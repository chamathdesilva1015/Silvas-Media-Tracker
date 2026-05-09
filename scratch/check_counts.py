import sys
import os
sys.path.append(os.getcwd())

from sqlmodel import Session, select
from database import Recommendation, engine

def check_counts():
    with Session(engine) as session:
        discord_recs = session.exec(select(Recommendation).where(Recommendation.recommender_name == 'Discord')).all()
        all_recs = session.exec(select(Recommendation)).all()
        print(f"Total recommendations: {len(all_recs)}")
        print(f"Discord recommendations: {len(discord_recs)}")
        
        # Check by status
        pending = [r for r in all_recs if r.status == 'pending']
        print(f"Pending recommendations: {len(pending)}")
        
        # Check by category
        movies = [r for r in all_recs if r.type == 'Movies']
        print(f"Movie recommendations: {len(movies)}")

if __name__ == "__main__":
    check_counts()
