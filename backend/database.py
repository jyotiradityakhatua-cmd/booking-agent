import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "bookings.db"


def init_db():
    with get_conn() as conn:

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                title TEXT NOT NULL,
                messages_json TEXT NOT NULL,
                booking_context_json TEXT NOT NULL,
                last_checked_date TEXT,
                updated_at TEXT NOT NULL
            )
            """
        )

        try:
            conn.execute("ALTER TABLE bookings ADD COLUMN username TEXT DEFAULT 'guest'")
        except sqlite3.OperationalError:
            pass


        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL DEFAULT 'guest',
                date TEXT NOT NULL,
                time_slot TEXT NOT NULL,
                patient_name TEXT,
                problem TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(date, time_slot)
            )
            """
        )
        conn.commit()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
