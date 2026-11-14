from core import *

# ============================================================
# AUTH ROUTES
# ============================================================
@app.post("/api/auth/register")
def register():
    """Register a new customer or merchant account."""
    data = request.get_json(force=True)
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "customer")
    pin = data.get("pin")
    shop = data.get("shop")

    if not name or not email or not password:
        return jsonify({"error": "Name, email, password are required"}), 400
    if role == "customer" and (not isinstance(pin, str) or len(pin) != 4 or not pin.isascii() or not pin.isdigit()):
        return jsonify({"error": "Customer PIN must be exactly 4 digits"}), 400
    if len(password.encode()) > 72 or len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters and at most 72 bytes"}), 400
    if role not in ("customer", "merchant"):
        return jsonify({"error": "Role must be customer or merchant"}), 400

    db = get_db()
    if db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        return jsonify({"error": "Email already registered"}), 409

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cur = db.execute(
        "INSERT INTO users (name,email,password_hash,role,pin,wallet_balance,merchant_shop,created_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (name, email, pw_hash, role, bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode() if pin else None, 0.0, shop if role == "merchant" else None, now),
    )
    if role == "merchant":
        db.execute("UPDATE users SET account_status='pending' WHERE id=?", (cur.lastrowid,))
    db.commit()
    return jsonify({"id": cur.lastrowid, "message": "Account created. Merchants require admin approval before login." if role == "merchant" else "Account created. Please log in."}), 201


@app.post("/api/auth/login")
def login():
    """Authenticate and return a JWT plus a safe user object."""
    data = request.get_json(force=True)
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    db = get_db()
    principal = (request.remote_addr or "unknown") + ":" + email
    window=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=config.LOGIN_WINDOW_MINUTES)).isoformat()
    count=db.execute("SELECT COUNT(*) FROM login_failures WHERE principal=? AND datetime(created_at)>=datetime(?)",(principal,window)).fetchone()[0]
    if count>=config.LOGIN_MAX_FAILURES: return jsonify({"error":"Too many attempts. Try again in 15 minutes."}),429
    row = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not isinstance(password,str) or len(password.encode())>72 or not row or not bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        db.execute("INSERT INTO login_failures(principal,created_at) VALUES(?,?)",(principal,datetime.datetime.now(datetime.timezone.utc).isoformat()));db.commit()
        return jsonify({"error": "Invalid email or password"}), 401
    db.execute("DELETE FROM login_failures WHERE principal=?",(principal,));db.commit()

    if row["account_status"] != "active":
        return jsonify({"error": "Account is suspended or awaiting approval"}), 403
    token = create_jwt(row["id"], row["role"])
    user = user_to_dict(row)
    # Never send the password hash to the client
    user.pop("password_hash", None)
    response=jsonify({"user":user, **({"token":token} if app.testing else {})})
    response.set_cookie("palmpay_session",token,httponly=True,secure=request.is_secure,samesite="Strict",max_age=JWT_EXP_HOURS*3600,path="/")
    return response

@app.post("/api/auth/logout")
def logout():
    response=jsonify({"message":"Signed out"}); response.delete_cookie("palmpay_session",path="/",samesite="Strict");return response


@app.get("/api/auth/me")
@auth_required()
def me():
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE id=?", (request.current_user["id"],)).fetchone()
    if not row:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user_to_dict(row)})


