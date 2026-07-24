// Export / import the learner's whole record as a JSON file.
//
// Everything lives in this browser's localStorage: phone and laptop are separate
// records, and clearing site data (or iOS Safari evicting an unopened site) takes
// it all. A file the learner owns is the only real safety net, and doubles as the
// way to move progress between devices.

import { parseImportedStudyState } from './storage.js';

const FILE_PREFIX = 'shenshuo-vocab-backup';

// A wrapper rather than the bare state, so a file can be recognised on sight and
// so future readers can tell which app/version wrote it. parseImportedStudyState
// accepts either shape, so older bare-state exports still import.
function buildBackup(study) {
  return {
    app: 'shenshuo-english-vocab',
    kind: 'study-backup',
    exportedAt: new Date().toISOString(),
    study,
  };
}

export function backupFilename(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${FILE_PREFIX}-${stamp}.json`;
}

/** Serialize the current study state and hand the browser a download. */
export function exportStudyState(study, now = new Date()) {
  const text = JSON.stringify(buildBackup(study), null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFilename(now);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick — revoking synchronously can cancel the download in
  // some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return link.download;
}

/**
 * Read a backup file chosen by the learner. Resolves with a ready-to-use study
 * state, or rejects with a message worth showing. Never writes anything itself —
 * the caller decides whether to apply it, so a bad file can't destroy progress.
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('没有选择文件'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result || ''));
      } catch {
        reject(new Error('文件不是有效的 JSON'));
        return;
      }
      try {
        resolve(parseImportedStudyState(parsed));
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
}

/** One-line summary of a parsed backup, so the learner can confirm before overwriting. */
export function describeBackup(study) {
  const words = Object.keys(study?.words || {}).length;
  const days = Object.keys(study?.daily || {}).length;
  const notes = Object.keys(study?.notes || {}).length;
  return `${words} 个单词记录 · ${days} 天学习记录 · ${notes} 条笔记`;
}
