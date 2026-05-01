import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchPRDiff } from '../lib/diff';
import type { PRDiffResult } from '../types/diff';

interface Args {
  token: string | null;
  repoNameWithOwner: string;
  pullNumber: number;
  changedFiles: number;
  /**
   * Gate the fetch on the user actually opening the Diff tab. Without
   * this, we'd burn a REST call every time the drawer opens, even if
   * the user only wanted the Timeline.
   */
  enabled: boolean;
}

/**
 * Lazy-fetches the file list + patches for one PR via GitHub's REST
 * API. Cached aggressively (10 min) — diffs rarely change after a PR
 * is opened, and react-query will refetch automatically when the
 * drawer reopens past the staleTime.
 */
export function usePRDiff({
  token,
  repoNameWithOwner,
  pullNumber,
  changedFiles,
  enabled,
}: Args): UseQueryResult<PRDiffResult, Error> {
  return useQuery<PRDiffResult, Error>({
    queryKey: ['pr-diff', repoNameWithOwner, pullNumber],
    enabled: enabled && Boolean(token),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!token) throw new Error('Missing token');
      return fetchPRDiff(token, repoNameWithOwner, pullNumber, changedFiles);
    },
    retry: (failureCount, err) => {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes('bad credentials')) return false;
      if (msg.includes('401') || msg.includes('404')) return false;
      return failureCount < 2;
    },
  });
}
