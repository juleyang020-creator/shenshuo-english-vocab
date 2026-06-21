#!/usr/bin/env python3
"""Extract Appendix I vocabulary from the exam syllabus PDF.

The PDF uses a custom text encoding, so the embedded text layer is not usable.
This script renders the vocabulary appendix pages, OCRs them, separates the
two printed columns, and converts dictionary-style entries into JSON for the
learning app.
"""

from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "同等学力人员申请硕士学位英语水平全国统一考试大纲（第六版）.pdf"
APP_DIR = ROOT / "vocab-study-app"
OUT_DIR = APP_DIR / "public" / "data"
TMP_DIR = ROOT / "tmp" / "vocab_ocr"
RAW_LINES_PATH = TMP_DIR / "ocr_lines.json"
HEADWORD_LINES_PATH = TMP_DIR / "ocr_lines_eng_psm11.json"
OUT_PATH = OUT_DIR / "vocab.json"

PDF_PAGE_OFFSET = 4
VOCAB_PDF_START = 92
VOCAB_PDF_END = 286
RENDER_DPI = 240
OCR_LANG = "chi_sim"
HEADWORD_OCR_LANG = "eng"
HEADWORD_OCR_PSM = "11"

POS_WORDS = {
    "a",
    "ad",
    "adj",
    "adv",
    "art",
    "aux",
    "conj",
    "int",
    "n",
    "num",
    "pl",
    "prep",
    "pron",
    "v",
    "vi",
    "vt",
}

POS_START_RE = re.compile(
    r"^(?:n|ne|nm|nn|v|vi|vt|ut|ul|ve|vu|a|ad|adv|prep|prebp|pron|bron|conj|co|aux|int|art|num|pl|cpl)\s*[.,，。]",
    re.IGNORECASE,
)

ALLOWED_SHORT_WORDS = {
    "a",
    "i",
    "am",
    "an",
    "as",
    "at",
    "be",
    "by",
    "do",
    "go",
    "he",
    "if",
    "in",
    "is",
    "it",
    "me",
    "mr",
    "my",
    "no",
    "of",
    "on",
    "or",
    "ox",
    "so",
    "to",
    "tv",
    "uk",
    "up",
    "us",
    "we",
}

WORD_CORRECTIONS = {
    "acessory": "accessory",
    "acccutacy": "accuracy",
    "acctuse": "accuse",
    "acduisition": "acquisition",
    "aetial": "aerial",
    "alm": "aim",
    "alieviate": "alleviate",
    "auto( mobile)": "auto(mobile)",
    "avvert": "avert",
    "avwait": "await",
    "avwake": "awake",
    "avwesome": "awesome",
    "peauty": "beauty",
    "plo": "blog",
    "caf": "cafe",
    "anvas": "canvas",
    "apability": "capability",
    "apacity": "capacity",
    "apsule": "capsule",
    "aptive": "captive",
    "arbon": "carbon",
    "ardiac": "cardiac",
    "arefree": "carefree",
    "aring": "caring",
    "argo": "cargo",
    "arpenter": "carpenter",
    "arpet": "carpet",
    "arriage": "carriage",
    "arrier": "carrier",
    "arrot": "carrot",
    "artoon": "cartoon",
    "arve": "carve",
    "ashier": "cashier",
    "assette": "cassette",
    "ast": "cast",
    "astle": "castle",
    "asualty": "casualty",
    "atalog(ue)": "catalog(ue)",
    "atastrophe": "catastrophe",
    "ategory": "category",
    "ater": "cater",
    "athedral": "cathedral",
    "atholic": "catholic",
    "aution": "caution",
    "autious": "cautious",
    "ave": "cave",
    "clumpsy": "clumsy",
    "crulty": "cruelty",
    "se dictation": "dictation",
    "distil(d": "distil(l)",
    "dvwaft": "dwarf",
    "fashionabjle": "fashionable",
    "favo(wr": "favo(u)r",
    "favo(u) rable": "favo(u)rable",
    "favo(u) rite": "favo(u)rite",
    "fulfil)": "fulfil(l)",
    "hono(w)r": "hono(u)r",
    "hono(wu) rable": "hono(u)rable",
    "humo(w)r": "humo(u)r",
    "ie hy": "ideal",
    "judg(e) ment": "judg(e)ment",
    "pee legislation": "legislation",
    "f lick": "lick",
    "frife": "lift",
    "labo(u) r": "labo(u)r",
    "longivity": "longevity",
    "ammal": "mammal",
    "ature": "mature",
    "aturity": "maturity",
    "aximize": "maximize",
    "munister": "minister",
    "aive": "naive",
    "aked": "naked",
    "arrate": "narrate",
    "arrative": "narrative",
    "asty": "nasty",
    "ationalist": "nationalist",
    "neighbocu)r": "neighbo(u)r",
    "neighbocu)rhood": "neighbo(u)rhood",
    "dewws": "news",
    "dickel": "nickel",
    "notewory": "noteworthy",
    "oclock": "o'clock",
    "overtutrn": "overturn",
    "oowe": "owe",
    "pronounciation": "pronunciation",
    "quaterly": "quarterly",
    "abbit": "rabbit",
    "acial": "racial",
    "adar": "radar",
    "adiate": "radiate",
    "adical": "radical",
    "adioactive": "radioactive",
    "adium": "radium",
    "adius": "radius",
    "ailroad": "railroad",
    "ainbow": "rainbow",
    "ainy": "rainy",
    "andom": "random",
    "ating": "rating",
    "fater": "refer",
    "s salute": "salute",
    "snapetet": "snapshot",
    "weer": "sweep",
    "tel": "tell",
    "aken": "waken",
    "allet": "wallet",
    "ander": "wander",
    "ard": "ward",
    "ardrobe": "wardrobe",
    "arehouse": "warehouse",
    "arfare": "warfare",
    "wateh": "watch",
    "yater": "water",
    "ayside": "wayside",
}

ENTRY_CORRECTIONS = {
    ("as", 165): "glass",
    ("n brak", 96): "air",
    ("rage", 96): "age",
    ("raid", 96): "aid",
    ("rally", 97): "alliance",
    ("duty", 99): "any",
    ("ne ae bears al", 105): "barber",
    ("junior", 106): "bay",
    ("i th", 143): "draw",
    ("any", 144): "duty",
    ("ese", 146): "egg",
    ("ay hbc", 157): "fine",
    ("ne pi s bets", 168): "hamper",
    ("hi hey", 171): "hi/hey",
    ("aie", 174): "hurt",
    ("impbrison", 176): "imprison",
    ("bay", 184): "junior",
    ("iaw", 186): "law",
    ("ail", 202): "nail",
    ("aa eee", 189): "light",
    ("aaa", 189): "liquid",
    ("n ju ta) bert", 195): "meanwhile",
    ("cron", 197): "microphone",
    ("epaenr", 209): "optional",
    ("pele yse", 213): "paralyze",
    ("ae rah)", 213): "parent",
    ("perbies", 216): "perplex",
    ("etat", 221): "potato",
    ("i", 220): "pose",
    ("pe qualitative", 227): "qualitative",
    ("ace", 228): "race",
    ("tag", 228): "rag",
    ("adar", 228): "radar",
    ("adiate", 228): "radiate",
    ("age", 229): "rage",
    ("aid", 229): "raid",
    ("ail", 229): "rail",
    ("ally", 229): "rally",
    ("ape", 229): "rape",
    ("ash", 229): "rash",
    ("tay", 229): "ray",
    ("a regiment", 232): "regiment",
    ("vt il bia", 237): "rival",
    ("an", 238): "rod",
    ("pit", 249): "slam",
    ("vt peub", 241): "scare",
    ("ul i", 250): "soar",
    ("kur", 250): "soft",
    ("n af", 256): "stem",
    ("ut ih", 256): "stir",
    ("vt rwi", 263): "talk",
    ("sabla", 263): "tea",
    ("eae", 267): "tight",
    ("feat", 270): "treat",
    ("ve if kare an", 277): "venture",
    ("ne eh", 282): "when",
    ("nt fel", 285): "wreck",
}

DROP_HEADWORDS = {
    "ere he ma",
    "mb expand",
    "u be beak ret",
    "ne hay lay bi",
    "tes",
    "h ads",
    "cute hue fi cl",
    "br wr hi",
    "n aeb",
    "ne sawn ae",
    "be that",
    "bak te",
}

DROP_ENTRY_KEYS = {
    ("legislation", 185),
}

PREFER_LINE_HEADWORDS = {
    "cab",
    "cabbage",
    "provide",
    "prosperity",
}

DEFINITION_OVERRIDES = {
    ("glimpse", 165): ["n. 一瞥,一看", "vt. 瞥见"],
    ("golden", 165): ["a. 金色的;黄金的;金制的"],
    ("good", 165): [
        "a. 好的,美好的;好心的,善良的;有本事的,擅长的;乖的,顺从的",
        "n. 好事;好处,利益",
    ],
    ("hi/hey", 171): ["int. 喂;嘿"],
    ("hono(u)r", 173): ["n. 荣誉,光荣,敬意", "vt. 尊敬,给以荣誉"],
    ("hurt", 174): [
        "vt. 伤害,刺痛;伤感情;损害",
        "vi. 痛,受痛苦",
        "n. 损害,伤害",
    ],
    ("humo(u)r", 174): ["n. 幽默,诙谐"],
    ("humo(u)rous", 174): ["a. 幽默的"],
    ("adopt", 95): ["vt. 收养;采用,采纳;通过"],
    ("approach", 100): ["v. 接近,走近;处理,对待", "n. 走近;方法,途径;观点"],
    ("astonish", 102): ["vt. 使惊讶,使吃惊"],
    ("any", 99): [
        "a. 任何的,任一的;[否定、疑问、条件句中]什么,一些",
        "pron. 无论哪个,无论哪些,任一",
    ],
    ("bang", 105): ["n. 巨响,爆炸声;猛击,猛撞", "v. 猛击,猛撞;砰地一声响"],
    ("blink", 109): ["vi. /vt. 眨眼;使闪烁", "n. 眨眼;闪烁;瞬间"],
    ("browse", 113): ["v. /n. 浏览"],
    ("bubble", 113): ["n. 泡,水泡,气泡", "vi. 冒泡,起泡,沸腾"],
    ("burst", 114): ["vi. /n. 破裂,爆炸", "vi. (into) 突然发生,突然发作"],
    ("busy", 114): ["a. 忙的,忙碌的;热闹的,繁忙的", "(电话)占线"],
    ("bypass", 114): ["vt. 忽视;绕开;设旁路;迂回", "n. 旁路;支路"],
    ("by", 114): [
        "prep. 在……旁,靠近;被,由;在……前,到……为止;经由;按照",
        "ad. 在旁,近旁,经过",
    ],
    ("caution", 117): ["n. /vt. 警告;小心;告诫"],
    ("collision", 123): ["n. 碰撞,冲突,抵触"],
    ("degenerate", 135): ["vt. 使退化;恶化", "vi. 堕落;退化", "a. 退化的;堕落的"],
    ("peer", 215): ["n. 同等的人,贵族", "vi. 凝视,盯着看"],
    ("imprison", 176): ["vt. 监禁;关押;使下狱"],
    ("junior", 184): [
        "a. 年少的,年幼的;后进的,下级的",
        "n. 年少者,晚辈,下级",
    ],
    ("law", 186): ["n. 法律,法规;规律,法则,定律"],
    ("ought to", 210): ["aux. 应该,应当;本应"],
    ("refund", 232): ["vi. /vt. /n. 退还;偿还;退款"],
    ("search", 242): ["v. /n. (for) 搜索,寻找,探查"],
    ("sentence", 243): ["n. 句子", "n. /vt. 判决,宣判"],
    ("sleepy", 249): ["a. 困乏的,想睡的"],
    ("sober", 250): ["a. 冷静的,清醒的;未醉的"],
    ("stare", 255): ["vi. /n. 凝视,盯视"],
    ("surge", 261): ["n. 大浪;汹涌"],
    ("tie", 267): ["n. 领带;纽带,联系", "vt. 系,捆;打领结"],
    ("unpleasant", 274): ["a. 使人不愉快的;讨厌的"],
    ("unload", 274): ["vt. 卸;摆脱……之负担"],
    ("wash", 280): ["v. /n. 洗,冲洗", "v. (浪涛)冲刷,拍打", "n. 洗涤物,衣服"],
    ("pose", 220): [
        "n. 姿势,姿态",
        "vt. (使)摆好姿势;形成,引起",
        "vi. 摆姿势;装腔作势,矫揉造作",
    ],
    ("prove", 226): ["vt. 证明,证实;检验,鉴定", "vi. 结果是,表明是"],
    ("provide", 226): ["vt. 提供,供给"],
    ("prosperity", 226): ["n. 繁荣,兴旺"],
    ("prosperous", 226): ["a. 繁荣的,兴旺的"],
    ("project", 225): ["n. 计划,方案;工程,项目", "vt. 设计,规划;投射;放映"],
    ("rag", 228): ["n. 破布,碎布"],
    ("race", 228): [
        "n. 种族,人种;竞赛,赛跑",
        "vt. 使全速行进;和……赛跑",
        "vi. 疾走;竞走;参加竞赛",
    ],
    ("radar", 228): ["n. 雷达"],
    ("radiate", 228): ["vt. 发射,辐射;散发", "vi. 发光,辐射;流露"],
    ("rage", 229): ["n. 愤怒", "vi. 发怒;肆虐"],
    ("raid", 229): ["n. 袭击,搜捕", "vt. 奇袭,搜捕"],
    ("rail", 229): ["n. 栏杆,围栏;(pl.)铁路"],
    ("railroad", 229): ["n. 铁路"],
    ("rainbow", 229): ["n. 虹,彩虹"],
    ("rainy", 229): ["a. 下雨的,多雨的"],
    ("ray", 229): ["n. 线,光线,射线"],
    ("reach", 229): [
        "vt. 伸手,够到,触到;到达",
        "vi. 达到,延伸;伸出手",
        "n. 能达到的范围",
    ],
    ("stem", 256): ["vt. 堵住,挡住", "vi. 起源于,由……造成"],
    ("tea", 263): ["n. 茶叶,茶;茶点"],
    ("treat", 270): ["vt. 对待,处理;治疗", "n. 款待,请客"],
    ("wag(g)on", 279): ["n. 运货马车,运货车"],
    ("wit", 283): ["n. 智力,才智,智慧"],
}

MANUAL_ENTRIES = [
    {
        "word": "global",
        "definitionLines": ["a. 地球的,全球的;全局的"],
        "pdfPage": 165,
        "printedPage": 161,
        "column": "left",
    },
    {
        "word": "globe",
        "definitionLines": ["n. 地球;地球仪,球体"],
        "pdfPage": 165,
        "printedPage": 161,
        "column": "left",
    },
    {
        "word": "golf",
        "definitionLines": ["n. 高尔夫球"],
        "pdfPage": 165,
        "printedPage": 161,
        "column": "right",
    },
    {
        "word": "cabbage",
        "definitionLines": ["n. 卷心菜,洋白菜"],
        "pdfPage": 114,
        "printedPage": 110,
        "column": "right",
    },
]


@dataclass
class WordBox:
    text: str
    left: int
    top: int
    width: int
    height: int
    conf: float

    @property
    def center_y(self) -> float:
        return self.top + self.height / 2

    @property
    def right(self) -> int:
        return self.left + self.width


def run(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(
            "Command failed: "
            + " ".join(cmd)
            + "\nSTDERR:\n"
            + proc.stderr[-4000:]
        )
    return proc.stdout


def render_pages() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    missing = [
        page
        for page in range(VOCAB_PDF_START, VOCAB_PDF_END + 1)
        if not page_image(page).exists()
    ]
    if not missing:
        return

    run(
        [
            "pdftoppm",
            "-png",
            "-r",
            str(RENDER_DPI),
            "-f",
            str(VOCAB_PDF_START),
            "-l",
            str(VOCAB_PDF_END),
            str(PDF),
            str(TMP_DIR / "page"),
        ]
    )


def page_image(pdf_page: int) -> Path:
    return TMP_DIR / f"page-{pdf_page:03d}.png"


def ocr_page(image_path: Path, lang: str = OCR_LANG, psm: str = "6") -> list[WordBox]:
    output = run(
        [
            "tesseract",
            str(image_path),
            "stdout",
            "-l",
            lang,
            "--psm",
            psm,
            "tsv",
        ]
    )
    rows = csv.DictReader(output.splitlines(), delimiter="\t")
    words: list[WordBox] = []
    for row in rows:
        if row.get("level") != "5":
            continue
        text = (row.get("text") or "").strip()
        if not text:
            continue
        try:
            conf = float(row.get("conf") or -1)
            left = int(row["left"])
            top = int(row["top"])
            width = int(row["width"])
            height = int(row["height"])
        except (TypeError, ValueError, KeyError):
            continue
        if conf < 0:
            continue
        words.append(WordBox(text, left, top, width, height, conf))
    return words


def cluster_lines(words: list[WordBox]) -> list[dict]:
    by_column: dict[str, list[WordBox]] = defaultdict(list)
    if not words:
        return []

    max_right = max(word.right for word in words)
    midpoint = max_right / 2
    for word in words:
        column = "left" if word.left + word.width / 2 < midpoint else "right"
        by_column[column].append(word)

    lines: list[dict] = []
    for column in ("left", "right"):
        column_words = sorted(by_column[column], key=lambda w: (w.center_y, w.left))
        clusters: list[list[WordBox]] = []
        for word in column_words:
            if not clusters:
                clusters.append([word])
                continue
            current = clusters[-1]
            current_y = mean(item.center_y for item in current)
            threshold = max(9, min(18, word.height * 0.62))
            if abs(word.center_y - current_y) <= threshold:
                current.append(word)
            else:
                clusters.append([word])

        for cluster in clusters:
            ordered = sorted(cluster, key=lambda w: w.left)
            text = " ".join(word.text for word in ordered)
            conf = mean(word.conf for word in ordered)
            left = min(word.left for word in ordered)
            top = min(word.top for word in ordered)
            width = max(word.right for word in ordered) - left
            height = max(word.top + word.height for word in ordered) - top
            lines.append(
                {
                    "column": column,
                    "text": text,
                    "conf": round(conf, 1),
                    "left": left,
                    "top": top,
                    "width": width,
                    "height": height,
                }
            )

    return lines


def extract_lines() -> list[dict]:
    if RAW_LINES_PATH.exists():
        return attach_headword_ocr(
            json.loads(RAW_LINES_PATH.read_text(encoding="utf-8"))
        )

    render_pages()
    all_lines: list[dict] = []
    for pdf_page in range(VOCAB_PDF_START, VOCAB_PDF_END + 1):
        image_path = page_image(pdf_page)
        if not image_path.exists():
            raise FileNotFoundError(image_path)
        with Image.open(image_path) as image:
            image_width, image_height = image.size
        words = ocr_page(image_path, OCR_LANG, "6")
        page_lines = cluster_lines(words)

        for line in page_lines:
            if line["top"] < image_height * 0.025:
                continue
            if line["top"] > image_height * 0.965:
                continue
            text = line["text"].strip()
            if not text:
                continue
            if not re.search(r"[A-Za-z\u3400-\u9fff]", text):
                continue
            if pdf_page == VOCAB_PDF_START and line["top"] < image_height * 0.19:
                continue
            if re.fullmatch(r"[•+\-.\s\d。．]+", text):
                continue
            line["pdfPage"] = pdf_page
            line["printedPage"] = pdf_page - PDF_PAGE_OFFSET
            line["imageWidth"] = image_width
            line["imageHeight"] = image_height
            all_lines.append(line)

        print(f"OCR page {pdf_page}/{VOCAB_PDF_END}", file=sys.stderr, flush=True)

    RAW_LINES_PATH.write_text(
        json.dumps(all_lines, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return attach_headword_ocr(all_lines)


def extract_headword_lines() -> list[dict]:
    if HEADWORD_LINES_PATH.exists():
        return json.loads(HEADWORD_LINES_PATH.read_text(encoding="utf-8"))

    render_pages()
    all_lines: list[dict] = []
    for pdf_page in range(VOCAB_PDF_START, VOCAB_PDF_END + 1):
        image_path = page_image(pdf_page)
        if not image_path.exists():
            raise FileNotFoundError(image_path)
        with Image.open(image_path) as image:
            image_width, image_height = image.size
        words = ocr_page(image_path, HEADWORD_OCR_LANG, HEADWORD_OCR_PSM)
        page_lines = cluster_lines(words)

        for line in page_lines:
            if line["top"] < image_height * 0.025:
                continue
            if line["top"] > image_height * 0.965:
                continue
            text = line["text"].strip()
            if not text:
                continue
            if not re.search(r"[A-Za-z]", text):
                continue
            if pdf_page == VOCAB_PDF_START and line["top"] < image_height * 0.19:
                continue
            line["pdfPage"] = pdf_page
            line["printedPage"] = pdf_page - PDF_PAGE_OFFSET
            line["imageWidth"] = image_width
            line["imageHeight"] = image_height
            all_lines.append(line)

        print(f"Headword OCR page {pdf_page}/{VOCAB_PDF_END}", file=sys.stderr, flush=True)

    HEADWORD_LINES_PATH.write_text(
        json.dumps(all_lines, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return all_lines


def contains_cjk(text: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", text))


def normalize_word(text: str) -> str:
    text = text.strip()
    text = text.replace("—", "-").replace("–", "-").replace("‘", "'").replace("’", "'")
    text = text.replace("／", "/").replace("．", ".")
    text = text.replace("[", "(").replace("]", ")")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*/\s*", "/", text)
    text = re.sub(r"\s*-\s*", "-", text)
    text = text.strip(" .,:;|_，。．、")
    text = re.sub(r"^[^A-Za-z]+", "", text)
    text = re.sub(r"[^A-Za-z.)]+$", "", text)
    if re.fullmatch(r"[A-Za-z][A-Za-z'./()+ -]*", text) and not text.isupper():
        text = text.lower()
    return text


def normalize_definition_line(text: str) -> str:
    text = text.strip().replace("|", " ")
    text = text.replace("—", "-").replace("–", "-")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"([\u3400-\u9fff])\s+([\u3400-\u9fff])", r"\1\2", text)
    text = re.sub(r"\s+([,，;；:：.!?。])", r"\1", text)
    text = re.sub(r"([（(])\s+", r"\1", text)
    text = re.sub(r"\s+([）)])", r"\1", text)
    text = text.replace(" ,", ",").replace(" ;", ";")
    text = fix_definition_ocr(text)
    return text.strip()


def fix_definition_ocr(text: str) -> str:
    replacements = {
        "飞行吉": "飞行器",
        "具待": "虐待",
        "辱驾": "辱骂",
        "鸣端": "弊端",
        "匾雇": "荒谬",
        "独击": "撞击",
        "洗视": "凝视",
        "宕视": "盯视",
        "热闸": "热闹",
        "和欲睡": "想睡",
        "未醇": "未醉",
        "漳涌": "汹涌",
        "不丛快": "不愉快",
        "丛快": "愉快",
        "钊": "卸",
        "和撞": "碰撞",
        "告诚": "告诫",
        "随落": "堕落",
        "喷落": "堕落",
        "不有具体的": "不具体的",
        "胡葛下": "胡萝卜",
        "看热闸": "看热闹",
        "层斗": "熨斗",
        "衣刺": "讽刺",
        "收子": "蚊子",
        "履盖": "覆盖",
    }
    for wrong, right in replacements.items():
        text = text.replace(wrong, right)

    pos_replacements = [
        (r"^ait[。.,，]?\s*", "art. "),
        (r"^atz[.。]?\s*", "aux. "),
        (r"^z?brep[.。]?\s*", "prep. "),
        (r"^prebp[.。]?\s*", "prep. "),
        (r"^prepp[.。]?\s*", "prep. "),
        (r"^preph[、.。]?\s*", "prep. "),
        (r"^co(?:1J1|z1j|zj|771|71|n1)[.。,，]?\s*", "conj. "),
        (r"^coz(?:2j|7?1|j)?[.。,，]?\s*", "conj. "),
        (r"^zron[.。,，]?\s*", "pron. "),
        (r"^zzroz[.。\[]?\s*", "pron. "),
        (r"^zroz[.。,，]?\s*", "pron. "),
        (r"^proz[.。,，]?\s*", "pron. "),
        (r"^acd[.。,，]?\s*", "ad. "),
        (r"^adg[.。,，]?\s*", "ad. "),
        (r"^adtz[.。,，]?\s*", "aux. "),
        (r"^4a[.。,，]?\s*", "a. "),
        (r"^4&[.。,，]?\s*", "a. "),
        (r"^4[.。,，]?\s*", "a. "),
        (r"^[?？]?\s*[127][2]?[.。,，]?\s*", "n. "),
        (r"^2[.。,，]?\s*", "n. "),
        (r"^MU71[.。,，]?\s*", "num. "),
        (r"^jz7[.。,，]?\s*", "num. "),
        (r"^w[.。,，]?\s*/\s*[72][.。,，]?\s*", "v. /n. "),
        (r"^z[.。,，]?\s*/\s*[72][.。,，]?\s*", "v. /n. "),
        (r"^vi[.。,，]?\s*/\s*[72][.。,，]?\s*", "vi. /n. "),
        (r"^vt[.。,，]?\s*/\s*[72][.。,，]?\s*", "vt. /n. "),
        (r"^w(?!w)[.。,，]?\s*", "v. "),
        (r"^Y[.。,，、]?\s*", "v. "),
        (r"^z(?![ztir])[.。,，]?\s*", "v. "),
        (r"^zz[.。,，]?\s*", "vi. "),
        (r"^tt[.。,，]?\s*", "vt. "),
        (r"^上\s*tt[.。,，]?\s*上?\s*", "vt. "),
        (r"^zt[.。,，]?\s*", "vt. "),
        (r"^ZL[.。,，]?\s*", "vt. "),
        (r"^ut[.。,，]?\s*", "vt. "),
        (r"^UL[.。,，]?\s*", "vt. "),
        (r"^VL[.。,，]?\s*", "vt. "),
        (r"^V[，,。.]\s*", "vt. "),
        (r"^zi[.。,，]?\s*", "vi. "),
        (r"^i\s+", "vi. "),
        (r"^ww[.。,，]?\s*", "v. "),
    ]
    for pattern, replacement in pos_replacements:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def is_noise_line(line: dict) -> bool:
    text = line["text"].strip()
    if not text:
        return True
    if not re.search(r"[A-Za-z\u3400-\u9fff]", text):
        return True
    if line.get("pdfPage") == VOCAB_PDF_START and line.get("top", 0) < line.get("imageHeight", 1) * 0.19:
        return True
    if re.fullmatch(r"[•+\-.\s\d。．]+", text):
        return True
    return False


def is_possible_headword_line(line: dict) -> bool:
    raw_text = line["text"].strip()
    if not raw_text or contains_cjk(raw_text):
        return False
    text = normalize_word(raw_text)
    if not text or len(text) > 46:
        return False
    if POS_START_RE.match(text):
        return False
    image_width = line["imageWidth"]
    midpoint = image_width / 2
    column_start = 0 if line["column"] == "left" else midpoint
    relative_left = line["left"] - column_start
    if relative_left > image_width * 0.13:
        return False
    if line["width"] > image_width * 0.28:
        return False
    return bool(re.search(r"[A-Za-z]", text))


def attach_headword_ocr(lines: list[dict]) -> list[dict]:
    try:
        headword_lines = extract_headword_lines()
    except Exception as error:
        print(f"Headword OCR unavailable: {error}", file=sys.stderr)
        return lines

    by_position: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for line in headword_lines:
        if is_possible_headword_line(line):
            by_position[(line["pdfPage"], line["column"])].append(line)

    for candidates in by_position.values():
        candidates.sort(key=lambda item: item["top"])

    matched_headword_ids: set[int] = set()
    for line in lines:
        if not is_possible_headword_line(line):
            continue
        candidates = [
            candidate
            for candidate in by_position.get((line["pdfPage"], line["column"]), [])
            if abs(candidate["top"] - line["top"]) <= 24
        ]
        if not candidates:
            continue
        best = min(
            candidates,
            key=lambda candidate: (
                abs(candidate["top"] - line["top"]),
                abs(candidate["left"] - line["left"]),
            ),
        )
        word = normalize_word(best["text"])
        if not word:
            continue
        line["headwordText"] = word
        line["headwordConfidence"] = best["conf"]
        matched_headword_ids.add(id(best))

    for candidate in headword_lines:
        if id(candidate) in matched_headword_ids:
            continue
        if not is_possible_headword_line(candidate):
            continue
        already_has_line = any(
            line["pdfPage"] == candidate["pdfPage"]
            and line["column"] == candidate["column"]
            and abs(line["top"] - candidate["top"]) <= 18
            for line in lines
        )
        if already_has_line:
            continue
        word = normalize_word(candidate["text"])
        if not word:
            continue
        synthetic = {
            **candidate,
            "text": word,
            "headwordText": word,
            "headwordConfidence": candidate["conf"],
            "syntheticHeadword": True,
        }
        lines.append(synthetic)
    return lines


def looks_like_headword(line: dict) -> bool:
    text = best_headword_text(line)
    if not text or len(text) > 42:
        return False
    if POS_START_RE.match(text):
        return False
    if contains_cjk(text):
        return False
    if any(ch.isdigit() for ch in text):
        return False
    if re.search(r"[{}\[\]，。；：!?？]", text):
        return False

    cleaned = text.lower().replace(".", "").replace("/", "").replace("-", "")
    cleaned = cleaned.replace("(", "").replace(")", "")
    if cleaned in POS_WORDS:
        return False
    if len(cleaned) <= 2 and cleaned not in ALLOWED_SHORT_WORDS:
        return False
    if "." in text and not re.fullmatch(
        r"(a\.m\.?|p\.m\.?|u\.s\.?|u\.n\.?|m\.a\.?|ph\.d\.?)",
        text.lower(),
    ):
        return False
    if " " in text and text != text.lower():
        return False
    if len(text.split()) > 4:
        return False
    if re.fullmatch(r"[a-z]+", text.lower()) is None and re.fullmatch(
        r"[A-Za-z][A-Za-z .'/()+-]*", text
    ) is None:
        return False

    image_width = line["imageWidth"]
    midpoint = image_width / 2
    column_start = 0 if line["column"] == "left" else midpoint
    relative_left = line["left"] - column_start
    if relative_left > image_width * 0.115:
        return False

    alpha = len(re.findall(r"[A-Za-z]", text))
    if alpha < 1:
        return False
    if alpha / max(len(text), 1) < 0.45:
        return False
    return True


def is_plausible_headword_text(text: str) -> bool:
    if not text or len(text) > 42:
        return False
    if POS_START_RE.match(text):
        return False
    if contains_cjk(text):
        return False
    if any(ch.isdigit() for ch in text):
        return False
    if re.search(r"[{}\[\]，。；：!?？]", text):
        return False

    cleaned = text.lower().replace(".", "").replace("/", "").replace("-", "")
    cleaned = cleaned.replace("(", "").replace(")", "")
    if cleaned in POS_WORDS:
        return False
    if len(cleaned) <= 2 and cleaned not in ALLOWED_SHORT_WORDS:
        return False
    if "." in text and not re.fullmatch(
        r"(a\.m\.?|p\.m\.?|u\.s\.?|u\.n\.?|m\.a\.?|ph\.d\.?)",
        text.lower(),
    ):
        return False
    if " " in text and text != text.lower():
        return False
    if len(text.split()) > 4:
        return False
    if re.fullmatch(r"[a-z]+", text.lower()) is None and re.fullmatch(
        r"[A-Za-z][A-Za-z .'/()+-]*", text
    ) is None:
        return False
    return True


def best_headword_text(line: dict) -> str:
    line_word = normalize_word(line["text"])
    ocr_word = normalize_word(line.get("headwordText") or "")
    line_ok = is_plausible_headword_text(line_word)
    ocr_ok = is_plausible_headword_text(ocr_word)

    if line_ok and line_word.lower() in PREFER_LINE_HEADWORDS:
        return line_word
    if line_ok and ocr_ok:
        line_key = re.sub(r"[^a-z]", "", line_word.lower())
        ocr_key = re.sub(r"[^a-z]", "", ocr_word.lower())
        if line_key == ocr_key:
            if "/" in ocr_word and "/" not in line_word:
                return ocr_word
            return line_word
        return ocr_word
    if ocr_ok:
        return ocr_word
    if line_ok and not contains_cjk(line["text"]):
        return line_word
    return ""


def parse_entries(lines: list[dict]) -> list[dict]:
    lines = sorted(
        lines,
        key=lambda line: (
            line["pdfPage"],
            0 if line["column"] == "left" else 1,
            line["top"],
            line["left"],
        ),
    )
    entries: list[dict] = []
    current: dict | None = None

    for line in lines:
        if is_noise_line(line):
            continue
        text = normalize_definition_line(line["text"])
        if not text:
            continue

        if looks_like_headword(line):
            word = best_headword_text(line)
            current = {
                "id": f"vocab-{len(entries) + 1:05d}",
                "word": word,
                "definitionLines": [],
                "definition": "",
                "source": "附录一 词汇表",
                "pdfPage": line["pdfPage"],
                "printedPage": line["printedPage"],
                "column": line["column"],
                "ocrConfidence": line["conf"],
                "letter": word[0].upper() if word else "#",
            }
            entries.append(current)
            continue

        if current is None:
            continue
        if re.fullmatch(r"[•+\-.\s\d]+", text):
            continue
        current["definitionLines"].append(text)

    for entry in entries:
        entry["definitionLines"] = tidy_definition_lines(entry["definitionLines"])
        entry["definition"] = " ".join(entry["definitionLines"]).strip()

    return entries


def tidy_definition_lines(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    for line in lines:
        line = normalize_definition_line(line)
        if not line:
            continue
        if re.fullmatch(r"[•+\-.\s\d]+", line):
            continue
        cleaned.append(line)
    return cleaned


def dedupe_entries(entries: list[dict]) -> list[dict]:
    seen: dict[tuple[str, int], dict] = {}
    result: list[dict] = []
    for entry in clean_entries(entries):
        word_key = re.sub(r"\s+", " ", entry["word"].lower()).strip()
        key = (word_key, entry["printedPage"])
        if key in seen:
            existing = seen[key]
            for line in entry["definitionLines"]:
                if line not in existing["definitionLines"]:
                    existing["definitionLines"].append(line)
            existing["definition"] = " ".join(existing["definitionLines"]).strip()
            continue
        if not entry["definition"]:
            continue
        seen[key] = entry
        result.append(entry)

    add_manual_entries(result, seen)

    for index, entry in enumerate(result, start=1):
        entry["id"] = f"vocab-{index:05d}"
    return result


def clean_entries(entries: list[dict]) -> list[dict]:
    cleaned_entries: list[dict] = []
    for entry in entries:
        word_key = re.sub(r"\s+", " ", entry["word"].lower()).strip()
        corrected_word = ENTRY_CORRECTIONS.get((word_key, entry["pdfPage"]))
        if corrected_word is None:
            corrected_word = WORD_CORRECTIONS.get(word_key)

        if corrected_word:
            entry = {**entry, "word": corrected_word}
            entry["letter"] = corrected_word[0].upper() if corrected_word else "#"
            word_key = re.sub(r"\s+", " ", corrected_word.lower()).strip()

        if (word_key, entry["pdfPage"]) in DROP_ENTRY_KEYS:
            continue
        if word_key in DROP_HEADWORDS:
            continue
        if looks_like_ocr_fragment(word_key):
            continue
        definition_override = DEFINITION_OVERRIDES.get((word_key, entry["pdfPage"]))
        if definition_override:
            entry = {**entry, "definitionLines": definition_override}
            entry["definition"] = " ".join(definition_override)
        cleaned_entries.append(entry)
    return cleaned_entries


def add_manual_entries(result: list[dict], seen: dict[tuple[str, int], dict]) -> None:
    for manual in MANUAL_ENTRIES:
        word = manual["word"]
        word_key = re.sub(r"\s+", " ", word.lower()).strip()
        key = (word_key, manual["printedPage"])
        if key in seen:
            continue
        entry = {
            "id": "",
            "word": word,
            "definitionLines": manual["definitionLines"],
            "definition": " ".join(manual["definitionLines"]),
            "source": "附录一 词汇表",
            "pdfPage": manual["pdfPage"],
            "printedPage": manual["printedPage"],
            "column": manual["column"],
            "ocrConfidence": None,
            "letter": word[0].upper(),
            "manualCorrection": True,
        }
        seen[key] = entry
        result.append(entry)


def looks_like_ocr_fragment(word: str) -> bool:
    if len(word.split()) >= 3:
        return True
    if re.search(r"\b(?:vt|ut|ne|te|suey|hbc|peub|aeb|kare|bia)\b", word):
        return True
    if re.fullmatch(r"[a-z]{2,4}", word) and word in {"aaa", "eae", "kur"}:
        return True
    return False


def summarize(entries: list[dict]) -> dict:
    counts_by_letter: dict[str, int] = defaultdict(int)
    for entry in entries:
        counts_by_letter[entry["letter"]] += 1
    return {
        "sourcePdf": PDF.name,
        "appendix": "附录一 词汇表",
        "pdfPages": [VOCAB_PDF_START, VOCAB_PDF_END],
        "printedPages": [VOCAB_PDF_START - PDF_PAGE_OFFSET, VOCAB_PDF_END - PDF_PAGE_OFFSET],
        "entryCount": len(entries),
        "countsByLetter": dict(sorted(counts_by_letter.items())),
        "notes": [
            "词库由 PDF 页面 OCR 自动提取，保留页码用于人工核对。",
            "大纲 PDF 的内嵌文字编码不可直接使用，因此未采用 pdftotext 结果。",
        ],
    }


def main() -> None:
    if not PDF.exists():
        raise FileNotFoundError(PDF)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    lines = extract_lines()
    entries = dedupe_entries(parse_entries(lines))
    payload = {"meta": summarize(entries), "entries": entries}
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
