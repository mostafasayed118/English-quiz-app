"""
extract_words_only.py
---------------------
Step 1: Extract all unique English words from the question bank and write
        them to a CSV. No translation — this runs in under 5 seconds.

Run from project root:
    python scripts/extract_words_only.py

Output: data/words_raw.csv  (English only, ready for Step 2)
"""

import csv
import json
import re
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_FILE = PROJECT_ROOT / "data" / "questions.json"
OUTPUT_CSV = PROJECT_ROOT / "data" / "words_raw.csv"

MIN_WORD_LEN = 3

STOP_WORDS = {
    "the","and","for","are","but","not","you","all","can","had","her","was",
    "one","our","out","has","his","how","its","may","new","now","old","see",
    "way","who","did","get","let","say","she","too","use","any","him","been",
    "from","have","this","that","with","they","will","each","make","like",
    "than","them","then","what","when","your","also","more","very","does",
    "some","time","such","into","just","only","other","most","over","after",
    "before","should","would","could","might","being","these","those",
    "where","while","about","there","their","which","through","between",
    "because","during","without","again","further","both","few","own","same",
    "here","why","yet","already","still","often","well","even","ever","never",
    "always","under","above","below","against","among","around","behind",
    "beside","besides","beyond","inside","outside","within","despite","since",
    "until","upon","rather","though","although","hence","thus","therefore",
    "however","nevertheless","meanwhile","otherwise","instead","indeed",
    "must","shall","need","dare","ought","used","able","going","take","come",
    "know","think","first","back","give","much","many","part","want","long",
    "look","help","line","turn","move","live","real","left","great","next",
    "life","hand","high","keep","last","begin","small","start","read","put",
    "set","try","ask","feel","three","state","work","year","thing","every",
    "point","find","tell","seem","mean","call","end","side","case","form",
    "day","name","happen","show","number","people","water","place","world",
    "change","play","still","learn","head","stand","letter","meet","close",
    "power","land","draw","plan","city","group","carry","ride","type","kind",
    "sort","lot","bit","half","whole","twice","once","run","right","left",
    "along","across","per","via","etc","e.g","i.e","vs","ok","yes","no",
    "if","or","so","do","it","an","as","at","be","by","up","to","in","on",
    "of","is","no","go","us","am","um","ah","oh","actually","especially",
    "particularly","specifically","relatively","approximately","essentially",
    "fundamentally","subsequently","consequently","primarily","typically",
    "importantly","considering","concerning","regarding","following",
    "leading","resulting","causing","creating","making","taking","giving",
    "having","doing","being","getting","going","coming","seeing","saying",
    "using","finding","keeping","allowing","enabling","ensuring","providing",
    "producing","offering","forming","establishing","generating",
    "implementing","maintaining","developing","building","designing",
    "testing","running","executing","performing","processing","analyzing",
    "evaluating","assessing","reviewing","checking","verifying","confirming",
    "validating","monitoring","tracking","managing","controlling","directing",
    "coordinating","organizing","planning","scheduling","arranging",
    "preparing","configuring","initializing","starting","beginning","ending",
    "completing","finishing","concluding","terminating","cancelling",
    "stopping","halting","pausing","resuming","continuing","progressing",
    "advancing","transferring","migrating","converting","transforming",
    "modifying","adjusting","adapting","customizing","personalizing",
    "optimizing","improving","enhancing","refining","polishing","simplifying",
    "increasing","decreasing","reducing","expanding","contracting","growing",
    "shrinking","scaling","branching","merging","combining","splitting",
    "dividing","separating","isolating","connecting","disconnecting",
    "integrating","segregating","bundling","unbundling","packaging",
    "distributing","collecting","gathering","assembling","disassembling",
    "destroying","deleting","adding","removing","inserting","extracting",
    "replacing","swapping","exchanging","trading","selling","buying",
    "purchasing","acquiring","obtaining","losing","winning","achieving",
    "failing","succeeding","aborting","retrying","suspending","killing",
    "dying","living","surviving","thriving","crashing","recovering","healing",
    "hurting","injuring","wounding","damaging","repairing","fixing","breaking",
    "shattering","cracking","tearing","ripping","cutting","slicing","chopping",
    "dicing","mincing","grinding","crushing","smashing","pounding","beating",
    "striking","hitting","punching","kicking","slapping","tapping","touching",
    "sensing","perceiving","noticing","observing","watching","viewing",
    "listening","hearing","smelling","tasting","verifying","authenticating",
    "authorizing","granting","denying","rejecting","accepting","approving",
    "disapproving","preventing","blocking","permitting","forbidding",
    "prohibiting","restricting","limiting","constraining","binding",
    "releasing","freeing","unlocking","locking","securing","protecting",
    "guarding","defending","attacking","invading","retreating","marching",
    "walking","jogging","sprinting","racing","driving","flying","sailing",
    "swimming","diving","jumping","leaping","hopping","skipping","bouncing",
    "rolling","sliding","gliding","floating","sinking","drowning","breathing",
    "sleeping","waking","dreaming","believing","doubting","questioning",
    "wondering","imagining","inventing","discovering","exploring","searching",
    "hiding","revealing","displaying","presenting","introducing","announcing",
    "declaring","stating","responding","replying","communicating","conversing",
    "discussing","arguing","debating","negotiating","persuading","convincing",
    "influencing","guiding","leading","following","obeying","disobeying",
    "complying","resisting","submitting","surrendering","fighting","battling",
    "competing","drawing","tying","ranking","rating","scoring","grading",
    "measuring","calculating","computing","estimating","approximating",
    "predicting","forecasting","projecting","extrapolating","interpolating",
}

WORD_RE = re.compile(r"[a-zA-Z]{" + str(MIN_WORD_LEN) + r",}")

def main():
    print("Loading questions...")
    with open(QUESTIONS_FILE, encoding="utf-8") as f:
        questions = json.load(f)
    print(f"  {len(questions)} questions")

    word_cats: dict[str, Counter] = {}
    for q in questions:
        text = " ".join([
            q.get("question_text",""), " ".join(q.get("options",[])),
            q.get("explanation",""), q.get("category",""),
            " ".join(q.get("tags",[])),
        ])
        text_clean = re.sub(r"[A-Z]\)\s*", " ", text)
        cat = q.get("category","Unknown")
        for w in WORD_RE.findall(text_clean):
            lo = w.lower()
            if lo in STOP_WORDS: continue
            word_cats.setdefault(lo, Counter())[cat] += 1

    sorted_words = sorted(word_cats.keys(), key=lambda w: (-sum(word_cats[w].values()), w))
    print(f"  {len(sorted_words)} unique words extracted")

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["English", "Arabic", "Categories", "Frequency"])
        for w in sorted_words:
            cats = ", ".join(word_cats[w].keys())
            freq = sum(word_cats[w].values())
            writer.writerow([w, "", cats, freq])

    print(f"  ✅ Saved: {OUTPUT_CSV}")
    print(f"  Open it in Excel and use GOOGLETRANSLATE(B2,\"en\",\"ar\") in column B,")
    print(f"  or run: python scripts/translate_words.py  to auto-translate.")

if __name__ == "__main__":
    main()
