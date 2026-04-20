import os
from sqlmodel import Session, select, SQLModel
from database import engine as remote_engine, MediaItem, SyncState
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv()

def migrate():
    # 1. Setup Local Engine (SQLite)
    local_url = "sqlite:///database.db"
    local_engine = create_engine(local_url)
    
    # 2. Verify Remote Connection (Supabase)
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set in .env. Please add your Supabase connection string.")
        return

    print(f"[*] Starting migration to: {database_url.split('@')[-1]}...")
    
    # Create tables on remote if they don't exist
    SQLModel.metadata.create_all(remote_engine)

    with Session(local_engine) as local_session:
        with Session(remote_engine) as remote_session:
            # --- Migrate MediaItems ---
            print("[*] Fetching local MediaItems...")
            local_items = local_session.exec(select(MediaItem)).all()
            print(f"[+] Found {len(local_items)} items. Migrating...")
            
            for item in local_items:
                # Clear ID to allow auto-increment on remote
                item_dict = item.model_dump()
                if "id" in item_dict: del item_dict["id"]
                
                # Check for duplicates on remote before adding
                existing = remote_session.exec(
                    select(MediaItem).where(
                        (MediaItem.title == item.title) & 
                        (MediaItem.type == item.type) & 
                        (MediaItem.release_year == item.release_year)
                    )
                ).first()
                
                if not existing:
                    new_item = MediaItem(**item_dict)
                    remote_session.add(new_item)
            
            # --- Migrate SyncState ---
            print("[*] Fetching local SyncStates...")
            local_states = local_session.exec(select(SyncState)).all()
            for state in local_states:
                existing_state = remote_session.exec(
                    select(SyncState).where(SyncState.channel_id == state.channel_id)
                ).first()
                if not existing_state:
                    state_dict = state.model_dump()
                    if "id" in state_dict: del state_dict["id"]
                    remote_session.add(SyncState(**state_dict))

            print("[*] Committing to Supabase...")
            remote_session.commit()
            print("[SUCCESS] Migration complete!")

if __name__ == "__main__":
    migrate()
