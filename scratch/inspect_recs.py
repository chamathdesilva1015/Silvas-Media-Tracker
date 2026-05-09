import sys
import os
sys.path.append(os.getcwd())

from sqlmodel import Session, select
from database import Recommendation, engine

def inspect_recs():
    with Session(engine) as session:
        recs = session.exec(select(Recommendation).order_by(Recommendation.date_added.desc()).limit(20)).all()
        print(f"Top 20 Recommendations:")
        for r in recs:
            print(f"- {r.title} | Type: {r.type} | Status: {r.status} | Recommender: {r.recommender_name}")

if __name__ == "__main__":
    inspect_recs()
