import os
import sqlite3
from sqlalchemy import create_engine, text

# Check if we are using postgres or sqlite
database_url = os.environ.get("DATABASE_URL")

def migrate():
    if database_url:
        print("[*] Detected Postgres (likely Supabase). Running migration...")
        if database_url.startswith("postgres://"):
            db_url = database_url.replace("postgres://", "postgresql+psycopg2://", 1)
        else:
            db_url = database_url
            
        try:
            # We need psycopg2 for this to work with sqlalchemy postgres
            engine = create_engine(db_url)
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE mediaitem ADD COLUMN backdrop_url VARCHAR"))
                conn.commit()
                print("[+] Added backdrop_url to mediaitem table.")
        except Exception as e:
            print(f"[!] Migration error (might already exist or missing driver): {e}")
    else:
        print("[*] Detected SQLite. Running migration...")
        sqlite_file = "database.db"
        if os.path.exists(sqlite_file):
            conn = sqlite3.connect(sqlite_file)
            cursor = conn.cursor()
            try:
                cursor.execute("ALTER TABLE mediaitem ADD COLUMN backdrop_url TEXT")
                conn.commit()
                print("[+] Added backdrop_url to mediaitem table.")
            except Exception as e:
                print(f"[!] Migration error (might already exist): {e}")
            finally:
                conn.close()
        else:
            print("[!] database.db not found locally.")

if __name__ == "__main__":
    migrate()
