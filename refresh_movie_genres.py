import asyncio
from sqlmodel import Session, select
from database import engine, MediaItem
from enrich_data import run_enrichment

async def main():
    print("Starting Aggressive Universal Movie Genre Sync...")
    
    # We want to force re-enrichment to apply the 2-genre rule
    # I'll manually reset progress for Movies category so run_enrichment picks them up
    with Session(engine) as db_session:
        items = db_session.exec(select(MediaItem).where(MediaItem.type == "Movies")).all()
        for item in items:
            # Setting to Imported from Discord forces it to re-enrich
            item.genres = "Imported from Discord" 
            item.enrichment_attempts = 0
            db_session.add(item)
        db_session.commit()
    
    print(f"Reset {len(items)} movies for re-enrichment.")
    
    # Now run the standard enrichment loop for Movies
    await run_enrichment(category="Movies")
    
    print("\nUniversal Movie Refresh Complete.")

if __name__ == "__main__":
    asyncio.run(main())
