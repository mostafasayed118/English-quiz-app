"""
append_questions.py
===================
Safely APPEND new questions to the existing question bank without
overwriting, deleting, or modifying any existing data.

Usage:
    python scripts/append_questions.py
    python scripts/append_questions.py --new-file path/to/new.json
    python scripts/append_questions.py --dry-run

Inputs:
    Existing bank: data/questions.json
    New questions: data/input/new_questions.json (configurable via --new-file)

Outputs:
    Updated bank:  data/questions.json (atomic replace)
    Backup:        data/backup/questions_backup_YYYYMMDD_HHMMSS.json
    Report:        data/merge_report.txt
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths (relative to project root)
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR     = PROJECT_ROOT / "data"
BACKUP_DIR   = DATA_DIR / "backup"
MASTER_FILE  = DATA_DIR / "questions.json"
INPUT_DIR    = DATA_DIR / "input"
REPORT_FILE  = DATA_DIR / "merge_report.txt"

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = {
    "id":             int,
    "category":       str,
    "cefr_level":     str,
    "question_type":  str,
    "question_text":  str,
    "options":        list,
    "correct_answer": str,
    "explanation":    str,
    "tags":           list,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"  {msg}")

def log_step(n: int, msg: str) -> None:
    print(f"\n[{n}] {msg}")

def ts() -> str:
    """Timestamp string for filenames: YYYYMMDD_HHMMSS."""
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def normalise(text: str) -> str:
    """Lowercase, collapse whitespace, strip — used for dedup comparison."""
    return re.sub(r"\s+", " ", text.strip().lower())


def atomic_write(path: Path, content: str) -> None:
    """
    Write `content` to `path` atomically:
      1. Write to a temp file in the same directory.
      2. fsync.
      3. os.replace (atomic on POSIX, best-effort on Windows).
    """
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
            f.flush()
            try:
                os.fsync(f.fileno())
            except OSError:
                pass  # best-effort
        os.replace(tmp_name, str(path))
    except Exception:
        try:
            Path(tmp_name).unlink()
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class ValidationError(ValueError):
    pass


def validate_question(raw: Any, idx: int, source: str) -> dict:
    """Validate one entry against the schema. Returns the entry on success."""
    if not isinstance(raw, dict):
        raise ValidationError(f"entry #{idx} is not an object")

    # Required fields
    missing = [f for f in REQUIRED_FIELDS if f not in raw]
    if missing:
        raise ValidationError(f"missing field(s): {', '.join(missing)}")

    # Type checks
    for field, expected in REQUIRED_FIELDS.items():
        val = raw[field]
        if expected is int and isinstance(val, bool):
            raise ValidationError(f"`{field}` must be int, got bool")
        if not isinstance(val, expected):
            raise ValidationError(
                f"`{field}` must be {expected.__name__}, got {type(val).__name__}"
            )

    # id must be a positive integer
    if raw["id"] < 1:
        raise ValidationError(f"`id` must be >= 1, got {raw['id']}")

    # options: 2–6 items, all non-empty strings
    opts = raw["options"]
    if len(opts) < 2 or len(opts) > 6:
        raise ValidationError(f"`options` has {len(opts)} items, need 2–6")
    for i, o in enumerate(opts):
        if not isinstance(o, str) or not o.strip():
            raise ValidationError(f"`options[{i}]` is empty or not a string")

    # correct_answer must be one of the options
    if raw["correct_answer"] not in opts:
        raise ValidationError(
            f"`correct_answer` {raw['correct_answer']!r} not in `options`"
        )

    # question_text must be meaningful
    if len(raw["question_text"].strip()) < 5:
        raise ValidationError("`question_text` is too short (<5 chars)")

    # tags must be a list of strings
    for i, t in enumerate(raw["tags"]):
        if not isinstance(t, str):
            raise ValidationError(f"`tags[{i}]` is not a string")

    # Coerce id to int if string-number
    if isinstance(raw["id"], str) and raw["id"].isdigit():
        raw["id"] = int(raw["id"])

    # tags: strip whitespace
    raw["tags"] = [str(t).strip() for t in raw["tags"]]

    return raw


# ---------------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------------

def backup_master() -> Path | None:
    """Create a timestamped copy of the master file. Returns path or None."""
    if not MASTER_FILE.exists():
        log("No existing master file to back up.")
        return None
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BACKUP_DIR / f"questions_backup_{ts()}.json"
    shutil.copy2(MASTER_FILE, dest)
    log(f"✅ Backup created: {dest.name}")
    return dest


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

from typing import Any


def run(new_file: Path, dry_run: bool = False) -> None:
    print("=" * 60)
    print("  Append new questions to the master bank")
    print("=" * 60)

    # ── 1. Load existing master ─────────────────────────────────────────
    log_step(1, "Load existing master file")
    if MASTER_FILE.exists():
        with open(MASTER_FILE, encoding="utf-8") as f:
            existing: list[dict] = json.load(f)
        log(f"✅ Loaded {len(existing)} existing questions from {MASTER_FILE.name}")
    else:
        existing = []
        log("⚠️  No existing master file — will create a new one.")

    # Build dedup index: normalised question_text → True
    existing_norms: set[str] = {normalise(q["question_text"]) for q in existing}
    existing_ids: set[int] = {q["id"] for q in existing}

    # ── 2. Backup ───────────────────────────────────────────────────────
    log_step(2, "Backup existing master")
    backup_path = backup_master()

    # ── 3. Load new questions ───────────────────────────────────────────
    log_step(3, f"Load new questions from {new_file.name}")
    if not new_file.exists():
        log(f"❌ File not found: {new_file}")
        sys.exit(1)

    try:
        with open(new_file, encoding="utf-8") as f:
            new_raw: list[dict] = json.load(f)
    except json.JSONDecodeError as e:
        log(f"❌ Invalid JSON: {e}")
        sys.exit(1)

    if not isinstance(new_raw, list):
        log("❌ Top-level JSON is not an array.")
        sys.exit(1)

    log(f"   Read {len(new_raw)} entries from {new_file.name}")

    # ── 4. Validate + dedup + auto-increment IDs ────────────────────────
    log_step(4, "Validate, deduplicate, assign IDs")

    added: list[dict] = []
    skipped_dupes: list[str] = []
    rejected: list[str] = []
    max_id = max(existing_ids) if existing_ids else 0
    next_id = max_id + 1

    for idx, entry in enumerate(new_raw):
        # 4a. Schema validation
        try:
            validated = validate_question(entry, idx, new_file.name)
        except ValidationError as ve:
            rejected.append(f"#{idx}: {ve}")
            log(f"   ⚠️  Rejected #{idx}: {ve}")
            continue

        # 4b. Deduplication (case-insensitive, trimmed)
        norm = normalise(validated["question_text"])
        if norm in existing_norms or norm in {normalise(a["question_text"]) for a in added}:
            skipped_dupes.append(validated["question_text"][:80])
            log(f"   ⚠️  Duplicate skipped: {validated['question_text'][:60]}...")
            continue

        # 4c. Assign new sequential ID (ignore original id)
        validated["id"] = next_id
        next_id += 1

        added.append(validated)
        existing_norms.add(norm)

    log(f"   ✅ {len(added)} questions ready to append")
    if skipped_dupes:
        log(f"   ⚠️  {len(skipped_dupes)} duplicates skipped")
    if rejected:
        log(f"   ❌ {len(rejected)} entries rejected (schema errors)")

    # ── 5. Merge ────────────────────────────────────────────────────────
    log_step(5, "Merge into master")
    merged = existing + added
    log(f"   {len(existing)} existing + {len(added)} new = {len(merged)} total")

    # ── 6. Atomic write ─────────────────────────────────────────────────
    log_step(6, "Write master file")
    if dry_run:
        log("   🏴 DRY RUN — would write, but skipping.")
    else:
        MASTER_FILE.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(merged, indent=2, ensure_ascii=False)
        atomic_write(MASTER_FILE, text)
        log(f"   ✅ Written: {MASTER_FILE.name} ({len(merged)} questions, "
            f"{len(text) / 1024:.1f} KB)")

    # ── 7. Migration report ─────────────────────────────────────────────
    log_step(7, "Generate merge report")
    report = render_report(
        existing_count=len(existing),
        new_count=len(new_raw),
        added_count=len(added),
        dupe_count=len(skipped_dupes),
        reject_count=len(rejected),
        final_count=len(merged),
        dupes=skipped_dupes,
        rejects=rejected,
        backup_path=backup_path,
        dry_run=dry_run,
    )
    if not dry_run:
        REPORT_FILE.write_text(report, encoding="utf-8")
        log(f"   ✅ Report: {REPORT_FILE.name}")

    # Print summary
    print("\n" + "─" * 60)
    print(report)
    print("─" * 60)


# ---------------------------------------------------------------------------
# Report renderer
# ---------------------------------------------------------------------------

def render_report(
    existing_count: int,
    new_count: int,
    added_count: int,
    dupe_count: int,
    reject_count: int,
    final_count: int,
    dupes: list[str],
    rejects: list[str],
    backup_path: Path | None,
    dry_run: bool,
) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("  APPEND MERGE REPORT")
    lines.append("=" * 60)
    lines.append(f"Timestamp:        {datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"Mode:             {'DRY RUN' if dry_run else 'LIVE'}")
    lines.append("")
    lines.append("─ Summary ─")
    lines.append(f"  Existing questions:    {existing_count}")
    lines.append(f"  New questions (input): {new_count}")
    lines.append(f"  Successfully added:    {added_count}")
    lines.append(f"  Duplicates skipped:    {dupe_count}")
    lines.append(f"  Invalid (rejected):    {reject_count}")
    lines.append(f"  Final total:           {final_count}")
    lines.append("")

    if dupes:
        lines.append("─ Duplicates (first 20) ─")
        for d in dupes[:20]:
            lines.append(f"  • {d}")
        if len(dupes) > 20:
            lines.append(f"  ... and {len(dupes) - 20} more")
        lines.append("")

    if rejects:
        lines.append("─ Rejected entries (first 20) ─")
        for r in rejects[:20]:
            lines.append(f"  ✗ {r}")
        if len(rejects) > 20:
            lines.append(f"  ... and {len(rejects) - 20} more")
        lines.append("")

    if backup_path:
        lines.append(f"─ Backup ─\n  {backup_path}")

    lines.append("=" * 60)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Append new questions to the master bank."
    )
    parser.add_argument(
        "--new-file",
        default=str(INPUT_DIR / "new_questions.json"),
        help="Path to the new questions JSON file.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and report, but do not write the master file.",
    )
    args = parser.parse_args()

    new_file = Path(args.new_file).resolve()
    if not new_file.exists():
        # Try relative to project root
        new_file = PROJECT_ROOT / args.new_file
    if not new_file.exists():
        print(f"❌ New questions file not found: {args.new_file}")
        print(f"   Expected location: {INPUT_DIR / 'new_questions.json'}")
        print(f"   Or specify with:   python scripts/append_questions.py --new-file path/to/file.json")
        sys.exit(1)

    run(new_file, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
