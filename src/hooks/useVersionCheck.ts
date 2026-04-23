import { useQuery } from '@tanstack/react-query';
import { VERSION } from '../version';

interface RemoteVersion {
  sha: string;
  shortSha: string;
  branch: string;
  builtAt: string;
}

async function fetchLatestVersion(): Promise<RemoteVersion> {
  // Bust any intermediate cache and prevent the browser from serving a
  // stale copy from its HTTP cache.
  const res = await fetch(`/version.json?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-store' },
  });
  if (!res.ok) throw new Error(`version.json ${res.status}`);
  return (await res.json()) as RemoteVersion;
}

export interface VersionCheck {
  hasUpdate: boolean;
  latest: RemoteVersion | null;
}

/**
 * Polls /version.json every 60s. Returns hasUpdate=true when the deployed
 * SHA differs from the one that was baked into this bundle at build time.
 *
 * Disabled during local dev since there's no meaningful SHA to compare
 * against and /version.json is not served by vite dev.
 */
export function useVersionCheck(): VersionCheck {
  const q = useQuery<RemoteVersion, Error>({
    queryKey: ['version'],
    queryFn: fetchLatestVersion,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
    enabled: import.meta.env.PROD && VERSION.sha !== 'unknown',
  });

  const latest = q.data ?? null;
  const hasUpdate = Boolean(
    latest && latest.sha && latest.sha !== VERSION.sha
  );
  return { hasUpdate, latest };
}
