import time
from database import engine, MediaItem
from sqlmodel import Session, select
from tmdb_helper import fetch_external_ratings

def backfill(batch_size: int = 50, delay: float = 0.5):
    with Session(engine) as session:
        movies = session.exec(
            select(MediaItem)
            .where(MediaItem.type == "Movies", MediaItem.imdb_rating == None, MediaItem.tmdb_id != None)
            .limit(batch_size)
        ).all()

        print(f"[*] Found {len(movies)} movies to populate external ratings for...")
        for i, m in enumerate(movies, 1):
            try:
                print(f"[{i}/{len(movies)}] Fetching ratings for '{m.title}' ({m.release_year or '????'})...")
                ratings = fetch_external_ratings(m.title, m.tmdb_id, m.release_year)
                if ratings.get("imdb_rating"): m.imdb_rating = ratings["imdb_rating"]
                if ratings.get("rt_critics_score"): m.rt_critics_score = ratings["rt_critics_score"]
                if ratings.get("rt_audience_score"): m.rt_audience_score = ratings["rt_audience_score"]
                if ratings.get("letterboxd_rating"): m.letterboxd_rating = ratings["letterboxd_rating"]
                session.add(m)
                session.commit()
                print(f"    -> IMDb: {m.imdb_rating} | RT: {m.rt_critics_score} / {m.rt_audience_score} | LB: {m.letterboxd_rating}")
            except Exception as e:
                print(f"    [!] Error for '{m.title}': {e}")
            time.sleep(delay)

    print("[*] Backfill batch finished.")

if __name__ == "__main__":
    backfill(batch_size=10, delay=0.3)
