from core import *

# ============================================================
# WALLET ROUTES
# ============================================================
@app.get("/api/wallet/balance")
@auth_required(roles=["customer"])
def wallet_balance():
    db = get_db()
    row = db.execute(
        "SELECT wallet_balance FROM users WHERE id=?", (request.current_user["id"],)
    ).fetchone()
    return jsonify({"balance": row["wallet_balance"]})


@app.post("/api/wallet/topup")
@auth_required(roles=["customer"])
def wallet_topup():
    """Top up the wallet using a simulated bKash/Nagad/Card payment."""
    data = request.get_json(force=True) or {}
    try:
        amount = money(data.get("amount"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    method = data.get("method", "bkash")
    if method not in ("bkash", "nagad", "card"):
        return jsonify({"error": "Invalid top-up method"}), 400
    if amount <= 0:
        return jsonify({"error": "Top-up amount must be greater than 0"}), 400
    if amount > 50000:
        return jsonify({"error": "Top-up capped at ৳50,000 for the demo"}), 400

    idem = data.get("idempotency_key")
    if not isinstance(idem,str) or not 12 <= len(idem) <= 128:
        return jsonify({"error":"A stable top-up key is required"}),400
    db=get_db(); db.execute("BEGIN IMMEDIATE")
    existing=db.execute("SELECT * FROM transactions WHERE idempotency_key=?",(idem,)).fetchone()
    if existing:
        if existing["user_id"] != request.current_user["id"] or existing["type"] != "topup" or existing["amount"] != amount or existing["method"] != method:
            db.rollback(); return jsonify({"error":"Top-up key already in use"}),409
        balance=db.execute("SELECT wallet_balance FROM users WHERE id=?",(request.current_user["id"],)).fetchone()[0]
        db.commit(); return jsonify({"tx_id":existing["id"],"method":method,"amount":amount,"new_balance":balance,"message":"Already processed"})
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    post_money(db,request.current_user["id"],poisha(amount),"topup",idem,now)
    cur=db.execute("INSERT INTO transactions(user_id,type,amount,status,idempotency_key,palm_matched,created_at,method) VALUES(?,'topup',?,'success',?,0,?,?)",(request.current_user["id"],amount,idem,now,method))
    db.execute("UPDATE transactions SET amount_p=? WHERE id=?",(poisha(amount),cur.lastrowid))
    new_balance=db.execute("SELECT wallet_balance FROM users WHERE id=?",(request.current_user["id"],)).fetchone()[0]
    db.commit()
    return jsonify({"tx_id":cur.lastrowid,"method":method,"amount":amount,"new_balance":new_balance,"message":"Simulated top-up completed"})


