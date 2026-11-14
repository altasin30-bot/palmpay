"""Entry point for gunicorn (used on Render): gunicorn wsgi:app"""
from app import app
from core import init_db

init_db()  # creates tables and demo accounts if they do not exist yet
