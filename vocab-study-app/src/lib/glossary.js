import { compactDefinition } from './definition.js';
import { BASIC_WORDS_FOR_GAOKAO_76 } from '../basicWords.js';

// Very common function words that never need a gloss even if the learner
// hasn't formally "known" them. The 670-word basic set covers most of this,
// but we add a few closed-class hedges.
const ALWAYS_KNOWN = new Set([
  ...BASIC_WORDS_FOR_GAOKAO_76,
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'and', 'or', 'but',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'it', 'its', "it's", 'this', 'that', 'these', 'those', 'their', 'them', 'they',
  'he', 'she', 'we', 'you', 'i', 'his', 'her', 'our', 'your', 'my', 'me', 'us',
  'as', 'if', 'so', 'not', 'no', 'yes', 'do', 'does', 'did', 'have', 'has', 'had',
  'will', 'would', 'can', 'could', 'may', 'might', 'must', 'should', 'shall',
  'by', 'with', 'from', 'up', 'out', 'about', 'into', 'over', 'than', 'then',
  'when', 'where', 'who', 'what', 'which', 'how', 'why', 'there', 'here',
  'one', 'two', 'three', 'more', 'most', 'some', 'any', 'all', 'each', 'many',
]);

/** Short Chinese gloss for a vocab entry (trimmed for tooltip use). */
function shortGloss(entry) {
  const def = compactDefinition(entry) || entry?.definition || '';
  return String(def).replace(/\s+/g, ' ').trim().slice(0, 34);
}

/**
 * Build a lookup Map: lowercased headword -> { zh, word }.
 * Keys include the exact headword plus its de-slashed / de-parenthesised forms
 * (e.g. "a/an" also registers "a" and "an"; "alumin(i)um" -> "aluminium").
 */
export function buildGlossary(entries) {
  const map = new Map();
  for (const entry of entries || []) {
    const raw = (entry.word || '').toLowerCase().trim();
    if (!raw) continue;
    const zh = shortGloss(entry);
    if (!zh) continue;
    const forms = new Set([raw]);
    if (raw.includes('/')) raw.split('/').forEach((f) => forms.add(f.trim()));
    if (raw.includes('(')) forms.add(raw.replace(/\([^)]*\)/g, '').trim());
    for (const f of forms) {
      const key = f.replace(/[^a-z-]/g, '');
      // `id` lets callers map a looked-up token back to its vocab entry, so a
      // word met in a sentence can feed the learner's SRS state.
      if (key.length >= 2 && !map.has(key)) map.set(key, { zh, word: entry.word, id: entry.id });
    }
  }
  return map;
}

/**
 * Candidate base forms for an inflected token, tried in order. Rule-based
 * (no dictionary) — good enough to catch regular plurals/tenses/adverbs so a
 * word like "abandoned" / "studies" / "quickly" resolves to its headword.
 */
export function lemmaCandidates(lower) {
  const out = [lower];
  const add = (w) => { if (w && w.length >= 2 && !out.includes(w)) out.push(w); };
  // plural / 3rd person
  if (lower.endsWith('ies') && lower.length > 4) add(lower.slice(0, -3) + 'y');
  if (lower.endsWith('es') && lower.length > 3) { add(lower.slice(0, -2)); add(lower.slice(0, -1)); }
  if (lower.endsWith('s') && lower.length > 3) add(lower.slice(0, -1));
  // past / -ing
  if (lower.endsWith('ied') && lower.length > 4) add(lower.slice(0, -3) + 'y');
  if (lower.endsWith('ed') && lower.length > 3) { add(lower.slice(0, -2)); add(lower.slice(0, -1)); }
  if (lower.endsWith('ing') && lower.length > 4) {
    add(lower.slice(0, -3));
    add(lower.slice(0, -3) + 'e');
  }
  // doubled final consonant: "stopped" -> "stop", "running" -> "run"
  const m = lower.match(/^(.*?)([bcdfghjklmnpqrstvwxz])\2(ed|ing)$/);
  if (m) add(m[1] + m[2]);
  // adverb / comparative / superlative
  if (lower.endsWith('ly') && lower.length > 4) { add(lower.slice(0, -2)); add(lower.slice(0, -2) + 'e'); }
  if (lower.endsWith('er') && lower.length > 4) add(lower.slice(0, -2));
  if (lower.endsWith('est') && lower.length > 5) add(lower.slice(0, -3));
  return out;
}

/** Resolve a raw token to a gloss, or null. */
export function lookupGloss(rawToken, glossary) {
  if (!glossary || !rawToken) return null;
  const lower = rawToken.toLowerCase();
  for (const cand of lemmaCandidates(lower)) {
    const hit = glossary.get(cand);
    if (hit) return hit;
  }
  return null;
}

/** True for words we should never mark (basic/function words). */
export function isAlwaysKnown(rawToken) {
  const lower = String(rawToken || '').toLowerCase();
  if (ALWAYS_KNOWN.has(lower)) return true;
  // also treat the de-inflected base as basic if it is
  for (const cand of lemmaCandidates(lower)) {
    if (ALWAYS_KNOWN.has(cand)) return true;
  }
  return false;
}
