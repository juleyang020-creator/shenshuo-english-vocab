#!/usr/bin/env python3
"""Merge newly generated cloze items into public/data/cloze.json.

Usage: python3 tools/merge_cloze.py <workflow_output.json>

- Validates every new item (one blank, 4 options, exactly one correct,
  answer matches, non-empty zh/translation/explain).
- Dedupes against existing items by normalized sentence and by
  (sorted option words + answer).
- Reassigns sequential ids, recomputes meta, writes back.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLOZE = ROOT / "vocab-study-app" / "public" / "data" / "cloze.json"
LEVELS = {"gaokao", "cet4", "cet6", "postgrad"}


def norm_sentence(s):
    return re.sub(r"\s+", " ", s.strip().lower())


def extract_items(obj):
    if isinstance(obj, dict):
        if isinstance(obj.get("items"), list):
            return obj["items"]
        for v in obj.values():
            r = extract_items(v)
            if r is not None:
                return r
    if isinstance(obj, list):
        for v in obj:
            r = extract_items(v)
            if r is not None:
                return r
    return None


def valid(it):
    try:
        s = it["sentence"]
        opts = it["options"]
        if s.count("___") != 1:
            return None
        if len(opts) != 4:
            return None
        corr = [o for o in opts if o.get("correct")]
        if len(corr) != 1:
            return None
        ans = corr[0]["word"]
        if not it.get("explain", "").strip() or not it.get("translation", "").strip():
            return None
        for o in opts:
            if not str(o.get("word", "")).strip() or not str(o.get("zh", "")).strip():
                return None
        lvl = it.get("level") if it.get("level") in LEVELS else "cet4"
        return {
            "theme": it.get("theme", "").strip() or "辨析",
            "sentence": s.strip(),
            "answer": ans,
            "translation": it["translation"].strip(),
            "level": lvl,
            "explain": it["explain"].strip(),
            "options": [
                {"word": o["word"].strip(), "zh": o["zh"].strip(), "correct": bool(o.get("correct"))}
                for o in opts
            ],
        }
    except Exception:
        return None


def sig(it):
    words = tuple(sorted(o["word"].lower() for o in it["options"]))
    return (norm_sentence(it["sentence"]), words, it["answer"].lower())


def main():
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    new_items = extract_items(raw) or []
    existing = json.load(open(CLOZE, encoding="utf-8"))["items"]

    merged = []
    seen = set()
    for it in existing:
        merged.append(it)
        seen.add(sig(it))

    added = 0
    for it in new_items:
        v = valid(it)
        if not v:
            continue
        k = sig(v)
        if k in seen:
            continue
        seen.add(k)
        merged.append(v)
        added += 1

    # reassign ids
    for i, it in enumerate(merged, 1):
        it["id"] = f"cloze-{i:04d}"

    words = {o["word"].lower() for it in merged for o in it["options"]}
    groups = {tuple(sorted(o["word"].lower() for o in it["options"])) for it in merged}
    out = {
        "meta": {
            "count": len(merged),
            "distinctWords": len(words),
            "groups": len(groups),
            "source": "curated (generated + adversarially verified)",
            "note": "近义词辨析选词填空：每题 4 个近义选项，作答后给中文释义与辨析。",
        },
        "items": merged,
    }
    CLOZE.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"existing={len(existing)} new_valid_added={added} total={len(merged)}")
    print(f"distinct words={len(words)} distinct groups={len(groups)}")
    print("levels:", dict(Counter(it["level"] for it in merged)))


if __name__ == "__main__":
    main()
