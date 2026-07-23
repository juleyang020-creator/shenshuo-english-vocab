#!/usr/bin/env python3
"""Generate a broad cloze bank from the full vocabulary list.

The curated near-synonym questions in public/data/cloze.json are preserved.
This script appends one deterministic definition-recognition item per vocab
entry so the cloze module can drill nearly the whole 5390-word outline.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "vocab-study-app" / "public" / "data" / "vocab.json"
CLOZE_PATH = ROOT / "vocab-study-app" / "public" / "data" / "cloze.json"
WORDLIST_DEFINITION_PATHS = [
    ROOT / "tools" / "wordlists" / "cet4.txt",
    ROOT / "tools" / "wordlists" / "cet6.txt",
]

ANSWER_OVERRIDES = {
    # OCR artifact in the source vocab list. Keep the target id, but show the
    # learnable headword in the cloze bank.
    "eg90q": "egg",
    "gqenetics": "genetics",
    "gqlow": "glow",
    "garind": "grind",
    "pquess": "guess",
    "gquidance": "guidance",
    "gauitar": "guitar",
    "ljetlag": "jetlag",
    "mal": "mall",
    "outdate": "outdated",
    "dispatch/dispatch": "dispatch",
    "postcode": "postcard",
    "fag": "rag",
    "fay": "ray",
    "fow": "row",
    "fug": "rug",
    "sum": "gum",
    "tub": "rub",
    "isghe": "tight",
    "television/tv/t. v": "television/tv",
    "unit": "quit",
    "om": "own",
}

DEFINITION_OVERRIDES = {
    "accountable": "a. 有责任的；有解释义务的",
    "abnormal": "a. 反常的，不规则的；变态的",
    "amaze": "vt. 使惊愕，使惊叹",
    "boring": "a. 令人厌烦的",
    "cashier": "n. 出纳员",
    "cigar": "n. 雪茄烟",
    "cruelty": "n. 残忍，残酷行为",
    "endanger": "vt. 危及；使遭到危险",
    "fallacy": "n. 谬论，谬误",
    "firewall": "n. 防火墙",
    "giraffe": "n. 长颈鹿",
    "generous": "a. 慷慨，大方；丰盛，丰富；宽厚的",
    "harass": "v. 骚扰；使烦恼",
    "humiliate": "vt. 使丢脸；羞辱",
    "lost": "a. 失去的；错过的，浪费掉的；迷路的",
    "moslem": "n./a. 穆斯林，伊斯兰教徒",
    "negotiate": "v. 谈判，交涉，商议",
    "odd": "a. 奇数的，单的；奇怪，古怪；临时的；剩余的",
    "omit": "vt. 省略，省去；遗漏，忽略",
    "politics": "n. 政治；政见，政纲",
    "pudding": "n. 布丁",
    "ruler": "n. 统治者，支配者；尺子，直尺",
    "ski": "n. 雪橇 vi. 滑雪",
    "south": "n. 南，南方 a. 南方的 ad. 向南，在南方",
    "spectacular": "a. 壮观的",
    "unveil": "vt. 揭幕；使公之于众，揭开 vi. 除去面纱；显露",
    "widen": "vt. 弄宽",
    "pquess": "v./n. 推测，猜测",
    "gauitar": "n. 吉他",
    "ljetlag": "n. 时差综合征",
    "mal": "n. 购物商场",
    "outdate": "a. 过时的",
    "postcode": "n. 明信片",
    "fow": "n. （一）排，（一）行；争吵 v. 划船",
    "westerner": "n. 西方人，欧美人",
    "whip": "n. 鞭子，车夫 v. 鞭打，抽打",
    "footstep": "n. 脚步；脚步声；足迹",
    "logical": "a. 逻辑（上）的，符合逻辑的",
    "lubricate": "vt. 使润滑；给……加润滑油",
    "maximize": "vt. 使最大化；取得最大值",
    "neutralize": "vt. 抵消；使中和；使无效 vi. 中和；变无效",
    "ought to": "aux. 应该，应当；本应",
    "prone": "a. 易于……的，有……倾向的",
    "shed": "v. 脱落，脱去；流出，流下；发出，散发 n. 棚，小屋",
    "speculate": "v. 思索，推测；投机",
    "spouse": "n. 配偶",
    "trifle": "n. 小事，琐事；少量，少许",
    "zone": "n. 地带，区域",
    "tidy": "vt. 整理，收拾 a. 整洁，整齐",
    "tub": "v. 擦，摩擦 n. 磨，擦；障碍",
}

CURATED_ITEM_FIXES = {
    "cloze-0033": {
        "sentence": "The nurse checked the patient's ___ signs every fifteen minutes after surgery.",
        "translation": "手术后，护士每十五分钟检查一次病人的生命体征。",
        "explain": "本题靠固定搭配 vital signs（生命体征）锁定答案。significant signs、important signs 和 essential signs 都不是医学英语中表示‘生命体征’的固定表达；这里不是泛泛说‘重要的标志’，而是指体温、脉搏、呼吸、血压等临床指标，故只能选 vital。",
    }
}

FUNCTION_POS = {"art", "prep", "conj", "pron", "num", "int", "aux", "auz"}
STAGE_ORDER = {"gaokao": 0, "cet4": 1, "cet6": 2, "master": 3, "advanced": 4}


def compact_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_definition_text(value: str) -> str:
    value = compact_spaces(value)
    value = value.replace("|", " ")
    value = value.replace("^．", "n. ").replace("^.", "n. ").replace("^•", "n. ")
    value = value.replace("《.", "a. ").replace("》", "")
    value = re.sub(r"\bn[0-9]\.", "n.", value, flags=re.I)
    value = re.sub(r"^([0-9])[.。•]\s*", "n. ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def clean_definition(value: str) -> str:
    value = normalize_definition_text(value)
    value = re.sub(r"^[\^•|《》]+", "", value)
    value = re.sub(r"^([a-z])([0-9])\.", r"\1.", value, flags=re.I)
    value = re.sub(r"^([0-9])[.。•，,]\s*", "", value)
    value = re.sub(r"^(?:[a-z]+\.?(?:/[a-z]+\.?)*)\s*", "", value, flags=re.I)
    value = re.sub(r"^[.．，,；;、\s]+", "", value)
    return value or "该词条释义"


def get_pos(entry: dict) -> str:
    definition = compact_spaces(entry.get("definition", "")).lower()
    word = entry.get("word", "")
    markers = set(re.findall(r"\b(?:vt|vi|v|n|a|ad|adv|prep|conj|pron|num|art|int|aux|auz|c)\.", definition))
    if any(marker in markers for marker in ("vt.", "vi.", "v.")):
        return "verb"
    if "n." in markers:
        return "noun"
    if any(marker in markers for marker in ("a.", "ad.", "adv.")):
        return "modifier"
    if any(marker.rstrip(".") in FUNCTION_POS for marker in markers) or " " in word or "/" in word:
        return "function"
    return "other"


def first_chinese_terms(definition: str, limit: int = 3) -> list[str]:
    definition = clean_definition(definition)
    terms = [term.strip() for term in re.split(r"[；;，,、/]", definition) if term.strip()]
    return terms[:limit] or [definition[:18]]


def zh_for(entry: dict) -> str:
    definition = compact_spaces(entry.get("_definition", entry.get("definition", "")))
    return definition[:80] + ("…" if len(definition) > 80 else "")


def answer_word(entry: dict) -> str:
    word = compact_spaces(entry.get("word", ""))
    return ANSWER_OVERRIDES.get(word, word)


def load_wordlist_definitions() -> dict[str, str]:
    definitions = {}
    for path in WORDLIST_DEFINITION_PATHS:
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            match = re.match(r"^([A-Za-z][A-Za-z' -]*(?:/-?[A-Za-z]+)?)\s+(.*)$", line)
            if not match:
                continue
            word, definition = match.groups()
            definition = re.sub(r"^\d+\s+", "", definition.strip())
            definition = re.sub(r"^\[[^\]]+\]\s*", "", definition.strip())
            if definition:
                definitions.setdefault(word.lower(), definition)
    return definitions


RISKY_DEFINITION_RE = re.compile(
    r"[|^•《》]|[0-9][A-Za-z]|[A-Za-z][0-9]|[A-Za-z]{2,}[（(][A-Za-z]|！|n[0-9]\.|[0-9][.。•]",
    re.I,
)


def choose_definition(entry: dict, wordlist_definitions: dict[str, str]) -> str:
    word = entry.get("word", "")
    if word in DEFINITION_OVERRIDES:
        return DEFINITION_OVERRIDES[word]
    raw_definition = compact_spaces(entry.get("definition", ""))
    answer = answer_word(entry).split("/")[0].lower()
    if RISKY_DEFINITION_RE.search(raw_definition) and answer in wordlist_definitions:
        return normalize_definition_text(wordlist_definitions[answer])
    return normalize_definition_text(raw_definition)


def prepare_entry(entry: dict, wordlist_definitions: dict[str, str]) -> dict:
    prepared = dict(entry)
    raw_definition = choose_definition(entry, wordlist_definitions)
    prepared["_answer"] = answer_word(entry)
    prepared["_definition"] = raw_definition
    prepared["_pos"] = get_pos({**entry, "definition": raw_definition})
    prepared["_terms"] = first_chinese_terms(raw_definition, 4)
    prepared["_terms_chars"] = set("".join(prepared["_terms"]))
    prepared["_stage_rank"] = STAGE_ORDER.get(entry.get("difficultyStage"), 9)
    prepared["_definition_clean"] = clean_definition(raw_definition)
    prepared["_zh"] = zh_for(prepared)
    return prepared


def stable_score(target: dict, candidate: dict) -> tuple:
    target_word = target["_answer"].lower()
    cand_word = candidate["_answer"].lower()
    overlap = len(target["_terms_chars"] & candidate["_terms_chars"])
    return (
        0 if target["_pos"] == candidate["_pos"] else 1,
        abs(target["_stage_rank"] - candidate["_stage_rank"]),
        overlap,
        abs(len(target_word) - len(cand_word)),
        cand_word,
    )


def build_buckets(entries: list[dict]) -> dict:
    buckets = {"all": sorted(entries, key=lambda item: item["_answer"].lower()), "pos": {}, "stage": {}, "pos_stage": {}}
    for entry in entries:
        buckets["pos"].setdefault(entry["_pos"], []).append(entry)
        buckets["stage"].setdefault(entry.get("difficultyStage", "advanced"), []).append(entry)
        buckets["pos_stage"].setdefault((entry["_pos"], entry.get("difficultyStage", "advanced")), []).append(entry)
    for group in ("pos", "stage", "pos_stage"):
        for key, items in buckets[group].items():
            items.sort(key=lambda item: item["_answer"].lower())
    return buckets


def choose_distractors(entry: dict, buckets: dict) -> list[dict]:
    answer = entry["_answer"].lower()
    same_answer = {
        item.get("id")
        for item in buckets["all"]
        if item["_answer"].lower() == answer and item.get("id") != entry.get("id")
    }
    candidate_map = {}
    groups = [
        buckets["pos_stage"].get((entry["_pos"], entry.get("difficultyStage", "advanced")), []),
        buckets["pos"].get(entry["_pos"], []),
        buckets["stage"].get(entry.get("difficultyStage", "advanced"), []),
        buckets["all"],
    ]
    for group in groups:
        for item in group:
            if item.get("id") == entry.get("id") or item.get("id") in same_answer:
                continue
            if not item["_answer"] or item["_answer"].lower() == answer:
                continue
            candidate_map[item.get("id")] = item
        if len(candidate_map) >= 24:
            break
    pool = sorted(candidate_map.values(), key=lambda item: stable_score(entry, item))
    selected = []
    seen = {answer}
    for item in pool:
        word = answer_word(item).lower()
        if word in seen:
            continue
        selected.append(item)
        seen.add(word)
        if len(selected) == 3:
            return selected
    raise ValueError(f"Not enough distractors for {entry.get('word')}")


def option_order(options: list[dict], seed: str) -> list[dict]:
    def key(option: dict) -> tuple[int, str]:
        value = sum((index + 1) * ord(char) for index, char in enumerate(seed + option["word"]))
        return value % 9973, option["word"]

    return sorted(options, key=key)


def make_sentence(entry: dict) -> tuple[str, str, str]:
    terms = "，".join(entry["_terms"][:3])
    pos = entry["_pos"]
    definition = entry["_definition"].lower()
    is_mixed_pos = (
        re.search(r"\bn\.", definition)
        and re.search(r"\b(?:v|vt|vi)\.", definition)
    )
    if is_mixed_pos:
        return (
            f"The vocabulary entry ___ matches the meaning “{terms}”.",
            f"词条 ___ 对应“{terms}”。",
            "词义识别",
        )
    if pos == "verb":
        return (
            f"In this vocabulary item, to ___ means “{terms}”.",
            f"在这一词汇题中，___ 表示“{terms}”。",
            "词义识别",
        )
    if pos == "noun":
        return (
            f"In the exam vocabulary list, ___ refers to “{terms}”.",
            f"在考试词汇表中，___ 指“{terms}”。",
            "词义识别",
        )
    if pos == "modifier":
        return (
            f"The word ___ is used for the meaning “{terms}”.",
            f"___ 用来表达“{terms}”这一含义。",
            "词义识别",
        )
    if pos == "function":
        return (
            f"The function word or phrase ___ is listed with the meaning “{terms}”.",
            f"功能词或短语 ___ 在词表中的释义是“{terms}”。",
            "功能词识别",
        )
    return (
        f"The vocabulary entry ___ matches the meaning “{terms}”.",
        f"词条 ___ 对应“{terms}”。",
        "词义识别",
    )


def make_generated_item(entry: dict, buckets: dict) -> dict:
    distractors = choose_distractors(entry, buckets)
    sentence, translation, theme = make_sentence(entry)
    answer = entry["_answer"]
    raw_options = [
        {"word": answer, "zh": entry["_zh"], "correct": True},
        *[
            {"word": item["_answer"], "zh": item["_zh"], "correct": False}
            for item in distractors
        ],
    ]
    options = option_order(raw_options, entry.get("id", answer))
    wrong_parts = [
        f"{option['word']}：{option['zh']}"
        for option in options
        if not option["correct"]
    ]
    definition = entry["_definition_clean"]
    return {
        "id": "",
        "theme": theme,
        "sentence": sentence,
        "answer": answer,
        "translation": translation,
        "level": entry.get("difficultyStage") or "advanced",
        "targetId": entry.get("id"),
        "targetWord": answer,
        "source": "auto-vocab-coverage",
        "explain": f"本题考查大纲词义：{answer} 的释义是“{definition}”。其他选项分别是：{'；'.join(wrong_parts)}，与题干给出的中文义项不同。",
        "options": options,
    }


def normalized_existing_signature(item: dict) -> tuple:
    sentence = compact_spaces(item.get("sentence", "")).lower()
    answer = compact_spaces(item.get("answer", "")).lower()
    words = tuple(sorted(compact_spaces(option.get("word", "")).lower() for option in item.get("options", [])))
    return sentence, answer, words


def normalize_curated_item(item: dict) -> dict:
    normalized = {**item, "source": item.get("source", "curated")}
    fix = CURATED_ITEM_FIXES.get(item.get("id"))
    if fix:
        normalized.update(fix)
    return normalized


def main() -> None:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    cloze = json.loads(CLOZE_PATH.read_text(encoding="utf-8"))
    wordlist_definitions = load_wordlist_definitions()
    entries = [
        prepare_entry(entry, wordlist_definitions)
        for entry in vocab["entries"]
        if answer_word(entry) and compact_spaces(entry.get("definition", ""))
    ]
    buckets = build_buckets(entries)

    curated = [
        normalize_curated_item(item) for item in cloze.get("items", [])
        if item.get("source") != "auto-vocab-coverage"
    ]
    existing_signatures = {normalized_existing_signature(item) for item in curated}

    generated = []
    for entry in entries:
        item = make_generated_item(entry, buckets)
        signature = normalized_existing_signature(item)
        if signature in existing_signatures:
            continue
        generated.append(item)
        existing_signatures.add(signature)

    merged = [*curated, *generated]
    for index, item in enumerate(merged, 1):
        item["id"] = f"cloze-{index:04d}"

    correct_words = {compact_spaces(item.get("answer", "")).lower() for item in merged if item.get("answer")}
    target_ids = {item.get("targetId") for item in merged if item.get("targetId")}
    levels = Counter(item.get("level", "unknown") for item in merged)
    sources = Counter(item.get("source", "curated") for item in merged)

    output = {
        "meta": {
            "count": len(merged),
            "curatedCount": len(curated),
            "generatedCount": len(generated),
            "vocabEntryCount": len(vocab["entries"]),
            "coveredVocabEntries": len(target_ids),
            "distinctAnswerWords": len(correct_words),
            "levels": dict(sorted(levels.items())),
            "sources": dict(sorted(sources.items())),
            "source": "curated near-synonym items + generated full-vocab coverage",
            "note": "前 90 题保留近义词辨析；后续题目从 5390 词大纲自动生成，尽量覆盖所有词条。",
        },
        "items": merged,
    }
    CLOZE_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"curated={len(curated)} generated={len(generated)} "
        f"total={len(merged)} covered_vocab={len(target_ids)}/{len(vocab['entries'])}"
    )
    print("levels:", dict(sorted(levels.items())))
    print("sources:", dict(sorted(sources.items())))


if __name__ == "__main__":
    main()
