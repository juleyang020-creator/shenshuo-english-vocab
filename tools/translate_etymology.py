#!/usr/bin/env python3
"""Translate etymonline etymology paragraphs to Chinese where structural.

etymonline's prose follows a tight, formulaic pattern: "late 14c., 'meaning,'
from Old French X 'gloss,' from Latin Y 'gloss,' from PIE *z 'gloss' …". This
lets us machine-translate the **structural** English (dates, language names,
"from", "see", "related") to Chinese while preserving the foreign words and
their original English glosses unchanged — which is exactly what a Chinese-
speaking learner wants to see: a Chinese skeleton with the loaded ancient
forms intact.

We deliberately do NOT try to translate the English glosses in quotes
('to limit, determine, explain'). Those describe the ancient Latin/Old
French meanings; auto-translating them adds noise and is rarely better
than the original short English.

Adds field:
  etymologyZh: translated paragraph (Chinese with embedded foreign words)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "vocab-study-app" / "public" / "data" / "vocab.json"

# Order matters: longer/more-specific patterns first so they win over
# shorter generic ones. Critical: decade (`1640s`) must come BEFORE bare year
# (`1640`) or the year pattern eats it first and we get "1640 年 年代".
RAW_PATTERNS = [
    # ── Decades MUST go before any "year" pattern so "1640s" beats "1640"
    (r"\b(\d{3,4})s\b", r"\1 年代"),
    # Then multi-word time phrases (with negative look-ahead so an already-
    # produced "年代" isn't re-eaten by these "from year"-style patterns).
    (r"\bis recorded from (\d{4})\b(?! 年代)", r"见于 \1 年"),
    (r"\bis attested from (\d{4})\b(?! 年代)", r"见于 \1 年"),
    (r"\bis from (\d{4})\b(?! 年代)", r"始于 \1 年"),
    (r"\bare from (\d{4})\b(?! 年代)", r"始于 \1 年"),
    (r"\bby (\d{4})\b(?! 年代)", r"截至 \1 年"),
    (r"\bbefore (\d{4})\b(?! 年代)", r"\1 年之前"),
    (r"\bin (\d{4})\b(?! 年代)", r"于 \1 年"),
    (r"\bfrom (\d{4})\b(?! 年代)", r"自 \1 年起"),
    (r"\bc\.[\s ]?(\d{3,4})\b(?! 年代)", r"约 \1 年"),
    # Centuries
    (r"\bearly (\d+)c\.", r"\1 世纪初"),
    (r"\bmid[- ]?(\d+)c\.", r"\1 世纪中期"),
    (r"\blate (\d+)c\.", r"\1 世纪晚期"),
    (r"\b(\d+)c\.", r"\1 世纪"),
    # Bare year LAST. Lookahead ensures we don't munch into an existing
    # "1640 年代" / "1640 年起" / "1640 年之前" / "1640 年" form.
    (r"\b(\d{4})\b(?! 年)", r"\1 年"),

    # ── Language sources (longest first) ────────────────────────────
    (r"\bProto-Indo-European\b", "原始印欧语"),
    (r"\bProto-Germanic\b", "原始日耳曼语"),
    (r"\bAnglo-French\b", "盎格鲁-法语"),
    (r"\bMedieval Latin\b", "中古拉丁语"),
    (r"\bChurch Latin\b", "教会拉丁语"),
    (r"\bLate Latin\b", "晚期拉丁语"),
    (r"\bVulgar Latin\b", "通俗拉丁语"),
    (r"\bMiddle French\b", "中古法语"),
    (r"\bOld French\b", "古法语"),
    (r"\bAnglo-Saxon\b", "盎格鲁-撒克逊语"),
    (r"\bOld English\b", "古英语"),
    (r"\bMiddle English\b", "中古英语"),
    (r"\bOld Norse\b", "古北欧语"),
    (r"\bOld High German\b", "古高地德语"),
    (r"\bOld Saxon\b", "古撒克逊语"),
    (r"\bOld Frisian\b", "古弗里西语"),
    (r"\bOld Dutch\b", "古荷兰语"),
    (r"\bModern English\b", "现代英语"),
    (r"\bModern French\b", "现代法语"),
    (r"\bModern\b", "现代"),
    (r"\bGermanic\b", "日耳曼语"),
    (r"\bLatin\b", "拉丁语"),
    (r"\bGreek\b", "希腊语"),
    (r"\bSanskrit\b", "梵语"),
    (r"\bArabic\b", "阿拉伯语"),
    (r"\bHebrew\b", "希伯来语"),
    (r"\bSpanish\b", "西班牙语"),
    (r"\bItalian\b", "意大利语"),
    (r"\bPortuguese\b", "葡萄牙语"),
    (r"\bGerman\b", "德语"),
    (r"\bDutch\b", "荷兰语"),
    (r"\bFrench\b", "法语"),
    (r"\bIrish\b", "爱尔兰语"),
    (r"\bScottish\b", "苏格兰语"),
    (r"\bRussian\b", "俄语"),
    (r"\bPersian\b", "波斯语"),
    (r"\bJapanese\b", "日语"),
    (r"\bChinese\b", "汉语"),
    (r"\bPIE\b", "原始印欧语 (PIE)"),

    # ── Source markers (multi-word combos handled before "from") ────
    (r"\bis recorded from\b", "见于"),
    (r"\bis attested from\b", "见于"),
    (r"\bis from\b", "始于"),
    (r"\bare from\b", "始于"),
    (r"\bdirectly from\b", "直接源自"),
    (r"\bborrowed from\b", "借自"),
    (r"\bperhaps from\b", "或源自"),
    (r"\bpresumably from\b", "推测源自"),
    (r"\bultimately from\b", "最终源自"),
    (r"\balso from\b", "亦源自"),
    (r"\bfrom the\b", "源自"),
    (r"\bfrom\b", "源自"),

    # ── Composition / structure ─────────────────────────────────────
    (r"\bvia\b", "经由"),
    (r"\bcombining form\b", "构词形式"),
    (r"\bcombining\b", "结合"),
    (r"\bcompound of\b", "由 … 复合而成"),
    (r"\bcompound\b", "复合词"),
    (r"\bderivative of\b", "为 … 的派生形式"),
    (r"\bvariant of\b", "为 … 的变体"),
    (r"\balternative form of\b", "为 … 的别体"),
    (r"\bassimilated form of\b", "为 … 的同化形式"),
    (r"\bdiminutive of\b", "为 … 的指小形式"),
    (r"\baugmentative of\b", "为 … 的扩大形式"),
    (r"\bfeminine of\b", "为 … 的阴性形式"),
    (r"\bplural of\b", "为 … 的复数"),
    (r"\bfrequentative form of\b", "为 … 的反复体"),
    (r"\bfrequentative of\b", "为 … 的反复体"),
    (r"\biterative of\b", "为 … 的反复体"),
    (r"\bcausative of\b", "为 … 的使役形式"),

    # ── Grammatical inflection notes ────────────────────────────────
    (r"\bpast participle of\b", "为 … 的过去分词"),
    (r"\bpresent participle of\b", "为 … 的现在分词"),
    (r"\bpast tense of\b", "为 … 的过去时"),
    (r"\bnoun use of\b", "为 … 的名词用法"),
    (r"\bverb use of\b", "为 … 的动词用法"),
    (r"\badjective use of\b", "为 … 的形容词用法"),
    (r"\bnominative\b", "主格"),
    (r"\bgenitive\b", "属格"),
    (r"\baccusative\b", "宾格"),

    # ── Quoted-gloss markers ────────────────────────────────────────
    (r"\boriginally\b", "原义为"),
    (r"\bliterally\b", "字面义为"),
    (r"\bmeaning\b", "意为"),
    (r"\bsense of\b", "语义"),
    (r"\bin sense of\b", "义为"),

    # ── Records & attestations ──────────────────────────────────────
    (r"\bfirst recorded\b", "首见于"),
    (r"\bfirst attested\b", "最早见于"),
    (r"\battested from\b", "见于"),
    (r"\battested in\b", "见于"),
    (r"\brecorded from\b", "见于"),
    (r"\bRelated:\s*", "同源词："),
    (r"\bRelated forms:\s*", "相关形式："),
    (r"\bAlso:\s*", "另作："),

    # ── Cross-reference ────────────────────────────────────────────
    (r"\(see also\b", "（亦参见"),
    (r"\(see\b", "（参见"),
    (r"\bsee also\b", "亦参见"),
    (r"\bsee\b", "参见"),
    (r"\bCompare\b", "对比"),
    (r"\bcompare\b", "对比"),
    (r"\bcf\.", "对比"),

    # ── Modifiers ──────────────────────────────────────────────────
    (r"\bnow rare\b", "今罕用"),
    (r"\bnow obsolete\b", "今废"),
    (r"\bobsolete\b", "已废"),
    (r"\barchaic\b", "古旧"),
    (r"\bdialectal\b", "方言"),
    (r"\bcolloquial\b", "口语"),
    (r"\bslang\b", "俚语"),
    (r"\bnonstandard\b", "非标准"),

    # ── Senses ─────────────────────────────────────────────────────
    (r"\bsense of\b", "语义"),
    (r"\bin the sense of\b", "在 … 的意义上"),
    (r"\bnotion of\b", "概念"),

    # ── Misc connectives ───────────────────────────────────────────
    (r"\bperhaps\b", "或许"),
    (r"\bprobably\b", "可能"),
    (r"\bapparently\b", "似乎"),
    (r"\bevidently\b", "显然"),
    (r"\bof unknown origin\b", "来源不详"),
    (r"\bof uncertain origin\b", "来源存疑"),
    (r"\borigin uncertain\b", "来源存疑"),
    (r"\bnative\b", "本族"),
    (r"\bcognate with\b", "与 … 同源"),
    (r"\bcognate\b", "同源"),
    (r"\bnear cognate\b", "近源"),

    # ── POS abbreviations in parens ────────────────────────────────
    (r"\(v\.\)", "（动）"),
    (r"\(n\.\)", "（名）"),
    (r"\(adj\.\)", "（形）"),
    (r"\(adv\.\)", "（副）"),
    (r"\(prep\.\)", "（介）"),
    (r"\(conj\.\)", "（连）"),
    (r"\(pron\.\)", "（代）"),
    (r"\(interj\.\)", "（叹）"),
    (r"\(art\.\)", "（冠）"),

    # ── Common content words ──────────────────────────────────────
    (r"\bAs a noun\b", "作名词时"),
    (r"\bAs an adjective\b", "作形容词时"),
    (r"\bAs a verb\b", "作动词时"),
    (r"\bas a noun\b", "作名词时"),
    (r"\bas an adjective\b", "作形容词时"),
    (r"\bas a verb\b", "作动词时"),
    (r"\bAs an?\b", "作为"),
    (r"\bas an?\b", "作为"),
    (r"\bnoun\b", "名词"),
    (r"\bverb\b", "动词"),
    (r"\badjective\b", "形容词"),
    (r"\badverb\b", "副词"),
    (r"\bSince\b", "自"),
    (r"\bsince\b", "自"),
    (r"\bnow\b", "现在"),
    (r"\bthen\b", "之后"),
    (r"\boften\b", "常"),
    (r"\busually\b", "通常"),
    (r"\bespecially\b", "尤指"),
    (r"\bsometimes\b", "有时"),
    (r"\battribut(?:ive|ively)\b", "定语用法"),

    # ── Light connectives (translate only at recognisable boundaries) ─
    (r"\band directly\b", "且直接"),
    (r"\bor directly\b", "或直接"),
    (r",\s+or\s+", "，或"),
    (r"\bMeaning\s+", "义为 "),
    (r"\bnotion of\b", "概念"),
    (r"\bSense of\b", "义为"),
]

COMPILED = [(re.compile(pat), repl) for pat, repl in RAW_PATTERNS]

# Match a quoted English gloss in the etymology text. We never want to
# translate inside these because:
#   1) they describe ancient Latin/Old French meanings, not modern English
#   2) translating "from one place to another" would turn into nonsense
QUOTE_RE = re.compile(r'("[^"]*"|\'[^\']*\')')


def translate(text: str) -> str:
    """Translate structural English to Chinese while leaving quoted glosses
    and inline foreign words alone."""
    if not text:
        return text
    # Split on quoted segments so we only translate the OUT-of-quote parts.
    pieces = QUOTE_RE.split(text)
    rebuilt = []
    for index, piece in enumerate(pieces):
        if index % 2 == 1:
            # Odd indices are quoted segments — keep verbatim.
            rebuilt.append(piece)
            continue
        translated = piece
        for regex, replacement in COMPILED:
            translated = regex.sub(replacement, translated)
        rebuilt.append(translated)
    out = ''.join(rebuilt)
    # Tidy double spaces, spacing before punctuation.
    out = re.sub(r"\s+([。，；：、）])", r"\1", out)
    out = re.sub(r"（\s+", r"（", out)
    out = re.sub(r"\s+", " ", out).strip()
    return out


def main() -> int:
    data = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    entries = data.get("entries", [])
    translated = 0
    for entry in entries:
        et = entry.get("etymology")
        if et:
            entry["etymologyZh"] = translate(et)
            translated += 1
        else:
            entry["etymologyZh"] = None
    data.setdefault("meta", {})["etymologyTranslationStrategy"] = (
        "Pattern-based: translates dates / language names / structural markers "
        "into Chinese; quoted English glosses and foreign words are preserved."
    )
    VOCAB_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"translated {translated}/{len(entries)} etymology paragraphs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
