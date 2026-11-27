from core import *
from scanner import get_scanner, ScannerUnavailable, similarity

# ============================================================
# PAYMENTS (atomic + idempotent)
# ============================================================
@app.get("/api/payments/demo-customers")
@auth_required(roles=["merchant"])
def demo_customers():
    rows = get_db().execute("SELECT DISTINCT u.id,u.name FROM users u JOIN palm_templates p ON p.user_id=u.id WHERE u.role='customer' AND u.account_status='active' AND p.status='active' ORDER BY u.name").fetchall()
    return jsonify({"customers": [dict(r) for r in rows]})

def expire_requests(db):
    db.execute("UPDATE payment_requests SET status='expired',code_encrypted=NULL WHERE status='pending' AND expires_at<=?", (datetime.datetime.now(datetime.timezone.utc).isoformat(),))

def request_result(r):
    return {"request_id":r["id"], "status":r["status"], "amount":r["amount"], "description":r["description"], "customer_id":r["customer_id"], "similarity":r["similarity"], "tx_id":r["tx_id"], "expires_at":r["expires_at"], "matched":r["auth_method"]=='palm', "pin_required":r["auth_method"]=='pin' and not r["pin_verified"]}

def complete_request(db, r):
    # Caller holds BEGIN IMMEDIATE; all checks and wallet updates are serialized.
    if r["status"] != "pending": return "Request is no longer pending"
    customer = db.execute("SELECT wallet_p,account_status FROM users WHERE id=? AND role='customer'", (r["customer_id"],)).fetchone()
    merchant = db.execute("SELECT account_status FROM users WHERE id=? AND role='merchant'", (r["merchant_id"],)).fetchone()
    if not customer or customer["account_status"] != "active" or not merchant or merchant["account_status"] != "active": return "Account unavailable"
    if customer["wallet_p"] < r["amount_p"]: return "Insufficient wallet balance"
    limit_error=spending_error(db,r["customer_id"],r["amount_p"])
    if limit_error: return limit_error
    if r["bill_id"]:
        bill=db.execute("SELECT status FROM bills WHERE id=? AND merchant_id=?", (r["bill_id"],r["merchant_id"])).fetchone()
        if not bill or bill["status"] != "unpaid": return "Bill no longer unpaid"
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    post_money(db,r["customer_id"],-r["amount_p"],"payment",r["idem"],now)
    post_money(db,r["merchant_id"],r["amount_p"],"payment",r["idem"],now)
    cur=db.execute("INSERT INTO transactions(user_id,merchant_id,bill_id,type,amount,status,idempotency_key,palm_matched,similarity,created_at) VALUES(?,?,?,'payment',?,'success',?,?,?,?)",(r["customer_id"],r["merchant_id"],r["bill_id"],r["amount"],r["idem"],1 if r["auth_method"]=='palm' else 0,r["similarity"],now))
    db.execute("UPDATE transactions SET amount_p=? WHERE id=?",(r["amount_p"],cur.lastrowid))
    if r["bill_id"]: db.execute("UPDATE bills SET status='paid',paid_at=? WHERE id=?",(now,r["bill_id"]))
    db.execute("UPDATE payment_requests SET status='success',code_encrypted=NULL,tx_id=? WHERE id=?",(cur.lastrowid,r["id"]))
    return None

@app.post("/api/payments/process")
@auth_required(roles=["merchant"])
def payments_process():
    data=request.get_json(silent=True) or {}; db=get_db(); merchant=request.current_user["id"]
    idem=data.get("idempotency_key")
    if not isinstance(idem,str) or not 12 <= len(idem) <= 128: return jsonify({"error":"A stable payment idempotency key is required"}),400
    try: customer_id=int(data.get("customer_id"))
    except (TypeError,ValueError): return jsonify({"error":"Select a demo customer"}),400
    mode=data.get("mode")
    if mode not in ("success","unrecognized","poor_lighting","pin_fallback"): return jsonify({"error":"Invalid demo scan mode"}),400
    try:
        db.execute("BEGIN IMMEDIATE"); expire_requests(db)
        old=db.execute("SELECT * FROM payment_requests WHERE idem=?",(idem,)).fetchone()
        if old:
            same_bill = str(old["bill_id"] or "") == str(data.get("bill_id") or "")
            same_manual = bool(old["bill_id"]) or (money(data.get("amount")) == old["amount"] and str(data.get("description") or "Palm payment")[:200] == old["description"])
            if old["merchant_id"] != merchant or old["customer_id"] != customer_id or not same_bill or not same_manual:
                db.rollback(); return jsonify({"error":"Payment key already used for different details"}),409
            result=request_result(old); db.commit(); return jsonify(result)
        customer=db.execute("SELECT u.id,u.name,u.wallet_p,u.verification_enabled,p.template FROM users u JOIN palm_templates p ON p.user_id=u.id WHERE u.id=? AND u.role='customer' AND u.account_status='active' AND p.status='active'",(customer_id,)).fetchone()
        if not customer: db.rollback(); return jsonify({"error":"Active enrolled customer not found"}),400
        if mode=='pin_fallback':
            if setting(db,'scanner_mode') != 'demo': db.rollback(); return jsonify({'error':'PIN fallback unavailable until a real scanner is integrated'}),503
            cutoff=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=2)).isoformat()
            failed=db.execute("SELECT id FROM scan_events WHERE customer_id=? AND merchant_id=? AND outcome!='success' AND used=0 AND datetime(created_at)>=datetime(?) ORDER BY id DESC LIMIT 1",(customer_id,merchant,cutoff)).fetchone()
            if not failed: db.rollback(); return jsonify({'error':'A recent failed scan is required before PIN fallback'}),400
            db.execute('UPDATE scan_events SET used=1 WHERE id=?',(failed['id'],)); score=0.0
        else:
            templates=db.execute("SELECT user_id,template FROM palm_templates WHERE status='active'").fetchall()
            try:
                vector,quality=get_scanner(setting(db,"scanner_mode")).capture(mode,decrypt_template(customer["template"]))
            except ScannerUnavailable as exc: db.rollback(); return jsonify({"error":str(exc)}),503
            scores=sorted([(similarity(vector,decrypt_template(t["template"])),t["user_id"]) for t in templates],reverse=True) if vector else []
            score=scores[0][0] if scores else 0.0
            runner=scores[1][0] if len(scores)>1 else -1.0
            matched=bool(scores and scores[0][1]==customer_id and score>=float(setting(db,"match_cutoff")) and score-runner>=0.05 and quality=='ok')
            now_str=datetime.datetime.now(datetime.timezone.utc).isoformat()
            outcome='success' if matched else ('poor_lighting' if quality=='poor_lighting' else 'unrecognized')
            db.execute("INSERT INTO scan_events(customer_id,merchant_id,outcome,similarity,created_at) VALUES(?,?,?,?,?)",(customer_id,merchant,outcome,score,now_str))
            if not matched:
                last_success=db.execute("SELECT COALESCE(MAX(id),0) FROM scan_events WHERE customer_id=? AND outcome='success'",(customer_id,)).fetchone()[0]
                failed=db.execute("SELECT COUNT(*) FROM scan_events WHERE customer_id=? AND outcome!='success' AND id>?",(customer_id,last_success)).fetchone()[0]
                if failed>=3: db.execute("UPDATE users SET account_status='scan_locked' WHERE id=?",(customer_id,))
                db.commit(); return jsonify({"matched":False,"similarity":round(score,4),"error":("Poor lighting: retry scan" if quality=='poor_lighting' else "Palm not recognized or match ambiguous") + ("; account locked for admin review" if failed>=3 else "")}),400
        bill_id=data.get("bill_id")
        if bill_id:
            bill=db.execute("SELECT * FROM bills WHERE id=? AND merchant_id=?",(bill_id,merchant)).fetchone()
            if not bill or bill["status"] != 'unpaid': db.rollback(); return jsonify({"error":"Bill not found or no longer unpaid"}),400
            amount=money(bill["amount"]); desc=bill["description"]
        else:
            amount=money(data.get("amount")); desc=str(data.get("description") or "Palm payment")[:200]
        if customer["wallet_p"] < poisha(amount): db.rollback(); return jsonify({"error":"Insufficient wallet balance"}),400
        limit_error=spending_error(db,customer_id,poisha(amount))
        if limit_error: db.rollback(); return jsonify({"error":limit_error}),400
        now=datetime.datetime.now(datetime.timezone.utc); expiry=(now+datetime.timedelta(minutes=2)).isoformat()
        code=f"{secrets.randbelow(1000000):06d}" if customer["verification_enabled"] else None
        cur=db.execute("INSERT INTO payment_requests(merchant_id,customer_id,bill_id,amount,description,idem,similarity,status,code_encrypted,expires_at,created_at) VALUES(?,?,?,?,?,?,?,'pending',?,?,?)",(merchant,customer_id,bill_id,amount,desc,idem,round(score,4),fernet.encrypt(code.encode()).decode() if code else None,expiry,now.isoformat()))
        db.execute("UPDATE payment_requests SET amount_p=?,auth_method=? WHERE id=?",(poisha(amount),'pin' if mode=='pin_fallback' else 'palm',cur.lastrowid))
        r=db.execute("SELECT * FROM payment_requests WHERE id=?",(cur.lastrowid,)).fetchone()
        if not code and mode!='pin_fallback':
            error=complete_request(db,r)
            if error: db.rollback(); return jsonify({"error":error}),400
        r=db.execute("SELECT * FROM payment_requests WHERE id=?",(r["id"],)).fetchone(); result=request_result(r); db.commit(); return jsonify(result)
    except ValueError as exc: db.rollback(); return jsonify({"error":str(exc)}),400
    except sqlite3.Error: db.rollback(); app.logger.exception("Payment failed"); return jsonify({"error":"Payment could not be processed"}),500

@app.get("/api/payments/pending")
@auth_required(roles=["customer"])
def customer_pending():
    db=get_db(); expire_requests(db); db.commit()
    rows=db.execute("SELECT r.*,u.name AS merchant_name FROM payment_requests r JOIN users u ON u.id=r.merchant_id WHERE r.customer_id=? AND r.status='pending' ORDER BY r.id DESC",(request.current_user["id"],)).fetchall()
    return jsonify({"requests":[{**request_result(r),"merchant_name":r["merchant_name"],"code":fernet.decrypt(r["code_encrypted"].encode()).decode() if r["code_encrypted"] and (r["auth_method"]!='pin' or r["pin_verified"]) else None} for r in rows]})

@app.post("/api/payments/<int:rid>/decline")
@auth_required(roles=["customer"])
def decline_request(rid):
    db=get_db(); expire_requests(db)
    cur=db.execute("UPDATE payment_requests SET status='declined',code_encrypted=NULL WHERE id=? AND customer_id=? AND status='pending'",(rid,request.current_user["id"]))
    db.commit(); return (jsonify({"status":"declined"}),200) if cur.rowcount else (jsonify({"error":"Request unavailable"}),404)

@app.get("/api/payments/<int:rid>")
@auth_required(roles=["merchant"])
def payment_status(rid):
    db=get_db(); expire_requests(db); db.commit()
    r=db.execute("SELECT * FROM payment_requests WHERE id=? AND merchant_id=?",(rid,request.current_user["id"])).fetchone()
    return jsonify(request_result(r)) if r else (jsonify({"error":"Request not found"}),404)

@app.post("/api/payments/<int:rid>/confirm")
@auth_required(roles=["merchant"])
def confirm_payment(rid):
    data=request.get_json(silent=True) or {}; code=data.get("code",""); db=get_db()
    db.execute("BEGIN IMMEDIATE"); expire_requests(db)
    r=db.execute("SELECT * FROM payment_requests WHERE id=? AND merchant_id=?",(rid,request.current_user["id"])).fetchone()
    if not r: db.rollback(); return jsonify({"error":"Request not found"}),404
    if r["status"] != 'pending': result=request_result(r); db.commit(); return jsonify(result)
    if r["auth_method"]=='pin' and not r["pin_verified"]: db.commit(); return jsonify({"error":"Waiting for the customer to verify their PIN"}),400
    if not r["code_encrypted"]: db.commit(); return jsonify({"error":"Waiting for the customer"}),400
    correct=fernet.decrypt(r["code_encrypted"].encode()).decode()
    if not isinstance(code,str) or len(code)!=6 or not code.isascii() or not code.isdigit() or not hmac.compare_digest(code,correct):
        attempts=r["attempts"]+1; db.execute("UPDATE payment_requests SET attempts=?,status=?,code_encrypted=CASE WHEN ?>=3 THEN NULL ELSE code_encrypted END WHERE id=?",(attempts,'cancelled' if attempts>=3 else 'pending',attempts,rid)); db.commit()
        return jsonify({"error":"Incorrect code" if attempts<3 else "Three incorrect codes; payment cancelled","attempts_remaining":max(0,3-attempts)}),400
    error=complete_request(db,r)
    if error: db.rollback(); return jsonify({"error":error}),400
    r=db.execute("SELECT * FROM payment_requests WHERE id=?",(rid,)).fetchone(); result=request_result(r); db.commit(); return jsonify(result)


@app.post('/api/payments/<int:rid>/verify-pin')
@auth_required(roles=['customer'])
def verify_payment_pin(rid):
    data=request.get_json(silent=True) or {}; pin=data.get('pin',''); db=get_db(); db.execute('BEGIN IMMEDIATE'); expire_requests(db)
    r=db.execute("SELECT * FROM payment_requests WHERE id=? AND customer_id=? AND status='pending' AND auth_method='pin'",(rid,request.current_user['id'])).fetchone()
    if not r: db.rollback(); return jsonify({'error':'Request unavailable'}),404
    if r['pin_verified']: db.commit(); return jsonify({'message':'PIN already verified'})
    user=db.execute('SELECT pin FROM users WHERE id=?',(request.current_user['id'],)).fetchone()
    if not isinstance(pin,str) or len(pin)!=4 or not pin.isascii() or not pin.isdigit() or not user['pin'] or not bcrypt.checkpw(pin.encode(),user['pin'].encode()):
        attempts=r['pin_attempts']+1; db.execute("UPDATE payment_requests SET pin_attempts=?,status=CASE WHEN ?>=3 THEN 'cancelled' ELSE status END,code_encrypted=CASE WHEN ?>=3 THEN NULL ELSE code_encrypted END WHERE id=?",(attempts,attempts,attempts,rid));db.commit()
        return jsonify({'error':'Incorrect PIN' if attempts<3 else 'Three incorrect PINs; payment cancelled'}),400
    db.execute('UPDATE payment_requests SET pin_verified=1 WHERE id=?',(rid,));r=db.execute('SELECT * FROM payment_requests WHERE id=?',(rid,)).fetchone()
    if not r['code_encrypted']:
        error=complete_request(db,r)
        if error: db.rollback(); return jsonify({'error':error}),400
    db.commit();return jsonify({'message':'PIN verified'})
