import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { mergePullRequest } from '../lib/github';
import { useUIStore } from '../store';
import type { MergeMethod } from '../types/dashboard';

export interface MergePullRequestVars {
  /** GraphQL node id of the PR — DashboardPR.id. */
  pullRequestId: string;
  /** Head SHA the user reviewed and confirmed. */
  expectedHeadOid: string;
  /** Merge strategy selected from the repository's enabled methods. */
  mergeMethod: MergeMethod;
}

/** Merge a PR and refresh every dashboard scope on success. */
export function useMergePullRequest(): UseMutationResult<
  void,
  Error,
  MergePullRequestVars
> {
  const token = useUIStore((s) => s.token);
  const queryClient = useQueryClient();

  return useMutation<void, Error, MergePullRequestVars>({
    mutationFn: async ({ pullRequestId, expectedHeadOid, mergeMethod }) => {
      if (!token) throw new Error('Missing token');
      return mergePullRequest(token, pullRequestId, expectedHeadOid, mergeMethod);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
