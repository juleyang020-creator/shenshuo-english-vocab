#!/usr/bin/env python3
"""Merge generated reading passages into vocab-study-app/public/data/passages.json.

Validates every passage, recomputes wordCount, drops long-sentence breakdowns
whose sentence does not appear verbatim in the passage, dedupes by title+passage,
and assigns sequential ids.
"""
import json
import re
import glob
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "vocab-study-app"
OUT = APP / "public" / "data" / "passages.json"
PARTS = APP / ".reading-gen" / "parts"
LEVELS = {"gaokao", "cet4", "cet6", "postgrad"}
CJK = re.compile(r"[㐀-鿿]")


def valid(it):
    try:
        passage = str(it["passage"]).strip()
        if len(passage.split()) < 90:
            return None
        if CJK.search(passage):           # English passage must not contain Chinese
            return None
        questions = it.get("questions") or []
        if not (3 <= len(questions) <= 5):
            return None
        clean_qs = []
        for q in questions:
            opts = q.get("options") or []
            ans = q.get("answer")
            # bool is a subclass of int in Python — reject it explicitly.
            if len(opts) != 4 or isinstance(ans, bool) or not isinstance(ans, int):
                return None
            if not (0 <= ans <= 3):
                return None
            if not str(q.get("q", "")).strip():
                return None
            clean_qs.append({
                "q": str(q["q"]).strip(),
                "options": [str(o).strip() for o in opts],
                "answer": ans,
                "explain": str(q.get("explain", "")).strip(),
            })
        # keep only breakdowns quoting the passage verbatim
        longs = []
        for s in (it.get("longSentences") or []):
            sent = str(s.get("sentence", "")).strip()
            if sent and sent in passage:
                longs.append({
                    "sentence": sent,
                    "skeleton": str(s.get("skeleton", "")).strip(),
                    "modifiers": str(s.get("modifiers", "")).strip(),
                    "translation": str(s.get("translation", "")).strip(),
                    "tip": str(s.get("tip", "")).strip(),
                })
        key_words = [
            {"word": str(k["word"]).strip(), "zh": str(k.get("zh", "")).strip()}
            for k in (it.get("keyWords") or [])
            if str(k.get("word", "")).strip()
        ]
        return {
            "title": str(it.get("title", "")).strip() or "Reading",
            "level": it.get("level") if it.get("level") in LEVELS else "cet4",
            "topic": (str(it.get("topic", "")).strip() or "精读")[:12],
            "wordCount": len(passage.split()),
            "passage": passage,
            "translation": str(it.get("translation", "")).strip(),
            "keyWords": key_words,
            "questions": clean_qs,
            "longSentences": longs,
        }
    except Exception:
        return None


def main():
    items, seen = [], set()
    raw = bad = dup = 0
    for path in sorted(glob.glob(str(PARTS / "part-*.json"))):
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception:
            continue
        for it in data.get("items", []):
            raw += 1
            v = valid(it)
            if not v:
                bad += 1
                continue
            key = v["passage"][:120]
            if key in seen:
                dup += 1
                continue
            seen.add(key)
            items.append(v)

    for i, it in enumerate(items, 1):
        it["id"] = f"read-{i:04d}"

    payload = {
        "meta": {
            "count": len(items),
            "totalQuestions": sum(len(i["questions"]) for i in items),
            "levels": dict(Counter(i["level"] for i in items)),
            "note": "短文精读：170-220 词短文 + 4 道理解题 + 长难句拆解 + 全文翻译。",
        },
        "items": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"raw={raw} added={len(items)} rejected_invalid={bad} rejected_dup={dup}")
    print("levels:", payload["meta"]["levels"], "| questions:", payload["meta"]["totalQuestions"])


if __name__ == "__main__":
    main()
