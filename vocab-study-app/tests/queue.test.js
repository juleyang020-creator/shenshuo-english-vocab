import test from 'node:test';
import assert from 'node:assert/strict';
import { nextQueueIndex } from '../src/lib/queue.js';

const queue = ['a', 'b', 'c'].map((id) => ({ id }));
test('新词达到掌握后删除当前词，下一词仍是紧邻词', () => {
  const remaining = queue.filter((entry) => entry.id !== 'a');
  assert.equal(remaining[nextQueueIndex(queue, 'a', true)].id, 'b');
});
test('末词移除与最后一个词完成不会产生越界游标', () => {
  assert.equal(nextQueueIndex(queue, 'c', true), 0);
  assert.equal(nextQueueIndex([{ id: 'a' }], 'a', true), 0);
  assert.equal(nextQueueIndex([], undefined), 0);
});
test('保留当前词的普通翻页和末尾循环保持顺序', () => {
  assert.equal(queue[nextQueueIndex(queue, 'a')].id, 'b');
  assert.equal(queue[nextQueueIndex(queue, 'c')].id, 'a');
});
