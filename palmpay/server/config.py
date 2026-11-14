"""Local demo defaults. Environment overrides are for controlled testing only."""
import os
CORS_ORIGINS = os.getenv('PALMPAY_CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',')
LOGIN_MAX_FAILURES = 5
LOGIN_WINDOW_MINUTES = 15
