// When a mastered word leaves the queue, its successor takes the same index.
export function nextQueueIndex(queue, currentId, removeCurrent = false) {
  const index = Math.max(0, queue.findIndex((entry) => entry.id === currentId));
  const length = queue.length - (removeCurrent ? 1 : 0);
  return length > 0 ? (index + (removeCurrent ? 0 : 1)) % length : 0;
}
