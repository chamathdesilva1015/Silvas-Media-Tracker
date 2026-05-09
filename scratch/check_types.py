import sys
import os
sys.path.append(os.getcwd())

from sqlmodel import Session, select
from database import Recommendation, engine

def check_all_types():
    with Session(engine) as session:
        recs = session.exec(select(Recommendation)).all()
        counts = {}
        for r in recs:
            counts[r.type] = counts.get(r.type, 0) + 1
        print("Recommendation counts by type:")
        for t, c in counts.items():
            print(f"- {t}: {c}")

if __name__ == "__main__":
    check_all_types()
