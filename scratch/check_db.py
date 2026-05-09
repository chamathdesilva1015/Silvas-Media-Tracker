from database import engine
from sqlalchemy import inspect

inspector = inspect(engine)
print(f"Engine: {engine.url}")
print(f"Tables: {inspector.get_table_names()}")

for table in inspector.get_table_names():
    print(f"\nColumns in {table}:")
    for col in inspector.get_columns(table):
        print(f"  {col['name']} ({col['type']})")
