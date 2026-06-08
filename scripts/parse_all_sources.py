"""
parse_all_sources.py
====================
Parse questions from ALL sources:
  1. DOCX files (English_Questions_Only_2262.docx + English_Answers_Only_2262.docx)
  2. Split JSON files (data/questions_1.json … questions_21.json)
  3. Current master (data/questions.json) — as fallback

Then merge, deduplicate, validate, and output:
  - data/questions_master.json  (clean, unique, sequential IDs)
  - data/bank_stats.json        (stats for UI)
  - data/parse_report.txt       (human-readable report)

Run from project root:
    python scripts/parse_all_sources.py
"""

import json
import os
import re
import sys
import zipfile
from collections import Counter, OrderedDict
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR     = PROJECT_ROOT / "data"
SRC_DIR      = PROJECT_ROOT  # DOCX files are at E:\English\

OUTPUT_MASTER = DATA_DIR / "questions_master.json"
OUTPUT_STATS  = DATA_DIR / "bank_stats.json"
OUTPUT_REPORT = DATA_DIR / "parse_report.txt"
BACKUP_DIR    = DATA_DIR / "backup"

# DOCX namespace
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg):
    print(f"  {msg}")

def normalise(text):
    return re.sub(r"\s+", " ", text.strip().lower())

def strip_option_prefix(s):
    """Remove 'A) ', 'B. ', 'A ', etc. from option text."""
    return re.sub(r"^[A-F][\.\)\s]\s*", "", s).strip()

def clean_text(s):
    """Remove extra whitespace, fix common encoding issues."""
    s = s.replace("\u200b", "")  # zero-width space
    s = s.replace("\xa0", " ")   # non-breaking space
    s = re.sub(r"\s+", " ", s).strip()
    return s

# ---------------------------------------------------------------------------
# DOCX parser
# ---------------------------------------------------------------------------

def extract_docx_text(path):
    """Extract raw text from a .docx file via zipfile + XML."""
    with zipfile.ZipFile(path) as z:
        xml_content = z.read("word/document.xml")
    tree = ET.fromstring(xml_content)
    paragraphs = []
    for para in tree.iter(f"{{{W_NS}}}p"):
        texts = []
        for run in para.iter(f"{{{W_NS}}}t"):
            if run.text:
                texts.append(run.text)
        if texts:
            paragraphs.append("".join(texts))
    return "\n".join(paragraphs)


def parse_question_docx(path):
    """
    Parse the questions DOCX. Expected format per question:
        N. [Category] question text
        A. option1
        B. option2
        C. option3
        D. option4
    """
    raw = extract_docx_text(path)
    lines = [l.strip() for l in raw.splitlines() if l.strip()]

    q_pattern = re.compile(r"^(\d+)\.\s*\[([^\]]+)\]\s*(.+)$")
    opt_pattern = re.compile(r"^([A-D])[\.\)]\s*(.+)$")

    questions = []
    current = None

    for line in lines:
        qm = q_pattern.match(line)
        if qm:
            if current:
                questions.append(current)
            current = {
                "id": int(qm.group(1)),
                "category_raw": qm.group(2).strip(),
                "question_text": clean_text(qm.group(3)),
                "options_raw": [],
                "correct_letter": None,
                "source_file": "DOCX_Questions",
            }
        else:
            om = opt_pattern.match(line)
            if om and current:
                current["options_raw"].append(clean_text(om.group(2)))

    if current:
        questions.append(current)

    return questions


def parse_answer_docx(path):
    """Parse the answers DOCX. Expected format: N. X (where X is A/B/C/D)."""
    raw = extract_docx_text(path)
    lines = [l.strip() for l in raw.splitlines() if l.strip()]

    answers = {}
    ans_pattern = re.compile(r"^(\d+)[\.\)]\s*([A-D])\s*$")

    for line in lines:
        m = ans_pattern.match(line)
        if m:
            answers[int(m.group(1))] = m.group(2)

    return answers


def build_docx_questions(q_path, a_path):
    """Merge questions + answers from DOCX files."""
    log(f"Parsing {q_path.name}...")
    raw_qs = parse_question_docx(q_path)
    log(f"  Extracted {len(raw_qs)} raw questions")

    log(f"Parsing {a_path.name}...")
    answers = parse_answer_docx(a_path)
    log(f"  Extracted {len(answers)} answer keys")

    # Map letter → option text
    LETTER_MAP = {"A": 0, "B": 1, "C": 2, "D": 3}

    results = []
    errors = []
    for q in raw_qs:
        qid = q["id"]
        letter = answers.get(qid)
        if not letter:
            errors.append(f"Q{qid}: no answer key found")
            continue
        if len(q["options_raw"]) < 4:
            errors.append(f"Q{qid}: only {len(q['options_raw'])} options (need 4)")
            continue

        idx = LETTER_MAP.get(letter)
        if idx is None or idx >= len(q["options_raw"]):
            errors.append(f"Q{qid}: answer letter {letter} out of range")
            continue

        correct_text = q["options_raw"][idx]
        results.append({
            "id": qid,
            "category": map_category(q["category_raw"]),
            "question_text": q["question_text"],
            "options": q["options_raw"][:4],
            "correct_answer": correct_text,
            "source_file": "English_Questions_Only_2262",
        })

    log(f"  Built {len(results)} valid questions ({len(errors)} errors)")
    return results, errors


# ---------------------------------------------------------------------------
# Category mapper
# ---------------------------------------------------------------------------

CATEGORY_MAP = {
    "Grammar": "Grammar",
    "Vocabulary": "Vocabulary",
    "Prepositions": "Grammar",
    "Tenses": "Grammar",
    "Passive Voice": "Grammar",
    "Conditionals": "Grammar",
    "Articles": "Grammar",
    "Reported Speech": "Grammar",
    "Comparatives": "Grammar",
    "IT & Technology": "IT & Technology",
    "Reading Comprehension": "Reading Comprehension",
}

def map_category(raw):
    return CATEGORY_MAP.get(raw, raw.strip())


# ---------------------------------------------------------------------------
# JSON file parser
# ---------------------------------------------------------------------------

def parse_json_file(path):
    """Parse a single questions_*.json file."""
    try:
        raw = path.read_text(encoding="utf-8")
        # Strip JS-style line comments if present
        cleaned = re.sub(r"^\s*//.*$", "", raw, flags=re.MULTILINE)
        data = json.loads(cleaned)
        if not isinstance(data, list):
            return [], f"top-level is not an array"

        results = []
        for q in data:
            # New schema (question_text, correct_answer)
            if "question_text" in q and "correct_answer" in q:
                opts = q.get("options", [])
                # Strip "A) " prefixes for clean output
                clean_opts = [strip_option_prefix(o) for o in opts]
                correct = strip_option_prefix(q.get("correct_answer", ""))
                results.append({
                    "id": q.get("id", 0),
                    "category": q.get("category", "Unknown"),
                    "question_text": clean_text(q["question_text"]),
                    "options": clean_opts[:4],
                    "correct_answer": correct,
                    "source_file": path.stem,
                })
            # Old schema (question, correctAnswer)
            elif "question" in q and "correctAnswer" in q:
                results.append({
                    "id": q.get("id", 0),
                    "category": q.get("category", "Unknown"),
                    "question_text": clean_text(q["question"]),
                    "options": q.get("options", [])[:4],
                    "correct_answer": q.get("correctAnswer", ""),
                    "source_file": path.stem,
                })
            else:
                continue

        return results, None
    except Exception as e:
        return [], str(e)


def parse_all_split_files(data_dir):
    """Parse all questions_*.json files in data/."""
    all_q = []
    all_err = []
    files = sorted(data_dir.glob("questions_*.json"))
    for f in files:
        qs, err = parse_json_file(f)
        all_q.extend(qs)
        if err:
            all_err.append(f"{f.name}: {err}")
        else:
            log(f"  {f.name}: {len(qs)} questions")
    return all_q, all_err


# ---------------------------------------------------------------------------
# Merge + dedup + validate
# ---------------------------------------------------------------------------

def validate_entry(q, idx):
    """Validate a single question entry. Returns (ok, reason)."""
    if not isinstance(q.get("question_text", ""), str) or len(q["question_text"].strip()) < 5:
        return False, "question_text too short"
    opts = q.get("options", [])
    if len(opts) < 2 or len(opts) > 6:
        return False, f"options has {len(opts)} items"
    for o in opts:
        if not isinstance(o, str) or not o.strip():
            return False, "empty option"
    correct = q.get("correct_answer", "")
    if not correct:
        return False, "missing correct_answer"
    # Check correct_answer matches one of the options (fuzzy: after stripping)
    stripped_opts = [strip_option_prefix(o) for o in opts]
    if correct not in stripped_opts and correct not in opts:
        return False, f"correct_answer '{correct[:40]}' not in options"
    return True, ""


def merge_and_dedup(all_questions):
    """
    Merge all sources, deduplicate by normalised question_text,
    validate, and assign sequential IDs.
    """
    seen = set()
    unique = []
    dupes = 0
    invalid = 0
    errors_log = []

    for i, q in enumerate(all_questions):
        ok, reason = validate_entry(q, i)
        if not ok:
            invalid += 1
            errors_log.append(f"#{i} [{q.get('source_file','?')}]: {reason}")
            continue

        norm = normalise(q["question_text"])
        if norm in seen:
            dupes += 1
            continue
        seen.add(norm)
        unique.append(q)

    # Assign sequential IDs
    for i, q in enumerate(unique, 1):
        q["id"] = i

    return unique, dupes, invalid, errors_log


# ---------------------------------------------------------------------------
# Stats generator
# ---------------------------------------------------------------------------

def generate_stats(questions, total_raw, dupes_removed, invalid_skipped):
    """Generate bank_stats.json content."""
    cat_counts = Counter(q["category"] for q in questions)

    # Answer distribution (which letter position is correct)
    letter_counts = Counter()
    for q in questions:
        opts = q["options"]
        correct = q["correct_answer"]
        if correct in opts:
            idx = opts.index(correct)
            letter_counts[["A", "B", "C", "D"][idx]] += 1

    total = len(questions)
    return {
        "total_unique_questions": total,
        "total_parsed": total_raw,
        "duplicates_removed": dupes_removed,
        "invalid_skipped": invalid_skipped,
        "categories": dict(sorted(cat_counts.items())),
        "options_distribution": {
            "A": letter_counts.get("A", 0),
            "B": letter_counts.get("B", 0),
            "C": letter_counts.get("C", 0),
            "D": letter_counts.get("D", 0),
        },
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  Parse all sources → questions_master.json + bank_stats.json")
    print("=" * 60)

    all_questions = []
    all_errors = []

    # ── 1. Parse DOCX files ─────────────────────────────────────────────
    log_step(1, "Parse DOCX files")
    docx_q = SRC_DIR / "English_Questions_Only_2262.docx"
    docx_a = SRC_DIR / "English_Answers_Only_2262.docx"
    if docx_q.exists() and docx_a.exists():
        qs, errs = build_docx_questions(docx_q, docx_a)
        all_questions.extend(qs)
        all_errors.extend(errs)
        log(f"  DOCX total: {len(qs)} valid, {len(errs)} errors")
    else:
        log("  ⚠️  DOCX files not found, skipping")

    # ── 2. Parse split JSON files ───────────────────────────────────────
    log_step(2, "Parse split JSON files (questions_*.json)")
    json_qs, json_errs = parse_all_split_files(DATA_DIR)
    all_questions.extend(json_qs)
    all_errors.extend(json_errs)
    log(f"  JSON total: {len(json_qs)} valid, {len(json_errs)} errors")

    # ── 3. Parse current master as fallback ─────────────────────────────
    master_file = DATA_DIR / "questions.json"
    if master_file.exists():
        log_step(3, "Parse current master (fallback)")
        m_qs, m_err = parse_json_file(master_file)
        all_questions.extend(m_qs)
        if m_err:
            all_errors.append(f"questions.json: {m_err}")
        log(f"  Master total: {len(m_qs)} valid")

    # ── 4. Merge + dedup + validate ─────────────────────────────────────
    total_raw = len(all_questions)
    log_step(4, f"Merge + dedup ({total_raw} raw entries)")
    unique, dupes, invalid, val_errors = merge_and_dedup(all_questions)
    all_errors.extend(val_errors)
    log(f"  ✅ {len(unique)} unique questions kept")
    log(f"  ⚠️  {dupes} duplicates removed")
    log(f"  ❌ {invalid} invalid entries skipped")

    # ── 5. Write questions_master.json ──────────────────────────────────
    log_step(5, "Write questions_master.json")
    OUTPUT_MASTER.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(unique, indent=2, ensure_ascii=False)
    OUTPUT_MASTER.write_text(text, encoding="utf-8")
    log(f"  ✅ {len(unique)} questions → {OUTPUT_MASTER.name} ({len(text)//1024} KB)")

    # ── 6. Write bank_stats.json ────────────────────────────────────────
    log_step(6, "Write bank_stats.json")
    stats = generate_stats(unique, total_raw, dupes, invalid)
    OUTPUT_STATS.write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"  ✅ Stats → {OUTPUT_STATS.name}")

    # ── 7. Write parse report ───────────────────────────────────────────
    log_step(7, "Write parse_report.txt")
    report = render_report(stats, all_errors)
    OUTPUT_REPORT.write_text(report, encoding="utf-8")
    log(f"  ✅ Report → {OUTPUT_REPORT.name}")

    # ── Summary ─────────────────────────────────────────────────────────
    print("\n" + "─" * 60)
    print(report)
    print("─" * 60)


def log_step(n, msg):
    print(f"\n[{n}] {msg}")


def render_report(stats, errors):
    lines = []
    lines.append("=" * 60)
    lines.append("  QUESTION BANK PARSING REPORT")
    lines.append("=" * 60)
    lines.append(f"Timestamp:  {datetime.now().isoformat(timespec='seconds')}")
    lines.append("")
    lines.append("─ Counts ─")
    lines.append(f"  Total parsed:      {stats['total_parsed']}")
    lines.append(f"  Duplicates removed: {stats['duplicates_removed']}")
    lines.append(f"  Invalid skipped:   {stats['invalid_skipped']}")
    lines.append(f"  Final unique:      {stats['total_unique_questions']}")
    lines.append("")
    lines.append("─ Categories ─")
    for cat, n in stats["categories"].items():
        lines.append(f"  {cat:<30} {n}")
    lines.append("")
    lines.append("─ Answer Distribution ─")
    for letter, n in stats["options_distribution"].items():
        pct = round(100 * n / max(stats["total_unique_questions"], 1), 1)
        lines.append(f"  {letter}: {n} ({pct}%)")
    lines.append("")
    if errors:
        lines.append(f"─ Errors/Skipped ({len(errors)} total, first 20) ─")
        for e in errors[:20]:
            lines.append(f"  ✗ {e}")
        if len(errors) > 20:
            lines.append(f"  ... and {len(errors)-20} more")
    lines.append("=" * 60)
    return "\n".join(lines)


if __name__ == "__main__":
    main()
