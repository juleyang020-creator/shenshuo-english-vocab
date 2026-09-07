#!/usr/bin/env python3
"""Check content structure and cross-file consistency without claiming semantic QA."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from add_examples import fill_blank, is_context_item

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "vocab-study-app" / "public" / "data"
LEVELS = {"gaokao", "cet4", "cet6", "master", "advanced", "postgrad"}
DETACHED_SUFFIX = re.compile(r"___\s+(?:s|es|ed|d|ing|ly)\b")


def check_content(vocab: dict, cloze: dict, passages: dict) -> tuple[list[str], dict]:
    """Return actionable errors and counts for the three runtime data files."""
    errors: list[str] = []
    entries = vocab.get("entries", [])
    items = cloze.get("items", [])
    readings = passages.get("items", [])

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    for name, records, meta_count in [
        ("vocab", entries, vocab.get("meta", {}).get("entryCount")),
        ("cloze", items, cloze.get("meta", {}).get("count")),
        ("passages", readings, passages.get("meta", {}).get("count")),
    ]:
        require(bool(records), f"{name}: no records")
        require(meta_count == len(records), f"{name}: meta count differs from records")
        counts = Counter(record.get("id") for record in records)
        for key, count in counts.items():
            require(bool(key) and count == 1, f"{name}: missing or duplicate ID {key}")

    items_by_id = {item.get("id"): item for item in items}
    sentences = Counter(item.get("sentence", "").strip().lower() for item in items)
    for entry in entries:
        key = entry["id"]
        require(bool(entry.get("word", "").strip()), f"{key}: missing headword")
        require(not re.search(r"\d", entry.get("word", "")), f"{key}: digit in headword")
        require(bool(entry.get("definition", "").strip()), f"{key}: missing definition")
        require(entry.get("difficultyStage") in LEVELS, f"{key}: unknown difficulty")
        example = entry.get("example")
        if example:
            source = items_by_id.get(example.get("sourceItemId"))
            require(bool(source), f"{key}: missing example source item")
            if source:
                require(is_context_item(source), f"{key}: example comes from an ineligible item")
                if source.get("sentence", "").count("___") == 1:
                    require(example.get("en") == fill_blank(source["sentence"], source["answer"]), f"{key}: stale English example")
                require(example.get("zh") == source.get("translation"), f"{key}: stale example translation")
    require(vocab.get("meta", {}).get("exampleCount") == sum(bool(e.get("example")) for e in entries), "vocab: incorrect exampleCount")
    require(vocab.get("meta", {}).get("stageCounts") == dict(Counter(e.get("difficultyStage") for e in entries)), "vocab: incorrect stageCounts")

    for item in items:
        key = item["id"]
        sentence = item.get("sentence", "")
        options = item.get("options", [])
        correct = [option for option in options if option.get("correct") is True]
        require(sentence.count("___") == 1, f"{key}: expected exactly one blank")
        require(not DETACHED_SUFFIX.search(sentence), f"{key}: detached word ending")
        require(sentences[sentence.strip().lower()] == 1, f"{key}: duplicate sentence")
        require(len(options) == 4 and len({o.get("word", "").strip().lower() for o in options}) == 4, f"{key}: four distinct options required")
        require(all(isinstance(o.get("correct"), bool) for o in options), f"{key}: correct flags must be booleans")
        require(len(correct) == 1 and correct[0].get("word") == item.get("answer"), f"{key}: inconsistent answer")
        require(all(o.get("word", "").strip() and o.get("zh", "").strip() for o in options), f"{key}: empty option or definition")
        require(bool(item.get("explain", "").strip()) and bool(item.get("translation", "").strip()), f"{key}: missing explanation or translation")
        require(item.get("level") in LEVELS, f"{key}: unknown level")

    question_count = 0
    reading_answers: Counter[int] = Counter()
    for passage in readings:
        key = passage["id"]
        text = passage.get("passage", "")
        require(passage.get("wordCount") == len(text.split()), f"{key}: incorrect wordCount")
        require(bool(passage.get("translation", "").strip()), f"{key}: missing translation")
        require(passage.get("sourceType") == "generated-practice", f"{key}: missing practice provenance")
        require(passage.get("level") in LEVELS, f"{key}: unknown level")
        require(3 <= len(passage.get("questions", [])) <= 5, f"{key}: expected 3-5 questions")
        for index, question in enumerate(passage.get("questions", []), 1):
            label = f"{key} question {index}"
            options = question.get("options", [])
            answer = question.get("answer")
            require(len(options) == 4 and len(set(options)) == 4 and all(o.strip() for o in options), f"{label}: four distinct nonempty options required")
            require(type(answer) is int and 0 <= answer < len(options), f"{label}: invalid answer index")
            require(bool(question.get("q", "").strip()) and bool(question.get("explain", "").strip()), f"{label}: missing prompt or explanation")
            question_count += 1
            reading_answers[answer] += 1
        for long_sentence in passage.get("longSentences", []):
            quoted = long_sentence.get("sentence", "")
            require(bool(quoted) and quoted in text, f"{key}: long-sentence quote absent from passage")
    require(passages.get("meta", {}).get("totalQuestions") == question_count, "passages: incorrect totalQuestions")
    return errors, {
        "vocabEntries": len(entries),
        "examples": sum(bool(e.get("example")) for e in entries),
        "clozeItems": len(items),
        "readingPassages": len(readings),
        "readingQuestions": question_count,
        "readingAnswerPositionsInSource": dict(reading_answers),
        "semanticReview": "结构检查不证明答案语义唯一，也不证明词表完整性；本轮核验范围见 docs/审核/学习内容审查-2026-09-07.md。",
    }


def main() -> int:
    try:
        vocab, cloze, passages = [json.loads((DATA / f"{name}.json").read_text(encoding="utf-8")) for name in ("vocab", "cloze", "passages")]
        errors, summary = check_content(vocab, cloze, passages)
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        print(f"FAIL: malformed learning data: {exc}")
        return 1
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if errors:
        print("\n".join(f"FAIL: {error}" for error in errors))
        return 1
    print("PASS: all learning-content structure and cross-file checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
