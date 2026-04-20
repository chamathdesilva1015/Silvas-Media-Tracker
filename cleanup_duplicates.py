import os
from sqlmodel import Session, select
from sqlalchemy import text
from dotenv import load_dotenv
from database import engine

load_dotenv()

def cleanup_duplicates():
    print("[*] Starting database deduplication cleanup...")
    with Session(engine) as session:
        # Find all discord_ids that have more than 1 entry
        res = session.exec(text("""
            SELECT discord_id, array_agg(id) as ids, array_agg(release_year) as years
            FROM mediaitem
            WHERE discord_id IS NOT NULL AND discord_id != ''
            GROUP BY discord_id
            HAVING count(*) > 1
        """)).all()
        
        duplicates_found = len(res)
        if duplicates_found == 0:
            print("[✓] No duplicates found.")
            return

        print(f"[!] Found {duplicates_found} messages with duplicated entries.")
        
        deleted_count = 0
        for row in res:
            discord_id = row[0]
            # ids are ordered as they appear, we sort them to keep the OLDEST string ID (lowest number)
            # The oldest one was enriched.
            item_ids = sorted(row[1])
            keep_id = item_ids[0]
            delete_ids = item_ids[1:]
            
            print(f"  - Discord ID {discord_id}: Keeping internal ID {keep_id}, deleting {delete_ids}")
            
            # Execute deletion
            for did in delete_ids:
                session.exec(text("DELETE FROM mediaitem WHERE id = :id"), params={"id": did})
                deleted_count += 1
                
        session.commit()
        print(f"[SUCCESS] Deleted {deleted_count} duplicate items safely.")

if __name__ == "__main__":
    cleanup_duplicates()
