import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def migrate():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found in .env")
        return

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg2://", 1)

    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        print("Adding 'is_manual_rating' column to 'mediaitem' table...")
        try:
            conn.execute(text("ALTER TABLE mediaitem ADD COLUMN is_manual_rating BOOLEAN DEFAULT FALSE;"))
            conn.commit()
            print("Successfully added 'is_manual_rating' column.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Column already exists. Skipping.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    migrate()
