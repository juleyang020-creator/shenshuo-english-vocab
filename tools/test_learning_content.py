"""Regression checks for actual content-import and example-generation failures."""

import copy
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import generate_full_cloze
import merge_cloze
import merge_passages

from add_examples import deinflect, fill_blank, is_context_item
from generate_full_cloze import answer_word
from merge_cloze import valid as valid_cloze
from merge_passages import valid as valid_passage


def cloze_item():
    return {
        "sentence": "They ___ the plan yesterday.",
        "answer": "revised",
        "translation": "他们昨天修改了计划。",
        "explain": "yesterday 提示过去时。",
        "level": "cet4",
        "options": [
            {"word": word, "zh": "词义", "correct": index == 0}
            for index, word in enumerate(["revised", "revise", "revising", "revision"])
        ],
    }


def passage_item(title="A learner's routine", seq=0):
    question = {
        "q": "Which word is used?", "options": ["one", "two", "three", "four"],
        "answer": 0, "explain": "根据原文。",
    }
    return {
        "title": title, "seq": seq, "level": "cet4",
        "passage": "A learner reads a short paragraph carefully. " * 20,
        "translation": "学习者仔细阅读短文。",
        "questions": [copy.deepcopy(question) for _ in range(3)],
    }


class ContentImportTests(unittest.TestCase):
    def test_cloze_rejects_multiple_answers_and_wrong_answer_text(self):
        item = cloze_item()
        self.assertIsNotNone(valid_cloze(item))
        item["options"][1]["correct"] = True
        self.assertIsNone(valid_cloze(item))
        item = cloze_item()
        item["answer"] = "revise"
        self.assertIsNone(valid_cloze(item))

    def test_cloze_rejects_truthy_strings_and_duplicate_options(self):
        item = cloze_item()
        item["options"][1]["correct"] = "false"
        self.assertIsNone(valid_cloze(item))
        item = cloze_item()
        item["options"][1]["word"] = " revised "
        self.assertIsNone(valid_cloze(item))

    def test_cloze_normalizes_answer_and_correct_option_together(self):
        item = cloze_item()
        item["answer"] = item["options"][0]["word"] = " revised "
        result = valid_cloze(item)
        self.assertIsNotNone(result)
        self.assertEqual(result["answer"], "revised")
        self.assertEqual(result["answer"], result["options"][0]["word"])

    def test_detached_suffix_never_enters_new_cloze_bank(self):
        item = cloze_item()
        item["sentence"] = "A good plan ___ s to succeed."
        self.assertIsNone(valid_cloze(item))

    def test_definition_templates_are_not_examples(self):
        item = cloze_item()
        self.assertTrue(is_context_item(item))
        item["source"] = "auto-vocab-coverage"
        self.assertFalse(is_context_item(item))
        item.pop("source")
        item["sentence"] = "The word ___ means ‘修改’."
        self.assertFalse(is_context_item(item))

    def test_fill_requires_one_blank_and_handles_case(self):
        self.assertEqual(fill_blank("___ s fly at night.", "bat"), "Bats fly at night.")
        self.assertEqual(fill_blank("They ___ it.", "praised"), "They praised it.")
        with self.assertRaises(ValueError):
            fill_blank("No blank.", "word")
        with self.assertRaises(ValueError):
            fill_blank("___ and ___", "word")

    def test_deinflection_does_not_teach_stare_as_star(self):
        self.assertEqual(deinflect("stared")[0], "stare")
        self.assertEqual(deinflect("hopes")[0], "hope")
        self.assertEqual(deinflect("owed")[0], "owe")
        self.assertEqual(deinflect("chose"), ["choose"])

    def test_legitimate_headwords_are_not_rewritten_by_ocr_workarounds(self):
        for word in ["sum", "tub", "unit", "postcode", "fag"]:
            self.assertEqual(answer_word({"word": word}), word)

    def test_reading_rejects_missing_explanations_and_boolean_answers(self):
        question = {"q": "Which word is used?", "options": ["one", "two", "three", "four"], "answer": 0, "explain": "根据原文。"}
        passage = {"passage": "A learner reads a short paragraph carefully. " * 20, "translation": "学习者仔细阅读短文。", "questions": [copy.deepcopy(question) for _ in range(3)]}
        self.assertEqual(valid_passage(passage)["sourceType"], "generated-practice")
        passage["questions"][0]["answer"] = True
        self.assertIsNone(valid_passage(passage))
        passage["questions"][0]["answer"] = 0
        passage["questions"][1]["explain"] = ""
        self.assertIsNone(valid_passage(passage))

    def test_reading_rejects_nontext_required_fields(self):
        for bad in [None, 42, {}, [], True]:
            for field in ["translation", "q", "explain", "option"]:
                with self.subTest(value=bad, field=field):
                    item = passage_item()
                    if field == "translation":
                        item[field] = bad
                    elif field == "option":
                        item["questions"][0]["options"][0] = bad
                    else:
                        item["questions"][0][field] = bad
                    self.assertIsNone(valid_passage(item))


class RegenerationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.parts = self.root / "parts"
        self.parts.mkdir()
        self.reading_path = self.root / "passages.json"
        self.vocab_path = self.root / "vocab.json"
        self.cloze_path = self.root / "cloze.json"

    def write_json(self, path, payload):
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    def merge_readings(self):
        with patch.object(merge_passages, "OUT", self.reading_path), patch.object(
            merge_passages, "PARTS", self.parts
        ), contextlib.redirect_stdout(io.StringIO()):
            merge_passages.main()
        return json.loads(self.reading_path.read_text(encoding="utf-8"))

    def test_reading_regeneration_keeps_reviewed_text_and_id(self):
        raw = passage_item()
        reviewed = valid_passage(raw)
        reviewed.update(id="read-0042", reviewStatus="reviewed", translation="已校正的翻译。")
        reviewed["passage"] = reviewed["passage"].replace("carefully", "attentively")
        self.write_json(self.reading_path, {"meta": {}, "items": [reviewed]})
        self.write_json(self.parts / "part-001.json", {"items": [raw]})
        result = self.merge_readings()
        self.assertEqual(len(result["items"]), 1)
        for key, value in reviewed.items():
            self.assertEqual(result["items"][0][key], value)
        self.assertTrue(result["items"][0].get("sourceKey"))

    def test_reading_reorder_and_new_items_preserve_existing_progress_keys(self):
        first, second = passage_item("First", 10), passage_item("Second", 20)
        self.write_json(self.parts / "part-001.json", {"items": [first, second]})
        initial = self.merge_readings()
        old_ids = {item["title"]: item["id"] for item in initial["items"]}
        self.write_json(self.parts / "part-001.json", {"items": [passage_item("Third", 30), second, first]})
        result = self.merge_readings()
        ids = {item["title"]: item["id"] for item in result["items"]}
        self.assertEqual({title: ids[title] for title in old_ids}, old_ids)
        self.assertEqual(len(set(ids.values())), 3)
        self.write_json(self.parts / "part-001.json", {"items": [second]})
        self.assertEqual(len(self.merge_readings()["items"]), 3)

    def test_missing_or_malformed_reading_parts_never_overwrite_output(self):
        self.write_json(self.reading_path, {"meta": {}, "items": [{"id": "read-0001"}]})
        original = self.reading_path.read_bytes()
        for source in [None, "{invalid", '{"items": []}', '{"items": [{"translation": null}]}']:
            with self.subTest(source=source):
                if source is not None:
                    (self.parts / "part-001.json").write_text(source, encoding="utf-8")
                with self.assertRaises((OSError, ValueError)):
                    self.merge_readings()
                self.assertEqual(self.reading_path.read_bytes(), original)

    def test_reading_output_survives_failed_atomic_replacement(self):
        self.reading_path.write_text("original content", encoding="utf-8")
        with patch.object(Path, "replace", side_effect=OSError("replacement failed")):
            with self.assertRaises(OSError):
                merge_passages.write_payload(self.reading_path, {"items": []})
        self.assertEqual(self.reading_path.read_text(encoding="utf-8"), "original content")
        self.assertEqual(list(self.root.glob(".passages.json.*")), [])

    def generate_cloze(self, entries):
        self.write_json(self.vocab_path, {"entries": entries})
        with patch.object(generate_full_cloze, "VOCAB_PATH", self.vocab_path), patch.object(
            generate_full_cloze, "CLOZE_PATH", self.cloze_path
        ), patch.object(generate_full_cloze, "load_wordlist_definitions", return_value={}), contextlib.redirect_stdout(io.StringIO()):
            generate_full_cloze.main()
        return json.loads(self.cloze_path.read_text(encoding="utf-8"))

    def vocab_entries(self):
        return [
            {"id": f"vocab-{word}", "word": word, "definition": definition, "difficultyStage": "cet4"}
            for word, definition in [("apple", "n. 苹果"), ("book", "n. 书"), ("chair", "n. 椅子"), ("desk", "n. 桌子")]
        ]

    def test_generated_cloze_reuses_target_ids_and_keeps_editorial_corrections(self):
        self.write_json(self.cloze_path, {"items": []})
        entries = self.vocab_entries()
        initial = self.generate_cloze(entries)
        initial["items"][0].update(id="cloze-0020", reviewStatus="reviewed", explain="已经校正的解析。")
        initial["items"][1]["id"] = "cloze-0021"
        initial["items"][2]["id"] = "cloze-0022"
        initial["items"][3]["id"] = "cloze-0023"
        self.write_json(self.cloze_path, initial)
        result = self.generate_cloze(list(reversed(entries)))
        by_target = {item["targetId"]: item for item in result["items"]}
        for item in initial["items"]:
            self.assertEqual(by_target[item["targetId"]]["id"], item["id"])
        self.assertEqual(by_target[initial["items"][0]["targetId"]], initial["items"][0])

    def test_new_cloze_ids_do_not_reuse_a_removed_item_id(self):
        entries = self.vocab_entries()
        self.write_json(self.cloze_path, {"items": [], "meta": {"nextItemNumber": 90}})
        initial = self.generate_cloze(entries)
        highest = max(int(item["id"].split("-")[1]) for item in initial["items"])
        retired_target = initial["items"][-1]["targetId"]
        remaining = [entry for entry in entries if entry["id"] != retired_target]
        # Keep enough candidates for each four-choice question after removal.
        remaining.append({"id": "vocab-egg", "word": "egg", "definition": "n. 鸡蛋", "difficultyStage": "cet4"})
        after = self.generate_cloze(remaining)
        egg = next(item for item in after["items"] if item["targetId"] == "vocab-egg")
        self.assertGreaterEqual(min(int(item["id"].split("-")[1]) for item in initial["items"]), 90)
        self.assertGreater(int(egg["id"].split("-")[1]), highest)

    def test_cloze_import_respects_id_high_water_mark(self):
        old = cloze_item()
        old.update(id="cloze-0020", reviewStatus="reviewed", answer="wrote", sentence="She ___ a letter.")
        old["options"] = [
            {"word": word, "zh": "词义", "correct": index == 0}
            for index, word in enumerate(["wrote", "write", "written", "writing"])
        ]
        self.write_json(self.cloze_path, {"meta": {"nextItemNumber": 90}, "items": [old]})
        source = self.root / "new-cloze.json"
        self.write_json(source, {"items": [cloze_item()]})
        with patch.object(merge_cloze, "CLOZE", self.cloze_path), patch.object(
            merge_cloze.sys, "argv", ["merge_cloze.py", str(source)]
        ), contextlib.redirect_stdout(io.StringIO()):
            merge_cloze.main()
        result = json.loads(self.cloze_path.read_text(encoding="utf-8"))
        self.assertEqual(result["items"][0], old)
        self.assertEqual(result["items"][1]["id"], "cloze-0090")
        self.assertEqual(result["meta"]["nextItemNumber"], 91)

    def test_invalid_vocab_ids_stop_generation_without_changing_output(self):
        entries = self.vocab_entries()
        entries.append({"id": "vocab-egg", "word": "egg", "definition": "n. 鸡蛋", "difficultyStage": "cet4"})
        self.write_json(self.cloze_path, {"items": []})
        self.generate_cloze(entries)
        original = self.cloze_path.read_bytes()
        for bad_id in [None, "", "   ", entries[0]["id"]]:
            with self.subTest(id=bad_id):
                self.cloze_path.write_bytes(original)
                invalid = copy.deepcopy(entries)
                invalid[1]["id"] = bad_id
                with self.assertRaises(ValueError):
                    self.generate_cloze(invalid)
                self.assertEqual(self.cloze_path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
