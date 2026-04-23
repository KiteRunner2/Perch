import { useEffect, useMemo, useRef } from 'react';
import { loadSeen, saveSeen } from '../lib/seen';

/**
 * Returns the subset of PR ids that are new since the previous visit.
 *
 * Semantics:
 * - The "seen" snapshot is frozen at mount (first render). Subsequent
 *   refetches compare against that frozen snapshot, so an incoming PR
 *   appears as new throughout the session.
 * - On page hide / unload, the current ids are persisted as the new
 *   baseline so the *next* visit computes newness relative to what was
 *   visible when you left.
 * - On the first-ever visit, the stored set is empty and nothing is
 *   marked new — we snapshot silently instead.
 */
export function useNewPRs(currentIds: string[]): Set<string> {
  const initialSeenRef = useRef<Set<string> | null>(null);
  if (initialSeenRef.current === null) {
    initialSeenRef.current = loadSeen();
  }
  const initialSeen = initialSeenRef.current;

  const newIds = useMemo<Set<string>>(() => {
    if (initialSeen.size === 0) return new Set();
    const out = new Set<string>();
    for (const id of currentIds) {
      if (!initialSeen.has(id)) out.add(id);
    }
    return out;
  }, [currentIds, initialSeen]);

  // Keep the latest ids in a ref so the save handlers always see fresh data.
  const latestIdsRef = useRef<string[]>(currentIds);
  latestIdsRef.current = currentIds;

  useEffect(() => {
    // First-load silent snapshot: if there was no prior set, stash the
    // current ids immediately so the next visit has a proper baseline.
    if (initialSeen.size === 0 && currentIds.length > 0) {
      saveSeen(currentIds);
    }
    // We intentionally do this only once; depending on [currentIds] would
    // re-acknowledge every refetch and defeat the "new since visit" idea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function persistNow() {
      saveSeen(latestIdsRef.current);
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') persistNow();
    }
    window.addEventListener('beforeunload', persistNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', persistNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return newIds;
}
