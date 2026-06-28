// Shared math helpers. Previously clamp() was duplicated across App.jsx,
// srs.js, speech.js, ProgressRing.jsx, TaskRow.jsx, and RightRail.jsx.

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
