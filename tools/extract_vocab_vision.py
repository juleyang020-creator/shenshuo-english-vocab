#!/usr/bin/env python3
"""Re-OCR the syllabus vocabulary appendix with Apple Vision.

Why a rewrite? The original tesseract pipeline left many systematic errors
(e.g. "vt. k. 下定义", page-number residue like "了 7。 震动,颤动"). Apple Vision's
text recognizer handles mixed CJK+English dictionary layout much more cleanly,
gives bounding boxes for column separation, and exposes per-line confidence.

The output schema matches the existing vocab.json:
  meta: { sourcePdf, appendix, pdfPages, printedPages, entryCount, countsByLetter, notes }
  entries: [{ id, word, definitionLines, definition, source, pdfPage,
              printedPage, column, ocrConfidence, letter }, ...]

Run:
  python3 tools/extract_vocab_vision.py
"""
from __future__ import annotations

import difflib
import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

import fitz  # PyMuPDF
import Quartz
import Vision
from Foundation import NSURL

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "同等学力人员申请硕士学位英语水平全国统一考试大纲（第六版）.pdf"
OUT_PATH = ROOT / "vocab-study-app" / "public" / "data" / "vocab.json"
REFERENCE_PATH = ROOT / "vocab-study-app" / "public" / "data" / "vocab.tesseract-backup.json"
TMP_DIR = ROOT / "tmp" / "ocr_vision"
TMP_DIR.mkdir(parents=True, exist_ok=True)


SYSTEM_DICT = Path("/usr/share/dict/words")


def load_system_dict() -> set[str]:
    """English words from /usr/share/dict/words, normalised to lowercase. We
    keep capitalised entries too (Saturday, Wednesday, Pluto, …) so days,
    months, and well-known proper nouns don't get fuzzy-matched away."""
    if not SYSTEM_DICT.exists():
        return set()
    out: set[str] = set()
    for line in SYSTEM_DICT.read_text().splitlines():
        line = line.strip()
        if line and line.isalpha():
            out.add(line.lower())
    return out


def load_vocab_reference() -> set[str]:
    """Headwords from the previous tesseract pass — tesseract's English layer
    was actually decent, so it's a curated list of words that ARE in the
    syllabus (no proper-noun noise from /usr/share/dict)."""
    if not REFERENCE_PATH.exists():
        return set()
    try:
        data = json.loads(REFERENCE_PATH.read_text())
    except Exception:
        return set()
    return {entry["word"].lower().strip() for entry in data.get("entries", []) if entry.get("word")}


def fuzzy_match_word(
    word: str,
    vocab_reference: set[str],
    system_dict: set[str],
) -> str | None:
    """Return a candidate correction for `word`, or None if it should be kept.

    Strategy:
    - If `word` is already in the curated vocab reference → no change.
    - If `word` is a valid English word per the system dict (real English,
      just not in our prior vocab) → leave alone. Protects "bear" / "cash" /
      "saturday" / "biomedical" that were missing from the tesseract pass.
    - Otherwise → fuzzy match against vocab reference (cutoff 0.75), but
      reject matches whose length differs by more than 25 % from `word`,
      since that signals a wholesale word change rather than an OCR slip
      ("biomedical" → "medical" would have failed this gate).
    """
    if not vocab_reference or not word:
        return None
    lower = word.lower()
    if lower in vocab_reference:
        return None
    if lower in system_dict:
        return None
    candidates = difflib.get_close_matches(lower, vocab_reference, n=3, cutoff=0.75)
    length_budget = max(1, int(len(lower) * 0.25))
    for candidate in candidates:
        if abs(len(candidate) - len(lower)) <= length_budget:
            return candidate
    return None

PDF_PAGE_OFFSET = 4  # printedPage = pdfPage - 4
VOCAB_PDF_START = 92
VOCAB_PDF_END = 286
RENDER_ZOOM = 3.0  # ~216 DPI
COLUMN_SPLIT_X = 0.45  # below = left, above = right

# Detects an English headword line — letters with optional /-'.() and digits.
HEADWORD_RE = re.compile(r"^[A-Za-z][A-Za-z0-9 /\-'.()]*$")

# Common POS tokens used to recognise definition start lines.
POS_TOKENS = (
    "n", "v", "vt", "vi", "a", "ad", "adv", "adj", "prep", "conj",
    "pron", "num", "int", "art", "aux", "pl",
)
POS_LINE_RE = re.compile(
    rf"^(?:{'|'.join(POS_TOKENS)})[\.\s]",
    re.IGNORECASE,
)


def render_page(doc: fitz.Document, page_index: int, zoom: float = RENDER_ZOOM) -> Path:
    """Render a PDF page to PNG and return its path."""
    page = doc.load_page(page_index)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    out = TMP_DIR / f"page_{page_index + 1:03d}.png"
    pix.save(out.as_posix())
    return out


def ocr_image(image_path: Path) -> list[dict]:
    """OCR a PNG via Apple Vision; return list of {text, x, y, w, h, confidence}."""
    url = NSURL.fileURLWithPath_(image_path.as_posix())
    source = Quartz.CGImageSourceCreateWithURL(url, None)
    cg_image = Quartz.CGImageSourceCreateImageAtIndex(source, 0, None)

    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLanguages_(["zh-Hans", "en-US"])
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(False)

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    ok, err = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(f"Vision OCR failed: {err}")

    out = []
    for obs in request.results():
        candidate = obs.topCandidates_(1)[0]
        bbox = obs.boundingBox()
        out.append({
            "text": candidate.string(),
            "confidence": float(candidate.confidence()),
            "x": float(bbox.origin.x),
            "y": float(bbox.origin.y),
            "w": float(bbox.size.width),
            "h": float(bbox.size.height),
        })
    return out


def is_headword_text(text: str) -> bool:
    """Return True if `text` looks like an English headword (no CJK)."""
    if not text:
        return False
    if any("㐀" <= c <= "鿿" for c in text):
        return False
    if POS_LINE_RE.match(text):
        return False
    return bool(HEADWORD_RE.match(text))


def normalize_headword(text: str) -> str:
    """Lowercase, collapse whitespace, drop trailing punctuation, and undo
    the most common Vision digit/letter confusions inside English words."""
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = text.strip("()[]{}.,;:'`\"")
    text = text.lower()
    # Common Vision digit↔letter confusions inside ASCII words: 0/o, 1/l.
    if any(c.isalpha() for c in text):
        text = re.sub(r"(?<=[a-z])0(?=[a-z])", "o", text)
        text = re.sub(r"(?<=[a-z])1(?=[a-z])", "l", text)
    return text


# Common POS-letter confusions from Vision OCR.
# Apple Vision sometimes reads `n.` as `7.` / `72.` / `1.` / `2.` because the
# stroke of a thin lowercase n looks like a digit. We normalise only when the
# digit-period appears at the start of a line, since `1.` / `2.` could legit
# appear inside a multi-sense definition.
POS_FIXUPS = [
    # Digit-period at line start (Vision reads `n.` as 1/2/7/72 sometimes)
    (re.compile(r"^[0-9]{1,3}[.．\s]+(?=[㐀-鿿(（/])"), "n. "),
    (re.compile(r"\bwt\.", re.IGNORECASE), "vt."),
    (re.compile(r"\bwi\.", re.IGNORECASE), "vi."),
    (re.compile(r"\but\.", re.IGNORECASE), "vt."),
    (re.compile(r"\bul\.", re.IGNORECASE), "vt."),
    # /wi before whitespace+CJK is "/vi"
    (re.compile(r"(?<=[/／])wi(?=\s|$)"), "vi"),
    (re.compile(r"(?<=[/／])wt(?=\s|$)"), "vt"),
    (re.compile(r"\bw\.(?=\s+[㐀-鿿(（])"), "v."),
    (re.compile(r"^Q\.(?=\s*[㐀-鿿])"), "a."),
    (re.compile(r"^q\.(?=\s*[㐀-鿿])"), "a."),
    # Normalize fullwidth period after Latin letters
    (re.compile(r"([A-Za-z])．"), r"\1."),
    # Capitalised POS markers at line start ("Pron." / "Vt." etc.)
    (re.compile(r"^(Vt|Vi|V|N|A|Ad|Adv|Adj|Prep|Conj|Pron|Num|Int|Aux|Art|Pl)\."), lambda m: m.group(1).lower() + "."),
    # Vision uses "⋯⋯" ellipsis; normalize to "……" (Chinese)
    (re.compile(r"⋯⋯"), "……"),
    (re.compile(r"⋯"), "…"),
    # Strip page-number footers that bled into entries
    (re.compile(r"[•·]\s*\d{1,4}\s*[•·]"), ""),
    # Drop leading OCR noise like "了 7。" / "了 152，" that sometimes prefixes a definition
    (re.compile(r"^了\s+\d{1,4}\s*[，。.,]?\s*"), ""),
    # Collapse runs of whitespace
    (re.compile(r"\s+"), " "),
]


def clean_line(text: str) -> str:
    text = text.strip()
    for pattern, repl in POS_FIXUPS:
        text = pattern.sub(repl, text)
    return text.strip()


def split_columns(observations: list[dict]) -> tuple[list[dict], list[dict]]:
    left = [o for o in observations if o["x"] < COLUMN_SPLIT_X]
    right = [o for o in observations if o["x"] >= COLUMN_SPLIT_X]
    # Sort by Y descending (Vision Y is bottom-up; top of page = high Y),
    # then by X ascending so same-line fragments come back left-to-right.
    left.sort(key=lambda o: (-o["y"], o["x"]))
    right.sort(key=lambda o: (-o["y"], o["x"]))
    return left, right


def merge_same_line(observations: list[dict], y_tolerance: float = 0.008) -> list[dict]:
    """Merge fragments Vision split mid-line back into single visual lines.

    Vision sometimes returns "vt." and the surrounding translation as two boxes
    at the same Y. Without this merge they would be parsed as two separate
    definition lines (and even land in the wrong order if Y ties).
    """
    if not observations:
        return []
    groups: list[list[dict]] = [[observations[0]]]
    for obs in observations[1:]:
        anchor_y = groups[-1][0]["y"]
        if abs(obs["y"] - anchor_y) < y_tolerance:
            groups[-1].append(obs)
        else:
            groups.append([obs])
    merged: list[dict] = []
    for group in groups:
        group.sort(key=lambda o: o["x"])
        text = " ".join(item["text"].strip() for item in group if item["text"].strip())
        if not text:
            continue
        merged.append({
            "text": text,
            "x": min(item["x"] for item in group),
            "y": group[0]["y"],
            "h": group[0]["h"],
            "confidence": sum(item["confidence"] for item in group) / len(group),
        })
    return merged


def parse_column(observations: list[dict], pdf_page: int, column: str) -> list[dict]:
    """Walk a single column's lines top-down and group into entries.

    A headword starts a new entry. All subsequent lines (more indented) are
    appended to that entry's definitionLines until the next headword.
    """
    if not observations:
        return []

    # Determine headword indent: take the smallest x present in this column,
    # then anything within ~1% of that x is a headword candidate.
    min_x = min(o["x"] for o in observations)
    headword_x_max = min_x + 0.012

    entries = []
    current = None

    for obs in observations:
        text = obs["text"].strip()
        if not text:
            continue
        is_at_headword_indent = obs["x"] <= headword_x_max
        if is_at_headword_indent and is_headword_text(text):
            if current and current["definitionLines"]:
                entries.append(current)
            current = {
                "word": normalize_headword(text),
                "raw_word": text,
                "definitionLines": [],
                "confidences": [],
                "pdfPage": pdf_page,
                "column": column,
            }
        else:
            if current is None:
                # Definition line before any headword on this column —
                # likely a continuation that wrapped from the previous page.
                continue
            cleaned = clean_line(text)
            if cleaned:
                current["definitionLines"].append(cleaned)
                current["confidences"].append(obs["confidence"])

    if current and current["definitionLines"]:
        entries.append(current)

    return entries


def looks_like_continuation(text: str) -> bool:
    """A line that doesn't start with a POS marker is a continuation of the prior."""
    if not text:
        return False
    if POS_LINE_RE.match(text):
        return False
    # Lines starting with a Chinese character or an opening paren are continuations.
    first = text.lstrip()[:1]
    if not first:
        return False
    return "㐀" <= first <= "鿿" or first in "（(《《"


def merge_continuations(entries: list[dict]) -> None:
    """Some definitions wrap to a second indented line; merge them onto the prior POS line."""
    for entry in entries:
        merged = []
        for line in entry["definitionLines"]:
            if merged and looks_like_continuation(line):
                merged[-1] = (merged[-1] + " " + line).strip()
            else:
                merged.append(line)
        entry["definitionLines"] = merged


def main() -> int:
    if not PDF_PATH.exists():
        print(f"PDF not found: {PDF_PATH}", file=sys.stderr)
        return 1

    doc = fitz.open(PDF_PATH.as_posix())
    vocab_reference = load_vocab_reference()
    system_dict = load_system_dict()
    print(f"loaded {len(vocab_reference):,} reference vocab words + {len(system_dict):,} dict words")
    all_entries: list[dict] = []
    seen_words: set[str] = set()
    spell_fixes = 0
    start = time.time()

    for pdf_page in range(VOCAB_PDF_START, VOCAB_PDF_END + 1):
        page_index = pdf_page - 1
        image_path = render_page(doc, page_index)
        observations = ocr_image(image_path)
        left, right = split_columns(observations)
        page_entries: list[dict] = []
        for column_obs, column in ((left, "left"), (right, "right")):
            page_entries.extend(parse_column(merge_same_line(column_obs), pdf_page, column))
        merge_continuations(page_entries)

        # Annotate with printed page + filter duplicates while preserving order.
        for entry in page_entries:
            entry["printedPage"] = pdf_page - PDF_PAGE_OFFSET
            entry["source"] = "附录一 词汇表"
            confidences = entry.pop("confidences", [])
            entry["ocrConfidence"] = (
                round(sum(confidences) / len(confidences) * 100, 1) if confidences else None
            )
            word = entry["word"]
            if not word:
                continue
            corrected = fuzzy_match_word(word, vocab_reference, system_dict)
            if corrected and corrected != word:
                entry["originalWord"] = word
                word = corrected
                entry["word"] = word
                spell_fixes += 1
            if word in seen_words:
                continue
            seen_words.add(word)
            all_entries.append(entry)

        elapsed = time.time() - start
        if (pdf_page - VOCAB_PDF_START + 1) % 10 == 0 or pdf_page == VOCAB_PDF_END:
            done = pdf_page - VOCAB_PDF_START + 1
            total = VOCAB_PDF_END - VOCAB_PDF_START + 1
            print(
                f"page {pdf_page}/{VOCAB_PDF_END} "
                f"({done}/{total} done) "
                f"entries={len(all_entries)} "
                f"elapsed={elapsed:.1f}s",
                flush=True,
            )

    # Assign ids and letter buckets
    counts_by_letter: dict[str, int] = defaultdict(int)
    for index, entry in enumerate(all_entries, start=1):
        entry["id"] = f"vocab-{index:05d}"
        first_letter = entry["word"][:1].upper()
        entry["letter"] = first_letter
        counts_by_letter[first_letter] += 1
        # Re-emit a flat `definition` for convenience.
        entry["definition"] = " ".join(entry["definitionLines"]).strip()
        entry.pop("raw_word", None)

    payload = {
        "meta": {
            "sourcePdf": PDF_PATH.name,
            "appendix": "附录一 词汇表",
            "pdfPages": [VOCAB_PDF_START, VOCAB_PDF_END],
            "printedPages": [VOCAB_PDF_START - PDF_PAGE_OFFSET, VOCAB_PDF_END - PDF_PAGE_OFFSET],
            "entryCount": len(all_entries),
            "countsByLetter": dict(sorted(counts_by_letter.items())),
            "ocrEngine": "Apple Vision",
            "notes": [
                "Re-OCR'd via Apple Vision (zh-Hans + en-US, accurate, no auto-correct).",
                "Headword detected by low x-indent + ASCII-only check; definitions follow each headword until the next.",
                "Continuation lines are merged onto the preceding POS-tagged line.",
            ],
        },
        "entries": all_entries,
    }

    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(
        f"\nwrote {OUT_PATH} ({len(all_entries)} entries, "
        f"{spell_fixes} headword spell-fixes, "
        f"{time.time() - start:.1f}s total)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
