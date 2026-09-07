// Letter-by-letter diff for spelling feedback.
// Returns a list of cells describing each position in the expected word, plus any
// extra letters typed beyond the expected length.
//   kind === 'ok'      -> correct letter typed
//   kind === 'wrong'   -> wrong letter typed at this position
//   kind === 'missing' -> letter expected but not typed
//   kind === 'extra'   -> typed beyond the end of the expected word

// Normalise typography, not the answer itself. Spaces and hyphens belong to a
// phrase/headword; deleting every non-letter used to accept "bo0ok" as "book".
// Plurals and other inflections are accepted only when the headword lists them.
export function normalizeSpellingInput(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// These are the abbreviated alternations used by the syllabus headwords.
// Match a known ending rather than replacing N letters: madam/-ame and
// reflection/-xion change the length of the ending.
const ALTERNATE_ENDINGS = {
  '-ize': [['ise', 'ize']],
  '-yse': [['yze', 'yse']],
  '-tre': [['ter', 'tre']],
  '-sation': [['zation', 'sation']],
  '-ise': [['ize', 'ise']],
  '-cise': [['cize', 'cise']],
  '-bank': [['base', 'bank']],
  '-se': [['ce', 'se'], ['ze', 'se']],
  '-re': [['er', 're']],
  '-sise': [['size', 'sise']],
  '-bre': [['ber', 'bre']],
  '-ame': [['am', 'ame']],
  '-tise': [['tice', 'tise']],
  '-xion': [['ction', 'xion']],
};

function expandOptionalLetters(value) {
  const match = value.match(/\(([a-z]{1,2})\)/);
  if (!match) return [value];
  const before = value.slice(0, match.index);
  const after = value.slice(match.index + match[0].length);
  return [
    ...expandOptionalLetters(before + after),
    ...expandOptionalLetters(before + match[1] + after),
  ];
}

export function getSpellingVariants(headword) {
  const [first = '', ...alternates] = String(headword || '').split('/').map(normalizeSpellingInput);
  const primary = expandOptionalLetters(first);
  const variants = new Set(primary.filter(Boolean));
  for (const alternate of alternates) {
    if (!alternate.startsWith('-')) {
      for (const form of expandOptionalLetters(alternate)) if (form) variants.add(form);
      continue;
    }
    for (const base of primary) {
      const ending = ALTERNATE_ENDINGS[alternate]?.find(([from]) => base.endsWith(from));
      if (ending) variants.add(base.slice(0, -ending[0].length) + ending[1]);
    }
  }
  return [...variants];
}

function editDistance(expected, actual) {
  const row = Array.from({ length: expected.length + 1 }, (_, index) => index);
  for (let i = 0; i < actual.length; i += 1) {
    let diagonal = row[0];
    row[0] = i + 1;
    for (let j = 1; j <= expected.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (expected[j - 1] === actual[i] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[expected.length];
}

export function diffSpelling(expectedRaw, actualRaw) {
  const actual = normalizeSpellingInput(actualRaw);
  const variants = getSpellingVariants(expectedRaw);
  let expected = variants[0] || '';
  let distance = editDistance(expected, actual);
  for (const variant of variants.slice(1)) {
    const candidateDistance = editDistance(variant, actual);
    if (candidateDistance < distance) {
      expected = variant;
      distance = candidateDistance;
    }
  }
  const letters = [];
  const maxLen = Math.max(expected.length, actual.length);
  for (let index = 0; index < maxLen; index += 1) {
    const exp = expected[index];
    const act = actual[index];
    if (exp && act && exp === act) {
      letters.push({ kind: 'ok', expected: exp, actual: act });
    } else if (exp && act) {
      letters.push({ kind: 'wrong', expected: exp, actual: act });
    } else if (exp) {
      letters.push({ kind: 'missing', expected: exp });
    } else {
      letters.push({ kind: 'extra', actual: act });
    }
  }
  return {
    letters,
    correct: expected.length > 0 && expected === actual,
    expected,
    actual,
  };
}
