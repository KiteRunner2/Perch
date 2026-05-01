/**
 * "Mark as viewed" state for the Diff tab. Display-only, persisted
 * client-side — we don't yet call GitHub's `markFileAsViewed` GraphQL
 * mutation. Keyed by `{prId}::{filePath}` so toggles in one PR don't
 * leak into another.
 */
const KEY = 'perch.viewedFiles';

interface ViewedShape {
  // Map of composite key → true. We never store false; absence === unviewed.
  [key: string]: true;
}

function compositeKey(prId: string, path: string): string {
  return `${prId}::${path}`;
}

function read(): ViewedShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: ViewedShape = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (v === true) out[k] = true;
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function write(shape: ViewedShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(shape));
  } catch {
    /* ignore quota errors etc. */
  }
}

/** Return the set of file paths the user has marked viewed on this PR. */
export function loadViewedFiles(prId: string): Set<string> {
  const shape = read();
  const out = new Set<string>();
  const prefix = `${prId}::`;
  for (const k of Object.keys(shape)) {
    if (k.startsWith(prefix)) out.add(k.slice(prefix.length));
  }
  return out;
}

/** Toggle the viewed flag for one (PR, file) pair and persist. */
export function setFileViewed(
  prId: string,
  path: string,
  viewed: boolean
): void {
  const shape = read();
  const k = compositeKey(prId, path);
  if (viewed) shape[k] = true;
  else delete shape[k];
  write(shape);
}
