/** The three review verdicts Perch can submit via the GitHub API. */
export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

/**
 * Whether a given review verdict is currently submittable, mirroring
 * what GitHub itself enforces so we fail in the UI instead of
 * round-tripping to a rejection:
 *
 * - You cannot APPROVE or REQUEST_CHANGES your own PR.
 * - REQUEST_CHANGES and COMMENT require a non-empty body; APPROVE does not.
 */
export function reviewActionEnabled(
  event: ReviewEvent,
  body: string,
  viewerIsAuthor: boolean,
): boolean {
  if (viewerIsAuthor && event !== 'COMMENT') return false;
  if (event !== 'APPROVE' && body.trim().length === 0) return false;
  return true;
}
