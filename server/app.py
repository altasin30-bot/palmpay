"""PalmPay demo entry point. Route modules register on the shared Flask app."""
from core import *
import routes_auth, routes_palm, routes_wallet, routes_history, routes_bills, routes_payments, routes_admin, routes_features

@app.get("/api/health")
def health():
    return jsonify({"status":"ok","service":"PalmPay demo"})

if __name__ == "__main__":
    init_db()
    print("PalmPay demo: http://127.0.0.1:5000 (no real money or biometrics)")
    app.run(host="127.0.0.1", port=5000, debug=False)
