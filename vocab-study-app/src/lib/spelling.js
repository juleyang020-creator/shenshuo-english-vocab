// Letter-by-letter diff for spelling feedback.
// Returns a list of cells describing each position in the expected word, plus any
// extra letters typed beyond the expected length.
//   kind === 'ok'      -> correct letter typed
//   kind === 'wrong'   -> wrong letter typed at this position
//   kind === 'missing' -> letter expected but not typed
//   kind === 'extra'   -> typed beyond the end of the expected word

export function normalizeSpellingInput(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

export function diffSpelling(expectedRaw, actualRaw) {
  const expected = normalizeSpellingInput(expectedRaw);
  const actual = normalizeSpellingInput(actualRaw);
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
