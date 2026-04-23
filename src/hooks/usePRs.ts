import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchDashboard } from '../lib/github';
import { transformDashboard } from '../lib/transform';
import { bucketize } from '../lib/bucketing';
import type { Bucket, DashboardPR } from '../types/dashboard';

export interface DashboardData {
  viewer: { login: string; avatarUrl: string };
  prs: DashboardPR[];
  buckets: Bucket[];
  rateLimit: { remaining: number; resetAt: string };
  fetchedAt: number;
}

export function usePRs(
  token: string | null
): UseQueryResult<DashboardData, Error> {
  return useQuery<DashboardData, Error>({
    queryKey: ['dashboard', token],
    enabled: Boolean(token),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    queryFn: async () => {
      if (!token) throw new Error('Missing token');
      const res = await fetchDashboard(token);
      const { viewer, prs, rateLimit } = transformDashboard(res);
      return {
        viewer,
        prs,
        buckets: bucketize(prs),
        rateLimit,
        fetchedAt: Date.now(),
      };
    },
    retry: (failureCount, err) => {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes('bad credentials')) return false;
      if (msg.includes('401')) return false;
      return failureCount < 2;
    },
  });
}
