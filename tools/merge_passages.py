#!/usr/bin/env python3
"""Merge generated reading passages into vocab-study-app/public/data/passages.json.

Validates every passage, recomputes wordCount, drops long-sentence breakdowns
whose sentence does not appear verbatim in the passage, and appends new records.
Existing text and IDs are preserved; source keys make later imports repeatable.
"""
import hashlib
import json
import re
import tempfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "vocab-study-app"
OUT = APP / "public" / "data" / "passages.json"
PARTS = APP / ".reading-gen" / "parts"
LEVELS = {"gaokao", "cet4", "cet6", "postgrad"}
CJK = re.compile(r"[㐀-鿿]")


def nonempty_text(value: object) -> bool:
    """Reject JSON nulls and other non-string values before normalization."""
    return isinstance(value, str) and bool(value.strip())


def valid(it):
    try:
        if not nonempty_text(it.get("passage")):
            return None
        passage = it["passage"].strip()
        if len(passage.split()) < 90:
            return None
        if CJK.search(passage):           # English passage must not contain Chinese
            return None
        if not nonempty_text(it.get("translation")):
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
            if not nonempty_text(q.get("q")):
                return None
            if any(not nonempty_text(option) for option in opts):
                return None
            if len({str(option).strip().lower() for option in opts}) != 4:
                return None
            if not nonempty_text(q.get("explain")):
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
            "sourceType": "generated-practice",
        }
    except (KeyError, TypeError, AttributeError, ValueError):
        return None


def source_key(item: dict) -> str:
    """Use producer identity; legacy inputs fall back to their original title."""
    if nonempty_text(item.get("sourceKey")):
        return item["sourceKey"].strip()
    if nonempty_text(item.get("id")):
        return f"source-id:{item['id'].strip()}"
    seq = item.get("seq")
    if isinstance(seq, int) and not isinstance(seq, bool) and seq >= 0:
        return f"reading-seq:{seq}"
    identity = item.get("title") or item.get("passage", "")
    normalized = re.sub(r"\s+", " ", identity.strip().lower())
    return "legacy:" + hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def load_candidates(parts: Path) -> list[dict]:
    """Fully validate the source batch before allowing any output changes."""
    paths = sorted(parts.glob("part-*.json"))
    if not paths:
        raise ValueError(f"No reading parts found in {parts}; output was not changed")
    candidates: dict[str, dict] = {}
    for path in paths:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise ValueError(f"Cannot read {path}: {exc}; output was not changed") from exc
        if not isinstance(data, dict) or not isinstance(data.get("items"), list):
            raise ValueError(f"{path}: expected an items list; output was not changed")
        for position, raw in enumerate(data["items"], 1):
            item = valid(raw)
            if item is None:
                raise ValueError(f"{path}: invalid reading item {position}; output was not changed")
            key = source_key(raw)
            item["sourceKey"] = key
            if key in candidates and candidates[key] != item:
                raise ValueError(f"{path}: conflicting source key {key}; output was not changed")
            candidates[key] = item
    if not candidates:
        raise ValueError("No valid reading items found; output was not changed")
    return list(candidates.values())


def merge_items(existing: list[dict], candidates: list[dict]) -> list[dict]:
    """Append unseen sources without replacing existing editorial content."""
    items = [dict(item) for item in existing]
    ids = [item.get("id") for item in items]
    if any(not nonempty_text(key) for key in ids) or len(set(ids)) != len(ids):
        raise ValueError("Existing reading IDs must be nonempty and unique")
    by_source = {item["sourceKey"]: item for item in items if item.get("sourceKey")}
    if len(by_source) != sum(bool(item.get("sourceKey")) for item in items):
        raise ValueError("Existing reading source keys must be unique")
    by_title: dict[str, list[dict]] = {}
    for item in items:
        title = item.get("title", "").strip().lower()
        if title:
            by_title.setdefault(title, []).append(item)
    next_id = max((int(key[5:]) for key in ids if re.fullmatch(r"read-\d+", key)), default=0) + 1
    for candidate in candidates:
        key = candidate["sourceKey"]
        if key in by_source:
            continue
        legacy = [item for item in by_title.get(candidate["title"].strip().lower(), []) if not item.get("sourceKey")]
        if len(legacy) > 1:
            raise ValueError(f"Ambiguous legacy title: {candidate['title']}")
        if legacy:
            # Attach producer identity without replacing the reviewed text.
            legacy[0]["sourceKey"] = key
            by_source[key] = legacy[0]
            continue
        item = {**candidate, "id": f"read-{next_id:04d}"}
        next_id += 1
        items.append(item)
        by_source[key] = item
    return items


def write_payload(path: Path, payload: dict) -> None:
    """Replace the output only after a complete temporary file is written."""
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main() -> None:
    candidates = load_candidates(PARTS)
    current = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"items": []}
    if not isinstance(current, dict) or not isinstance(current.get("items"), list):
        raise ValueError("Existing reading data must contain an items list")
    items = merge_items(current["items"], candidates)
    payload = {
        "meta": {
            **current.get("meta", {}),
            "count": len(items),
            "totalQuestions": sum(len(i["questions"]) for i in items),
            "levels": dict(Counter(i["level"] for i in items)),
            "sourceLabel": "AI 辅助编写的模拟阅读",
            "sourceNote": "用于英语学习，未标注为历年真题；自动结构检查不等同于全部内容已经人工核验。",
            "note": "模拟短文精读：理解题、长句拆解和全文翻译；篇幅与题数以每篇实际数据为准。",
        },
        "items": items,
    }
    write_payload(OUT, payload)
    print(f"sources={len(candidates)} existing={len(current['items'])} added={len(items) - len(current['items'])} total={len(items)}")
    print("levels:", payload["meta"]["levels"], "| questions:", payload["meta"]["totalQuestions"])


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as exc:
        raise SystemExit(f"FAIL: {exc}") from exc
