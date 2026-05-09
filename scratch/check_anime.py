import sys
import os
sys.path.append(os.getcwd())

from sqlmodel import Session, select
from database import Recommendation, engine

def check_anime():
    with Session(engine) as session:
        anime_recs = session.exec(select(Recommendation).where(Recommendation.type == 'Anime')).all()
        print(f"Anime recommendations: {len(anime_recs)}")
        for r in anime_recs:
            print(f"- {r.title} | Status: {r.status} | Recommender: {r.recommender_name}")

if __name__ == "__main__":
    check_anime()
