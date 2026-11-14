from core import *

# ============================================================
# BILLS (merchant)
# ============================================================
@app.post("/api/bills")
@auth_required(roles=["merchant"])
def bills_create():
    data = request.get_json(force=True) or {}
    try:
        amount = money(data.get("amount"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    description = data.get("description", "").strip()
    if amount <= 0 or not description:
        return jsonify({"error": "amount and description are required"}), 400

    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cur = db.execute(
        "INSERT INTO bills (merchant_id,amount,description,status,created_at) "
        "VALUES (?,?,?,?,?)",
        (request.current_user["id"], amount, description, "unpaid", now),
    )
    db.execute("UPDATE bills SET amount_p=? WHERE id=?",(poisha(amount),cur.lastrowid))
    db.commit()
    return jsonify({
        "bill_id": cur.lastrowid,
        "merchant_id": request.current_user["id"],
        "amount": amount,
        "description": description,
        "status": "unpaid",
        "created_at": now,
    })


@app.get("/api/bills")
@auth_required(roles=["merchant"])
def bills_list():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM bills WHERE merchant_id=? ORDER BY id DESC",
        (request.current_user["id"],),
    ).fetchall()
    return jsonify({"bills": [dict(r) for r in rows]})


