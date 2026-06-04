# PR Review Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user submit a GitHub PR review (Approve / Request changes / Comment, each with an optional message) directly from Perch's PR modal.

**Architecture:** First write path in a previously read-only, client-only app. A pure enable/disable rules function (unit-tested) drives a `ReviewComposer` in the `PRDetail` footer. The composer calls a `useSubmitReview` react-query mutation, which wraps a `submitReview` GraphQL helper (`addPullRequestReview`) hitting `api.github.com` directly. On success it invalidates the `['dashboard']` query so the modal and list refresh from GitHub — no optimistic updates, no backend.

**Tech Stack:** React 18 + TypeScript (strict), graphql-request, @tanstack/react-query, zustand, Vitest, Bun. Inline styles with CSS custom properties (`--ok`, `--err`, `--bg-1`, `--line-2`, …).

**Spec:** `docs/superpowers/specs/2026-06-04-pr-review-actions-design.md`
**Branch:** `feature/pr-review-actions` (already created & pushed)

---

## File Structure

- **Create** `src/lib/reviewActions.ts` — `ReviewEvent` type + pure `reviewActionEnabled(event, body, viewerIsAuthor)` rule. The only branching logic; unit-tested.
- **Create** `src/lib/reviewActions.test.ts` — Vitest coverage of the enable/disable matrix.
- **Modify** `src/lib/github.ts` — add `submitReview(token, pullRequestId, event, body)` GraphQL mutation helper (re-exports `ReviewEvent` from `reviewActions`).
- **Create** `src/hooks/useSubmitReview.ts` — react-query `useMutation` wrapper; reads token from store, invalidates `['dashboard']` on success.
- **Modify** `src/components/PRDetail.tsx` — add `ReviewComposer` component and render it in the footer; add imports.

**Conventions to follow** (from `CLAUDE.md`):
- Inline styles with CSS vars, never hardcoded hex. Dark+light parallel palette already handled by the vars.
- `.mono` class for identifiers; not needed here.
- No new docs/scaffolding. No emojis. Commit messages: imperative, explain *why*, end with `Co-Authored-By:` trailer.
- **Auto-push after every commit** (`git push` — branch upstream already set).
- Each task ends green on `bun test` + `bun run typecheck` (full `bun run build` at the end).

---

### Task 1: Pure review-action rules

**Files:**
- Create: `src/lib/reviewActions.ts`
- Test: `src/lib/reviewActions.test.ts`

GitHub-driven rules we enforce client-side so we fail fast:
- Approve/Request-changes are rejected on a PR you authored → disabled when `viewerIsAuthor`.
- Request-changes and Comment require a non-empty (non-whitespace) body. Approve allows an empty body.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reviewActions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { reviewActionEnabled } from './reviewActions';

describe('reviewActionEnabled', () => {
  describe('APPROVE', () => {
    it('is enabled with an empty body for a non-author', () => {
      expect(reviewActionEnabled('APPROVE', '', false)).toBe(true);
    });
    it('is enabled with a body for a non-author', () => {
      expect(reviewActionEnabled('APPROVE', 'lgtm', false)).toBe(true);
    });
    it('is disabled when the viewer authored the PR', () => {
      expect(reviewActionEnabled('APPROVE', 'lgtm', true)).toBe(false);
    });
  });

  describe('REQUEST_CHANGES', () => {
    it('is disabled with an empty body', () => {
      expect(reviewActionEnabled('REQUEST_CHANGES', '', false)).toBe(false);
    });
    it('is disabled with a whitespace-only body', () => {
      expect(reviewActionEnabled('REQUEST_CHANGES', '   \n', false)).toBe(false);
    });
    it('is enabled with a real body for a non-author', () => {
      expect(reviewActionEnabled('REQUEST_CHANGES', 'fix this', false)).toBe(true);
    });
    it('is disabled when the viewer authored the PR even with a body', () => {
      expect(reviewActionEnabled('REQUEST_CHANGES', 'fix this', true)).toBe(false);
    });
  });

  describe('COMMENT', () => {
    it('is disabled with an empty body', () => {
      expect(reviewActionEnabled('COMMENT', '', false)).toBe(false);
    });
    it('is enabled with a body for a non-author', () => {
      expect(reviewActionEnabled('COMMENT', 'a note', false)).toBe(true);
    });
    it('is enabled with a body even when the viewer authored the PR', () => {
      expect(reviewActionEnabled('COMMENT', 'a note', true)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/reviewActions.test.ts`
Expected: FAIL — cannot resolve `./reviewActions` / `reviewActionEnabled is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/reviewActions.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/reviewActions.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reviewActions.ts src/lib/reviewActions.test.ts
git commit -m "Add pure review-action enablement rules

Encode the GitHub-enforced constraints (no self approve/request-changes,
body required for request-changes/comment) as a single tested predicate
so the upcoming composer can disable buttons before any network call.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 2: `submitReview` GraphQL mutation helper

**Files:**
- Modify: `src/lib/github.ts` (add near `testConnection`, after the `createClient` helper)

This is the first write call in the app. It uses `addPullRequestReview`,
which creates **and** submits a review in one request when `event` is set.

- [ ] **Step 1: Add the import and mutation helper**

At the top of `src/lib/github.ts`, add the type import (keep the existing imports):

```ts
import type { ReviewEvent } from './reviewActions';
```

Re-export the type so callers can import it from either module:

```ts
export type { ReviewEvent } from './reviewActions';
```

Then add the mutation constant and helper (place after `testConnection`):

```ts
export const SUBMIT_REVIEW_MUTATION = /* GraphQL */ `
  mutation SubmitReview(
    $pullRequestId: ID!
    $event: PullRequestReviewEvent!
    $body: String
  ) {
    addPullRequestReview(
      input: { pullRequestId: $pullRequestId, event: $event, body: $body }
    ) {
      pullRequestReview {
        id
        state
      }
    }
  }
`;

/**
 * Submit a review on a PR. `addPullRequestReview` both creates and
 * submits in one call when `event` is provided, so there's no separate
 * "create draft then submit" step. `pullRequestId` is the GraphQL node
 * id carried on every DashboardPR (`pr.id`). Throws on GraphQL/HTTP
 * error; callers surface it (redacting the PAT first).
 */
export async function submitReview(
  token: string,
  pullRequestId: string,
  event: ReviewEvent,
  body: string,
): Promise<void> {
  const client = createClient(token);
  await client.request(SUBMIT_REVIEW_MUTATION, {
    pullRequestId,
    event,
    // GitHub treats an empty body as "no summary" only for APPROVE;
    // the composer guarantees a non-empty body for the other verdicts.
    body: body.trim(),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors. (No unit test — this is a thin network wrapper, trusted-by-types per project convention.)

- [ ] **Step 3: Run the existing suite to confirm nothing broke**

Run: `bun test`
Expected: PASS (existing tests + Task 1's 10 tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/github.ts
git commit -m "Add submitReview GraphQL mutation helper

Introduce the first write path: addPullRequestReview creates and
submits a review in a single call. Kept client-only, straight to
api.github.com, matching every existing query.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 3: `useSubmitReview` mutation hook

**Files:**
- Create: `src/hooks/useSubmitReview.ts`

Wraps `submitReview` in a react-query `useMutation`, reads the token from
the zustand store, and invalidates `['dashboard']` on success so the
Approval card / Reviewers / Timeline refresh from GitHub.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useSubmitReview.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSubmitReview.ts
git commit -m "Add useSubmitReview mutation hook

Wrap submitReview in react-query and invalidate the dashboard query on
success so the modal and list reflect the new review without optimistic
patching.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 4: `ReviewComposer` in the PR modal footer

**Files:**
- Modify: `src/components/PRDetail.tsx`

Add a composer to the footer: an optional message textarea + three
verdict buttons, direct submit, pending/error states, PAT redaction.

- [ ] **Step 1: Add imports**

At the top of `src/components/PRDetail.tsx`, extend the existing imports.

Add to the lucide-react import list: `Loader2`. Add new imports below the existing ones:

```ts
import { useSubmitReview } from '../hooks/useSubmitReview';
import { reviewActionEnabled, type ReviewEvent } from '../lib/reviewActions';
import { redactToken } from '../lib/storage';
import { useUIStore } from '../store';
```

- [ ] **Step 2: Replace the footer's right side with the composer**

In `PRDetail`, the current footer (around the `Open on GitHub` anchor +
spacer + `Close` button) stays, but we add `<ReviewComposer pr={pr} />`
between the spacer and the Close button so verdicts sit at the bottom of
the modal. Change the footer block so it reads:

```tsx
      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--line-1)',
          background: 'var(--bg-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <ReviewComposer pr={pr} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: 30,
              padding: '0 12px',
              borderRadius: 6,
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              fontSize: 12,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} />
            Open on GitHub
          </a>
          <span style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              height: 30,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid var(--line-2)',
              background: 'var(--bg-1)',
              color: 'var(--fg-1)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      </div>
```

Note: the outer footer `div` changes from a single flex row to a
`flexDirection: 'column'` stack (composer on top, the existing
action row below).

- [ ] **Step 3: Add the `ReviewComposer` component**

Add this component at the bottom of `src/components/PRDetail.tsx` (after
the other local function components):

```tsx
const VERDICTS: { event: ReviewEvent; label: string; tone: 'ok' | 'err' | 'neutral' }[] = [
  { event: 'APPROVE', label: 'Approve', tone: 'ok' },
  { event: 'REQUEST_CHANGES', label: 'Request changes', tone: 'err' },
  { event: 'COMMENT', label: 'Comment', tone: 'neutral' },
];

function ReviewComposer({ pr }: { pr: DashboardPR }) {
  const [body, setBody] = useState('');
  const token = useUIStore((s) => s.token);
  const mutation = useSubmitReview();
  const pending = mutation.isPending;
  const activeEvent = mutation.variables?.event;

  function submit(event: ReviewEvent) {
    mutation.mutate(
      { pullRequestId: pr.id, event, body },
      { onSuccess: () => setBody('') },
    );
  }

  // Redact the PAT from any error before display, then add a friendly
  // hint for the common "token lacks write scope" failure.
  const errorMessage = (() => {
    if (!mutation.error) return null;
    let msg = mutation.error.message;
    if (token) msg = msg.split(token).join(redactToken(token));
    if (/permission|forbidden|403|not authorized|scope|resource not accessible/i.test(msg)) {
      return `${msg} — your token may lack write access. It needs the "repo" scope (classic) or "Pull requests: Read and write" (fine-grained).`;
    }
    return msg;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a review comment (optional for Approve)…"
        rows={2}
        disabled={pending}
        style={{
          width: '100%',
          resize: 'vertical',
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid var(--line-2)',
          background: 'var(--bg-1)',
          color: 'var(--fg-0)',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />
      {errorMessage && (
        <div
          role="alert"
          style={{
            fontSize: 11.5,
            color: 'var(--err)',
            lineHeight: 1.4,
          }}
        >
          {errorMessage}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {VERDICTS.map(({ event, label, tone }) => {
          const enabled =
            !pending && reviewActionEnabled(event, body, pr.viewerIsAuthor);
          const isActive = pending && activeEvent === event;
          const title =
            pr.viewerIsAuthor && event !== 'COMMENT'
              ? 'GitHub does not allow approving or requesting changes on your own PR'
              : !pr.viewerIsAuthor && event !== 'APPROVE' && body.trim().length === 0
                ? 'A comment is required for this action'
                : undefined;
          return (
            <button
              key={event}
              onClick={() => submit(event)}
              disabled={!enabled}
              title={title}
              style={verdictBtnStyle(tone, enabled)}
            >
              {isActive && (
                <Loader2 size={12} className="spin" aria-hidden />
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function verdictBtnStyle(
  tone: 'ok' | 'err' | 'neutral',
  enabled: boolean,
): React.CSSProperties {
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'err' ? 'var(--err)' : 'var(--fg-1)';
  const border =
    tone === 'neutral' ? 'var(--line-2)' : color;
  return {
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    border: `1px solid ${border}`,
    background: 'var(--bg-1)',
    color,
    fontSize: 12,
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.45,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };
}
```

- [ ] **Step 4: Add the spinner keyframe**

The pending state uses a `.spin` class. Check `src/index.css` for an
existing spin/rotate animation first:

Run: `grep -nE "spin|@keyframes" src/index.css`

If a `.spin` rule already exists, skip this step. Otherwise append to
`src/index.css`:

```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.spin {
  animation: spin 0.8s linear infinite;
}
```

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no errors. (If `React.CSSProperties` is flagged as missing,
confirm the file already references `React.` — `navBtnStyle` above it
already returns `React.CSSProperties`, so the namespace is in scope.)

- [ ] **Step 6: Run the full test suite**

Run: `bun test`
Expected: PASS (no regressions; Task 1 tests still green).

- [ ] **Step 7: Build**

Run: `bun run build`
Expected: succeeds (strict tsc + Vite build to `dist/`).

- [ ] **Step 8: Commit**

```bash
git add src/components/PRDetail.tsx src/index.css
git commit -m "Add in-modal review composer

Surface Approve / Request changes / Comment in the PR modal footer with
an optional message body. Buttons disable per GitHub's own rules (no
self approve/request-changes, body required for request-changes and
comment) and show a pending spinner during submit. Errors redact the
PAT and hint at missing write scope on permission failures.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 5: Final verification & manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Full gate**

Run each and confirm green:

```bash
bun test
bun run typecheck
bun run build
```

Expected: all pass.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `bun dev`, open the dashboard, open a PR you did **not** author:
- Empty body → Approve enabled, Request changes & Comment disabled.
- Type a message → all three enabled.
- Open a PR you **did** author → Approve & Request changes disabled (with tooltip), Comment enabled once a body is typed.
- Submitting a verdict shows the spinner, then the Approval card /
  Reviewers list refresh.

(Manual only — per `CLAUDE.md`, UI/integration tests are out of scope.)

- [ ] **Step 3: Confirm branch is pushed**

Run: `git status` (clean) and `git log --oneline -6`.
The branch `feature/pr-review-actions` should hold the spec commit plus
the four implementation commits.

---

## Self-Review

**Spec coverage:**
- Mutation layer (`submitReview`, `addPullRequestReview`) → Task 2. ✓
- Refresh via `invalidateQueries(['dashboard'])` → Task 3. ✓
- Composer in modal footer (textarea + 3 toned buttons, direct submit, pending, inline redacted error, 403 hint) → Task 4. ✓
- Own-PR guard via `pr.viewerIsAuthor`; body-required rule → Task 1 (pure, tested) + applied in Task 4. ✓
- Keyboard nav already guards textareas → no task needed (noted in spec). ✓
- "Open on GitHub" / "Close" retained → Task 4 Step 2. ✓
- Tests for the pure rule only; no UI/integration tests → Task 1. ✓
- Out-of-scope items (row quick-approve, inline comments, TokenSetup copy, optimistic updates) → not implemented. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every code step shows full code.

**Type consistency:** `ReviewEvent` defined in `reviewActions.ts` (Task 1), re-exported from `github.ts` (Task 2), imported by `useSubmitReview.ts` (Task 3, via `github`) and `PRDetail.tsx` (Task 4, via `reviewActions`). `reviewActionEnabled(event, body, viewerIsAuthor)` signature identical across Task 1 definition and Task 4 usage. `SubmitReviewVars` fields (`pullRequestId`, `event`, `body`) match the `mutation.mutate({ pullRequestId: pr.id, event, body })` call in Task 4. ✓
