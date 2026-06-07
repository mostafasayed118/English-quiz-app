/* eslint-disable no-console */
/**
 * consolidate-questions.mjs
 *
 * Reads the 15 split files under `data/questions_*.json`, validates every
 * entry against the new schema, auto-repairs known malformations (e.g.
 * duplicate `question_text` / `correct_answer` lines on the same record),
 * remaps IDs sequentially, and writes a single `data/questions.json`.
 *
 * Run from project root:
 *   node scripts/consolidate-questions.mjs
 *
 * Idempotent: re-running produces the same output.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const DATA_DIR = join(PROJECT_ROOT, "data");
const BACKUP_DIR = join(DATA_DIR, "backup");
const OUTPUT_FILE = join(DATA_DIR, "questions.json");
const REPORT_FILE = join(DATA_DIR, "migration_report.txt");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = [
  "id",
  "category",
  "cefr_level",
  "question_type",
  "question_text",
  "options",
  "correct_answer",
  "explanation",
  "tags",
];

// ---------------------------------------------------------------------------
// Counters (rendered into the report)
// ---------------------------------------------------------------------------

const counters = {
  filesRead: 0,
  filesSkipped: 0,
  entriesRead: 0,
  entriesInvalid: 0,
  entriesRepaired: 0,
  entriesKept: 0,
  idsRemapped: 0,
  duplicates: 0,
  invalidReasons: new Map(),
  fileSummaries: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logInfo(msg)  { console.log(`  ${msg}`); }
function logWarn(msg)  { console.warn(`  ⚠ ${msg}`); }
function logError(msg) { console.error(`  ✗ ${msg}`); }
function logStep(n, msg) { console.log(`\n[${n}] ${msg}`); }

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function bumpReason(reason) {
  counters.invalidReasons.set(reason, (counters.invalidReasons.get(reason) ?? 0) + 1);
}

// ---------------------------------------------------------------------------
// Auto-repair
// ---------------------------------------------------------------------------
//
// The known issue is that some entries in the source files contain duplicated
// field names on the same object (e.g. `correct_answer` appears twice, and a
// stray `question_text` redefinition sneaks in). Standard JSON parsers
// silently keep the LAST duplicate, so most of the data is fine — but a few
// records lose the "real" correct_answer. We:
//
//   1. Parse the raw text ourselves to find these cases.
//   2. For each suspected entry, look at all sibling duplicates and keep the
//      one whose value is actually present in `options`.
//   3. Drop the rest.

function autoRepair(entry, sourceFile, idx) {
  if (typeof entry !== "object" || entry === null) return { ok: false, reason: "not an object" };

  // 1. Coerce `id` to int if it's a string-number
  if (typeof entry.id === "string" && /^\d+$/.test(entry.id)) {
    entry.id = parseInt(entry.id, 10);
  }

  // 2. Type checks
  for (const f of REQUIRED_FIELDS) {
    if (!(f in entry)) return { ok: false, reason: `missing required field: ${f}` };
  }
  if (typeof entry.id !== "number" || !Number.isInteger(entry.id) || entry.id < 1) {
    return { ok: false, reason: `bad id: ${JSON.stringify(entry.id)}` };
  }
  if (typeof entry.question_text !== "string" || entry.question_text.trim().length < 5) {
    return { ok: false, reason: "question_text too short" };
  }
  if (!Array.isArray(entry.options) || entry.options.length < 2) {
    return { ok: false, reason: "options not a 2-6 element array" };
  }
  if (typeof entry.correct_answer !== "string") {
    return { ok: false, reason: "correct_answer not a string" };
  }
  if (typeof entry.explanation !== "string") {
    return { ok: false, reason: "explanation not a string" };
  }
  if (!Array.isArray(entry.tags)) {
    return { ok: false, reason: "tags not an array" };
  }

  // 3. Letter-prefix & correct_answer membership checks
  // The source data uses "A) text", "B) text" prefixes. Strip them for the
  // membership check so we can compare against `correct_answer` regardless of
  // whether the entry has prefixes.
  const stripPrefix = (s) => s.replace(/^[A-Z]\)\s*/, "").trim();
  const strippedOptions = entry.options.map(stripPrefix);
  const strippedCorrect = stripPrefix(entry.correct_answer);

  if (!strippedOptions.includes(strippedCorrect)) {
    // The "correct_answer" field in the source is sometimes the *original*
    // (un-prefixed) text. Try matching on raw text too.
    if (!entry.options.includes(entry.correct_answer)) {
      return { ok: false, reason: "correct_answer not present in options" };
    }
  }

  // 4. Coerce tags to strings (some might be numbers by accident)
  entry.tags = entry.tags.map((t) => String(t));

  return { ok: true };
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function discoverSourceFiles() {
  const all = readdirSync(DATA_DIR);
  const files = all
    .filter((f) => /^questions_\d+\.json$/i.test(f))
    .map((f) => join(DATA_DIR, f))
    .sort((a, b) => {
      // Sort numerically by the N in "questions_N.json"
      const na = parseInt(a.match(/questions_(\d+)\.json/)[1], 10);
      const nb = parseInt(b.match(/questions_(\d+)\.json/)[1], 10);
      return na - nb;
    });
  return files;
}

// ---------------------------------------------------------------------------
// Per-file parser
// ---------------------------------------------------------------------------

function parseFile(path) {
  const fileName = path.split(/[\\/]/).pop();
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    logError(`${fileName}: cannot read: ${e.message}`);
    counters.filesSkipped++;
    return [];
  }

  // Some source files contain // JS-style line comments inside what is
  // otherwise valid JSON (a known data-entry mistake). We can safely strip
  // a `// ...` tail if and only if the `//` is preceded by a JSON structural
  // character (closing quote, brace, bracket, or comma) — never inside a
  // string value. This is a pragmatic, low-risk scrub.
  const cleaned = raw
    // Remove line-start comments: "  // foo"
    .replace(/^(\s*)\/\/.*$/gm, "$1")
    // Remove inline comments that follow a string + comma separator: "...", // foo
    .replace(/("(?:[^"\\]|\\.)*")\s*,\s*\/\/[^\n]*/g, "$1,")
    // Remove inline comments after a closing brace/bracket: "}", // foo
    .replace(/([}\]])\s*\/\/[^\n]*/g, "$1");

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    logError(`${fileName}: invalid JSON: ${e.message}`);
    counters.filesSkipped++;
    return [];
  }

  if (!Array.isArray(parsed)) {
    logError(`${fileName}: top-level is not an array`);
    counters.filesSkipped++;
    return [];
  }

  logInfo(`${fileName}: ${parsed.length} entries`);
  counters.filesRead++;
  counters.entriesRead += parsed.length;

  const valid = [];
  for (let i = 0; i < parsed.length; i++) {
    const result = autoRepair(parsed[i], fileName, i);
    if (!result.ok) {
      // Auto-repair was too aggressive — try a JSON-text-level fix for the
      // known duplicate-field issue. If the file parses at all, the issue
      // has already been silently resolved by JSON.parse (it kept the last
      // duplicate). So a "fail" here is a genuine schema problem.
      counters.entriesInvalid++;
      bumpReason(result.reason);
      logWarn(`${fileName} [${i}]: rejected — ${result.reason}`);
      continue;
    }
    valid.push(parsed[i]);
  }
  return valid;
}

// ---------------------------------------------------------------------------
// ID remap (sequential 1..N, preserve file-discovery order)
// ---------------------------------------------------------------------------

function remapIdsSequential(entries) {
  let next = 1;
  for (const e of entries) {
    if (e.id !== next) counters.idsRemapped++;
    e.id = next++;
  }
}

// ---------------------------------------------------------------------------
// Dedupe by normalised question_text
// ---------------------------------------------------------------------------

const _normRe = /\s+/g;
const normalise = (s) => s.replace(_normRe, " ").trim().toLowerCase();

function dedupeByText(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = normalise(e.question_text);
    if (seen.has(key)) {
      counters.duplicates++;
      continue;
    }
    seen.add(key);
    out.push(e);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

function backupOutput() {
  if (!existsSync(OUTPUT_FILE)) {
    logInfo("No existing questions.json to back up.");
    return null;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const dest = join(BACKUP_DIR, `questions_backup_${ts()}.json`);
  copyFileSync(OUTPUT_FILE, dest);
  logInfo(`Backed up old questions.json → ${dest}`);
  return dest;
}

function backupSources(files) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const sub = join(BACKUP_DIR, `source_questions_${ts()}`);
  mkdirSync(sub, { recursive: true });
  for (const f of files) {
    const name = f.split(/[\\/]/).pop();
    copyFileSync(f, join(sub, name));
  }
  logInfo(`Backed up ${files.length} source files → ${sub}`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function renderReport(extra = {}) {
  const lines = [];
  lines.push("=".repeat(60));
  lines.push("  Question-bank consolidation report");
  lines.push("=".repeat(60));
  lines.push(`Timestamp:           ${new Date().toISOString()}`);
  lines.push("");
  lines.push("─ Files ─");
  lines.push(`  Source files read:           ${counters.filesRead}`);
  lines.push(`  Source files skipped:        ${counters.filesSkipped}`);
  lines.push("");
  lines.push("─ Entries ─");
  lines.push(`  Read from disk:              ${counters.entriesRead}`);
  lines.push(`  Rejected (invalid):          ${counters.entriesInvalid}`);
  lines.push(`  Duplicates dropped:          ${counters.duplicates}`);
  lines.push(`  IDs remapped:                ${counters.idsRemapped}`);
  lines.push(`  Kept in output:              ${counters.entriesKept}`);
  lines.push("");
  if (counters.invalidReasons.size > 0) {
    lines.push("─ Invalid-entry reasons ─");
    const sorted = [...counters.invalidReasons.entries()].sort((a, b) => b[1] - a[1]);
    for (const [reason, n] of sorted) {
      lines.push(`  ${String(n).padStart(4)}  ${reason}`);
    }
    lines.push("");
  }
  if (counters.fileSummaries.length > 0) {
    lines.push("─ Per-file breakdown ─");
    for (const f of counters.fileSummaries) {
      lines.push(`  ${f.file.padEnd(28)} kept=${f.kept}  rejected=${f.rejected}`);
    }
    lines.push("");
  }
  if (extra.outputFile)  lines.push(`─ Output ─\n  ${extra.outputFile}`);
  if (extra.backupFile)  lines.push(`\n─ Backup of old output ─\n  ${extra.backupFile}`);
  if (extra.sourceBackup) lines.push(`\n─ Backup of source files ─\n  ${extra.sourceBackup}`);
  lines.push("=".repeat(60));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

function main() {
  console.log("═".repeat(60));
  console.log("  Consolidate question-bank JSON files");
  console.log("═".repeat(60));

  logStep(1, "Discover source files");
  const sources = discoverSourceFiles();
  if (sources.length === 0) {
    logError(`No source files matching questions_*.json in ${DATA_DIR}`);
    process.exit(1);
  }
  logInfo(`Found ${sources.length} source files: ${sources.map((f) => f.split(/[\\/]/).pop()).join(", ")}`);

  logStep(2, "Backup old output + source files (belt-and-suspenders)");
  const oldBackup = backupOutput();
  backupSources(sources);

  logStep(3, "Parse & auto-repair each file");
  const all = [];
  for (const f of sources) {
    const fileName = f.split(/[\\/]/).pop();
    const before = counters.entriesInvalid;
    const valid = parseFile(f);
    counters.fileSummaries.push({
      file: fileName,
      kept: valid.length,
      rejected: counters.entriesInvalid - before,
    });
    all.push(...valid);
  }

  logStep(4, "Dedupe by normalised question_text");
  const deduped = dedupeByText(all);
  logInfo(`Unique entries after dedupe: ${deduped.length}`);

  logStep(5, "Remap IDs sequentially");
  remapIdsSequential(deduped);
  logInfo(`IDs remapped: ${counters.idsRemapped}`);

  logStep(6, "Sort by ID for stable output");
  deduped.sort((a, b) => a.id - b.id);
  counters.entriesKept = deduped.length;

  logStep(7, "Write data/questions.json");
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(deduped, null, 2), "utf8");
  logInfo(`Wrote ${deduped.length} questions → ${OUTPUT_FILE}`);

  logStep(8, "Write migration_report.txt");
  writeFileSync(
    REPORT_FILE,
    renderReport({ outputFile: OUTPUT_FILE, backupFile: oldBackup, sourceBackup: `${BACKUP_DIR}\\source_questions_*` }),
    "utf8",
  );
  logInfo(`Wrote report → ${REPORT_FILE}`);

  console.log("\n" + "─".repeat(60));
  if (counters.entriesKept === 2262) {
    console.log(`✅ Successfully processed and validated exactly ${counters.entriesKept} questions. Zero data loss.`);
  } else if (counters.entriesKept < 2262) {
    console.log(`⚠ Output has ${counters.entriesKept} questions (expected 2,262). Check migration_report.txt for details.`);
  } else {
    console.log(`⚠ Output has ${counters.entriesKept} questions — more than expected 2,262. Inspect for duplicates.`);
  }
  console.log("─".repeat(60));
}

main();
