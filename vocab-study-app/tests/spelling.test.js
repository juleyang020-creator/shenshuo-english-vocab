import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { diffSpelling, getSpellingVariants } from '../src/lib/spelling.js';

const vocab = JSON.parse(readFileSync(new URL('../public/data/vocab.json', import.meta.url), 'utf8'));
const headwords = new Set(vocab.entries.map((entry) => entry.word));

test('题库中的完整别名都可作答，不能把别名拼成一个单词', () => {
  for (const [headword, variants] of [
    ['a/an', ['a', 'an']],
    ['check/cheque', ['check', 'cheque']],
    ['refrigerator/fridge', ['refrigerator', 'fridge']],
    ['television/tv/t. v', ['television', 'tv', 't. v']],
  ]) {
    assert.ok(headwords.has(headword), `真实题库缺少 ${headword}`);
    for (const variant of variants) assert.equal(diffSpelling(headword, variant).correct, true, variant);
  }
  assert.equal(diffSpelling('a/an', 'aan').correct, false);
});

test('题库中的缩写词尾恢复成完整的英美拼写', () => {
  for (const [headword, alternate] of [
    ['advertise/-ize', 'advertize'],
    ['analyze/-yse', 'analyse'],
    ['centimeter/-tre', 'centimetre'],
    ['characterise/-ize', 'characterize'],
    ['civilization/-sation', 'civilisation'],
    ['criticize/-cise', 'criticise'],
    ['database/-bank', 'databank'],
    ['defence/-se', 'defense'],
    ['diameter/-re', 'diametre'],
    ['emphasize/-sise', 'emphasise'],
    ['fiber/-bre', 'fibre'],
    ['madam/-ame', 'madame'],
    ['organize/-se', 'organise'],
    ['practice/-tise', 'practise'],
    ['reflection/-xion', 'reflexion'],
  ]) {
    assert.ok(headwords.has(headword), `真实题库缺少 ${headword}`);
    assert.equal(diffSpelling(headword, headword.split('/')[0]).correct, true, headword);
    assert.equal(diffSpelling(headword, alternate).correct, true, alternate);
  }
  assert.equal(diffSpelling('reflection/-xion', 'reflecxion').correct, false);
  assert.equal(diffSpelling('madam/-ame', 'maame').correct, false);
});

test('每个真实题库的缩写词尾均有完整答案，不接受缩写后缀本身', () => {
  for (const headword of headwords) {
    if (!headword.includes('/-')) continue;
    assert.ok(getSpellingVariants(headword).length > 1, headword);
    assert.equal(diffSpelling(headword, headword.split('/')[1]).correct, false, headword);
  }
});

test('只规范大小写与排版，保留短语分词和连字符，不宽松接受复数或输入杂质', () => {
  assert.equal(diffSpelling('according to', '  According   to  ').correct, true);
  assert.equal(diffSpelling('according to', 'accordingto').correct, false);
  assert.equal(diffSpelling('t-shirt', 'T–shirt').correct, true);
  assert.equal(diffSpelling('t-shirt', 'tshirt').correct, false);
  assert.equal(diffSpelling('book', 'books').correct, false);
  assert.equal(diffSpelling('books', 'book').correct, false);
  assert.equal(diffSpelling('book', 'bo0ok').correct, false);
  assert.equal(diffSpelling('book', 'bo@ok').correct, false);
  assert.equal(diffSpelling('book', '').correct, false);
});

test('可选字母提供两个完整答案，错误反馈选择最接近的有效词形', () => {
  assert.deepEqual(getSpellingVariants('distil(l)'), ['distil', 'distill']);
  assert.equal(diffSpelling('distil(l)', 'distil').correct, true);
  assert.equal(diffSpelling('distil(l)', 'distill').correct, true);
  const feedback = diffSpelling('check/cheque', 'cheqe');
  assert.equal(feedback.correct, false);
  assert.equal(feedback.expected, 'cheque');
  assert.ok(feedback.letters.some((cell) => cell.kind !== 'ok'));
});
