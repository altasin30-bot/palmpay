"""PalmPay demo entry point. Route modules register on the shared Flask app."""
import os
from flask import send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix
from core import *
import routes_auth, routes_palm, routes_wallet, routes_history, routes_bills, routes_payments, routes_admin, routes_features

# Behind Render's HTTPS proxy: trust X-Forwarded-* headers so cookies get the Secure flag.
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Built React frontend (created by `npm run build` in client/).
DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "client", "dist")

@app.get("/api/health")
def health():
    return jsonify({"status":"ok","service":"PalmPay demo"})

# Serve the React app from the same server, so one link opens the whole software.
@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def spa(path):
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    if path and os.path.isfile(os.path.join(DIST, path)):
        return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")

if __name__ == "__main__":
    init_db()
    print("PalmPay demo: http://127.0.0.1:5000 (no real money or biometrics)")
    app.run(host="127.0.0.1", port=5000, debug=False)
