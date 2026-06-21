#!/usr/bin/env python3
"""Tag vocab.json entries with which exam levels each word appears in, and
derive a difficulty stage that maps cleanly onto a learning path.

Stages (from easiest to hardest):
  1. gaokao    — in the high-school 3500-word list
  2. cet4      — in CET-4 (or CET-4+6) but not in gaokao
  3. cet6      — in CET-6 but not in CET-4 or gaokao
  4. master    — in our 申硕 syllabus list but not in the lists above; still in COCA top-10k
  5. advanced  — specialised / low-frequency 申硕 vocabulary outside COCA top-10k

We also stash a coarse COCA frequency band (when available) so the UI can do
secondary sorting by real-world frequency.

Reads:  vocab-study-app/public/data/vocab.json
        tools/wordlists/*.txt
Writes: vocab-study-app/public/data/vocab.json (in-place, schema-extended)
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORDLISTS = ROOT / "tools" / "wordlists"
VOCAB_PATH = ROOT / "vocab-study-app" / "public" / "data" / "vocab.json"

STAGES = [
    {"id": "gaokao", "label": "高考基础", "detail": "高中 3500 词，先把高考词彻底打牢"},
    {"id": "cet4", "label": "四级核心", "detail": "大学英语四级新增词，桥接大学英语"},
    {"id": "cet6", "label": "六级提升", "detail": "六级新增词，难度上一个台阶"},
    {"id": "master", "label": "申硕进阶", "detail": "六级以外的申硕大纲常见词"},
    {"id": "advanced", "label": "拔高识记", "detail": "低频/专业词，看脸熟即可"},
]


def first_token(line: str) -> str | None:
    match = re.match(r"^([A-Za-z][A-Za-z\-/]*[A-Za-z])", line.strip())
    return match.group(1).lower() if match else None


def load_simple_list(path: Path) -> set[str]:
    out: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        token = first_token(line)
        if token and len(token) > 1:
            out.add(token)
    return out


def load_coca_ranked(path: Path) -> dict[str, int]:
    """Return {word: rank} where rank=1 is the most frequent."""
    ranks: dict[str, int] = {}
    for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        token = first_token(line)
        if token and len(token) > 1 and token not in ranks:
            ranks[token] = index
    return ranks


def normalize_word(word: str) -> str:
    """Strip parens / slashes for tag lookup: 'living-room' / 'a/an' / 'alumin(i)um'
    all become a simple lookup key."""
    word = word.lower().strip()
    # Try the literal first, then a couple of simplifications.
    candidates = [word]
    if "/" in word:
        candidates.append(word.split("/", 1)[0].strip())
    if "(" in word:
        candidates.append(re.sub(r"\([^)]*\)", "", word).strip())
    if "-" in word and " " not in word:
        candidates.append(word.replace("-", ""))
    return [c for c in candidates if c]


def coca_band(rank: int | None) -> str | None:
    if rank is None:
        return None
    if rank <= 1000:
        return "top-1k"
    if rank <= 3000:
        return "top-3k"
    if rank <= 5000:
        return "top-5k"
    if rank <= 10000:
        return "top-10k"
    if rank <= 20000:
        return "top-20k"
    return "beyond-20k"


def main() -> int:
    gaokao = load_simple_list(WORDLISTS / "highschool.txt")
    cet46 = load_simple_list(WORDLISTS / "cet4_6.txt")
    cet6 = load_simple_list(WORDLISTS / "cet6.txt")
    coca = load_coca_ranked(WORDLISTS / "coca20000.txt")

    cet4_set = cet46 - cet6  # CET-4 only
    cet6_set = cet6
    print(
        f"gaokao={len(gaokao)} cet4={len(cet4_set)} cet6={len(cet6_set)} coca={len(coca)}"
    )

    data = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    entries = data.get("entries", [])

    stage_counts: Counter[str] = Counter()
    tag_counts: Counter[str] = Counter()

    for entry in entries:
        word = entry.get("word", "")
        candidates = normalize_word(word)

        tags: list[str] = []
        coca_rank: int | None = None

        for cand in candidates:
            if cand in gaokao:
                tags.append("gaokao")
            if cand in cet4_set:
                tags.append("cet4")
            if cand in cet6_set:
                tags.append("cet6")
            if cand in coca and (coca_rank is None or coca[cand] < coca_rank):
                coca_rank = coca[cand]

        # Dedupe preserving order.
        seen = set()
        tags = [t for t in tags if not (t in seen or seen.add(t))]

        # Pick the easiest stage the word qualifies for; this aligns with the
        # "study from easiest to hardest" learning order.
        if "gaokao" in tags:
            stage = "gaokao"
        elif "cet4" in tags:
            stage = "cet4"
        elif "cet6" in tags:
            stage = "cet6"
        elif coca_rank is not None and coca_rank <= 10000:
            stage = "master"
        else:
            stage = "advanced"

        entry["examTags"] = tags
        entry["difficultyStage"] = stage
        entry["cocaRank"] = coca_rank
        entry["cocaBand"] = coca_band(coca_rank)

        stage_counts[stage] += 1
        for tag in tags:
            tag_counts[tag] += 1

    data.setdefault("meta", {})
    data["meta"]["difficultyStages"] = STAGES
    data["meta"]["stageCounts"] = dict(stage_counts)
    data["meta"]["tagCounts"] = dict(tag_counts)
    data["meta"]["wordlistSources"] = {
        "gaokao": "mahavivo/english-wordlists – Highschool_edited.txt (3,440 unique words)",
        "cet4+6": "mahavivo/english-wordlists – CET_4+6_edited.txt (8,008 unique words)",
        "cet6": "mahavivo/english-wordlists – CET6_edited.txt (2,219 unique words)",
        "coca": "mahavivo/english-wordlists – COCA_20000.txt (20,195 entries, rank ordered)",
    }

    VOCAB_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    print("\nStage breakdown:")
    for stage in STAGES:
        sid = stage["id"]
        print(f"  {sid:9s} ({stage['label']}): {stage_counts.get(sid, 0):>5}")
    print(f"\nTag totals: {dict(tag_counts)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
