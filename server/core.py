"""
==============================================================
 PalmPay - Palm Vein Payment System (Backend)
==============================================================
A lightweight Flask + SQLite demo backend for biometric payments.

Features:
  - Auto-creates SQLite DB + seed data on first run (zero setup)
  - JWT auth + bcrypt password hashing
  - Simulated palm-vein scanner using 128-dim vectors
  - Cosine similarity matching (threshold 0.90)
  - Atomic wallet->merchant transfer with idempotency keys
  - Roles: Customer, Merchant, Admin

Run on Windows (inside VS Code terminal):
    python -m venv venv
    venv\\Scripts\\activate
    pip install -r requirements.txt
    python app.py
Server starts at http://127.0.0.1:5000
==============================================================
"""

import os
import json
import math
import random
import secrets
import datetime
import sqlite3
import hashlib
import hmac
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo
from cryptography.fernet import Fernet

import bcrypt
import jwt
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import config

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------
app = Flask(__name__)
CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)

KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".demo_key")
if not os.path.exists(KEY_PATH):
    with open(KEY_PATH, "xb") as key_file:
        key_file.write(Fernet.generate_key())
with open(KEY_PATH, "rb") as key_file:
    KEY = key_file.read()
fernet = Fernet(KEY)
JWT_SECRET = os.environ.get("PALMPAY_JWT_SECRET", KEY.decode())
JWT_ALG = "HS256"
JWT_EXP_HOURS = 12

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("PALMPAY_DB", os.path.join(BASE_DIR, "palmpay.db"))

PALM_VECTOR_DIM = 128
SIMILARITY_THRESHOLD = 0.90  # minimum cosine similarity for a successful match


# ============================================================
# Database helpers
# ============================================================
def get_db():
    """Return a per-request SQLite connection stored on Flask's `g`."""
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
    return db


@app.teardown_appcontext
def close_db(error):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def encrypt_template(vector):
    return fernet.encrypt(json.dumps(vector).encode()).decode()

def decrypt_template(value):
    return json.loads(fernet.decrypt(value.encode()).decode())

def init_db():
    """Create all tables and seed initial demo data (idempotent)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # --- Users ---
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL CHECK(role IN ('customer','merchant','admin')),
            pin           TEXT,                       -- 4-digit PIN fallback for customers
            wallet_balance REAL NOT NULL DEFAULT 0,  -- in BDT
            merchant_shop TEXT,                       -- shop name for merchants
            created_at    TEXT NOT NULL
        )
        """
    )

    # --- Palm templates (encrypted-style blob; we store JSON of the vector) ---
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS palm_templates (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            template    TEXT NOT NULL,                -- JSON: 128-dim vector
            scan_count  INTEGER NOT NULL,             -- how many scans were averaged
            status      TEXT NOT NULL DEFAULT 'active',
            created_at  TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    # --- Bills created by merchants ---
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS bills (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            merchant_id INTEGER NOT NULL,
            amount      REAL NOT NULL,
            description TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'unpaid',  -- unpaid / paid / cancelled
            created_at  TEXT NOT NULL,
            paid_at     TEXT,
            FOREIGN KEY(merchant_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    # --- Transactions (wallet movements) ---
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,                  -- customer (payer)
            merchant_id     INTEGER,                            -- merchant (payee), NULL for top-ups
            bill_id         INTEGER,
            type            TEXT NOT NULL,                       -- 'topup' | 'payment'
            amount          REAL NOT NULL,
            status          TEXT NOT NULL DEFAULT 'success',    -- success | failed | pending
            idempotency_key TEXT UNIQUE,                         -- prevents double payments
            palm_matched    INTEGER,                             -- 0/1 if palm was used to authorize
            similarity      REAL,                                -- cosine similarity at time of pay
            created_at      TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(merchant_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(bill_id) REFERENCES bills(id) ON DELETE SET NULL
        )
        """
    )

    # Migrate existing local demo databases. Keep .demo_key with the database.
    cols = {r[1] for r in cur.execute("PRAGMA table_info(users)")}
    if "account_status" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'")
    if "verification_enabled" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN verification_enabled INTEGER NOT NULL DEFAULT 1 CHECK(verification_enabled IN (0,1))")
    cols = {r[1] for r in cur.execute("PRAGMA table_info(transactions)")}
    if "method" not in cols:
        cur.execute("ALTER TABLE transactions ADD COLUMN method TEXT")
    cur.execute("""CREATE TABLE IF NOT EXISTS payment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL, bill_id INTEGER, amount REAL NOT NULL,
      description TEXT NOT NULL, idem TEXT NOT NULL UNIQUE, similarity REAL NOT NULL,
      status TEXT NOT NULL, code_encrypted TEXT, attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL, tx_id INTEGER, created_at TEXT NOT NULL)""")
    for pid, pin in cur.execute("SELECT id,pin FROM users WHERE pin IS NOT NULL").fetchall():
        if not pin.startswith("$2"):
            cur.execute("UPDATE users SET pin=? WHERE id=?", (bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode(),pid))
    for tid, template in cur.execute("SELECT id,template FROM palm_templates").fetchall():
        if template.startswith("["):
            cur.execute("UPDATE palm_templates SET template=? WHERE id=?", (encrypt_template(json.loads(template)),tid))
    conn.commit()

    # --- Seed data only if users table is empty ---
    cur.execute("SELECT COUNT(*) FROM users")
    seeded = cur.fetchone()[0] == 0
    if seeded:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        def hash_pw(plain: str) -> str:
            return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

        # Admin
        cur.execute(
            "INSERT INTO users (name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)",
            ("System Admin", "admin@palmpay.com", hash_pw("Admin@123"), "admin", now),
        )

        # Merchant
        cur.execute(
            "INSERT INTO users (name,email,password_hash,role,merchant_shop,created_at) VALUES (?,?,?,?,?,?)",
            ("Dhaka Fresh Mart", "shop@palmpay.com", hash_pw("Shop@123"), "merchant",
             "Dhaka Fresh Mart", now),
        )

        # Customer with wallet + PIN
        cur.execute(
            "INSERT INTO users (name,email,password_hash,role,pin,wallet_balance,created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            ("Rahim Ahmed", "rahim@palmpay.com", hash_pw("Rahim@123"), "customer",
             hash_pw("1234"), 5000.0, now),
        )

        # Give the demo customer a pre-enrolled palm template so they can pay immediately
        customer_id = cur.lastrowid
        template = [round(random.uniform(-1, 1), 4) for _ in range(PALM_VECTOR_DIM)]
        cur.execute(
            "INSERT INTO palm_templates (user_id, template, scan_count, status, created_at) "
            "VALUES (?,?,?,?,?)",
            (customer_id, encrypt_template(template), 3, "active", now),
        )

        conn.commit()
        print("[Palmpay] Seeded admin, merchant, customer (rahim@palmpay.com).")

    # Integer-poisha fields are authoritative; old REAL columns are compatibility mirrors.
    for table, column, old in [("users","wallet_p","wallet_balance"),("transactions","amount_p","amount"),("bills","amount_p","amount"),("payment_requests","amount_p","amount")]:
        cols = {r[1] for r in cur.execute("PRAGMA table_info("+table+")")}
        if column not in cols:
            cur.execute("ALTER TABLE "+table+" ADD COLUMN "+column+" INTEGER NOT NULL DEFAULT 0")
            cur.execute("UPDATE "+table+" SET "+column+"=CAST(ROUND("+old+"*100) AS INTEGER)")
    if seeded: cur.execute("UPDATE users SET wallet_p=CAST(ROUND(wallet_balance*100) AS INTEGER)")
    cur.execute("""CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL,
        delta_p INTEGER NOT NULL, kind TEXT NOT NULL, reference TEXT NOT NULL, created_at TEXT NOT NULL)""")
    # Opening balances are explicitly marked; older transactions cannot be reconstructed reliably.
    cur.execute("""INSERT INTO ledger(user_id,delta_p,kind,reference,created_at)
        SELECT id,wallet_p,'opening_balance','migration',? FROM users
        WHERE wallet_p != 0 AND NOT EXISTS(SELECT 1 FROM ledger WHERE ledger.user_id=users.id)""", (datetime.datetime.now(datetime.timezone.utc).isoformat(),))
    cur.execute("CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT,'ledger is append-only'); END")
    cur.execute("CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT,'ledger is append-only'); END")
    cur.execute("CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
    for k,v in [("session_epoch",secrets.token_hex(16)),("approval_threshold_p","100000"),("per_payment_limit_p","5000000"),("daily_limit_p","10000000"),("scanner_mode","demo"),("match_cutoff","0.90")]:
        cur.execute("INSERT OR IGNORE INTO settings(name,value) VALUES (?,?)", (k,v))
    cur.execute("CREATE TABLE IF NOT EXISTS scan_events(id INTEGER PRIMARY KEY,customer_id INTEGER,merchant_id INTEGER,outcome TEXT NOT NULL,similarity REAL,created_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0)")
    if 'used' not in {r[1] for r in cur.execute('PRAGMA table_info(scan_events)')}: cur.execute('ALTER TABLE scan_events ADD COLUMN used INTEGER NOT NULL DEFAULT 0')
    for col,spec in [('auth_method',"TEXT NOT NULL DEFAULT 'palm'"),('pin_verified','INTEGER NOT NULL DEFAULT 0'),('pin_attempts','INTEGER NOT NULL DEFAULT 0')]:
        if col not in {r[1] for r in cur.execute('PRAGMA table_info(payment_requests)')}: cur.execute('ALTER TABLE payment_requests ADD COLUMN '+col+' '+spec)
    cur.execute("CREATE TABLE IF NOT EXISTS login_failures(id INTEGER PRIMARY KEY,principal TEXT NOT NULL,created_at TEXT NOT NULL)")
    cur.execute("CREATE TABLE IF NOT EXISTS refunds(id INTEGER PRIMARY KEY, original_tx_id INTEGER NOT NULL UNIQUE, refund_tx_id INTEGER NOT NULL, created_at TEXT NOT NULL)")
    cur.execute("""CREATE TABLE IF NOT EXISTS demo_devices (
        id INTEGER PRIMARY KEY, device_code TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL, merchant_id INTEGER NOT NULL REFERENCES users(id),
        location_name TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
        demo_status TEXT NOT NULL CHECK(demo_status IN ('active','inactive'))
    )""")
    if seeded:
        seed_additional_demo_data(conn)
    conn.commit(); conn.close()


def seed_additional_demo_data(conn):
    """Add synthetic accounts/devices once, without updating existing records.

    Call only on fresh database creation or by explicit local opt-in script.
    """
    from functools import lru_cache
    @lru_cache(maxsize=None)
    def fixture_hash(value):
        return bcrypt.hashpw(value.encode(), bcrypt.gensalt()).decode()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    customers = [
        ('Ayesha Khan', 'ayesha@palmpay.com'),
        ('Karim Hasan', 'karim@palmpay.com'),
    ]
    merchants = [
        ('Dhanmondi Demo Store', 'dhanmondi@palmpay.com', 'Dhanmondi Demo Store'),
        ('Gulshan Demo Store', 'gulshan@palmpay.com', 'Gulshan Demo Store'),
        ('Mirpur Demo Store', 'mirpur@palmpay.com', 'Mirpur Demo Store'),
        ('Uttara Demo Store', 'uttara@palmpay.com', 'Uttara Demo Store'),
    ]
    for name, email in customers:
        if conn.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
            continue
        cur = conn.execute("INSERT INTO users(name,email,password_hash,role,pin,wallet_balance,wallet_p,created_at) VALUES(?,?,?,'customer',?,3000,300000,?)", (name,email,fixture_hash('Demo@123'),fixture_hash('1234'),now))
        uid = cur.lastrowid
        template = [round(random.uniform(-1,1),4) for _ in range(PALM_VECTOR_DIM)]
        conn.execute("INSERT INTO palm_templates(user_id,template,scan_count,status,created_at) VALUES(?,?,3,'active',?)", (uid,encrypt_template(template),now))
        conn.execute("INSERT INTO ledger(user_id,delta_p,kind,reference,created_at) VALUES(?,300000,'opening_balance','demo_seed',?)", (uid,now))
    for name, email, shop in merchants:
        if not conn.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
            conn.execute("INSERT INTO users(name,email,password_hash,role,merchant_shop,created_at) VALUES(?,?,?,'merchant',?,?)", (name,email,fixture_hash('Demo@123'),shop,now))
    devices = [
        ('DEMO-001','Demo terminal 1','shop@palmpay.com','Dhaka (sample)',23.8103,90.4125,'active'),
        ('DEMO-002','Demo terminal 2','dhanmondi@palmpay.com','Dhanmondi (sample)',23.7461,90.3742,'active'),
        ('DEMO-003','Demo terminal 3','gulshan@palmpay.com','Gulshan (sample)',23.7925,90.4078,'active'),
        ('DEMO-004','Demo terminal 4','mirpur@palmpay.com','Mirpur (sample)',23.8223,90.3654,'active'),
        ('DEMO-005','Demo terminal 5','uttara@palmpay.com','Uttara (sample)',23.8759,90.3795,'inactive'),
    ]
    for code, label, email, location, lat, lon, status in devices:
        merchant = conn.execute("SELECT id FROM users WHERE email=? AND role='merchant'", (email,)).fetchone()
        if merchant:
            conn.execute('INSERT OR IGNORE INTO demo_devices(device_code,label,merchant_id,location_name,latitude,longitude,demo_status) VALUES(?,?,?,?,?,?,?)', (code,label,merchant[0],location,lat,lon,status))


def setting(db, name):
    return db.execute("SELECT value FROM settings WHERE name=?",(name,)).fetchone()[0]

def poisha(value):
    return int(Decimal(str(value))*100)

def post_money(db, user_id, delta_p, kind, reference, now):
    db.execute("UPDATE users SET wallet_p=wallet_p+?, wallet_balance=(wallet_p+?)/100.0 WHERE id=?",(delta_p,delta_p,user_id))
    db.execute("INSERT INTO ledger(user_id,delta_p,kind,reference,created_at) VALUES(?,?,?,?,?)",(user_id,delta_p,kind,reference,now))

def spending_error(db, customer_id, amount_p):
    if amount_p > int(setting(db,"per_payment_limit_p")): return "Payment exceeds the per-payment limit"
    local=datetime.datetime.now(ZoneInfo("Asia/Dhaka")); day=local.date()
    start=datetime.datetime.combine(day,datetime.time.min,tzinfo=ZoneInfo("Asia/Dhaka")).astimezone(datetime.timezone.utc).isoformat()
    end=(datetime.datetime.combine(day+datetime.timedelta(days=1),datetime.time.min,tzinfo=ZoneInfo("Asia/Dhaka"))).astimezone(datetime.timezone.utc).isoformat()
    spent=db.execute("SELECT COALESCE(SUM(amount_p),0) FROM transactions WHERE user_id=? AND type='payment' AND status='success' AND datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?)",(customer_id,start,end)).fetchone()[0]
    if spent + amount_p > int(setting(db,"daily_limit_p")): return "Payment exceeds the daily limit"
    return None

# ============================================================
# Auth + helper utilities
# ============================================================
def create_jwt(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "epoch": setting(get_db(),"session_epoch"),
        "iat": datetime.datetime.now(datetime.timezone.utc),
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_jwt(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def auth_required(roles=None):
    """Flask decorator that checks a Bearer JWT and (optionally) the role."""
    def decorator(fn):
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            token = header.split(" ", 1)[1] if header.startswith("Bearer ") else request.cookies.get("palmpay_session", "")
            if not token: return jsonify({"error":"Sign in required"}),401
            payload = decode_jwt(token)
            if not payload:
                return jsonify({"error": "Invalid or expired token"}), 401
            if payload.get("epoch") != setting(get_db(),"session_epoch"): return jsonify({"error":"Session expired"}),401
            if roles and payload["role"] not in roles:
                return jsonify({"error": "Forbidden: insufficient role"}), 403
            account = get_db().execute("SELECT role, account_status FROM users WHERE id=?", (payload["sub"],)).fetchone()
            if not account or account["account_status"] != "active" or account["role"] != payload["role"]:
                return jsonify({"error": "Account is unavailable or not approved"}), 403
            # attach user info to the request for downstream handlers
            request.current_user = {
                "id": int(payload["sub"]),
                "role": payload["role"],
            }
            return fn(*args, **kwargs)
        wrapper.__name__ = fn.__name__
        return wrapper
    return decorator


def money(value):
    try:
        n = Decimal(str(value))
        if not n.is_finite() or n <= 0 or n > 50000 or n.as_tuple().exponent < -2:
            raise ValueError()
        return float(n)
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Amount must be between 0.01 and 50,000 with at most two decimals")

def cosine_similarity(v1, v2):
    """Cosine similarity between two equal-length numeric lists."""
    if len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(b * b for b in v2))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)


def gen_palm_vector():
    """Simulate a fresh palm scan: random 128-dim vector with some noise."""
    return [round(random.uniform(-1, 1), 4) for _ in range(PALM_VECTOR_DIM)]


def average_vectors(vectors):
    """Average multiple palm scans into one template (used during enrollment)."""
    n = len(vectors)
    return [round(sum(v[i] for v in vectors) / n, 4) for i in range(PALM_VECTOR_DIM)]


def user_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "wallet_balance": row["wallet_balance"],
        "merchant_shop": row["merchant_shop"],
        "pin_set": bool(row["pin"]),
        "created_at": row["created_at"],
    }


