#!/usr/bin/env python3
"""Merge newly generated cloze items into public/data/cloze.json.

Usage: python3 tools/merge_cloze.py <workflow_output.json>

- Validates every new item (one blank, 4 options, exactly one correct,
  answer matches, non-empty zh/translation/explain).
- Dedupes against existing items by normalized sentence and by
  (sorted option words + answer).
- Preserves existing IDs, assigns new IDs, recomputes meta, writes back.
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
        if any(not isinstance(o.get("correct"), bool) for o in opts):
            return None
        corr = [o for o in opts if o.get("correct")]
        if len(corr) != 1:
            return None
        ans = corr[0]["word"].strip()
        if it.get("answer", "").strip() != ans.strip():
            return None
        if len({o["word"].strip().lower() for o in opts}) != 4:
            return None
        if re.search(r"___\s+(?:s|es|ed|d|ing|ly)\b", s):
            return None
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
    except (KeyError, TypeError, AttributeError, ValueError):
        return None


def sig(it):
    words = tuple(sorted(o["word"].lower() for o in it["options"]))
    return (norm_sentence(it["sentence"]), words, it["answer"].lower())


def main():
    raw = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    new_items = extract_items(raw) or []
    current = json.loads(CLOZE.read_text(encoding="utf-8"))
    existing = current["items"]

    merged = []
    seen = set()
    seen_sentences = set()
    seen_answers_options = set()
    for it in existing:
        merged.append(it)
        seen.add(sig(it))
        seen_sentences.add(norm_sentence(it["sentence"]))
        seen_answers_options.add(sig(it)[1:])

    added = 0
    for it in new_items:
        v = valid(it)
        if not v:
            continue
        k = sig(v)
        if k in seen or k[0] in seen_sentences or k[1:] in seen_answers_options:
            continue
        seen.add(k)
        seen_sentences.add(k[0])
        seen_answers_options.add(k[1:])
        merged.append(v)
        added += 1

    # Existing IDs are learning-progress keys and must never be reassigned.
    used_ids = {it["id"] for it in existing}
    next_id = max(
        current.get("meta", {}).get("nextItemNumber", 1),
        max((int(key[6:]) + 1 for key in used_ids if re.fullmatch(r"cloze-\d+", key)), default=1),
    )
    for it in merged[len(existing):]:
        while f"cloze-{next_id:04d}" in used_ids:
            next_id += 1
        it["id"] = f"cloze-{next_id:04d}"
        used_ids.add(it["id"])
        next_id += 1

    words = {o["word"].lower() for it in merged for o in it["options"]}
    groups = {tuple(sorted(o["word"].lower() for o in it["options"])) for it in merged}
    out = {
        "meta": {
            **current.get("meta", {}),
            "nextItemNumber": next_id,
            "count": len(merged),
            "distinctWords": len(words),
            "groups": len(groups),
            "distinctAnswers": len({it["answer"] for it in merged}),
            "source": "AI-assisted practice; sampled editorial review",
            "note": "词义辨析、固定搭配与词形训练；自动结构校验不等同于全部题目语义已人工核验。",
        },
        "items": merged,
    }
    CLOZE.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"existing={len(existing)} new_valid_added={added} total={len(merged)}")
    print(f"distinct words={len(words)} distinct groups={len(groups)}")
    print("levels:", dict(Counter(it["level"] for it in merged)))


if __name__ == "__main__":
    main()
