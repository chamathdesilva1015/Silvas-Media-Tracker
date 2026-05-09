from database import engine
from sqlalchemy import text

cols_to_add = [
    ("cover_url", "VARCHAR"),
    ("genres", "TEXT"),
    ("director", "VARCHAR"),
    ("overview", "TEXT"),
    ("runtime", "INTEGER"),
    ("content_rating", "VARCHAR"),
    ("backdrop_url", "VARCHAR"),
    ("status", "VARCHAR DEFAULT 'pending'")
]

with engine.connect() as conn:
    print("Starting migration...")
    for col_name, col_type in cols_to_add:
        try:
            print(f"Adding column {col_name}...")
            conn.execute(text(f"ALTER TABLE recommendation ADD COLUMN {col_name} {col_type};"))
            conn.commit()
            print(f"Successfully added {col_name}")
        except Exception as e:
            print(f"Could not add {col_name} (it might already exist): {e}")
    print("Migration finished.")
