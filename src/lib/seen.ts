const KEY = 'perch.seen';
const COMMENT_KEY = 'perch.commentCounts';

/** Load the set of PR ids the user has already seen in a prior visit. */
export function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

/** Persist the current snapshot of PR ids as "seen" for the next visit. */
export function saveSeen(ids: Iterable<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore quota errors etc. */
  }
}

/** Load per-PR comment counts as of the previous visit. */
export function loadCommentCounts(): Map<string, number> {
  const out = new Map<string, number>();
  try {
    const raw = localStorage.getItem(COMMENT_KEY);
    if (!raw) return out;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) out.set(k, v);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Persist per-PR comment counts as the new baseline. */
export function saveCommentCounts(counts: Map<string, number>): void {
  try {
    const obj: Record<string, number> = {};
    for (const [k, v] of counts) obj[k] = v;
    localStorage.setItem(COMMENT_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}
