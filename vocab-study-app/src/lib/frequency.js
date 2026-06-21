import { compactDefinition } from './definition.js';

// Difficulty stages derived from real exam wordlists (gaokao 3500 / CET-4 /
// CET-6 / COCA top-20k). Each vocab entry carries `difficultyStage` set by
// tools/tag_vocab_by_exam.py; this module just surfaces the metadata and
// supplies a heuristic fallback for entries that pre-date tagging.
export const DIFFICULTY_STAGES = [
  {
    id: 'gaokao',
    label: '高考基础',
    detail: '高中 3500 词，先把基础牢牢掌握',
  },
  {
    id: 'cet4',
    label: '四级核心',
    detail: '大学英语四级新增词',
  },
  {
    id: 'cet6',
    label: '六级提升',
    detail: '六级新增词，难度更上一层',
  },
  {
    id: 'master',
    label: '申硕进阶',
    detail: '六级之外的申硕大纲常见词',
  },
  {
    id: 'advanced',
    label: '拔高识记',
    detail: '低频/专业词，看脸熟即可',
  },
];

// Back-compat: some call sites still import FREQUENCY_BUCKETS.
export const FREQUENCY_BUCKETS = DIFFICULTY_STAGES;

export const WORD_TYPE_BUCKETS = [
  { id: 'verb', label: '动词', detail: 'v. / vt. / vi.' },
  { id: 'noun', label: '名词', detail: 'n.' },
  { id: 'modifier', label: '形容词/副词', detail: 'a. / ad.' },
  { id: 'function', label: '功能词/短语', detail: 'prep. / conj. 等' },
  { id: 'other', label: '其他', detail: '混合或特殊' },
];

export function getWordTypeIds(entry) {
  const definition = compactDefinition(entry).toLowerCase();
  const word = entry?.word?.toLowerCase() || '';
  const types = new Set();
  if (/\b(?:v|vt|vi)\./.test(definition)) types.add('verb');
  if (/\bn\./.test(definition)) types.add('noun');
  if (/\b(?:a|ad|adv)\./.test(definition)) types.add('modifier');
  if (/\b(?:prep|conj|pron|aux|art|int)\./.test(definition) || word.includes(' ') || word.includes('/')) {
    types.add('function');
  }
  if (!types.size) types.add('other');
  return [...types];
}

export function getDifficultyStage(entry) {
  return entry?.difficultyStage || 'advanced';
}

// Back-compat for older code paths.
export function getExamFrequencyId(entry) {
  return getDifficultyStage(entry);
}

export function getExamTags(entry) {
  return entry?.examTags || [];
}

export function getCocaBand(entry) {
  return entry?.cocaBand || null;
}

export function describeDifficulty(entry) {
  const stage = DIFFICULTY_STAGES.find((item) => item.id === getDifficultyStage(entry));
  return stage?.label || '未分级';
}
