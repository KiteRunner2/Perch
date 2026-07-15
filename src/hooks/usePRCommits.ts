import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchPRCommits } from '../lib/commits';
import type { PRCommitsResult } from '../types/commits';

interface Args {
  token: string | null;
  pullRequestId: string;
  headSha: string;
  enabled: boolean;
}

/** Lazy-fetch and cache the latest 100 commits for the selected PR. */
export function usePRCommits({
  token,
  pullRequestId,
  headSha,
  enabled,
}: Args): UseQueryResult<PRCommitsResult, Error> {
  return useQuery<PRCommitsResult, Error>({
    queryKey: ['pr-commits', pullRequestId, headSha],
    enabled: enabled && Boolean(token),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!token) throw new Error('Missing token');
      return fetchPRCommits(token, pullRequestId);
    },
    retry: (failureCount, err) => {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes('bad credentials')) return false;
      if (msg.includes('401') || msg.includes('404')) return false;
      return failureCount < 2;
    },
  });
}
