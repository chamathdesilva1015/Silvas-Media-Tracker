from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, UniqueConstraint
from datetime import datetime

class MediaItem(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("title", "type", "release_year", name="unique_media_item"),)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    release_year: Optional[int] = Field(default=None, index=True)

    type: str # Movies, TV Series, Manga, Book, Anime
    is_ranking: bool = Field(default=False)
    is_liked: bool = Field(default=False)
    rating: str 
    numeric_rating: Optional[str] = None # Stores 1-10 rating even for ranked items
    review: Optional[str] = None
    source: str = "manual" 
    discord_id: Optional[str] = None 
    enrichment_attempts: int = Field(default=0) # Track attempts to avoid infinite retries
    date_added: datetime = Field(default_factory=datetime.utcnow)


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
    old_rating: str
    new_rating: str
    changed_at: datetime = Field(default_factory=datetime.utcnow)


class AuditQueue(SQLModel, table=True):
    """Temporary holding table for Retroactive Auditor suggestions.
    Movies stay here until the user confirms (→ MediaItem) or rejects (→ EternalBlacklist)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    tmdb_id: int = Field(index=True, unique=True)       # Canonical TMDB ID — prevents duplicates
    title: str
    release_year: Optional[int] = None
    scan_source: str                                     # 'franchise' | 'blockbuster' | 'childhood' | 'director'
    reason: str                                          # Human-readable: "Franchise: Toy Story 1 in DB"
    popularity: float = Field(default=0.0)              # TMDB popularity score — used for queue ordering
    queued_at: datetime = Field(default_factory=datetime.utcnow)


class EternalBlacklist(SQLModel, table=True):
    """Movies the user has explicitly rejected — never surface these again."""
    id: Optional[int] = Field(default=None, primary_key=True)
    tmdb_id: int = Field(index=True, unique=True)
    title: str
    rejected_at: datetime = Field(default_factory=datetime.utcnow)


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
