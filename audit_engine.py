"""
audit_engine.py — Retroactive Auditor: Phase 2 (Silent Scouts)
================================================================
Finds movies you have likely already watched but haven't logged.
Workflow: TMDB API → Delta Check → audit_queue table.

Scanners implemented:
  - Franchise Gap Scanner (runs on demand or on startup)
  - Blockbuster Hit Scanner (top-N by year)
  - Childhood Scan (animation/family by birth-year window)
  - Director Staples Scanner (filmographies of high-rated directors)
"""

import os
import time
import logging
import requests
from datetime import datetime
from thefuzz import fuzz
from sqlmodel import Session, select
from database import engine, AuditQueue, EternalBlacklist, MediaItem

# ─── Configuration ────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

TMDB_API_KEY    = os.getenv("TMDB_API_KEY", "")
TMDB_BASE       = "https://api.themoviedb.org/3"
FUZZY_THRESHOLD = 88        # Score (0-100) — above this = "already seen"
MIN_POPULARITY  = 20.0      # Ignore truly obscure films (too low-confidence)
BIRTH_YEAR      = int(os.getenv("USER_BIRTH_YEAR", "2003"))  # Used for childhood scan
FRANCHISE_MAX_SCAN = 500    # Max DB items to scan for franchise membership at once

logger = logging.getLogger("audit_engine")

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _tmdb_get(path: str, params: dict = None) -> dict:
    """Wrapper around TMDB API GET with basic error handling."""
    if not TMDB_API_KEY:
        raise RuntimeError("TMDB_API_KEY not set in .env")
    base_params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    if params:
        base_params.update(params)
    r = requests.get(f"{TMDB_BASE}{path}", params=base_params, timeout=10)
    r.raise_for_status()
    return r.json()


def _load_seen_set(session: Session) -> list[dict]:
    """Return all logged movies from the local DB as a list of dicts for fuzzy matching."""
    items = session.exec(
        select(MediaItem).where(MediaItem.type == "Movies")
    ).all()
    return [{"title": m.title, "year": m.release_year} for m in items]


def _load_blacklist_ids(session: Session) -> set[int]:
    """Return TMDB IDs the user has permanently rejected."""
    return {row.tmdb_id for row in session.exec(select(EternalBlacklist)).all()}


def _load_queued_ids(session: Session) -> set[int]:
    """Return TMDB IDs already sitting in the audit queue (avoid duplicates)."""
    return {row.tmdb_id for row in session.exec(select(AuditQueue)).all()}


def _is_already_seen(title: str, year: int | None, seen_set: list[dict]) -> bool:
    """True if a fuzzy match exists in the user's local movie DB."""
    for entry in seen_set:
        # Optionally narrow by year first (±1 year tolerance)
        if year and entry["year"] and abs(year - entry["year"]) > 1:
            continue
        score = fuzz.token_sort_ratio(title.lower(), entry["title"].lower())
        if score >= FUZZY_THRESHOLD:
            return True
    return False


def _add_to_queue(session: Session, result: dict, source: str, reason: str):
    """Safely add a TMDB result to the audit_queue table."""
    tmdb_id     = result["id"]
    title       = result.get("title", "Unknown")
    year_str    = result.get("release_date", "")[:4]
    year        = int(year_str) if year_str.isdigit() else None
    popularity  = result.get("popularity", 0.0)

    entry = AuditQueue(
        tmdb_id=tmdb_id,
        title=title,
        release_year=year,
        scan_source=source,
        reason=reason,
        popularity=popularity,
    )
    session.add(entry)
    logger.info(f"  [Audit Queue] Added: '{title}' ({year}) — {reason}")


# ─── Scanner A: Franchise Gap Scanner ─────────────────────────────────────────

def run_franchise_scan(log=print) -> int:
    """
    For every movie in the DB that belongs to a TMDB collection,
    find any collection members missing from the local database
    and push them to audit_queue.

    Example:
      DB has "The Dark Knight (2008)" → Belongs to "The Dark Knight Collection"
      → Scans collection → Finds "Batman Begins" not in DB → Queues it.

    Returns: Number of new entries added to audit_queue.
    """
    added = 0

    with Session(engine) as session:
        seen_set        = _load_seen_set(session)
        blacklist_ids   = _load_blacklist_ids(session)
        queued_ids      = _load_queued_ids(session)

        # Fetch all logged movies to look up their TMDB collection membership
        logged_movies = session.exec(
            select(MediaItem).where(MediaItem.type == "Movies")
        ).all()

        log(f"[Franchise] Scanning {len(logged_movies)} logged movies for collection membership...")

        # Track collections already scanned to avoid duplicate API calls
        scanned_collections: set[int] = set()

        for movie in logged_movies:
            # Search TMDB to get the movie's full metadata (incl. belongs_to_collection)
            try:
                search_res = _tmdb_get("/search/movie", {
                    "query": movie.title,
                    "year": movie.release_year or "",
                })
            except Exception as e:
                log(f"  [Franchise] TMDB search failed for '{movie.title}': {e}")
                continue

            results = search_res.get("results", [])
            if not results:
                continue

            # Pick the best fuzzy match from search results
            best = None
            for r in results[:5]:
                score = fuzz.token_sort_ratio(
                    movie.title.lower(), r.get("title", "").lower()
                )
                if score >= FUZZY_THRESHOLD:
                    best = r
                    break
            if not best:
                continue

            # Fetch full movie details to get belongs_to_collection
            try:
                details = _tmdb_get(f"/movie/{best['id']}")
            except Exception as e:
                log(f"  [Franchise] Details fetch failed for '{movie.title}': {e}")
                continue

            collection = details.get("belongs_to_collection")
            if not collection:
                continue  # This movie isn't part of a series

            col_id = collection["id"]
            col_name = collection["name"]

            if col_id in scanned_collections:
                continue  # Already processed this collection from another DB entry
            scanned_collections.add(col_id)

            # Fetch all movies in the collection
            try:
                col_details = _tmdb_get(f"/collection/{col_id}")
            except Exception as e:
                log(f"  [Franchise] Collection fetch failed for '{col_name}': {e}")
                continue

            parts = col_details.get("parts", [])
            log(f"  [Franchise] '{col_name}' has {len(parts)} parts.")

            for part in parts:
                tmdb_id = part["id"]

                # Skip: too obscure
                if part.get("popularity", 0) < MIN_POPULARITY:
                    continue
                # Skip: blacklisted
                if tmdb_id in blacklist_ids:
                    continue
                # Skip: already in queue
                if tmdb_id in queued_ids:
                    continue

                part_title = part.get("title", "Unknown")
                year_str   = part.get("release_date", "")[:4]
                part_year  = int(year_str) if year_str.isdigit() else None

                # Skip: already in DB
                if _is_already_seen(part_title, part_year, seen_set):
                    continue

                reason = f"Franchise: '{movie.title}' is in {col_name}"
                _add_to_queue(session, part, "franchise", reason)
                queued_ids.add(tmdb_id)
                added += 1

            time.sleep(0.25)  # Respect TMDB rate limit (40 req/10s)

        session.commit()

    log(f"[Franchise] Scan complete. {added} new entries added to audit_queue.")
    return added


# ─── Scanner B: Blockbuster Hit Scanner ───────────────────────────────────────

def run_blockbuster_scan(year_start: int | None = None, year_end: int | None = None,
                         top_n: int = 50, log=print) -> int:
    """
    Fetches the top_n most popular movies for every year in [year_start, year_end]
    and queues the ones missing from the local DB.

    Defaults to the user's full lifetime (BIRTH_YEAR to current year).
    """
    added = 0
    current_year = datetime.utcnow().year
    y_start = year_start or BIRTH_YEAR
    y_end   = year_end   or current_year

    with Session(engine) as session:
        seen_set        = _load_seen_set(session)
        blacklist_ids   = _load_blacklist_ids(session)
        queued_ids      = _load_queued_ids(session)

        for year in range(y_start, y_end + 1):
            log(f"[Blockbuster] Scanning year {year}...")
            pages_needed = (top_n // 20) + 1
            collected = []

            for page in range(1, pages_needed + 1):
                try:
                    res = _tmdb_get("/discover/movie", {
                        "sort_by": "popularity.desc",
                        "primary_release_year": year,
                        "vote_count.gte": 500,
                        "page": page,
                    })
                    collected.extend(res.get("results", []))
                except Exception as e:
                    log(f"  [Blockbuster] API error for {year} page {page}: {e}")
                    break

                if len(collected) >= top_n:
                    break

            for movie in collected[:top_n]:
                tmdb_id    = movie["id"]
                title      = movie.get("title", "Unknown")
                year_str   = movie.get("release_date", "")[:4]
                movie_year = int(year_str) if year_str.isdigit() else None

                if movie.get("popularity", 0) < MIN_POPULARITY:
                    continue
                if tmdb_id in blacklist_ids:
                    continue
                if tmdb_id in queued_ids:
                    continue
                if _is_already_seen(title, movie_year, seen_set):
                    continue

                reason = f"Blockbuster Hit: #{collected.index(movie)+1} most popular film of {year}"
                _add_to_queue(session, movie, "blockbuster", reason)
                queued_ids.add(tmdb_id)
                added += 1

            session.commit()
            time.sleep(0.25)

    log(f"[Blockbuster] Scan complete. {added} new entries added to audit_queue.")
    return added


# ─── Scanner C: Childhood / Animation Scan ───────────────────────────────────

def run_childhood_scan(log=print) -> int:
    """
    Scans for animation/family films released during the user's ages 3–13.
    These are the "Did I see this as a kid?" candidates.
    """
    added = 0
    age_start = BIRTH_YEAR + 3
    age_end   = BIRTH_YEAR + 13

    # TMDB Genre IDs: 16 = Animation, 10751 = Family
    CHILDHOOD_GENRES = "16,10751"

    with Session(engine) as session:
        seen_set      = _load_seen_set(session)
        blacklist_ids = _load_blacklist_ids(session)
        queued_ids    = _load_queued_ids(session)

        for year in range(age_start, age_end + 1):
            log(f"[Childhood] Scanning {year} (age {year - BIRTH_YEAR})...")
            try:
                res = _tmdb_get("/discover/movie", {
                    "with_genres": CHILDHOOD_GENRES,
                    "primary_release_year": year,
                    "sort_by": "popularity.desc",
                    "vote_count.gte": 200,
                })
            except Exception as e:
                log(f"  [Childhood] API error for {year}: {e}")
                continue

            for movie in res.get("results", [])[:30]:
                tmdb_id    = movie["id"]
                title      = movie.get("title", "Unknown")
                year_str   = movie.get("release_date", "")[:4]
                movie_year = int(year_str) if year_str.isdigit() else None

                if tmdb_id in blacklist_ids:
                    continue
                if tmdb_id in queued_ids:
                    continue
                if _is_already_seen(title, movie_year, seen_set):
                    continue

                age_at_release = year - BIRTH_YEAR
                reason = f"Childhood Hit: Popular animation/family film from age {age_at_release}"
                _add_to_queue(session, movie, "childhood", reason)
                queued_ids.add(tmdb_id)
                added += 1

            session.commit()
            time.sleep(0.25)

    log(f"[Childhood] Scan complete. {added} new entries added to audit_queue.")
    return added


# ─── Scanner D: Director Staples Scanner ─────────────────────────────────────

def run_director_scan(min_rating_threshold: float = 8.0, log=print) -> int:
    """
    For movies you've rated >= min_rating_threshold, finds the director and
    checks for other well-received films (TMDB vote_average > 7.0) missing from your DB.
    """
    added = 0
    DIRECTOR_MIN_VOTE_AVG = 7.0
    DIRECTOR_MIN_VOTES    = 500

    with Session(engine) as session:
        seen_set      = _load_seen_set(session)
        blacklist_ids = _load_blacklist_ids(session)
        queued_ids    = _load_queued_ids(session)

        # Find highly-rated movies in DB to extract director affinity
        highly_rated = session.exec(
            select(MediaItem).where(MediaItem.type == "Movies")
        ).all()

        high_affinity = []
        for m in highly_rated:
            try:
                rating_val = float((m.numeric_rating or "").replace("/10", ""))
                if rating_val >= min_rating_threshold:
                    high_affinity.append(m)
            except (ValueError, AttributeError):
                continue

        log(f"[Director] Found {len(high_affinity)} movies with rating >= {min_rating_threshold}.")

        scanned_directors: set[int] = set()

        for movie in high_affinity:
            try:
                search_res = _tmdb_get("/search/movie", {
                    "query": movie.title,
                    "year": movie.release_year or "",
                })
                results = search_res.get("results", [])
                if not results:
                    continue

                best = None
                for r in results[:5]:
                    if fuzz.token_sort_ratio(movie.title.lower(), r.get("title","").lower()) >= FUZZY_THRESHOLD:
                        best = r
                        break
                if not best:
                    continue

                credits = _tmdb_get(f"/movie/{best['id']}/credits")
                directors = [p for p in credits.get("crew", []) if p["job"] == "Director"]

                for director in directors:
                    dir_id   = director["id"]
                    dir_name = director["name"]

                    if dir_id in scanned_directors:
                        continue
                    scanned_directors.add(dir_id)

                    log(f"  [Director] Scanning filmography of {dir_name}...")
                    filmography = _tmdb_get(f"/person/{dir_id}/movie_credits")

                    for film in filmography.get("crew", []):
                        if film.get("job") != "Director":
                            continue
                        if film.get("vote_average", 0) < DIRECTOR_MIN_VOTE_AVG:
                            continue
                        if film.get("vote_count", 0) < DIRECTOR_MIN_VOTES:
                            continue

                        tmdb_id    = film["id"]
                        title      = film.get("title", "Unknown")
                        year_str   = film.get("release_date", "")[:4]
                        film_year  = int(year_str) if year_str.isdigit() else None

                        if tmdb_id in blacklist_ids:
                            continue
                        if tmdb_id in queued_ids:
                            continue
                        if _is_already_seen(title, film_year, seen_set):
                            continue

                        reason = f"Director Staple: {dir_name} (you rated '{movie.title}' {movie.numeric_rating})"
                        _add_to_queue(session, film, "director", reason)
                        queued_ids.add(tmdb_id)
                        added += 1

                    time.sleep(0.25)

            except Exception as e:
                log(f"  [Director] Error processing '{movie.title}': {e}")
                continue

        session.commit()

    log(f"[Director] Scan complete. {added} new entries added to audit_queue.")
    return added


# ─── Master Runner ────────────────────────────────────────────────────────────

def run_full_audit(log=print):
    """Run all four scanners in sequence. Called on startup or by scheduler."""
    log("[Audit Engine] Starting full audit scan...")
    total = 0
    total += run_franchise_scan(log=log)
    total += run_blockbuster_scan(log=log)
    total += run_childhood_scan(log=log)
    total += run_director_scan(log=log)
    log(f"[Audit Engine] Full scan complete. {total} total items added to audit_queue.")
    return total


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_full_audit(log=print)
