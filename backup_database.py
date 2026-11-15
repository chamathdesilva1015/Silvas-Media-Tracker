import os
import sys
import json
import gzip
import argparse
import subprocess
from datetime import datetime
from typing import Dict, Any, List

from dotenv import load_dotenv
load_dotenv()

from database import engine, MediaItem, RatingHistory, Recommendation, PassedSuggestion, SyncState
from sqlmodel import Session, select

BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups")

def serialize_model(obj: Any) -> Dict[str, Any]:
    """Serialize SQLModel instance to dictionary with ISO formatted datetimes."""
    data = obj.model_dump()
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data

def run_backup(encrypt: bool = False, key: str = None, output_dir: str = BACKUP_DIR) -> str:
    """Creates a full database backup in JSON format, compresses it with gzip, and optionally encrypts it."""
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    base_filename = f"media_tracker_backup_{timestamp}"
    json_path = os.path.join(output_dir, f"{base_filename}.json")
    gz_path = f"{json_path}.gz"
    enc_path = f"{gz_path}.enc"

    encryption_key = key or os.environ.get("BACKUP_KEY") or os.environ.get("BACKUP_ENCRYPTION_KEY") or os.environ.get("ADMIN_PASSWORD")

    print("[*] Connecting to database and extracting tables...")
    with Session(engine) as session:
        media_items = [serialize_model(m) for m in session.exec(select(MediaItem)).all()]
        rating_history = [serialize_model(r) for r in session.exec(select(RatingHistory)).all()]
        recommendations = [serialize_model(rec) for rec in session.exec(select(Recommendation)).all()]
        passed_suggestions = [serialize_model(p) for p in session.exec(select(PassedSuggestion)).all()]
        sync_state = [serialize_model(s) for s in session.exec(select(SyncState)).all()]

    backup_payload = {
        "metadata": {
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "counts": {
                "media_items": len(media_items),
                "rating_history": len(rating_history),
                "recommendations": len(recommendations),
                "passed_suggestions": len(passed_suggestions),
                "sync_state": len(sync_state),
            }
        },
        "media_items": media_items,
        "rating_history": rating_history,
        "recommendations": recommendations,
        "passed_suggestions": passed_suggestions,
        "sync_state": sync_state
    }

    # 1. Write uncompressed JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(backup_payload, f, indent=2)

    # 2. Compress with gzip
    with open(json_path, "rb") as f_in:
        with gzip.open(gz_path, "wb") as f_out:
            f_out.writelines(f_in)
    
    # Remove uncompressed json file to save space
    if os.path.exists(json_path):
        os.remove(json_path)

    final_file = gz_path

    # 3. Encrypt if requested
    is_encrypted = False
    if encrypt:
        if not encryption_key:
            print("[!] Warning: Encryption requested but no BACKUP_KEY or ADMIN_PASSWORD found. Storing gzipped.")
        else:
            try:
                cmd = [
                    "openssl", "enc", "-aes-256-cbc", "-salt", "-pbkdf2",
                    "-in", gz_path,
                    "-out", enc_path,
                    "-pass", f"pass:{encryption_key}"
                ]
                subprocess.run(cmd, check=True)
                os.remove(gz_path)
                final_file = enc_path
                is_encrypted = True
            except Exception as e:
                print(f"[!] Encryption failed: {e}. Keeping gzipped backup.")

    file_size_kb = os.path.getsize(final_file) / 1024.0

    print("\n" + "=" * 50)
    print("  Media Tracker Database Backup Complete")
    print("=" * 50)
    print(f"Timestamp:       {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Media Items:     {len(media_items):,}")
    print(f"Rating History:  {len(rating_history):,}")
    print(f"Recommendations: {len(recommendations):,}")
    print(f"Output File:     {final_file}")
    print(f"File Size:       {file_size_kb:.1f} KB")
    print(f"Encrypted:       {'Yes (AES-256-CBC)' if is_encrypted else 'No (Plain Gzip)'}")
    print("=" * 50 + "\n")

    return final_file

def run_decrypt(enc_path: str, key: str = None) -> str:
    """Decrypts an AES-256 encrypted backup file."""
    if not os.path.exists(enc_path):
        raise FileNotFoundError(f"File not found: {enc_path}")

    encryption_key = key or os.environ.get("BACKUP_KEY") or os.environ.get("BACKUP_ENCRYPTION_KEY") or os.environ.get("ADMIN_PASSWORD")
    if not encryption_key:
        raise ValueError("Decryption password required via --key or BACKUP_KEY environment variable.")

    out_gz = enc_path.replace(".enc", "")
    if out_gz == enc_path:
        out_gz = enc_path + ".decrypted.gz"

    cmd = [
        "openssl", "enc", "-d", "-aes-256-cbc", "-salt", "-pbkdf2",
        "-in", enc_path,
        "-out", out_gz,
        "-pass", f"pass:{encryption_key}"
    ]
    subprocess.run(cmd, check=True)
    print(f"[+] Decrypted to: {out_gz}")

    # Decompress to JSON
    out_json = out_gz.replace(".gz", "")
    with gzip.open(out_gz, "rb") as f_in:
        with open(out_json, "wb") as f_out:
            f_out.write(f_in.read())
    print(f"[+] Decompressed to: {out_json}")
    return out_json

def run_restore(file_path: str, confirm: bool = False):
    """Restores database records from a JSON or GZ backup file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Backup file not found: {file_path}")

    if file_path.endswith(".enc"):
        raise ValueError("Cannot restore directly from an encrypted (.enc) file. Run with --decrypt first.")

    # Read data
    if file_path.endswith(".gz"):
        with gzip.open(file_path, "rt", encoding="utf-8") as f:
            data = json.load(f)
    else:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

    meta = data.get("metadata", {}).get("counts", {})
    print(f"Backup Metadata: {meta}")

    if not confirm:
        res = input("Are you sure you want to restore? This will upsert records into the database. (y/N): ")
        if res.strip().lower() != "y":
            print("[*] Restore cancelled.")
            return

    with Session(engine) as session:
        # Restore MediaItem
        media_list = data.get("media_items", [])
        print(f"[*] Restoring {len(media_list)} MediaItem records...")
        for item_dict in media_list:
            if "date_added" in item_dict and item_dict["date_added"]:
                item_dict["date_added"] = datetime.fromisoformat(item_dict["date_added"].replace("Z", "+00:00"))
            if "ratings_updated_at" in item_dict and item_dict["ratings_updated_at"]:
                item_dict["ratings_updated_at"] = datetime.fromisoformat(item_dict["ratings_updated_at"].replace("Z", "+00:00"))
            
            existing = session.get(MediaItem, item_dict["id"]) if "id" in item_dict else None
            if not existing:
                item = MediaItem(**item_dict)
                session.add(item)
            else:
                for k, v in item_dict.items():
                    setattr(existing, k, v)
                session.add(existing)

        session.commit()
        print("[+] Restore completed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Media Tracker Database Backup & Restore Utility")
    parser.add_argument("--encrypt", action="store_true", help="Encrypt the backup archive using AES-256")
    parser.add_argument("--key", type=str, default=None, help="Encryption / Decryption password")
    parser.add_argument("--decrypt", type=str, default=None, help="Decrypt an existing .enc file")
    parser.add_argument("--restore", type=str, default=None, help="Restore database from a backup JSON or GZ file")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt on restore")

    args = parser.parse_args()

    if args.decrypt:
        run_decrypt(args.decrypt, key=args.key)
    elif args.restore:
        run_restore(args.restore, confirm=args.yes)
    else:
        run_backup(encrypt=args.encrypt, key=args.key)
