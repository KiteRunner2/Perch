import { useEffect, useMemo, useRef } from 'react';
import { loadCommentCounts, saveCommentCounts } from '../lib/seen';
import type { DashboardPR } from '../types/dashboard';

/**
 * Returns a map of `prId -> number of new comments since the previous visit`.
 *
 * Mirrors `useNewPRs`:
 * - Snapshot the stored per-PR comment counts at mount; freeze.
 * - For every refetched PR, if `current > previous` the diff is "new
 *   since your last visit." PRs not present in the snapshot get no
 *   delta (those are flagged by the new-row dot already).
 * - On page hide / unload, persist the *current* counts so the next
 *   visit computes deltas relative to what was on screen when you left.
 * - First-ever visit silently snapshots — nothing is flagged.
 */
export function useNewComments(prs: DashboardPR[]): Map<string, number> {
  const initialRef = useRef<Map<string, number> | null>(null);
  if (initialRef.current === null) {
    initialRef.current = loadCommentCounts();
  }
  const initial = initialRef.current;

  const deltas = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>();
    if (initial.size === 0) return out;
    for (const pr of prs) {
      const previous = initial.get(pr.id);
      if (previous === undefined) continue; // PR didn't exist last visit
      if (pr.commentCount > previous) {
        out.set(pr.id, pr.commentCount - previous);
      }
    }
    return out;
  }, [prs, initial]);

  // Keep latest counts in a ref so the save handlers always see fresh data.
  const latestRef = useRef<DashboardPR[]>(prs);
  latestRef.current = prs;

  useEffect(() => {
    // Silent first-visit snapshot.
    if (initial.size === 0 && prs.length > 0) {
      const snapshot = new Map<string, number>();
      for (const pr of prs) snapshot.set(pr.id, pr.commentCount);
      saveCommentCounts(snapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function persistNow(): void {
      const snapshot = new Map<string, number>();
      for (const pr of latestRef.current) {
        snapshot.set(pr.id, pr.commentCount);
      }
      saveCommentCounts(snapshot);
    }
    function onVisibility(): void {
      if (document.visibilityState === 'hidden') persistNow();
    }
    window.addEventListener('beforeunload', persistNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', persistNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return deltas;
}
