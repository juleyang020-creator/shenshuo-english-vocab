#!/usr/bin/env python3
"""Build examples from contextual cloze items with traceable item IDs.

These are AI-assisted practice sentences, not a fully human-verified corpus.
Definition-recognition templates and structurally invalid items are excluded.

Matching is deliberately conservative:
  - exact surface match first (vocab headwords are split on `/` and `,` so
    entries like "advertise/-ize" or "check/cheque" resolve properly)
  - then a small inflection rollback (-s/-es/-ies/-ed/-ing) for答案 like
    "influenced" -> "influence"
  - NO -er/-est rollback: measured, it buys exactly one extra match and that
    match is wrong (career -> care), so it is a net negative.

Writes `entry.example = {"en": ..., "zh": ..., "sourceItemId": ...}`.
Entries with no eligible match lose stale examples. Re-running is idempotent.
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
IRREGULAR_BASES = {
    "became": "become", "came": "come", "caught": "catch", "chose": "choose",
    "clung": "cling", "fell": "fall", "felt": "feel", "flung": "fling",
    "laid": "lay", "stole": "steal", "threw": "throw",
}


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
    if w in IRREGULAR_BASES:
        return [IRREGULAR_BASES[w]]
    out = []
    if w.endswith("ies") and len(w) > 4:
        out.append(w[:-3] + "y")
    # Preserve an existing final e first: hopes -> hope, not hop.
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        out.append(w[:-1])
    if w.endswith("es") and len(w) > 3:
        out.append(w[:-2])
    if w.endswith("ed") and len(w) >= 4:
        # stared -> stare, not star; starred -> star uses the doubled branch.
        out.append(w[:-1])
        out.append(w[:-2])
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
    if sentence.count(BLANK) != 1:
        raise ValueError("An example must have exactly one blank")
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


def is_context_item(item: dict) -> bool:
    """Require a single-answer contextual sentence, not a word-definition template."""
    sentence = item.get("sentence") or ""
    options = item.get("options") or []
    correct = [option for option in options if option.get("correct") is True]
    return (
        item.get("source") != "auto-vocab-coverage"
        and sentence.count(BLANK) == 1
        and not re.search(r"[㐀-鿿]", sentence)
        and bool((item.get("translation") or "").strip())
        and len(options) == 4
        and len(correct) == 1
        and correct[0].get("word") == item.get("answer")
    )


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

    # Prefer revised material when more than one item can teach the same word.
    for item in sorted(items, key=lambda it: not bool(it.get("reviewStatus"))):
        sentence = item.get("sentence") or ""
        answer = (item.get("answer") or "").strip()
        zh = item.get("translation") or ""
        if not answer or not is_context_item(item):
            skipped_no_blank += 1
            continue
        en = fill_blank(sentence, answer)
        payload = (en, zh, item["id"])
        key = answer.lower()

        hit = index.get(key)
        if hit:
            exact.setdefault(hit, payload)
            continue
        for base in deinflect(key):
            hit = index.get(base)
            if hit:
                lemma.setdefault(hit, payload)
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
            entry["example"] = {"en": payload[0], "zh": payload[1], "sourceItemId": payload[2]}
            written += 1
        else:
            entry.pop("example", None)

    vocab["meta"]["exampleCount"] = written
    vocab["meta"]["exampleSource"] = "AI-assisted contextual cloze practice; sourceItemId identifies the source item; not fully human-verified."
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
