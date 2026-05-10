from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, UniqueConstraint
from datetime import datetime

class MediaItem(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("title", "type", "release_year", name="unique_media_item"),)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    release_year: Optional[int] = Field(default=None, index=True)

    type: str = Field(index=True) # Movies, TV Series, Manga, Book, Anime
    is_ranking: bool = Field(default=False, index=True)
    is_liked: bool = Field(default=False)
    is_manual_rating: bool = Field(default=False)
    rating: Optional[str] = Field(default=None)
    numeric_rating: Optional[str] = Field(default=None) # Stores 1-10 rating even for ranked items

    review: Optional[str] = None
    source: str = "manual" 
    discord_id: Optional[str] = None 
    enrichment_attempts: int = Field(default=0) # Track attempts to avoid infinite retries
    date_added: datetime = Field(default_factory=datetime.utcnow)
    cover_url: Optional[str] = None
    genres: Optional[str] = None
    tmdb_id: Optional[int] = None
    director: Optional[str] = None
    runtime: Optional[int] = None          # minutes
    content_rating: Optional[str] = None   # e.g. "PG-13", "R"
    backdrop_url: Optional[str] = None     # High-res backdrop image
    overview: Optional[str] = None         # Plot summary / synopsis
    
    # Custom Metadata for TV and Manga
    total_seasons: Optional[int] = Field(default=None)
    total_episodes: Optional[int] = Field(default=None)
    manga_status: Optional[str] = Field(default=None)
    total_chapters: Optional[int] = Field(default=None)


class SyncState(SQLModel, table=True):
    """Tracks the last-synced Discord message ID per channel for incremental sync."""
    id: Optional[int] = Field(default=None, primary_key=True)
    channel_id: str = Field(unique=True, index=True)
    last_message_id: str  # Newest message ID seen during last sync
    last_sync_at: datetime = Field(default_factory=datetime.utcnow)

class RatingHistory(SQLModel, table=True):
    """Immutable log of every rating change for every media item."""
    id: Optional[int] = Field(default=None, primary_key=True)
    media_item_id: Optional[int] = Field(default=None, index=True)  # FK to MediaItem (soft ref, no cascade)
    title: str
    media_type: str
    old_rating: Optional[str] = Field(default=None)
    new_rating: Optional[str] = Field(default=None)

    changed_at: datetime = Field(default_factory=datetime.utcnow)

class PassedSuggestion(SQLModel, table=True):
    """Tracks media items the user has passed on, ensuring they are not suggested again."""
    __table_args__ = (UniqueConstraint("type", "tmdb_id", name="unique_passed_suggestion"),)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    type: str = Field(index=True) # e.g. "Movies", "Anime"
    tmdb_id: int = Field(index=True)
    title: Optional[str] = Field(default=None)
    passed_at: datetime = Field(default_factory=datetime.utcnow)

class Recommendation(SQLModel, table=True):
    """Stores recommendations left by users."""
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    year: Optional[int] = Field(default=None, index=True)
    ext_id: Optional[int] = Field(default=None) # TMDB ID or MAL ID
    type: str = Field(index=True) # Movies, TV Series, Manga, Anime
    note: Optional[str] = None
    recommender_name: Optional[str] = None
    date_added: datetime = Field(default_factory=datetime.utcnow)
    
    # Metadata for rich profiles
    cover_url: Optional[str] = None
    genres: Optional[str] = None
    director: Optional[str] = None
    overview: Optional[str] = None
    runtime: Optional[int] = None
    content_rating: Optional[str] = None
    backdrop_url: Optional[str] = None
    status: str = Field(default="pending") # pending, accepted, rejected

import os
from dotenv import load_dotenv

load_dotenv()

# Database Configuration
# Priority: DATABASE_URL (for Supabase/Cloud) -> sqlite_url (for local)
database_url = os.environ.get("DATABASE_URL")

if database_url:
    # Adapt Supabase/Heroku postgres:// to postgresql+psycopg2:// for SQLAlchemy
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg2://", 1)
    engine_url = database_url
    # PostgreSQL doesn't need check_same_thread
    connect_args = {}
else:
    sqlite_file_name = "database.db"
    engine_url = f"sqlite:///{sqlite_file_name}"
    connect_args = {"check_same_thread": False}

engine = create_engine(engine_url, echo=False, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # apply_migrations() # Disabled to prevent slow cold starts on Vercel

def apply_migrations():
    from sqlalchemy import text
    with engine.connect() as conn:
        columns = [
            ("total_seasons", "INTEGER"),
            ("total_episodes", "INTEGER"),
            ("manga_status", "VARCHAR"),
            ("total_chapters", "INTEGER")
        ]
        for col_name, col_type in columns:
            try:
                conn.execute(text(f"ALTER TABLE mediaitem ADD COLUMN {col_name} {col_type}"))
                print(f"[*] Added column {col_name} to mediaitem table.")
            except Exception as e:
                # Ignore error if column already exists
                if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                    pass
                else:
                    print(f"[!] Error adding column {col_name}: {e}")
        conn.commit()
