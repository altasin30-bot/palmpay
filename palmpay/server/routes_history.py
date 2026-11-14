from core import *

# ============================================================
# TRANSACTIONS (history)
# ============================================================
@app.get("/api/transactions")
@auth_required(roles=["customer", "merchant", "admin"])
def list_transactions():
    """Return role-filtered transaction history."""
    db = get_db()
    role = request.current_user["role"]
    uid = request.current_user["id"]

    if role == "customer":
        rows = db.execute(
            "SELECT t.*, u.name AS merchant_name FROM transactions t "
            "LEFT JOIN users u ON t.merchant_id = u.id "
            "WHERE t.user_id=? ORDER BY t.id DESC", (uid,)
        ).fetchall()
    elif role == "merchant":
        rows = db.execute(
            "SELECT t.*, u.name AS customer_name FROM transactions t "
            "LEFT JOIN users u ON t.user_id = u.id "
            "WHERE t.merchant_id=? ORDER BY t.id DESC", (uid,)
        ).fetchall()
    else:  # admin
        rows = db.execute(
            "SELECT t.*, cu.name AS customer_name, mu.name AS merchant_name "
            "FROM transactions t "
            "LEFT JOIN users cu ON t.user_id = cu.id "
            "LEFT JOIN users mu ON t.merchant_id = mu.id "
            "ORDER BY t.id DESC"
        ).fetchall()

    return jsonify({"transactions": [dict(r) for r in rows]})


