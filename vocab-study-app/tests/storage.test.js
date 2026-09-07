import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultStudyState, loadStudyState, parseImportedStudyState } from '../src/lib/storage.js';

test('旧版备份正常迁移，空的模块补齐计数默认值', () => {
  const result = parseImportedStudyState({ words: { apple: { score: 2, attempts: 2 } }, cloze: {}, reading: {} });
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.words.apple.repetitions, 2);
  assert.equal(result.cloze.seen, 0);
  assert.equal(result.reading.correct, 0);
  assert.deepEqual(result.reading.done, {});
});

test('拒绝损坏的单词记录与非文字笔记，给出可读错误', () => {
  for (const schemaVersion of [1, 2]) {
    assert.throws(() => parseImportedStudyState({ schemaVersion, words: { apple: null } }), /单词记录.*apple/);
    assert.throws(() => parseImportedStudyState({ schemaVersion, words: {}, notes: { apple: {} } }), /笔记.*apple/);
  }
  assert.throws(() => parseImportedStudyState({ words: { apple: { attempts: '3' } } }), /attempts/);
  assert.throws(() => parseImportedStudyState({ words: {}, daily: { '2026-09-07': null } }), /每日记录/);
});

test('读取局部损坏的旧本地记录时保留正常进度，丢弃损坏项', () => {
  const previousWindow = globalThis.window;
  try {
    globalThis.window = {
      localStorage: {
        getItem: () => JSON.stringify({
          words: { broken: null, apple: { score: 2, attempts: 2 } },
          notes: { broken: {}, apple: '保留这条笔记' },
          daily: { broken: null, '2026-09-07': { seen: 2 } },
          cloze: {},
          reading: {},
        }),
      },
    };
    const result = loadStudyState();
    assert.equal(result.words.apple.attempts, 2);
    assert.equal(result.words.broken, undefined);
    assert.equal(result.notes.apple, '保留这条笔记');
    assert.equal(result.notes.broken, undefined);
    assert.equal(result.daily['2026-09-07'].seen, 2);
    assert.equal(result.daily['2026-09-07'].known, 0);
    assert.equal(result.cloze.seen, 0);
    assert.deepEqual(result.reading.done, {});
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('当前完整备份经包装后可无损还原，拒绝不属于本应用的包装文件', () => {
  const study = defaultStudyState();
  study.notes.apple = 'test';
  assert.deepEqual(parseImportedStudyState({ app: 'shenshuo-english-vocab', kind: 'study-backup', study }), study);
  assert.throws(() => parseImportedStudyState({ app: 'another-app', kind: 'study-backup', study }), /本应用/);
});

test('导入前拒绝错误类型的学习设置和发音设置', () => {
  for (const [key, value] of [
    ['dailyTarget', {}], ['dailyTarget', '120'], ['dailyTarget', null],
    ['dailyTarget', Infinity], ['shuffleSeed', {}], ['lastSession', []], ['speech', null],
  ]) {
    assert.throws(() => parseImportedStudyState({ words: {}, settings: { [key]: value } }), new RegExp(key));
  }
  for (const [key, value] of [
    ['accent', 'fr'], ['rate', {}], ['rate', NaN], ['repeat', 1.5],
    ['repeat', 0], ['autoSpeak', 'true'], ['voiceURI', {}],
  ]) {
    assert.throws(() => parseImportedStudyState({ words: {}, settings: { speech: { [key]: value } } }), new RegExp(key));
  }
});

test('有限的历史目标保留并限制到界面允许范围', () => {
  for (const [value, expected] of [[-1, 20], [0, 20], [10, 20], [120, 120], [999, 500]]) {
    assert.equal(parseImportedStudyState({ settings: { dailyTarget: value } }).settings.dailyTarget, expected);
  }
});

test('校验会话模式、非负整数位置及范围，保留全库复习位置', () => {
  const validSession = { mode: 'review', activeScope: { kind: 'all', value: 'all' }, currentIndex: 12, currentEntryId: 'apple' };
  assert.deepEqual(parseImportedStudyState({ settings: { lastSession: validSession } }).settings.lastSession, validSession);
  for (const [key, value] of [
    ['mode', 'unknown'], ['currentIndex', -1], ['currentIndex', 1.5],
    ['currentIndex', '1'], ['currentEntryId', {}], ['activeScope', null],
    ['activeScope', { kind: 'unknown', value: 'all' }],
    ['activeScope', { kind: 'range', value: -1 }],
    ['activeScope', { kind: 'stage-chunk', value: 'gaokao:1.5' }],
  ]) {
    assert.throws(() => parseImportedStudyState({ settings: { lastSession: { ...validSession, [key]: value } } }), new RegExp(key));
  }
  for (const scope of [
    { kind: 'frequency', value: 'gaokao' }, { kind: 'stage-chunk', value: 'cet4:2' },
    { kind: 'type', value: 'noun' }, { kind: 'range', value: 2 }, { kind: 'range', value: '2' },
  ]) {
    assert.deepEqual(parseImportedStudyState({ settings: { lastSession: { ...validSession, activeScope: scope } } }).settings.lastSession.activeScope, scope);
  }
});

test('本地损坏设置按字段回退，不丢失同一设置中的正常值', () => {
  const previousWindow = globalThis.window;
  try {
    globalThis.window = { localStorage: { getItem: () => JSON.stringify({
      words: { apple: { attempts: 3 } },
      settings: {
        dailyTarget: {}, shuffleSeed: {},
        lastSession: { mode: 'reading', currentIndex: -5, currentEntryId: {}, activeScope: { kind: 'bad' } },
        speech: { accent: {}, rate: 'fast', repeat: 2, autoSpeak: true, voiceURI: 'saved-voice' },
      },
    }) } };
    const result = loadStudyState();
    assert.equal(result.words.apple.attempts, 3);
    assert.equal(result.settings.dailyTarget, 120);
    assert.equal(typeof result.settings.shuffleSeed, 'string');
    assert.equal(result.settings.lastSession.mode, 'reading');
    assert.equal(result.settings.lastSession.currentIndex, 0);
    assert.equal(result.settings.lastSession.currentEntryId, null);
    assert.deepEqual(result.settings.lastSession.activeScope, { kind: 'frequency', value: 'gaokao' });
    assert.deepEqual(result.settings.speech, { accent: 'us', rate: 0.82, repeat: 2, autoSpeak: true, voiceURI: 'saved-voice' });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
