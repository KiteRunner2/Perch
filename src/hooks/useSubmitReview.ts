import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { submitReview, type ReviewEvent } from '../lib/github';
import { useUIStore } from '../store';

export interface SubmitReviewVars {
  /** GraphQL node id of the PR — DashboardPR.id. */
  pullRequestId: string;
  event: ReviewEvent;
  body: string;
}

/**
 * Submit a PR review and refresh the dashboard on success. No
 * optimistic update: GitHub is the single source of truth, and
 * invalidating the query keeps the modal's Approval card and the list
 * in sync without hand-maintained patches.
 */
export function useSubmitReview(): UseMutationResult<
  void,
  Error,
  SubmitReviewVars
> {
  const token = useUIStore((s) => s.token);
  const queryClient = useQueryClient();

  return useMutation<void, Error, SubmitReviewVars>({
    mutationFn: async ({ pullRequestId, event, body }) => {
      if (!token) throw new Error('Missing token');
      return submitReview(token, pullRequestId, event, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
