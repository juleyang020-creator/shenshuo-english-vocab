import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createReadingSession, moveReadingSession, prepareReadingQuestions } from './reading.js';

const items = [
  ...Array.from({ length: 8 }, (_, index) => ({ id: `g${index}`, level: 'gaokao' })),
  { id: 'c4', level: 'cet4' },
  { id: 'c6', level: 'cet6' },
];

test('完成文章后保留当前篇与队列，直到主动翻页', () => {
  const stats = { done: {}, level: 'gaokao' };
  const session = createReadingSession(items, stats, 'reading-regression');
  const originalOrder = [...session.queueIds];
  const finishedId = session.passageId;
  stats.done[finishedId] = { correct: 4 };

  assert.equal(session.passageId, finishedId);
  assert.deepEqual(session.queueIds, originalOrder);
  const next = moveReadingSession(session, 1);
  assert.equal(next.passageId, originalOrder[1]);
  assert.equal(moveReadingSession(next, -1).passageId, finishedId);
});

test('刷新时按 ID 恢复刚完成的文章，而不跳到未读首篇', () => {
  const session = createReadingSession(items, {
    level: 'gaokao',
    lastPassageId: 'g3',
    done: { g3: { correct: 4 } },
  }, 'restore');
  assert.equal(session.passageId, 'g3');
  assert.equal(session.queueIds.at(-1), 'g3');
});

test('恢复已解锁难度；已失效的难度与文章记录有可用回退', () => {
  const done = Object.fromEntries(items.slice(0, 6).map(({ id }) => [id, true]));
  const restored = createReadingSession(items, { level: 'cet4', lastPassageId: 'c4', done }, 'restore');
  assert.equal(restored.level, 'cet4');
  assert.equal(restored.passageId, 'c4');

  for (const level of ['cet6', 'unknown']) {
    const fallback = createReadingSession(items, { level, lastPassageId: 'missing', done }, 'restore');
    assert.equal(fallback.level, 'gaokao');
    assert.ok(fallback.queueIds.includes(fallback.passageId));
  }
});

test('上一篇可从首篇回到末篇；空队列不会产生无效位置', () => {
  const session = createReadingSession(items, {}, 'navigation');
  assert.equal(moveReadingSession(session, -1).passageId, session.queueIds.at(-1));
  const empty = createReadingSession([], {}, 'empty');
  assert.equal(empty.passageId, null);
  assert.equal(moveReadingSession(empty, 1), empty);
});

test('打散选项时正确答案与解析字母同步映射，不改动 AI 或 DNA 等英文词', () => {
  const passage = {
    id: 'explanation-mapping',
    questions: [{
      options: ['original-A', 'original-B', 'original-C', 'original-D'],
      answer: 1,
      explain: '答案为B；A、C、D项不符。AI 与 DNA 不是选项字母。',
    }],
  };
  const [question] = prepareReadingQuestions(passage, 'mapping');
  const letter = (original) => String.fromCharCode(65 + question.options.indexOf(`original-${original}`));
  assert.equal(question.options[question.answer], 'original-B');
  assert.equal(question.explain, `答案为${letter('B')}；${letter('A')}、${letter('C')}、${letter('D')}项不符。AI 与 DNA 不是选项字母。`);
  assert.deepEqual(prepareReadingQuestions(passage, 'mapping'), [question]);
  assert.equal(passage.questions[0].explain, '答案为B；A、C、D项不符。AI 与 DNA 不是选项字母。');
});

test('全题库打散后保留每个正确答案的实际文本与全部选项', async () => {
  const { items: passages } = JSON.parse(await readFile(new URL('../../public/data/passages.json', import.meta.url), 'utf8'));
  for (const passage of passages) {
    const prepared = prepareReadingQuestions(passage, 'full-bank-regression');
    prepared.forEach((question, index) => {
      const original = passage.questions[index];
      assert.equal(question.options[question.answer], original.options[original.answer], `${passage.id} 第 ${index + 1} 题`);
      assert.deepEqual([...question.options].sort(), [...original.options].sort());
    });
  }
});
