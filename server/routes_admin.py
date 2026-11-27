from core import *

# ============================================================
# ADMIN ROUTES
# ============================================================
@app.get("/api/admin/users")
@auth_required(roles=["admin"])
def admin_users():
    db = get_db()
    rows = db.execute(
        "SELECT id,name,email,role,wallet_balance,merchant_shop,created_at,account_status "
        "FROM users ORDER BY id"
    ).fetchall()
    users = []
    for r in rows:
        u = dict(r)
        # does this user have an enrolled palm template?
        tpl = db.execute(
            "SELECT id, scan_count, status, created_at FROM palm_templates "
            "WHERE user_id=? ORDER BY id DESC LIMIT 1", (r["id"],)
        ).fetchone()
        u["palm_template"] = dict(tpl) if tpl else None
        users.append(u)
    return jsonify({"users": users})


@app.delete("/api/admin/users/<int:user_id>")
@auth_required(roles=["admin"])
def admin_delete_user(user_id):
    db = get_db()
    row = db.execute("SELECT role FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        return jsonify({"error": "User not found"}), 404
    if row["role"] == "admin":
        return jsonify({"error": "Cannot delete admin user"}), 400
    db.execute("UPDATE users SET account_status='suspended' WHERE id=?", (user_id,))
    db.commit()
    return jsonify({"message": "User suspended; transaction history retained"})


@app.post("/api/admin/users/<int:user_id>/approve")
@auth_required(roles=["admin"])
def admin_approve(user_id):
    db=get_db(); cur=db.execute("UPDATE users SET account_status='active' WHERE id=? AND role='merchant' AND account_status='pending'",(user_id,)); db.commit()
    return (jsonify({"message":"Merchant approved"}),200) if cur.rowcount else (jsonify({"error":"Pending merchant not found"}),404)

@app.get("/api/admin/biometric")
@auth_required(roles=["admin"])
def admin_biometric():
    """Return metadata for all enrolled palm templates (encrypted-style preview)."""
    db = get_db()
    rows = db.execute(
        "SELECT p.id, p.user_id, u.name AS user_name, u.email, p.scan_count, "
        "p.status, p.created_at FROM palm_templates p "
        "JOIN users u ON p.user_id = u.id ORDER BY p.id"
    ).fetchall()
    templates = [{**dict(r), "dim": PALM_VECTOR_DIM} for r in rows]
    return jsonify({"templates": templates})


@app.get("/api/admin/reports")
@auth_required(roles=["admin"])
def admin_reports():
    """Aggregate stats for the admin dashboard charts."""
    db = get_db()
    total_users = db.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    total_customers = db.execute("SELECT COUNT(*) AS c FROM users WHERE role='customer'").fetchone()["c"]
    total_merchants = db.execute("SELECT COUNT(*) AS c FROM users WHERE role='merchant'").fetchone()["c"]
    total_admins = db.execute("SELECT COUNT(*) AS c FROM users WHERE role='admin'").fetchone()["c"]
    total_palm = db.execute("SELECT COUNT(*) AS c FROM palm_templates WHERE status='active'").fetchone()["c"]

    tx_summary = db.execute(
        "SELECT "
        " COUNT(*) AS total_tx, "
        " COALESCE(SUM(CASE WHEN type='payment' THEN amount ELSE 0 END),0) AS total_payments, "
        " COALESCE(SUM(CASE WHEN type='topup'   THEN amount ELSE 0 END),0) AS total_topups "
        "FROM transactions WHERE status='success'"
    ).fetchone()

    # daily volume (last 7 days) for the chart
    daily = db.execute(
        "SELECT substr(created_at,1,10) AS day, type, SUM(amount) AS total "
        "FROM transactions WHERE status='success' "
        "AND created_at >= date('now','-7 days') "
        "GROUP BY day, type ORDER BY day"
    ).fetchall()

    return jsonify({
        "users": {
            "total": total_users,
            "customers": total_customers,
            "merchants": total_merchants,
            "admins": total_admins,
        },
        "palm_templates": total_palm,
        "transactions": {
            "total": tx_summary["total_tx"],
            "total_payments": tx_summary["total_payments"],
            "total_topups": tx_summary["total_topups"],
        },
        "daily": [dict(r) for r in daily],
    })




@app.get('/api/admin/devices')
@auth_required(roles=['admin'])
def admin_demo_devices():
    """Only synthetic device inventory; no real connectivity is measured."""
    rows = get_db().execute("""SELECT d.id,d.device_code,d.label,d.location_name,d.latitude,
        d.longitude,d.demo_status,u.id AS merchant_id,u.name AS merchant_name,
        u.email AS merchant_email,u.merchant_shop,u.account_status AS merchant_status
        FROM demo_devices d JOIN users u ON u.id=d.merchant_id ORDER BY d.device_code""").fetchall()
    devices = [dict(r) for r in rows]
    return jsonify({'devices': devices, 'simulated_active_count': sum(d['demo_status']=='active' for d in devices), 'simulated': True})


@app.patch('/api/admin/users/<int:user_id>')
@auth_required(roles=['admin'])
def admin_update_user(user_id):
    """Edit a customer or merchant's basic contact details in the local demo."""
    import re
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or set(data) - {'name','email','merchant_shop'}:
        return jsonify({'error':'Provide only name, email and merchant shop'}), 400
    name, email = data.get('name'), data.get('email')
    if not isinstance(name,str) or not name.strip() or len(name.strip()) > 120:
        return jsonify({'error':'Name is required and must be at most 120 characters'}), 400
    if not isinstance(email,str):
        return jsonify({'error':'A valid email is required'}), 400
    email = email.strip().lower()
    if len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        return jsonify({'error':'A valid email is required'}), 400
    db = get_db()
    user = db.execute('SELECT role FROM users WHERE id=?', (user_id,)).fetchone()
    if not user: return jsonify({'error':'User not found'}), 404
    if user['role'] not in ('customer','merchant'):
        return jsonify({'error':'Only customer and merchant details can be edited here'}), 403
    shop = data.get('merchant_shop')
    if user['role'] == 'merchant':
        if not isinstance(shop,str) or not shop.strip() or len(shop.strip())>120:
            return jsonify({'error':'Merchant shop is required and must be at most 120 characters'}), 400
        shop = shop.strip()
    elif shop not in (None,''):
        return jsonify({'error':'Customers cannot have a merchant shop'}), 400
    else: shop = None
    try:
        db.execute('UPDATE users SET name=?,email=?,merchant_shop=? WHERE id=?', (name.strip(),email,shop,user_id))
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({'error':'Email is already in use'}), 409
    return jsonify({'message':'User details updated'})
