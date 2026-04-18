import os
import re
import asyncio
import discord
from dotenv import load_dotenv
from sqlmodel import Session, select
from database import engine, MediaItem, create_db_and_tables

# Load environment variables
load_dotenv()
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')

def safe_getenv_int(key: str, default: int = 0) -> int:
    val = os.getenv(key, "")
    if not val or not val.strip():
        return default
    try:
        return int(val)
    except ValueError:
        print(f"[!] Warning: Environment variable {key}='{val}' is invalid. Defaulting to {default}.")
        return default

# Map your channels to Media Types here
# Format: { CHANNEL_ID (int) : "Type" }
# Replace these with your actual Discord Channel IDs
CHANNEL_MAP_COMPLETED = {
    safe_getenv_int('CHANNEL_MOVIE_COMPLETED'): "Movie",
    safe_getenv_int('CHANNEL_ANIME_COMPLETED'): "Anime",
    safe_getenv_int('CHANNEL_MANGA_COMPLETED'): "Manga",
    safe_getenv_int('CHANNEL_TVSERIES_COMPLETED'): "TV Series",
}

CHANNEL_MAP_TOP = {
    safe_getenv_int('CHANNEL_MOVIE_TOP'): "Movie",
    safe_getenv_int('CHANNEL_ANIME_TOP'): "Anime",
    safe_getenv_int('CHANNEL_MANGA_TOP'): "Manga",
    safe_getenv_int('CHANNEL_TVSERIES_TOP'): "TV Series",
}

# 1. Movies format: "- Title Year: Rating"
PARSE_REGEX_MOVIES = re.compile(r"^\s*[-*•]?\s*(.+?)\s+(\d{4,})\s*:\s*(.+)$")

# 2. Anime format: "**Title** *Genres*: Rating"
PARSE_REGEX_ANIME = re.compile(r"^\s*\*\*(.+?)\*\*\s*\*([^*]+)\*:\s*(.+)$")

# 3. Manga format: "Title - Rating"
PARSE_REGEX_MANGA = re.compile(r"^\s*(.+?)\s+-\s+(\d+(?:\.\d+)?/10)$")

# 4. TV Series format: "Title X seasons/Release: YEAR/Genre RATING/10"
#    e.g. "The Boys 5 seasons/Release: 2019/Action 7.5/10"
PARSE_REGEX_TVSERIES = re.compile(
    r"^\s*(.+?)\s+\d+\s+seasons?/Release:\s*(\d{4})/([^/]+?)\s+(\d+(?:\.\d+)?/10)\s*$",
    re.IGNORECASE
)

# Regex to match Numbered Rankings: "1. Inception"
RANKING_REGEX = re.compile(r"^\s*(\d+)\.\s+(.+)$")

def is_valid_rating(rating_str: str) -> bool:
    if not rating_str:
        return False
    if rating_str.startswith('#'):
        return True
    
    if '/10' in rating_str:
        num_str = rating_str.split('/')[0].strip()
        try:
            val = float(num_str)
            if val < 0 or val > 10:
                return False
            return True
        except ValueError:
            return False
    return True

def is_valid_year(year_str: str) -> bool:
    """Validates that a year string is a realistic 4-digit release year."""
    if not year_str:
        return True  # year is optional, None is fine
    try:
        year = int(year_str)
        if year < 1888 or year > 2030:  # 1888 = first film ever made
            return False
        return True
    except (ValueError, TypeError):
        return False

class SyncClient(discord.Client):
    async def on_ready(self):
        print(f"[Sync] Logged in as {self.user}")
        
        # Ensure database is ready
        create_db_and_tables()
        
        with Session(engine) as session:
            # Build a lookup map: (title, type, year_int_or_None, is_ranking) -> MediaItem
            # This lets us both deduplicate AND detect rating changes
            existing_items = session.exec(
                select(MediaItem).where(MediaItem.source == "discord")
            ).all()

            def make_key(title: str, mtype: str, is_ranking: bool):
                """Uniquely identify entries by title, type, and whether it's a ranking."""
                return (title.lower(), mtype, is_ranking)

            existing_map = {
                make_key(item.title, item.type, item.is_ranking): item
                for item in existing_items
            }
            
            new_additions = 0
            updated_ratings = 0

            # Consolidate channels to scan
            channels_to_scan = []
            for cid, mtype in CHANNEL_MAP_COMPLETED.items(): channels_to_scan.append((cid, mtype, False))
            for cid, mtype in CHANNEL_MAP_TOP.items(): channels_to_scan.append((cid, mtype, True))

            for channel_id, media_type, is_ranking in channels_to_scan:
                if channel_id == 0:
                    continue # Skip unset channels
                
                channel = self.get_channel(channel_id)
                if not channel:
                    print(f"[Sync] Could not find channel with ID {channel_id}. Does the bot have access?")
                    continue
                
                print(f"[Sync] Scanning channel: #{channel.name} for {media_type}s (Ranking: {is_ranking})...")
                
                # Fetch recent messages (adjust limit as needed)
                async for message in channel.history(limit=500):
                    lines = message.content.split('\n')
                    
                    for line in lines:
                        if not is_ranking:
                            title, year, rating, genres = None, None, None, None
                            clean_line = line.replace('**', '').replace('*', '')

                            match_anime = PARSE_REGEX_ANIME.match(line)
                            match_movies = PARSE_REGEX_MOVIES.match(clean_line)
                            match_manga = PARSE_REGEX_MANGA.match(clean_line)
                            match_tvseries = PARSE_REGEX_TVSERIES.match(clean_line)

                            if match_anime:
                                title = match_anime.group(1).strip()
                                genres = match_anime.group(2).strip()
                                rating = match_anime.group(3).strip()
                            elif match_tvseries:
                                title = match_tvseries.group(1).strip()
                                year = match_tvseries.group(2).strip()
                                genres = match_tvseries.group(3).strip()
                                rating = match_tvseries.group(4).strip()
                            elif match_movies:
                                title = match_movies.group(1).strip()
                                year = match_movies.group(2).strip()
                                rating = match_movies.group(3).strip()
                            elif match_manga:
                                title = match_manga.group(1).strip()
                                rating = match_manga.group(2).strip()
                            
                            if title and rating:
                                # Graceful Degradation: Fix broken data instead of rejecting it
                                if not is_valid_rating(rating):
                                    print(f"  [!] WARNING (Corrupt Score): {title} had score '{rating}'. Defaulting to 'ERROR'.")
                                    rating = "ERROR (Check Discord)"
                                
                                if year and not is_valid_year(year):
                                    print(f"  [!] WARNING (Corrupt Year): {title} had year '{year}'. Defaulting to None.")
                                    year = None

                                key = make_key(title, media_type, is_ranking)
                                
                                if key in existing_map:
                                    # Entry already exists — check if rating or year changed
                                    existing_item = existing_map[key]
                                    changed = False
                                    
                                    if existing_item.rating != rating:
                                        print(f"  [~] UPDATED rating for {title}: {existing_item.rating} → {rating}")
                                        existing_item.rating = rating
                                        changed = True
                                        
                                    try:
                                        parsed_year = int(year) if year else None
                                    except (ValueError, TypeError):
                                        parsed_year = None
                                        
                                    if existing_item.release_year != parsed_year:
                                        print(f"  [~] UPDATED year for {title}: {existing_item.release_year} → {parsed_year}")
                                        existing_item.release_year = parsed_year
                                        changed = True
                                        
                                    if changed:
                                        session.add(existing_item)
                                        updated_ratings += 1
                                else:
                                    new_item = MediaItem(
                                        title=title,
                                        release_year=int(year) if year else None,
                                        genres=genres,
                                        type=media_type,
                                        is_ranking=is_ranking,
                                        rating=rating,
                                        review="Imported from Discord",
                                        source="discord"
                                    )
                                    session.add(new_item)
                                    existing_map[key] = new_item  # prevent duplicates within same scan
                                    new_additions += 1
                                    print(f"  -> Found {media_type}: {title} ({year}) - {rating}")
                        elif is_ranking:
                            rank_match = RANKING_REGEX.match(line)
                            if rank_match:
                                rank_num = rank_match.group(1).strip()
                                title = rank_match.group(2).replace('*', '').strip()
                                year = None   # rankings have no year
                                rating = f"#{rank_num}"
                                key = make_key(title, media_type, is_ranking)

                                if key in existing_map:
                                    existing_item = existing_map[key]
                                    if existing_item.rating != rating:
                                        print(f"  [~] UPDATED ranking for {title}: {existing_item.rating} → {rating}")
                                        existing_item.rating = rating
                                        session.add(existing_item)
                                        updated_ratings += 1
                                else:
                                    new_item = MediaItem(
                                        title=title,
                                        release_year=None,
                                        type=media_type,
                                        is_ranking=is_ranking,
                                        rating=rating,
                                        review="Imported from Discord Ranking",
                                        source="discord"
                                    )
                                    session.add(new_item)
                                    existing_map[key] = new_item
                                    new_additions += 1
                                    print(f"  -> Found Ranked {media_type}: {title} {rating}")
            
            session.commit()
            print(f"[Sync] Complete! Added {new_additions} new items, updated {updated_ratings} ratings.")
        
        # Close the connection so the script exits automatically
        await self.close()

def main():
    if not DISCORD_TOKEN:
        print("ERROR: DISCORD_TOKEN is not set. Please create a .env file and add your bot token.")
        return

    # Set up intents so we can read message content
    intents = discord.Intents.default()
    intents.message_content = True

    client = SyncClient(intents=intents)
    print("[Sync] Connecting to Discord...")
    client.run(DISCORD_TOKEN)

if __name__ == "__main__":
    main()
