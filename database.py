from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, UniqueConstraint
from datetime import datetime

class MediaItem(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("title", "type", "release_year", name="unique_media_item"),)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    release_year: Optional[int] = Field(default=None, index=True)
    genres: Optional[str] = None
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

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, echo=True, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
