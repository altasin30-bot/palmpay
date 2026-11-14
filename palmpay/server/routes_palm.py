from core import *

# ============================================================
# PALM VEIN ROUTES
# ============================================================
@app.post("/api/palm/enroll")
@auth_required(roles=["customer"])
def palm_enroll():
    """
    Enroll a palm template by averaging 3 simulated scan samples.
    The client may also send 3 explicit vectors (for testing); if not, we
    generate 3 fresh samples on the server.
    """
    # `silent=True` returns None (no 400) when the body is empty / not JSON.
    data = request.get_json(silent=True) or {}
    samples = data.get("samples")  # optional list of 3 vectors
    if samples is not None and (not isinstance(samples,list) or len(samples)!=3 or any(not isinstance(v,list) or len(v)!=PALM_VECTOR_DIM or any(not isinstance(x,(float,int)) or isinstance(x,bool) or not math.isfinite(x) or abs(x)>10 for x in v) for v in samples)):
        return jsonify({"error": "Enrollment requires three valid 128-dimensional samples"}), 400

    if not samples:
        samples = [gen_palm_vector() for _ in range(3)]

    template = average_vectors(samples)
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    db.execute("UPDATE palm_templates SET status='replaced' WHERE user_id=? AND status='active'", (request.current_user["id"],))
    cur = db.execute(
        "INSERT INTO palm_templates (user_id,template,scan_count,status,created_at) "
        "VALUES (?,?,?,?,?)",
        (request.current_user["id"], encrypt_template(template), 3, "active", now),
    )
    db.commit()
    return jsonify({
        "template_id": cur.lastrowid,
        "scan_count": 3,
        "dim": PALM_VECTOR_DIM,
        "message": "Palm enrolled successfully",
    })


@app.delete("/api/palm/enroll")
@auth_required(roles=["customer"])
def delete_palm():
    db=get_db(); db.execute("DELETE FROM palm_templates WHERE user_id=?",(request.current_user["id"],)); db.commit()
    return jsonify({"message":"Simulated templates deleted"})

@app.post("/api/palm/scan")
@auth_required(roles=["customer", "merchant"])
def palm_scan():
    """
    Simulate a single palm scan and return the raw 128-dim vector.
    The frontend uses this vector when calling /api/palm/verify.
    """
    return jsonify({"vector": gen_palm_vector(), "dim": PALM_VECTOR_DIM})


@app.post("/api/palm/verify")
@auth_required(roles=["customer", "merchant"])
def palm_verify():
    return jsonify({"error":"Standalone verification is disabled in this demo; use the payment terminal."}), 410


