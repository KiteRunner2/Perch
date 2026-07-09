# Draft toggle in the PR modal

## Goal

Let the viewer flip their own PR between draft and ready-for-review
from inside Perch's PR modal, without a trip to GitHub.

## Scope

- Author-only. The button renders only when `pr.viewerIsAuthor`.
- Open PRs only. Hidden when `pr.isMerged` — draft state is
  meaningless once merged.
- No confirmation on either direction.

## Design

### `src/lib/github.ts`

Add `setDraftState(token, pullRequestId, draft)`. It wraps GitHub's two
GraphQL mutations, both of which take only `{ pullRequestId }`:

- `draft === true` → `convertPullRequestToDraft`
- `draft === false` → `markPullRequestReadyForReview`

A single function with a boolean branch beats two near-identical
exports. Throws on GraphQL/HTTP error; callers redact the PAT before
surfacing the message, matching `submitReview` and `rerunPipeline`.

### `src/hooks/useSetDraftState.ts`

New hook, mirroring `useRerunPipeline`:

- Reads `token` from the zustand store, throws `Missing token` if absent.
- `onSuccess` awaits `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`.

No optimistic update. GitHub stays the single source of truth, and the
refetch flips both the modal's `DraftChip` and the PR's bucket —
`bucketOf` reads `isDraft` when deciding "ready to merge" — with no
hand-maintained patches.

### `src/components/PRDetail.tsx`

A `DraftToggleButton({ pr })` component rendered in the footer action
row, immediately after `RerunButton`.

- Returns `null` when `pr.isMerged || !pr.viewerIsAuthor`.
- Label and icon flip on `pr.isDraft`: "Mark as Ready" when currently a
  draft, "Mark as Draft" otherwise.
- Disabled while the mutation is pending, showing the `Loader2` spinner
  already used by `RerunButton`.
- Reuses `RerunButton`'s inline status line: `role="alert"` in
  `var(--err)` on failure, with the same permission hint appended when
  the message matches the 403 heuristic. A token without `repo` scope
  cannot change draft state even on the viewer's own PR.
- The "Mark as Draft" tooltip states that GitHub dismisses pending
  review requests when a PR returns to draft. That is a real cost of a
  stray click, and the tooltip is where it belongs given there is no
  confirmation step.

Styling copies `RerunButton` exactly: 30px height, `var(--bg-1)`
background, `var(--line-2)` border, CSS custom properties throughout —
no hardcoded colors.

## Testing

`bucketing` and `transform` already cover `isDraft`; neither changes.
`setDraftState` is a thin API wrapper whose only branch is "picks the
right mutation," and the repo has no `github.test.ts` today. Consistent
with the project's trusted-by-types stance for non-pure-logic code, we
add no new test file.

Gates before the work is done:

- `bun test` green
- `bun run typecheck` green
- `bun run build` succeeds

## Out of scope

- Toggling draft state on other people's PRs, even where the viewer has
  write access.
- A keyboard shortcut for the toggle.
- Syncing anything to GitHub beyond the mutation itself.
