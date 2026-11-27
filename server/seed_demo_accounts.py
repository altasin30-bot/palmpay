"""Opt-in: add synthetic accounts/devices to an existing local demo database."""
from core import init_db, seed_additional_demo_data, DB_PATH
import sqlite3
from contextlib import closing

if __name__ == '__main__':
    init_db()
    with closing(sqlite3.connect(DB_PATH)) as db, db:
        seed_additional_demo_data(db)
    print('Demo accounts and devices added where missing; existing records were not changed.')
