#!/usr/bin/env python3
"""Generate IPA phonetic transcriptions for each vocab entry and bake them
into vocab.json. Uses the offline `eng-to-ipa` package (CMU pronouncing
dictionary), which covers ~99.6% of our 5,390 entries.

For each entry we try the original headword, then progressively simpler
forms (drop parens, replace hyphen with space, etc.) until we get a hit.
The IPA is written to `entry.phonetic`; entries we can't resolve simply
get null and the UI falls back to TTS-only.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import eng_to_ipa as ipa

ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "vocab-study-app" / "public" / "data" / "vocab.json"


def normalize_candidates(word: str):
    """Yield alternative forms of a headword for IPA lookup."""
    word = word.lower().strip()
    seen = set()

    def emit(value: str):
        value = value.strip()
        if value and value not in seen:
            seen.add(value)
            yield value

    yield from emit(word)

    cleaned = re.sub(r"\([^)]*\)", "", word).strip()
    if cleaned:
        yield from emit(cleaned)

    if "/" in word:
        for part in word.split("/"):
            yield from emit(part)

    if "-" in word:
        yield from emit(word.replace("-", " "))
        for part in word.split("-"):
            yield from emit(part)


def best_ipa(word: str) -> str | None:
    for candidate in normalize_candidates(word):
        result = ipa.convert(candidate).strip()
        # eng-to-ipa appends `*` to tokens it couldn't resolve.
        if result and "*" not in result:
            return result
    return None


def main() -> int:
    data = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    entries = data.get("entries", [])

    resolved = 0
    for entry in entries:
        phon = best_ipa(entry["word"])
        entry["phonetic"] = phon
        if phon:
            resolved += 1

    data.setdefault("meta", {})
    data["meta"]["phoneticSource"] = "eng-to-ipa (CMU pronouncing dictionary)"
    data["meta"]["phoneticCoverage"] = {
        "resolved": resolved,
        "total": len(entries),
    }

    VOCAB_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(
        f"wrote IPA for {resolved}/{len(entries)} entries "
        f"({resolved * 100 / len(entries):.1f}%)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
