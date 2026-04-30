import os
from audit_engine import run_full_audit
from database import create_db_and_tables

def main():
    print("--- Retroactive Auditor Standalone CLI ---")
    print("Target: Identifying movies you've seen but haven't logged.")
    
    # Ensure DB tables exist
    create_db_and_tables()
    
    def simple_log(msg):
        print(f"[AUDIT] {msg}")

    added = run_full_audit(log=simple_log)
    
    print(f"\n--- Scan Complete ---")
    print(f"Total new suggestions found and added to queue: {added}")
    print("You can now review these in the web UI under 'Retroactive Audit'.")

if __name__ == "__main__":
    main()
