# PR review actions (Approve / Request changes / Comment)

**Date:** 2026-06-04
**Branch:** `feature/pr-review-actions`
**Status:** Approved design, ready for implementation plan

## Goal

Let the user submit a GitHub PR review — Approve, Request changes, or
Comment, each with an optional message — directly from Perch's PR modal,
without leaving for github.com.

This introduces the **first write path** in an app that has been
deliberately read-only. The client-only boundary stays intact: the
mutation goes straight from the browser to `api.github.com`, same as
every existing query. No backend.

## Decisions (locked with the user)

| Decision | Choice |
|----------|--------|
| Scope | Full review: **Approve**, **Request changes**, **Comment**, each with an optional body |
| Placement | **Modal only** — composer in `PRDetail` footer. No row-level quick-approve. |
| Friction | **Direct submit** — click sends immediately, no confirm dialog. |
| Refresh | Invalidate the dashboard query on success; GitHub is the single source of truth (no optimistic patching). |

## Architecture

Data flow for the new write path:

```
ReviewComposer (PRDetail footer)
  → useSubmitReview() mutation hook
    → submitReview() in lib/github.ts  (GraphQL addPullRequestReview)
      → api.github.com
  → onSuccess: queryClient.invalidateQueries(['dashboard'])
    → usePRs refetches → modal's Approval card / Reviewers / Timeline update
```

### 1. Mutation layer — `src/lib/github.ts`

Add a `submitReview` helper. GitHub's GraphQL `addPullRequestReview`
mutation creates **and** submits a review in one call when `event` is
provided (no separate "add then submit" dance).

```ts
export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export async function submitReview(
  token: string,
  pullRequestId: string, // GraphQL node id — DashboardPR.id
  event: ReviewEvent,
  body: string,
): Promise<void>;
```

- Uses the existing `createClient(token)` + `client.request(...)`.
- `pullRequestId` is `DashboardPR.id`, which is the GraphQL node id we
  already carry on every row.
- Throws on GraphQL/HTTP error; the hook surfaces it.

### 2. Mutation hook — `src/hooks/useSubmitReview.ts`

A react-query `useMutation` wrapping `submitReview`.

- Reads the token from the zustand store (same pattern as `usePRs`
  callers).
- Uses `useQueryClient()` (the app is wrapped in `QueryClientProvider`
  in `App.tsx`).
- `onSuccess`: `invalidateQueries({ queryKey: ['dashboard'] })` so the
  Approval status card, reviewers list, and timeline refresh from
  GitHub. No optimistic update — keeps the two views from drifting.
- Exposes `isPending` and `error` for the composer's UI states.

### 3. UI — `ReviewComposer` in `PRDetail.tsx`

Replaces the right-hand side of the existing modal footer. Layout:

- An **optional message** `<textarea>` (styled with the existing
  CSS-var tokens — `--bg-2`, `--line-1`, etc.).
- Three submit buttons, color-toned to existing semantics:
  - **Approve** → `--ok`
  - **Request changes** → `--err`
  - **Comment** → neutral (`--bg-1` / `--line-2`)
- **Direct submit:** clicking a button calls the mutation immediately.
- **Pending state:** while `isPending`, all three buttons disable and
  the active one shows a pending affordance.
- **Inline error:** on failure, render `error.message` **redacted via
  the `storage` PAT-redaction helper**. A 403 / permission failure gets
  a friendly hint that the token needs write access (`repo` or
  fine-grained "Pull requests: Read and write").
- **On success:** clear the textarea; the query refetch repopulates the
  Approval card and Reviewers list.
- "Open on GitHub" and "Close" buttons stay in the footer.

### 4. Guardrails (GitHub-driven, baked in)

These mirror what GitHub itself enforces, so we fail fast in the UI
instead of round-tripping to a rejection:

- **Own PRs:** GitHub rejects Approve / Request-changes on a PR you
  authored. When **`pr.viewerIsAuthor`** is true, those two buttons are
  disabled with an explanatory tooltip; **Comment** stays enabled.
- **Body requirement:** GitHub requires a non-empty body for *Request
  changes* and *Comment*; *Approve* allows an empty body. Those two
  buttons stay disabled until the textarea has non-whitespace text.
- These enable/disable rules live in a small **pure function**
  co-located with a `*.test.ts`, e.g.:

  ```ts
  // reviewActions.ts
  export function reviewActionEnabled(
    event: ReviewEvent,
    body: string,
    viewerIsAuthor: boolean,
  ): boolean;
  ```

  This is the only piece with branching logic worth unit-testing, per
  the repo convention ("new logic worth unit-testing goes next to the
  source"). The mutation, hook, and JSX stay trusted-by-types.

## Testing

- **Unit tests** (Vitest) for `reviewActionEnabled` covering the matrix:
  each event × empty/non-empty body × author/non-author.
- Per `CLAUDE.md`, no integration/UI tests — they are explicitly out of
  scope for this project.
- Gate before claiming done: `bun test`, `bun run typecheck`,
  `bun run build` all green.

## Keyboard interaction note

`useKeyboardNav` **already** ignores key events whose target is an
`INPUT` / `TEXTAREA` / `SELECT` / contentEditable element (its
`isEditable` guard), so typing a review message will **not** trigger
j/k/r list navigation. No change needed there.

The one nuance: `Escape` is handled *before* that guard, so pressing Esc
while focused in the textarea closes the modal (and discards the typed
draft). This matches existing modal behavior and is acceptable; we will
not special-case it.

## Token scope

Approving requires a token with write access. The current read-only
flow does not, so an existing user's PAT may be read-only. We do **not**
change `TokenSetup` copy beyond surfacing a clear permission-error hint
in the composer when a write is rejected (403). Keeping `TokenSetup`
changes out keeps scope tight; the inline hint is enough for a
single-user app.

## Out of scope (YAGNI)

- Row-level quick-approve button or shortcut.
- Inline / line-level review comments.
- Re-requesting review, dismissing reviews, merge button.
- Editing `TokenSetup` documentation/scope copy beyond the error hint.
- Optimistic UI updates.
