import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { setDraftState } from '../lib/github';
import { useUIStore } from '../store';

export interface SetDraftStateVars {
  /** GraphQL node id of the PR — DashboardPR.id. */
  pullRequestId: string;
  /** Target state: true converts to draft, false marks ready for review. */
  draft: boolean;
}

/**
 * Flip a PR's draft state and refresh the dashboard on success. No
 * optimistic update: the refetch flips both the modal's DraftChip and
 * the PR's bucket (bucketOf reads isDraft when deciding "ready to
 * merge") without hand-maintained patches.
 */
export function useSetDraftState(): UseMutationResult<
  void,
  Error,
  SetDraftStateVars
> {
  const token = useUIStore((s) => s.token);
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetDraftStateVars>({
    mutationFn: async ({ pullRequestId, draft }) => {
      if (!token) throw new Error('Missing token');
      return setDraftState(token, pullRequestId, draft);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
