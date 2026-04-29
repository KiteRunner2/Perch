import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadCommentCounts, saveCommentCounts } from '../lib/seen';
import type { DashboardPR } from '../types/dashboard';

export interface NewCommentsState {
  /** Map of `prId -> number of new comments since the previous visit`. */
  deltas: Map<string, number>;
  /** Mark a PR as read — clears its delta and persists immediately. */
  markAsRead: (prId: string) => void;
}

/**
 * Tracks new-since-last-visit deltas on per-PR comment counts.
 *
 * - Snapshot the stored counts at mount (held as state, not a ref, so
 *   `markAsRead` can advance the baseline mid-session).
 * - For every refetched PR, if `current > previous` the diff is "new
 *   since your last visit." PRs not present in the snapshot get no
 *   delta (the new-row dot already covers them).
 * - On page hide / unload, persist the *current* counts as the new
 *   baseline for the next visit.
 * - First-ever visit silently snapshots — nothing is flagged.
 *
 * `markAsRead(prId)` is fired from Dashboard when the drawer opens for
 * a PR — bumps that PR's snapshot entry to its current count so the
 * delta clears immediately.
 */
export function useNewComments(prs: DashboardPR[]): NewCommentsState {
  const [snapshot, setSnapshot] = useState<Map<string, number>>(() =>
    loadCommentCounts()
  );

  // Keep latest data accessible to closures without re-running effects.
  const latestPrsRef = useRef<DashboardPR[]>(prs);
  latestPrsRef.current = prs;

  const deltas = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>();
    if (snapshot.size === 0) return out;
    for (const pr of prs) {
      const previous = snapshot.get(pr.id);
      if (previous === undefined) continue; // PR didn't exist last visit
      if (pr.commentCount > previous) {
        out.set(pr.id, pr.commentCount - previous);
      }
    }
    return out;
  }, [prs, snapshot]);

  const markAsRead = useCallback((prId: string) => {
    const pr = latestPrsRef.current.find((p) => p.id === prId);
    if (!pr) return;
    setSnapshot((prev) => {
      if (prev.get(prId) === pr.commentCount) return prev; // already in sync
      const next = new Map(prev);
      next.set(prId, pr.commentCount);
      saveCommentCounts(next);
      return next;
    });
  }, []);

  // First-visit silent snapshot: if there was no prior baseline, set it
  // to whatever's on screen right now so nothing is flagged on day one.
  useEffect(() => {
    if (snapshot.size === 0 && prs.length > 0) {
      const initial = new Map<string, number>();
      for (const pr of prs) initial.set(pr.id, pr.commentCount);
      setSnapshot(initial);
      saveCommentCounts(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist current counts on tab hide / unload so the next visit
  // computes deltas relative to what was on screen when you left.
  useEffect(() => {
    function persistNow(): void {
      const snap = new Map<string, number>();
      for (const pr of latestPrsRef.current) {
        snap.set(pr.id, pr.commentCount);
      }
      saveCommentCounts(snap);
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

  return { deltas, markAsRead };
}
