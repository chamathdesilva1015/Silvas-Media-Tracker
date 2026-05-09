import sys
import os
sys.path.append(os.getcwd())

from main import get_recent_recommendations
from database import engine
from sqlmodel import Session

def test_api():
    with Session(engine) as session:
        recs = get_recent_recommendations("Movies", session)
        print(f"API Function returned: {len(recs)} items")
        for r in recs[:5]:
            print(f"- {r.title}")

if __name__ == "__main__":
    test_api()
