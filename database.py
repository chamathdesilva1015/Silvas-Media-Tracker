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
    cover_url: Optional[str] = None

class SyncState(SQLModel, table=True):
    """Tracks the last-synced Discord message ID per channel for incremental sync."""
    id: Optional[int] = Field(default=None, primary_key=True)
    channel_id: str = Field(unique=True, index=True)
    last_message_id: str  # Newest message ID seen during last sync
    last_sync_at: datetime = Field(default_factory=datetime.utcnow)

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
