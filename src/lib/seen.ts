const KEY = 'perch.seen';

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
