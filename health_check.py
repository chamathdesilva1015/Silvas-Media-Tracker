import sys
import re
import argparse
import collections
from sqlmodel import Session, select
from database import engine, MediaItem


def normalize_title(title: str) -> str:
    """Universal normalizer for semantic identity matching."""
    if not title: return ""
    import string
    t = title.lower().strip()
    for prefix in ["the ", "a ", "an "]:
        if t.startswith(prefix):
            t = t[len(prefix):]
            break
    t = "".join(char for char in t if char not in string.punctuation)
    return " ".join(t.split())


def validate_rating(rating: str) -> bool:
    if not rating: return False
    if rating.startswith('#'):
        return rating[1:].isdigit()
    if '/10' in rating:
        parts = rating.split('/')
        try:
            val = float(parts[0])
            return 0 <= val <= 10
        except ValueError:
            return False
    return False


def run_score_crosslink(session, items, auto_fix=False):
    """
    Pass 5: Score Cross-Linker (Global Auto-Repair).

    For every ranked entry (rating='#N') that is missing a numeric_rating,
    search the database for a same-type, normalised-title Completed entry
    that HAS a score (X/10) and link them.

    This is the permanent, general fix for the 'Ranked item with no rating
    displayed' pattern – it runs on every health check so no manual repair
    is ever needed again.
    """
    issues = []
    fixed = 0

    ranked_missing = [
        m for m in items
        if (m.rating or '').startswith('#') and not m.numeric_rating
    ]
    scored_items = [
        m for m in items
        if not (m.rating or '').startswith('#') and m.rating and '/' in m.rating
    ]

    for ranked in ranked_missing:
        r_norm = normalize_title(ranked.title)
        matched_score = None

        for scored in scored_items:
            if ranked.type != scored.type:
                continue
            if normalize_title(scored.title) != r_norm:
                continue
            # Year guard: never cross-link if both have different years
            if ranked.release_year and scored.release_year:
                if ranked.release_year != scored.release_year:
                    continue
            matched_score = scored.rating
            break

        if matched_score:
            if auto_fix:
                print(f"  [+] Cross-linked: \"{ranked.title}\" ({ranked.rating}) <- score={matched_score}")
                ranked.numeric_rating = matched_score
                session.add(ranked)
                fixed += 1
            else:
                issues.append(
                    f"[Score Missing] \"{ranked.title}\" ({ranked.rating}) has "
                    f"a Completed score ({matched_score}) that is not linked. Run --fix to repair."
                )
        else:
            # Score doesn't exist in DB at all — needs a sync from Discord
            issues.append(
                f"[Score Unsynced] \"{ranked.title}\" ({ranked.rating}) has no score "
                f"anywhere in the DB. Re-run Discord Sync to pull it from the Completed channel."
            )

    return fixed, issues


def run_health_check(auto_fix=False):
    print("=" * 45)
    print(f"  SYSTEM HEALTH AUDITOR {'[AUTO-FIX ACTIVE]' if auto_fix else ''}")
    print("=" * 45)

    with Session(engine) as session:
        items = session.exec(select(MediaItem)).all()
        print(f"Total Items: {len(items)}\n")

        issues = []
        fixed_count = 0

        # ── Pass 1: Duplicate Detection & Cross-Pollination Merge ────────────
        grouped = collections.defaultdict(list)
        for item in items:
            key = (normalize_title(item.title), item.type, item.release_year)
            grouped[key].append(item)

        for key, group in grouped.items():
            if len(group) > 1:
                if auto_fix:
                    sorted_group = sorted(group, key=lambda x: (
                        1 if (x.review and len(x.review) > 20) else 0,
                        1 if x.is_ranking else 0,
                        1 if x.is_liked else 0,
                        x.id
                    ), reverse=True)

                    keep = sorted_group[0]
                    others = sorted_group[1:]

                    print(f"[*] MERGE: Merging duplicates for \"{keep.title}\"...")
                    for other in others:
                        rank_str = None
                        score_str = None

                        for candidate in [keep, other]:
                            r = candidate.rating or ""
                            s = candidate.numeric_rating or ""
                            if r.startswith('#'): rank_str = r
                            elif r: score_str = r
                            if s.startswith('#'): rank_str = s
                            elif s: score_str = s

                        if rank_str:
                            keep.is_ranking = True
                            keep.rating = rank_str
                        if score_str:
                            keep.numeric_rating = score_str
                            if not keep.rating or keep.rating == score_str:
                                keep.rating = rank_str if rank_str else score_str

                        if other.is_liked: keep.is_liked = True
                        if not keep.review and other.review: keep.review = other.review

                        session.delete(other)
                        fixed_count += 1
                    session.add(keep)
                else:
                    ids = [str(i.id) for i in group]
                    issues.append(
                        f"[Duplicate] \"{key[0]}\" exists {len(group)} times. "
                        f"IDs: {', '.join(ids)}"
                    )

        # Re-fetch after merge so subsequent passes see clean data
        session.flush()
        items = session.exec(select(MediaItem)).all()

        # ── Pass 2: Rating Validation ─────────────────────────────────────────
        for item in items:
            if not validate_rating(item.rating):
                issues.append(
                    f"[Rating Error] ID {item.id} (\"{item.title}\") "
                    f"has invalid rating: \"{item.rating}\""
                )

        # ── Pass 3: Missing Metadata ──────────────────────────────────────────
        for item in items:
            if not item.release_year:
                issues.append(
                    f"[Metadata Missing] ID {item.id} (\"{item.title}\") "
                    f"is missing a release year."
                )

        # ── Pass 4: Corruption Purge ──────────────────────────────────────────
        for item in items:
            if item.rating == "ERROR (Check Discord)":
                if auto_fix:
                    print(f"[*] PURGE: Removing corrupted entry ID {item.id} (\"{item.title}\")...")
                    session.delete(item)
                    fixed_count += 1
                else:
                    issues.append(
                        f"[Corruption] ID {item.id} (\"{item.title}\") "
                        f"is corrupted (ERROR rating)."
                    )

        # ── Pass 5: Score Cross-Linker (Global Auto-Repair) ───────────────────
        print("[Pass 5] Running global Score Cross-Linker...")
        cross_fixed, cross_issues = run_score_crosslink(session, items, auto_fix)
        fixed_count += cross_fixed

        # Only bubble up "Score Missing" (fixable), not "Score Unsynced" (need Discord)
        linkable = [i for i in cross_issues if 'Score Missing' in i]
        issues.extend(linkable)

        unsynced_count = sum(1 for i in cross_issues if 'Unsynced' in i)
        if cross_fixed:
            print(f"  -> Linked {cross_fixed} missing scores to ranked entries.")
        if unsynced_count:
            print(f"  -> {unsynced_count} ranked entries have no score in DB yet — run Discord Sync.")
        if not cross_issues:
            print("  -> All ranked entries have scores linked. OK")

        # ── Result Summary ─────────────────────────────────────────────────────
        print()
        if not issues and fixed_count == 0:
            print("Status: ALL CLEAR. Your database is healthy.")
        elif fixed_count > 0:
            session.commit()
            print(f"Success: Automatically repaired {fixed_count} records.")
            if issues:
                print(f"Remaining manual issues ({len(issues)}):")
                for issue in issues:
                    print(f"  {issue}")
        else:
            print(f"Found {len(issues)} issues that require attention:")
            for issue in issues:
                print(f"  {issue}")
            if not auto_fix:
                print("\n[Tip] Run with --fix to automatically repair duplicates and cross-link scores.")

    print("\n" + "=" * 45)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Media Tracker Health Auditor")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Automatically repair duplicates and cross-link ranked scores"
    )
    args = parser.parse_args()
    run_health_check(auto_fix=args.fix)
