#!/usr/bin/env python3
"""Bake real etymology data into vocab.json.

We replace the previous pattern-matched morphology heuristic (which falsely
"detected" affixes by literal substring) with actual etymonline.com entries
sourced from the open-source yosevu/etymonline dataset (MIT licensed, 46,840
records derived from etymonline.com).

Each vocab entry gains:
  - etymology: full etymology paragraph (plain English text)
  - etymologyYears: optional list of historical-attestation years

Coverage on a typical exam vocabulary set is 90%+; the rest get null (the
UI then shows nothing rather than fabricating a false derivation).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools" / "etymology" / "etymonline.json"
VOCAB_PATH = ROOT / "vocab-study-app" / "public" / "data" / "vocab.json"


def load_etymology_index(path: Path) -> dict[str, dict]:
    """Return a flat lookup of {word_lowercase -> first matching entry}.

    etymonline has multiple entries per spelling (different parts of speech /
    senses). We keep the first occurrence so the lookup is stable. Callers
    can refine later if needed.
    """
    raw = json.loads(path.read_text(encoding="utf-8"))
    index: dict[str, dict] = {}
    for entry in raw:
        word = (entry.get("word") or "").strip()
        if not word:
            continue
        key = word.lower()
        if key not in index:
            index[key] = entry
    return index


def normalize_candidates(word: str):
    """Yield plausible alternate forms of a headword for lookup."""
    word = word.lower().strip()
    seen: set[str] = set()

    def emit(value: str):
        value = value.strip()
        if value and value not in seen:
            seen.add(value)
            yield value

    yield from emit(word)

    cleaned_parens = re.sub(r"\([^)]*\)", "", word).strip()
    if cleaned_parens:
        yield from emit(cleaned_parens)

    if "/" in word:
        for part in word.split("/"):
            yield from emit(part)

    if "-" in word:
        yield from emit(word.replace("-", " "))
        for part in word.split("-"):
            yield from emit(part)


def best_etymology(word: str, index: dict[str, dict]) -> dict | None:
    for candidate in normalize_candidates(word):
        hit = index.get(candidate)
        if hit:
            return hit
    return None


def main() -> int:
    if not SOURCE.exists():
        print(f"missing etymonline data at {SOURCE}", flush=True)
        return 1
    index = load_etymology_index(SOURCE)
    print(f"loaded {len(index):,} etymonline entries")

    data = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    entries = data.get("entries", [])

    resolved = 0
    for entry in entries:
        hit = best_etymology(entry.get("word", ""), index)
        if hit:
            entry["etymology"] = hit.get("etymology")
            entry["etymologyYears"] = hit.get("years") or None
            resolved += 1
        else:
            entry["etymology"] = None
            entry["etymologyYears"] = None

    data.setdefault("meta", {})
    data["meta"]["etymologySource"] = (
        "yosevu/etymonline (MIT) — derived from etymonline.com"
    )
    data["meta"]["etymologyCoverage"] = {
        "resolved": resolved,
        "total": len(entries),
    }

    VOCAB_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(
        f"wrote etymology for {resolved}/{len(entries)} entries "
        f"({resolved * 100 / len(entries):.1f}%)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
