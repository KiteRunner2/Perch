# Desktop Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in browser desktop notifications that alert the user to activity on their own PRs (new comments, failed pipelines, merges, review approvals/changes), defaulting to off.

**Architecture:** A pure `computeNotifications(prev, next)` diffs a per-poll in-memory snapshot of the viewer's authored PRs and returns events; a thin `useDesktopNotifications` hook fires `Notification`s from those events. A stored boolean preference (separate from browser permission) gates everything and flips `refetchIntervalInBackground` on so the 60s poll keeps running in a hidden tab.

**Tech Stack:** React 18 + TypeScript (strict), zustand, @tanstack/react-query, Vitest, Web Notifications API. Package manager: Bun.

---

## File Structure

- `src/lib/storage.ts` (modify) — persist the `perch.notifications` boolean.
- `src/store.ts` (modify) — `notificationsEnabled` state + setter.
- `src/lib/notifications.ts` (create) — types, `snapshotAuthored`, pure `computeNotifications`.
- `src/lib/notifications.test.ts` (create) — unit tests for `computeNotifications`.
- `src/hooks/useDesktopNotifications.ts` (create) — snapshot ref + fire side effect.
- `src/hooks/usePRs.ts` (modify) — `notificationsEnabled` arg → `refetchIntervalInBackground`.
- `src/components/Settings.tsx` (modify) — Notifications settings group + permission flow.
- `src/components/Dashboard.tsx` (modify) — wire store → `usePRs` + `useDesktopNotifications`.
- `CLAUDE.md` (modify) — document the client-only notification boundary.

---

## Task 1: Persist the notifications preference

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add the storage key and accessors**

In `src/lib/storage.ts`, add the key constant alongside the others at the top:

```ts
const NOTIFICATIONS_KEY = 'perch.notifications';
```

Then add these two methods inside the `storage` object (after `setOrgs`):

```ts
  getNotifications(): boolean {
    try {
      return localStorage.getItem(NOTIFICATIONS_KEY) === 'true';
    } catch {
      return false;
    }
  },
  setNotifications(enabled: boolean): void {
    localStorage.setItem(NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
  },
```

- [ ] **Step 2: Verify it typechecks**

Run: `bun run typecheck`
Expected: PASS (no output, exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "Add localStorage accessors for notifications preference"
```

---

## Task 2: Add notifications state to the store

**Files:**
- Modify: `src/store.ts`

- [ ] **Step 1: Extend the UIState interface**

In `src/store.ts`, add to the `UIState` interface (after `helpOpen: boolean;` and its setters region — place the field near the other booleans and the setter near the other setters):

Add field:

```ts
  notificationsEnabled: boolean;
```

Add setter signature:

```ts
  setNotificationsEnabled: (enabled: boolean) => void;
```

- [ ] **Step 2: Initialize and implement in the store body**

In the `create<UIState>` initializer, add the initial value (near `theme: storage.getTheme(),`):

```ts
  notificationsEnabled: storage.getNotifications(),
```

And add the setter implementation (near `setTheme`):

```ts
  setNotificationsEnabled: (enabled) => {
    storage.setNotifications(enabled);
    set({ notificationsEnabled: enabled });
  },
```

- [ ] **Step 3: Verify it typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store.ts
git commit -m "Track notificationsEnabled in the UI store"
```

---

## Task 3: Pure notification-diff logic (TDD)

**Files:**
- Create: `src/lib/notifications.ts`
- Test: `src/lib/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  computeNotifications,
  snapshotAuthored,
  type PRSnapshot,
} from './notifications';
import type { DashboardPR } from '../types/dashboard';

function makePR(overrides: Partial<DashboardPR> = {}): DashboardPR {
  const now = Date.now();
  const base: DashboardPR = {
    id: 'PR_1',
    number: 1,
    title: 'Example PR',
    url: 'https://github.com/example/repo/pull/1',
    isDraft: false,
    mergeable: 'MERGEABLE',
    updatedAt: new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
    repoNameWithOwner: 'example/repo',
    author: { login: 'me', av: 'a' },
    viewerIsAuthor: true,
    viewerIsRequestedReviewer: false,
    approvalCount: 0,
    reviewerCount: 0,
    approvalState: 'pending',
    viewerReviewState: 'none',
    ciStatus: 'none',
    labels: [],
    reviewers: [],
    waitingTimeMs: 0,
    escalate: false,
    isMerged: false,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    commitCount: 1,
    commentCount: 0,
    lastCommitAt: new Date(now).toISOString(),
    lastCommentAt: null,
    headRefName: 'feature/example',
    headSha: 'abc123',
    baseRefName: 'main',
    timeline: [],
  };
  return { ...base, ...overrides };
}

function snap(pr: DashboardPR): PRSnapshot {
  return {
    commentCount: pr.commentCount,
    ciStatus: pr.ciStatus,
    approvalState: pr.approvalState,
    isMerged: pr.isMerged,
  };
}

describe('computeNotifications', () => {
  it('fires nothing when the PR was not in the previous snapshot', () => {
    const pr = makePR({ commentCount: 5 });
    expect(computeNotifications(new Map(), [pr])).toEqual([]);
  });

  it('ignores PRs the viewer did not author', () => {
    const before = makePR({ viewerIsAuthor: false, commentCount: 0 });
    const after = makePR({ viewerIsAuthor: false, commentCount: 3 });
    const prev = new Map([[before.id, snap(before)]]);
    expect(computeNotifications(prev, [after])).toEqual([]);
  });

  it('fires nothing when nothing changed', () => {
    const pr = makePR({ commentCount: 2, ciStatus: 'success' });
    const prev = new Map([[pr.id, snap(pr)]]);
    expect(computeNotifications(prev, [pr])).toEqual([]);
  });

  it('fires a comment event when commentCount increases', () => {
    const before = makePR({ commentCount: 1 });
    const after = makePR({ commentCount: 4 });
    const prev = new Map([[before.id, snap(before)]]);
    const events = computeNotifications(prev, [after]);
    expect(events.map((e) => e.kind)).toEqual(['comment']);
    expect(events[0]).toMatchObject({ prId: 'PR_1', prNumber: 1 });
  });

  it('fires ci-fail only when ciStatus transitions into failure', () => {
    const before = makePR({ ciStatus: 'pending' });
    const after = makePR({ ciStatus: 'failure' });
    const prev = new Map([[before.id, snap(before)]]);
    expect(computeNotifications(prev, [after]).map((e) => e.kind)).toEqual([
      'ci-fail',
    ]);
  });

  it('does not fire on ciStatus transitions into pending or success', () => {
    const before = makePR({ ciStatus: 'none' });
    const toPending = makePR({ ciStatus: 'pending' });
    const toSuccess = makePR({ ciStatus: 'success' });
    const prev = new Map([[before.id, snap(before)]]);
    expect(computeNotifications(prev, [toPending])).toEqual([]);
    expect(computeNotifications(prev, [toSuccess])).toEqual([]);
  });

  it('does not re-fire ci-fail when already failing', () => {
    const before = makePR({ ciStatus: 'failure' });
    const after = makePR({ ciStatus: 'failure' });
    const prev = new Map([[before.id, snap(before)]]);
    expect(computeNotifications(prev, [after])).toEqual([]);
  });

  it('fires merged when isMerged flips true', () => {
    const before = makePR({ isMerged: false });
    const after = makePR({ isMerged: true });
    const prev = new Map([[before.id, snap(before)]]);
    expect(computeNotifications(prev, [after]).map((e) => e.kind)).toEqual([
      'merged',
    ]);
  });

  it('fires approved and changes on approvalState transitions', () => {
    const before = makePR({ approvalState: 'pending' });
    const approved = makePR({ approvalState: 'approved' });
    const changes = makePR({ approvalState: 'changes' });
    const prev = new Map([[before.id, snap(before)]]);
    expect(computeNotifications(prev, [approved]).map((e) => e.kind)).toEqual([
      'approved',
    ]);
    expect(computeNotifications(prev, [changes]).map((e) => e.kind)).toEqual([
      'changes',
    ]);
  });

  it('emits multiple events for a PR with multiple simultaneous changes', () => {
    const before = makePR({ commentCount: 0, ciStatus: 'pending' });
    const after = makePR({ commentCount: 2, ciStatus: 'failure' });
    const prev = new Map([[before.id, snap(before)]]);
    const kinds = computeNotifications(prev, [after]).map((e) => e.kind);
    expect(kinds).toEqual(['comment', 'ci-fail']);
  });
});

describe('snapshotAuthored', () => {
  it('keeps only authored PRs', () => {
    const mine = makePR({ id: 'mine', viewerIsAuthor: true });
    const theirs = makePR({ id: 'theirs', viewerIsAuthor: false });
    const result = snapshotAuthored([mine, theirs]);
    expect([...result.keys()]).toEqual(['mine']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/notifications.test.ts`
Expected: FAIL — cannot resolve `./notifications` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/notifications.ts`:

```ts
import type { ApprovalState, CIStatus, DashboardPR } from '../types/dashboard';

export type NotificationKind =
  | 'comment'
  | 'ci-fail'
  | 'merged'
  | 'approved'
  | 'changes';

/** The slice of a PR we diff between consecutive polls. */
export interface PRSnapshot {
  commentCount: number;
  ciStatus: CIStatus;
  approvalState: ApprovalState;
  isMerged: boolean;
}

export interface NotificationEvent {
  prId: string;
  prNumber: number;
  repoNameWithOwner: string;
  title: string;
  url: string;
  kind: NotificationKind;
}

function snapshotPR(pr: DashboardPR): PRSnapshot {
  return {
    commentCount: pr.commentCount,
    ciStatus: pr.ciStatus,
    approvalState: pr.approvalState,
    isMerged: pr.isMerged,
  };
}

/**
 * Snapshot only the PRs the viewer authored — the only PRs notifications
 * fire for. Keyed by PR id.
 */
export function snapshotAuthored(prs: DashboardPR[]): Map<string, PRSnapshot> {
  const out = new Map<string, PRSnapshot>();
  for (const pr of prs) {
    if (pr.viewerIsAuthor) out.set(pr.id, snapshotPR(pr));
  }
  return out;
}

/**
 * Diff the previous per-poll snapshot against the current PRs and return
 * the notification events that should fire. Pure — fires nothing itself.
 *
 * Rules (all scoped to viewer-authored PRs):
 * - comment: commentCount increased
 * - ci-fail: ciStatus transitioned *into* 'failure' (success/pending never fire)
 * - merged:  isMerged flipped false -> true
 * - approved/changes: approvalState transitioned into that state
 *
 * A PR absent from `prev` (first time seen) yields no events, so the first
 * poll after load is silent.
 */
export function computeNotifications(
  prev: Map<string, PRSnapshot>,
  next: DashboardPR[]
): NotificationEvent[] {
  const events: NotificationEvent[] = [];
  for (const pr of next) {
    if (!pr.viewerIsAuthor) continue;
    const before = prev.get(pr.id);
    if (!before) continue;

    const base = {
      prId: pr.id,
      prNumber: pr.number,
      repoNameWithOwner: pr.repoNameWithOwner,
      title: pr.title,
      url: pr.url,
    };

    if (pr.commentCount > before.commentCount) {
      events.push({ ...base, kind: 'comment' });
    }
    if (pr.ciStatus === 'failure' && before.ciStatus !== 'failure') {
      events.push({ ...base, kind: 'ci-fail' });
    }
    if (pr.isMerged && !before.isMerged) {
      events.push({ ...base, kind: 'merged' });
    }
    if (pr.approvalState === 'approved' && before.approvalState !== 'approved') {
      events.push({ ...base, kind: 'approved' });
    }
    if (pr.approvalState === 'changes' && before.approvalState !== 'changes') {
      events.push({ ...base, kind: 'changes' });
    }
  }
  return events;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/lib/notifications.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications.ts src/lib/notifications.test.ts
git commit -m "Add pure computeNotifications diff over authored PRs"
```

---

## Task 4: The useDesktopNotifications hook

**Files:**
- Create: `src/hooks/useDesktopNotifications.ts`

> Not unit-tested: it is a thin wrapper around the (tested) `computeNotifications` plus the browser `Notification` side effect, which has no jsdom equivalent. This matches the spec's no-UI-tests stance.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useDesktopNotifications.ts`:

```ts
import { useEffect, useRef } from 'react';
import type { DashboardPR } from '../types/dashboard';
import {
  computeNotifications,
  snapshotAuthored,
  type NotificationEvent,
  type NotificationKind,
  type PRSnapshot,
} from '../lib/notifications';

const TITLE: Record<NotificationKind, (n: number) => string> = {
  comment: (n) => `New comment on #${n}`,
  'ci-fail': (n) => `Checks failed on #${n}`,
  merged: (n) => `#${n} merged`,
  approved: (n) => `#${n} approved`,
  changes: (n) => `Changes requested on #${n}`,
};

function fire(
  events: NotificationEvent[],
  onOpenPR: (prId: string) => void
): void {
  if (events.length === 0) return;

  // Avoid a flood: collapse a busy poll into one summary toast.
  if (events.length > 3) {
    const n = new Notification(`${events.length} updates across your PRs`, {
      body: 'Open Perch to review.',
      tag: 'perch-summary',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return;
  }

  for (const event of events) {
    const n = new Notification(TITLE[event.kind](event.prNumber), {
      body: `${event.repoNameWithOwner} · ${event.title}`,
      tag: event.prId, // later events on the same PR replace, not stack
    });
    n.onclick = () => {
      window.focus();
      onOpenPR(event.prId);
      n.close();
    };
  }
}

/**
 * Fires desktop notifications for activity on the viewer's own PRs.
 *
 * Holds the previous poll's snapshot in a ref (in-memory, resets on
 * reload — distinct from the localStorage "since last visit" baseline).
 * The snapshot advances on every render regardless of `enabled`, so
 * turning notifications on mid-session never back-fires a backlog. The
 * first run only seeds the snapshot.
 */
export function useDesktopNotifications(
  prs: DashboardPR[],
  enabled: boolean,
  onOpenPR: (prId: string) => void
): void {
  const snapshotRef = useRef<Map<string, PRSnapshot> | null>(null);
  const onOpenRef = useRef(onOpenPR);
  onOpenRef.current = onOpenPR;

  useEffect(() => {
    const prev = snapshotRef.current;
    const nextSnapshot = snapshotAuthored(prs);

    if (prev === null) {
      // First run: seed silently.
      snapshotRef.current = nextSnapshot;
      return;
    }

    if (
      enabled &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      fire(computeNotifications(prev, prs), onOpenRef.current);
    }

    snapshotRef.current = nextSnapshot;
  }, [prs, enabled]);
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDesktopNotifications.ts
git commit -m "Add useDesktopNotifications hook firing on poll diffs"
```

---

## Task 5: Background polling when notifications are on

**Files:**
- Modify: `src/hooks/usePRs.ts`

- [ ] **Step 1: Add the arg to the Args interface**

In `src/hooks/usePRs.ts`, add to `interface Args`:

```ts
  notificationsEnabled?: boolean;
```

- [ ] **Step 2: Destructure it and pass it to the query**

Change the function signature destructuring to include the new arg with a default:

```ts
export function usePRs({
  token,
  scope,
  orgs,
  notificationsEnabled = false,
}: Args): UseQueryResult<DashboardData, Error> {
```

Then, in the `useQuery` options, add `refetchIntervalInBackground` right after `refetchInterval: 60_000,`:

```ts
    refetchInterval: 60_000,
    refetchIntervalInBackground: notificationsEnabled,
```

- [ ] **Step 3: Verify it typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePRs.ts
git commit -m "Poll in background when notifications are enabled"
```

---

## Task 6: Wire notifications into the Dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Import the hook**

In `src/components/Dashboard.tsx`, add after the other hook imports (e.g. after the `useTitleAndFavicon` import):

```ts
import { useDesktopNotifications } from '../hooks/useDesktopNotifications';
```

- [ ] **Step 2: Read the preference and pass it to usePRs**

Add a store read near the other `useUIStore` reads at the top of `Dashboard`:

```ts
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
```

Change the `usePRs` call to thread the flag:

```ts
  const query = usePRs({ token, scope, orgs, notificationsEnabled });
```

- [ ] **Step 3: Define the open-PR callback and call the hook**

Below the existing `onRefresh` callback (around the `useKeyboardNav` call), add an open-PR callback and the notifications hook. Use `query.data?.prs` (the full set, not the search-filtered list) so notifications are independent of the active filter:

```ts
  const openPR = useCallback(
    (id: string) => {
      setSelectedPRId(id);
      setDetailOpen(true);
    },
    [setSelectedPRId, setDetailOpen]
  );

  useDesktopNotifications(query.data?.prs ?? [], notificationsEnabled, openPR);
```

- [ ] **Step 4: Verify it builds and typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "Wire desktop notifications into the dashboard"
```

---

## Task 7: Settings UI — Notifications group

**Files:**
- Modify: `src/components/Settings.tsx`

- [ ] **Step 1: Read the preference from the store**

In `src/components/Settings.tsx`, add to the block of `useUIStore` reads at the top of the `Settings` component (after `setOrgs`):

```ts
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useUIStore((s) => s.setNotificationsEnabled);
```

- [ ] **Step 2: Track permission state and add enable/disable handlers**

Add this state and these handlers inside the component, after the existing `orgsInput` state declaration (`const [orgsInput, setOrgsInput] = useState(...)`):

```ts
  const notifSupported = typeof Notification !== 'undefined';
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(notifSupported ? Notification.permission : 'unsupported');

  async function enableNotifications() {
    if (!notifSupported) return;
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      return;
    }
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    setNotificationsEnabled(result === 'granted');
  }
```

- [ ] **Step 3: Render the Notifications group**

Add this new `Group` immediately after the closing `</Group>` of the "Appearance" group (and before the "GitHub token" group):

```tsx
          <Group title="Notifications">
            <Row
              label="Desktop notifications"
              meta={
                notifPermission === 'unsupported'
                  ? 'Not supported in this browser'
                  : notifPermission === 'denied'
                    ? 'Blocked in your browser — re-enable in site settings'
                    : 'Alerts for activity on your PRs: new comments, failed checks, merges, and reviews'
              }
            >
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  padding: 3,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line-1)',
                  borderRadius: 6,
                  opacity:
                    notifPermission === 'unsupported' ||
                    notifPermission === 'denied'
                      ? 0.5
                      : 1,
                }}
              >
                <SegBtn
                  active={!notificationsEnabled}
                  onClick={() => setNotificationsEnabled(false)}
                >
                  Off
                </SegBtn>
                <SegBtn
                  active={notificationsEnabled}
                  onClick={() => {
                    if (
                      notifPermission === 'unsupported' ||
                      notifPermission === 'denied'
                    ) {
                      return;
                    }
                    void enableNotifications();
                  }}
                >
                  On
                </SegBtn>
              </div>
            </Row>
          </Group>
```

- [ ] **Step 4: Verify it typechecks and builds**

Run: `bun run typecheck && bun run build`
Expected: both PASS (build writes to `dist/`).

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings.tsx
git commit -m "Add Notifications toggle to Settings with permission flow"
```

---

## Task 8: Document the boundary in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a bullet under "Things that regularly bite"**

In `CLAUDE.md`, add this bullet to the end of the "Things that regularly bite" list:

```markdown
- **Desktop notifications are tab-bound, not push.** `useDesktopNotifications`
  fires `Notification`s by diffing a per-poll in-memory snapshot of the
  viewer's *authored* PRs (new comment, CI failure, merge, approval/changes).
  It needs the tab open — there is no service worker or Push API (that would
  need a backend, which the client-only boundary forbids). Notifications also
  flip `refetchIntervalInBackground` on in `usePRs`, so the 60s poll keeps
  running in a hidden tab only while the preference is on. The preference
  (`perch.notifications`, default off) is separate from the browser's
  `Notification.permission`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the client-only notification boundary"
```

---

## Final verification

- [ ] **Step 1: Full test + typecheck + build green**

Run: `bun test && bun run typecheck && bun run build`
Expected: all PASS.

- [ ] **Step 2: Manual smoke (optional, requires a browser)**

Run `bun dev`, open Settings → Notifications → On, accept the browser permission prompt. Confirm the toggle reflects On. (Live firing depends on real PR activity arriving on a poll; it cannot be reliably forced in a smoke test.)
