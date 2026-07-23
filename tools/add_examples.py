#!/usr/bin/env python3
"""Bake a real example sentence into each vocab entry, mined from cloze.json.

The 近义辨析 question bank already holds 3,522 hand-checked sentences, each with
a unique correct answer AND a Chinese translation. Every sentence has exactly one
`___` blank, so filling the blank back in yields a natural example sentence for
the answer word — content we already own, at zero generation cost.

Matching is deliberately conservative:
  - exact surface match first (vocab headwords are split on `/` and `,` so
    entries like "advertise/-ize" or "check/cheque" resolve properly)
  - then a small inflection rollback (-s/-es/-ies/-ed/-ing) for答案 like
    "influenced" -> "influence"
  - NO -er/-est rollback: measured, it buys exactly one extra match and that
    match is wrong (career -> care), so it is a net negative.

Writes `entry.example = {"en": ..., "zh": ...}`. Entries with no match are left
untouched and the UI simply omits the block. Re-running is idempotent.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "vocab-study-app" / "public" / "data"
VOCAB_PATH = DATA / "vocab.json"
CLOZE_PATH = DATA / "cloze.json"

BLANK = "___"


def surface_forms(word: str):
    """Every lowercase surface form a headword should be findable under."""
    raw = (word or "").lower().strip()
    if not raw:
        return
    seen = set()

    def emit(value: str):
        value = value.strip().strip(".,;")
        if value and value not in seen:
            seen.add(value)
            return value
        return None

    for candidate in (raw, re.sub(r"\([^)]*\)", "", raw)):
        got = emit(candidate)
        if got:
            yield got
    # "advertise/-ize", "check/cheque", "colour, color"
    for sep in ("/", ","):
        if sep in raw:
            for part in raw.split(sep):
                part = part.strip()
                # skip suffix-only alternates like "-ize"
                if part.startswith("-"):
                    continue
                got = emit(part)
                if got:
                    yield got


def deinflect(word: str):
    """Conservative base-form candidates. Intentionally excludes -er/-est."""
    w = word.lower()
    out = []
    if w.endswith("ies") and len(w) > 4:
        out.append(w[:-3] + "y")
    if w.endswith("es") and len(w) > 3:
        out.append(w[:-2])
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        out.append(w[:-1])
    if w.endswith("ed") and len(w) > 4:
        out.append(w[:-2])
        out.append(w[:-1])
        if len(w) > 5 and w[-3] == w[-4]:  # stopped -> stop
            out.append(w[:-3])
    if w.endswith("ing") and len(w) > 5:
        out.append(w[:-3])
        out.append(w[:-3] + "e")
        if len(w) > 6 and w[-4] == w[-5]:  # running -> run
            out.append(w[:-4])
    return out


# A handful of source sentences write the inflection OUTSIDE the blank
# ("Researchers discovered that ___ s use echolocation"), which would otherwise
# render as "bat s". None of these are real standalone English words, so
# re-attaching them is unambiguous.
DETACHED_SUFFIX = re.compile(r"^\s+(s|es|ed|d|ing|ly)\b")


def fill_blank(sentence: str, answer: str) -> str:
    """Put the answer back into the sentence, fixing case and detached suffixes."""
    idx = sentence.find(BLANK)
    word = answer
    if idx == 0 and word[:1].islower():
        word = word[:1].upper() + word[1:]
    before, after = sentence[:idx], sentence[idx + len(BLANK):]
    match = DETACHED_SUFFIX.match(after)
    if match and not word.lower().endswith(match.group(1)):
        word += match.group(1)
        after = after[match.end():]
    return before + word + after


def main() -> None:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    cloze = json.loads(CLOZE_PATH.read_text(encoding="utf-8"))
    entries = vocab["entries"]
    items = cloze["items"]

    index: dict[str, str] = {}          # surface form -> entry id
    by_id: dict[str, dict] = {}
    for entry in entries:
        by_id[entry["id"]] = entry
        for form in surface_forms(entry.get("word", "")):
            index.setdefault(form, entry["id"])

    exact: dict[str, tuple] = {}
    lemma: dict[str, tuple] = {}
    lemma_log: list[str] = []
    skipped_no_blank = 0
    unmatched: list[str] = []

    for item in items:
        sentence = item.get("sentence") or ""
        answer = (item.get("answer") or "").strip()
        zh = item.get("translation") or ""
        if not answer or not zh or BLANK not in sentence:
            skipped_no_blank += 1
            continue
        en = fill_blank(sentence, answer)
        key = answer.lower()

        hit = index.get(key)
        if hit:
            exact.setdefault(hit, (en, zh))
            continue
        for base in deinflect(key):
            hit = index.get(base)
            if hit:
                lemma.setdefault(hit, (en, zh))
                lemma_log.append(f"{answer} -> {by_id[hit]['word']}")
                break
        else:
            unmatched.append(answer)

    # Exact matches win; lemma matches only fill entries nothing else claimed.
    resolved = dict(exact)
    for entry_id, payload in lemma.items():
        resolved.setdefault(entry_id, payload)

    written = 0
    for entry in entries:
        payload = resolved.get(entry["id"])
        if payload:
            entry["example"] = {"en": payload[0], "zh": payload[1]}
            written += 1
        else:
            entry.pop("example", None)

    vocab["meta"]["exampleCount"] = written
    # indent=2 to match add_phonetics.py / add_etymology.py / tag_vocab_by_exam.py —
    # they all rewrite this same file, so a differing format here would be undone
    # (and churn the whole file) the next time any of them runs.
    VOCAB_PATH.write_text(
        json.dumps(vocab, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    stages: dict[str, list] = {}
    for entry in entries:
        stage = entry.get("difficultyStage") or "?"
        got, total = stages.setdefault(stage, [0, 0])
        stages[stage] = [got + (1 if entry.get("example") else 0), total + 1]

    print(f"cloze items          : {len(items)}")
    print(f"skipped (no blank/zh): {skipped_no_blank}")
    print(f"exact matches        : {len(exact)}")
    print(f"inflection matches   : {len(lemma)}")
    print(f"answers unmatched    : {len(unmatched)}")
    print(f"entries with example : {written} / {len(entries)}"
          f" ({written / len(entries) * 100:.1f}%)")
    print("per stage:")
    for stage, (got, total) in sorted(stages.items(), key=lambda kv: -kv[1][1]):
        print(f"  {stage:<9} {got:>4} / {total:<4} ({got / total * 100:.1f}%)")
    print(f"\nunmatched answers ({len(unmatched)}): {', '.join(sorted(unmatched))}")
    print(f"\ninflection mappings ({len(lemma_log)}) — eyeball these:")
    for line in sorted(lemma_log):
        print(f"  {line}")


if __name__ == "__main__":
    main()
