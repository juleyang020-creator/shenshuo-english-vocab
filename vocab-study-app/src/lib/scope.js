export const RANGE_SIZE = 500;
// Smaller chunk for the difficulty-stage sub-divisions, sized so a learner
// at 30 new words/day can finish a chunk in roughly 10 days.
export const STAGE_CHUNK_SIZE = 300;

export function makeRanges(entries) {
  const count = Math.max(1, Math.ceil(entries.length / RANGE_SIZE));
  return Array.from({ length: count }, (_, index) => {
    const start = index * RANGE_SIZE;
    const end = Math.min(entries.length, start + RANGE_SIZE);
    return {
      index,
      start,
      end,
      label: `${start + 1}-${end} 词`,
    };
  });
}


