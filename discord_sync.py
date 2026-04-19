import os
import re
import asyncio
import collections
from datetime import datetime

import discord
from dotenv import load_dotenv
from sqlmodel import Session, select

from database import engine, MediaItem, SyncState, create_db_and_tables

# ─── Environment ────────────────────────────────────────────────────────────
load_dotenv()
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')


def safe_getenv_int(key: str, default: int = 0) -> int:
    """Read an integer env var, returning *default* on missing / malformed values."""
    val = os.getenv(key, "")
    if not val or not val.strip():
        return default
    try:
        return int(val)
    except ValueError:
        print(f"[!] Warning: Environment variable {key}='{val}' is invalid. Defaulting to {default}.")
        return default


# ─── Channel Configuration ──────────────────────────────────────────────────
# (Channel ID, Media Type, Is Ranking List)
CHANNEL_CONFIG = [
    (safe_getenv_int('CHANNEL_MOVIE_COMPLETED'),    "Movies",    False),
    (safe_getenv_int('CHANNEL_ANIME_COMPLETED'),    "Anime",     False),
    (safe_getenv_int('CHANNEL_MANGA_COMPLETED'),    "Manga",     False),
    (safe_getenv_int('CHANNEL_TVSERIES_COMPLETED'), "TV Series", False),

    (safe_getenv_int('CHANNEL_MOVIE_TOP'),    "Movies",    True),
    (safe_getenv_int('CHANNEL_ANIME_TOP'),    "Anime",     True),
    (safe_getenv_int('CHANNEL_MANGA_TOP'),    "Manga",     True),
    (safe_getenv_int('CHANNEL_TVSERIES_TOP'), "TV Series", True),
]

# ─── Parsing Regexes ────────────────────────────────────────────────────────
# Movies PRIMARY: requires "Title YEAR: X/10" — the year anchors the split so colons
# inside the title (e.g. "Avengers: Infinity War 2018: 9/10") are absorbed by (.+?)
PARSE_REGEX_MOVIES_WITH_YEAR = re.compile(
    r"^\s*[-*•]?\s*(.+?)\s+\(?\b((?:19|20)\d{2})\b\)?\s*:\s*(\d+(?:\.\d+)?/10)\s*$"
)
# Movies FALLBACK: no year — still requires strictly numeric X/10 rating
PARSE_REGEX_MOVIES_NO_YEAR = re.compile(
    r"^\s*[-*•]?\s*(.+?)\s*:\s*(\d+(?:\.\d+)?/10)\s*$"
)

# Anime:  "**Title** *Genres*: 9/10"
PARSE_REGEX_ANIME = re.compile(
    r"^\s*\*\*(.+?)\*\*\s*(?:\*([^*]+)\*)?:\s*(\d+(?:\.\d+)?/10|ERROR.*)$"
)
# Manga:  "Title - Rating"
PARSE_REGEX_MANGA = re.compile(
    r"^\s*(.+?)\s+-\s+(\d+(?:\.\d+)?/10)$"
)
# TV Series:  "Title X seasons[/Release: YEAR/Genre] RATING/10"
PARSE_REGEX_TVSERIES = re.compile(
    r"^\s*(.+?)\s+\d+\s+seasons?(?:/Release:\s*(\d{4})/([^/]+?))?\s+(\d+(?:\.\d+)?/10)\s*$",
    re.IGNORECASE
)
# Rankings:  "1. Title", "#1 Title", "1 Title"
RANKING_REGEX = re.compile(r"^\s*[#•]?\s*(\d+)[.\s\-]*\s+(.+)$")

# Lines that look like section headers — must NOT be treated as media titles
_HEADER_PATTERNS = re.compile(
    r"^(top\s+\d|best\s+|completed|ranking|list|part\s+\d|---+|===+|#{1,6}\s|\*{3,})",
    re.IGNORECASE
)


# ─── Utility Functions ──────────────────────────────────────────────────────
def is_valid_rating(rating_str: str) -> bool:
    """Check if a rating string is well-formed (e.g. '#3', '9/10')."""
    if not rating_str:
        return False
    if rating_str.startswith('#'):
        return True
    if '/10' in rating_str:
        try:
            val = float(rating_str.split('/')[0].strip())
            return 0 <= val <= 10
        except ValueError:
            return False
    return True


def is_title_valid(title: str) -> bool:
    """
    Guard that rejects strings that are clearly NOT media titles.
    Designed to catch parsing fragments without rejecting real edge-case titles
    like 'F1', '1917', 'Up', 'Her', 'It'.
    """
    if not title:
        return False
    t = title.strip()
    if not t:
        return False
    # Contains '/10' — it's a rating that landed in the title field
    if '/10' in t:
        return False
    # Standalone bare numbers that are clearly not titles (just a digit or two)
    # e.g. '1', '10', '20' — but NOT '1917', 'F1', 'Se7en'
    if t.isdigit() and len(t) <= 2:
        return False
    # Looks like a section header
    if _HEADER_PATTERNS.match(t):
        return False
    return True


def is_clean_parse(title: str, rating: str, numeric_rating) -> bool:
    """
    Final sanity check before any record is written to the DB.
    Catches the colon-split corruption pattern where the subtitle of a movie
    (e.g. 'Infinity War', 'No Way Home') ends up in the rating/numeric_rating field.
    
    A rating field can only legally contain:
      - '#N'     (rank string)
      - 'X/10'   (numeric score)
      - 'ERROR (Check Discord)'
    A numeric_rating can only legally contain:
      - 'X/10'   (numeric score)
      - None
    """
    # Rating must be a rank OR an X/10 score OR the error sentinel
    if rating and rating != 'ERROR (Check Discord)':
        if not rating.startswith('#') and '/10' not in rating:
            return False  # rating looks like a title fragment

    # numeric_rating (if present) must contain '/10' — never letters without a slash
    if numeric_rating:
        if '/' not in numeric_rating and any(c.isalpha() for c in numeric_rating):
            return False  # numeric_rating is a title continuation string

    # Double check title doesn't look like a rating error
    if '/10' in title and len(title) < 10:
        return False

    return True


def purge_corrupt_entries(session) -> int:
    """
    Scans the DB for entries created by old broken regexes across ALL categories
    where title fragments ended up in rating or numeric_rating fields.
    """
    from sqlmodel import select as sql_select
    all_items = session.exec(sql_select(MediaItem)).all()
    count = 0
    for item in all_items:
        nr = item.numeric_rating or ''
        r = item.rating or ''
        
        # Corrupt pattern: letters but no slash/hash (title continuation)
        bad_nr = nr and '/' not in nr and any(c.isalpha() for c in nr)
        bad_r  = r and '/' not in r and not r.startswith('#') and any(c.isalpha() for c in r) and r != 'ERROR (Check Discord)'
        
        if (bad_nr or bad_r) and item.source == 'discord':
            print(f"[Purge] Corrupt entry ID={item.id}: {item.title!r} r={r!r} nr={nr!r} — deleting")
            session.delete(item)
            count += 1
    if count:
        session.commit()
    return count


def is_valid_year(year_str: str) -> bool:
    """Validates that a year string is a realistic 4-digit release year."""
    if not year_str:
        return True
    try:
        year = int(year_str)
        return 1888 <= year <= 2030
    except (ValueError, TypeError):
        return False


def normalize_title(title: str) -> str:
    """Universal normalizer – strips articles, punctuation, collapses whitespace."""
    if not title:
        return ""
    import string
    t = title.lower().strip()
    for prefix in ["the ", "a ", "an "]:
        if t.startswith(prefix):
            t = t[len(prefix):]
            break
    t = "".join(ch for ch in t if ch not in string.punctuation)
    return " ".join(t.split())


# ─── Sync Client ────────────────────────────────────────────────────────────
class SyncClient(discord.Client):
    def __init__(self, *args, log_func=print, category=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.log_func = log_func
        self.target_category = category  # e.g. "Movie", "Anime", None for all
        self.sync_started = False

    # ── Dual-output logger: UI terminal + server console ─────────────────
    def _log(self, msg: str):
        """Write to both the frontend terminal (self.log_func) and stdout."""
        self.log_func(msg)
        print(msg)

    async def on_ready(self):
        if self.sync_started:
            return
        self.sync_started = True

        # ╔══════════════════════════════════════════════════════════════════╗
        # ║  DEFENSIVE ENVELOPE – Every possible exception is caught and   ║
        # ║  logged to BOTH the UI terminal and the server console so      ║
        # ║  sync can NEVER fail silently again.                           ║
        # ╚══════════════════════════════════════════════════════════════════╝
        try:
            await self._run_sync()
        except Exception as exc:
            self._log(f"[Sync] FATAL ERROR: {type(exc).__name__}: {exc}")
            import traceback
            traceback.print_exc()
        finally:
            if not self.is_closed():
                await self.close()

    # ── Core sync logic ──────────────────────────────────────────────────
    async def _run_sync(self):
        self._log(f"[Sync] Logged in as {self.user}")
        self._log("[Sync] Phase 1/3: Warm-up (Waiting for Discord cache...)")
        await asyncio.sleep(5)

        # ── BURST 1: Quick DB read (<1 s lock, then release) ─────────────
        create_db_and_tables()
        self._log("[Sync] Phase 2/3: Indexing database...")

        with Session(engine) as session:
            all_items = session.exec(select(MediaItem)).all()
            items_snapshot = [
                {
                    "id": m.id, "title": m.title, "type": m.type,
                    "release_year": m.release_year, "rating": m.rating,
                    "numeric_rating": m.numeric_rating, "genres": m.genres,
                    "discord_id": m.discord_id, "is_ranking": m.is_ranking,
                }
                for m in all_items
            ]
            # Load last-sync cursors for incremental sync
            sync_states = session.exec(select(SyncState)).all()
            sync_cursors = {s.channel_id: s.last_message_id for s in sync_states}

        self._log(f"[Sync] Database indexed: {len(items_snapshot)} items loaded.")

        # Build in-memory lookup maps (no DB lock needed)
        candidates_map = collections.defaultdict(list)
        msg_to_items = {}
        for snap in items_snapshot:
            norm_key = (normalize_title(snap["title"]), snap["type"])
            candidates_map[norm_key].append(snap)
            if snap["discord_id"]:
                msg_to_items.setdefault(snap["discord_id"], []).append(snap)

        # ── BURST 2: Pure async Discord scanning (NO DB lock) ────────────
        self._log("[Sync] Phase 3/3: Scanning Discord channels...")

        channels_to_scan = []
        for cid, mtype, is_ranking in CHANNEL_CONFIG:
            if not cid or cid == 0:
                continue
            if not self.target_category or self.target_category.lower() == mtype.lower():
                channels_to_scan.append((cid, mtype, is_ranking))

        if not channels_to_scan:
            self._log(f"[Sync] No channels configured for: {self.target_category or 'All'}")
            return

        self._log(f"[Sync] Channels to scan: {len(channels_to_scan)}")

        # Accumulate all changes in memory
        pending_updates = {}   # item_id -> {field: value}
        pending_adds    = []   # list of dicts for new MediaItem records
        newest_msg_ids  = {}   # channel_id_str -> newest message id seen

        new_additions = 0
        updated_items = 0

        # Step 0: Clear current rankings for channels we are about to scan
        # This prevents "ghost duplicates" if entries were removed from the Top 20 lists.
        ranking_types_to_reset = set(mtype for cid, mtype, is_rank in channels_to_scan if is_rank)
        if ranking_types_to_reset:
            self._log(f"[Sync] Resetting ranking status for: {', '.join(ranking_types_to_reset)}")
            with Session(engine) as session:
                for target_type in ranking_types_to_reset:
                    # Reset is_ranking AND clear the rank string (#NN) from the rating field
                    # We restore the numeric_rating if available, otherwise clear the rating.
                    session.exec(
                        text("UPDATE mediaitem SET is_ranking = 0, rating = COALESCE(numeric_rating, '') "
                             "WHERE type = :t AND is_ranking = 1"),
                        {'t': target_type}
                    )
                session.commit()
            
            # Refresh items_snapshot in memory to reflect reset status
            for snap in items_snapshot:
                if snap["type"] in ranking_types_to_reset:
                    snap["is_ranking"] = False

        for channel_id, media_type, is_ranking in channels_to_scan:
            channel = self.get_channel(channel_id)
            if not channel:
                self._log(f"  [!] Channel {media_type} ({channel_id}): NOT FOUND. Check env var.")
                continue

            self._log(f"[Sync] Scanning #{channel.name} ({media_type})...")

            # Incremental sync: for Completed channels, only read new messages.
            # Ranking channels ALWAYS do a full scan (messages are edited in-place).
            cid_str = str(channel_id)
            last_cursor = sync_cursors.get(cid_str)

            if is_ranking or not last_cursor:
                # Full scan
                history_kwargs = {"limit": 500 if is_ranking else 1000}
                scan_mode = "full"
            else:
                # Incremental: only messages AFTER the last-seen message
                history_kwargs = {"after": discord.Object(id=int(last_cursor)), "limit": 1000}
                scan_mode = "incremental"

            self._log(f"  [{scan_mode.upper()}] mode for #{channel.name}")

            msg_count = 0
            async for message in channel.history(**history_kwargs):
                msg_count += 1
                if msg_count % 100 == 0:
                    self._log(f"  [.] {msg_count} messages scanned in #{channel.name}...")

                msg_id = str(message.id)

                # Track the newest message ID for this channel
                if cid_str not in newest_msg_ids or int(message.id) > int(newest_msg_ids[cid_str]):
                    newest_msg_ids[cid_str] = msg_id

                lines = message.content.split('\n')
                items_found_in_msg = []

                for line in lines:
                    title, year_str, rating, num_rating, genres = None, None, None, None, None

                    if not is_ranking:
                        clean_line = line.replace('**', '').replace('*', '')
                        match_anime    = PARSE_REGEX_ANIME.match(line)
                        match_movies_y = PARSE_REGEX_MOVIES_WITH_YEAR.match(clean_line)
                        match_movies_n = PARSE_REGEX_MOVIES_NO_YEAR.match(clean_line)
                        match_manga    = PARSE_REGEX_MANGA.match(clean_line)
                        match_tvseries = PARSE_REGEX_TVSERIES.match(clean_line)

                        if match_anime:
                            title     = match_anime.group(1).strip()
                            genres    = match_anime.group(2).strip() if match_anime.group(2) else None
                            rating    = match_anime.group(3).strip()
                            num_rating = rating if '/10' in rating else None
                        elif match_tvseries:
                            title     = match_tvseries.group(1).strip()
                            year_str  = match_tvseries.group(2).strip() if match_tvseries.group(2) else None
                            genres    = match_tvseries.group(3).strip() if match_tvseries.group(3) else None
                            rating    = match_tvseries.group(4).strip()
                            num_rating = rating if '/10' in rating else None
                        elif match_movies_y:
                            # Primary: year is present — title absorbs any colons before the year
                            title     = match_movies_y.group(1).strip()
                            year_str  = match_movies_y.group(2)
                            rating    = match_movies_y.group(3).strip()
                            num_rating = rating
                        elif match_movies_n:
                            # Fallback: no year — rating must still be strictly X/10
                            title     = match_movies_n.group(1).strip()
                            year_str  = None
                            rating    = match_movies_n.group(2).strip()
                            num_rating = rating
                        elif match_manga:
                            title     = match_manga.group(1).strip()
                            rating    = match_manga.group(2).strip()
                            num_rating = rating if '/10' in rating else None
                    else:
                        rank_match = RANKING_REGEX.match(line)
                        if rank_match:
                            rank_num = rank_match.group(1).strip()
                            part     = rank_match.group(2).strip()
                            
                            # Robust split logic: look for the RATING at the end first
                            # Supports both ": 9/10" and just "9/10" (some rankings have scores appended)
                            rating_match = re.search(r"(?::\s*)?(\d+(?:\.\d+)?/10)$", part)
                            
                            if rating_match:
                                # Title is everything before the rating
                                title = part[:rating_match.start()].replace('**', '').replace('*', '').strip()
                                num_rating = rating_match.group(1).strip()
                            else:
                                # No numeric rating found (e.g. just "2. Title: Subtitle")
                                # Treat the entire part as the title
                                title = part.replace('**', '').replace('*', '').strip()
                                num_rating = None
                                
                            rating = f"#{rank_num}"
                            year_in_title = re.search(r"\((20\d{2}|19\d{2})\)$", title)
                            if year_in_title:
                                title    = title[:year_in_title.start()].strip()
                                year_str = year_in_title.group(1)

                    if title and rating:
                        # ── Title sanity guard — reject invalid parsed fragments ──
                        if not is_title_valid(title):
                            self._log(f"  [SKIP] Rejected bad title parse: {title!r} from line: {line.strip()[:60]}")
                            title = None  # fall through to unparsed handler

                    if title and rating:
                        if not is_valid_rating(rating):
                            rating = "ERROR (Check Discord)"

                        norm_title = normalize_title(title)
                        items_found_in_msg.append(title.lower().strip())

                        discord_year = int(year_str) if (year_str and is_valid_year(year_str)) else None
                        candidates = candidates_map.get((norm_title, media_type), [])

                        # Match: exact year first, then fuzzy
                        existing = None
                        for c in candidates:
                            if c["release_year"] == discord_year and discord_year is not None:
                                existing = c; break
                        if not existing:
                            for c in candidates:
                                if c["release_year"] and discord_year and c["release_year"] != discord_year:
                                    continue
                                existing = c; break

                        if existing:
                            eid = existing["id"]
                            upd = pending_updates.setdefault(eid, {})

                            if existing["discord_id"] != msg_id:
                                upd["discord_id"] = msg_id
                            if discord_year is not None and not existing["release_year"]:
                                upd["release_year"] = discord_year

                            # ── Cross-pollination: keep rank + score in separate fields ──
                            if rating.startswith('#'):
                                # Incoming = RANK
                                if existing["rating"] and not existing["rating"].startswith('#'):
                                    if existing["numeric_rating"] != existing["rating"]:
                                        upd["numeric_rating"] = existing["rating"]
                                if existing["rating"] != rating:
                                    upd["rating"] = rating
                                    upd["is_ranking"] = True
                            else:
                                # Incoming = SCORE
                                if existing["rating"] and existing["rating"].startswith('#'):
                                    if existing["numeric_rating"] != rating:
                                        upd["numeric_rating"] = rating
                                        self._log(f"  [~] Score linked: {title} <- {rating}")
                                elif existing["rating"] != rating:
                                    upd["rating"] = rating

                            if num_rating and existing["numeric_rating"] != num_rating:
                                upd["numeric_rating"] = num_rating
                            if genres and (not existing["genres"] or existing["genres"] == "Imported from Discord"):
                                upd["genres"] = genres
                            if not existing["is_ranking"] and is_ranking:
                                upd["is_ranking"] = True

                            if upd:
                                updated_items += 1
                        else:
                            pending_adds.append({
                                "title": title, "release_year": discord_year,
                                "genres": genres, "type": media_type,
                                "is_ranking": is_ranking, "rating": rating,
                                "numeric_rating": num_rating,
                                "review": "Imported from Discord Ranking" if is_ranking else "Imported from Discord",
                                "source": "discord", "discord_id": msg_id,
                            })
                            # Register in candidate map so we don't double-add this run
                            candidates_map[(norm_title, media_type)].append(pending_adds[-1] | {"id": None})
                            new_additions += 1
                            self._log(f"  [+] NEW: {title} ({rating})")

                    elif line.strip() and not any(h in line.lower() for h in ['completed', 'manga', 'anime', 'movie', 'tv', 'top ', 'best ']):
                        if not any(s in line for s in ['```', '---', '**']):
                            self._log(f"  [?] Unparsed: \"{line.strip()[:50]}\"")

            self._log(f"  [OK] #{channel.name}: {msg_count} messages scanned.")

        # ── BURST 3: Fast DB write (short lock, no async) ────────────────
        self._log(f"[Sync] Writing {updated_items} updates + {new_additions} additions...")

        with Session(engine) as session:
            # Apply updates
            for item_id, changes in pending_updates.items():
                if not changes:
                    continue
                db_item = session.get(MediaItem, item_id)
                if db_item:
                    for field, value in changes.items():
                        setattr(db_item, field, value)
                    session.add(db_item)

            # Apply additions
            for data in pending_adds:
                # Final integrity check before write — never persist a corrupt parse
                if not is_clean_parse(data["title"], data["rating"], data.get("numeric_rating")):
                    self._log(f"  [SKIP-CORRUPT] Refused to write bad entry: "
                              f"title={data['title']!r} nr={data.get('numeric_rating')!r}")
                    new_additions -= 1
                    continue
                session.add(MediaItem(**data))

            # Save sync cursors for incremental mode
            for cid_str, msg_id in newest_msg_ids.items():
                existing_state = session.exec(
                    select(SyncState).where(SyncState.channel_id == cid_str)
                ).first()
                if existing_state:
                    existing_state.last_message_id = msg_id
                    existing_state.last_sync_at = datetime.utcnow()
                    session.add(existing_state)
                else:
                    session.add(SyncState(
                        channel_id=cid_str,
                        last_message_id=msg_id,
                        last_sync_at=datetime.utcnow(),
                    ))

            session.commit()
            self._log(f"[Sync] Complete! Added {new_additions}, Updated {updated_items}.")

            # ── POST-SYNC: Score Cross-Linker ────────────────────────────
            self._log("[Sync] Running post-sync Score Cross-Linker...")
            all_fresh = session.exec(select(MediaItem)).all()
            ranked_missing = [m for m in all_fresh if (m.rating or '').startswith('#') and not m.numeric_rating]
            scored_pool    = [m for m in all_fresh if not (m.rating or '').startswith('#') and m.rating and '/' in m.rating]
            cross_linked = 0
            for ranked in ranked_missing:
                r_norm = normalize_title(ranked.title)
                for scored in scored_pool:
                    if ranked.type != scored.type:
                        continue
                    if normalize_title(scored.title) != r_norm:
                        continue
                    if ranked.release_year and scored.release_year and ranked.release_year != scored.release_year:
                        continue
                    self._log(f"  [+] Cross-linked: \"{ranked.title}\" ({ranked.rating}) <- {scored.rating}")
                    ranked.numeric_rating = scored.rating
                    session.add(ranked)
                    cross_linked += 1
                    break
            if cross_linked:
                session.commit()
                self._log(f"[Sync] Cross-linked {cross_linked} scores to ranked entries.")
            else:
                self._log("[Sync] Score Cross-Linker: all scores already linked.")


# ─── Public API ──────────────────────────────────────────────────────────────
async def run_sync(log_func=print, category=None):
    """Entry point called by the FastAPI background task."""
    log_func("[Sync] Initializing...")

    # ── Startup purge: remove any DB entries corrupted by old broken regex ──
    try:
        with Session(engine) as session:
            purged = purge_corrupt_entries(session)
            if purged:
                log_func(f"[Sync] Purged {purged} corrupt DB entries before sync.")
    except Exception as e:
        log_func(f"[Sync] Purge skipped: {e}")

    if not DISCORD_TOKEN:
        log_func("ERROR: DISCORD_TOKEN is not set in .env")
        return {"status": "error", "message": "DISCORD_TOKEN missing"}

    intents = discord.Intents.default()
    intents.message_content = True

    client = SyncClient(intents=intents, log_func=log_func, category=category)
    try:
        await asyncio.wait_for(client.start(DISCORD_TOKEN), timeout=600)
    except asyncio.TimeoutError:
        log_func("[Sync] Timed out after 10 minutes.")
        return {"status": "timeout"}
    except Exception as e:
        log_func(f"[Sync] Error: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        if not client.is_closed():
            await client.close()

    return {"status": "success"}


def main():
    asyncio.run(run_sync())


if __name__ == "__main__":
    main()
