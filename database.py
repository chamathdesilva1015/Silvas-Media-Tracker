from typing import Optional
from sqlmodel import Field, SQLModel, create_engine
from datetime import datetime

class MediaItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    release_year: Optional[int] = None
    genres: Optional[str] = None
    type: str # Movie, TV Series, Manga, Book, Anime
    is_ranking: bool = Field(default=False)
    is_liked: bool = Field(default=False)
    rating: str # e.g. '8.5/10'
    review: Optional[str] = None
    source: str = "manual" # 'manual' or 'discord'
    date_added: datetime = Field(default_factory=datetime.utcnow)
    cover_url: Optional[str] = None

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, echo=True, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
