# Desktop notifications — design

Date: 2026-06-11

## Goal

Add browser desktop notifications to Perch so the user is alerted to
activity on **their own** pull requests without keeping the tab in the
foreground. The feature is opt-in and **defaults to off**.

## Scope

Notifications fire for four events, all scoped to PRs the viewer
authored (`viewerIsAuthor === true`):

| Event       | Trigger (transition between consecutive polls)          |
|-------------|---------------------------------------------------------|
| New comment | `commentCount` increased vs. previous snapshot          |
| Pipeline    | `ciStatus` changed *into* `failure`                     |
| Merged      | `isMerged` flipped `false → true`                       |
| Review      | `approvalState` changed *into* `approved` or `changes`  |

Pipeline fires on **failure only** — a passing run is not surfaced. All
events require the PR to be authored by the viewer — comments included.

### Out of scope

- Notifications for PRs the viewer only reviews / was requested on.
- Notifications for "new PR appeared" (covered by the existing new-row
  dot + favicon badge).
- Any server-side push. This stays client-only; notifications are fired
  by the running tab via the Web Notifications API. If the tab is fully
  closed, nothing fires (no service worker / Push API — that would need
  a backend and is explicitly out of scope per the client-only boundary
  in CLAUDE.md).

## Detection model

A pure function plus a thin hook:

- **`computeNotifications(prev, next)`** — `src/lib/notifications.ts`.
  Pure. Takes the previous snapshot (`Map<prId, PRSnapshot>`) and the
  current `DashboardPR[]`, returns `NotificationEvent[]`. A
  `PRSnapshot` holds `{ commentCount, ciStatus, approvalState,
  isMerged }`. Only PRs present in `prev` are diffed — a PR absent from
  the previous snapshot (first time seen) produces no event, so the
  first poll after load is silent. Only `viewerIsAuthor` PRs are
  considered.
- **`useDesktopNotifications(prs, enabled)`** — `src/hooks/`. Holds the
  snapshot in a ref. On each `prs` change: if `enabled` and permission
  is `granted`, calls `computeNotifications`, fires the resulting
  events, then replaces the snapshot ref. When `enabled` is false it
  still advances the snapshot (so toggling on mid-session doesn't
  back-fire a backlog) but fires nothing. The very first run only seeds
  the snapshot.

This is intentionally distinct from `useNewPRs` / `useNewComments`,
which use the `localStorage` "since last visit" baseline. Notifications
are about transitions **between consecutive polls while the app runs**,
not since-last-visit, so they use an in-memory ref baseline that resets
on reload.

### NotificationEvent shape

```ts
type NotificationKind = 'comment' | 'ci-fail' | 'merged'
  | 'approved' | 'changes';

interface NotificationEvent {
  prId: string;
  prNumber: number;
  repoNameWithOwner: string;
  title: string;       // PR title
  url: string;
  kind: NotificationKind;
}
```

The hook maps each kind to notification copy, e.g.:

- `comment`  → "New comment on #123" / `repo · PR title`
- `ci-fail`  → "Checks failed on #123"
- `merged`   → "#123 merged"
- `approved` → "#123 approved"
- `changes`  → "Changes requested on #123"

## Firing, dedupe, flooding

- Each `Notification` uses `tag: prId` so a later event on the same PR
  replaces the previous toast rather than stacking.
- If a single poll yields **more than 3** events, collapse to one
  summary notification ("N updates across your PRs", tag `perch-summary`)
  instead of firing each individually.
- `onclick` of a notification: `window.focus()` then route to the PR —
  select it and open the detail drawer. The hook receives an
  `onOpenPR(prId)` callback from `Dashboard` that does
  `setSelectedPRId(id)` + `setDetailOpen(true)`. The summary
  notification just focuses the window.

## Preference vs. permission

Two separate concepts:

1. **Stored preference** `notifications: boolean`, default `false`.
   Added to `src/lib/storage.ts` (key `perch.notifications`) and the
   zustand store (`notificationsEnabled` + `setNotificationsEnabled`),
   mirroring how `theme` / `scope` are persisted.
2. **Browser permission** `Notification.permission` (`default` /
   `granted` / `denied`), owned by the browser.

Flipping the toggle **on** calls `Notification.requestPermission()`:

- resolves `granted` → preference saved as `true`.
- resolves `denied` → preference stays `false`; the toggle shows a
  "Blocked in your browser" hint (the browser won't re-prompt, so the
  user must re-enable in site settings).

If `Notification` is undefined (unsupported browser), the toggle is
disabled with a "Not supported" hint.

## Settings UI

A new `Group title="Notifications"` in `src/components/Settings.tsx`,
using the existing `Row` + `SegBtn` pattern:

- Row "Desktop notifications", meta describing the four events and the
  your-PRs-only scope.
- On/Off `SegBtn` pair. The Off→On click runs the permission request.
- When permission is `denied` or unsupported, render the hint text in
  the row meta and keep the control reflecting the real (off) state.

## Background polling

`usePRs` gains a `notificationsEnabled?: boolean` arg. When true it
passes `refetchIntervalInBackground: true` to the query so the 60s poll
continues while the tab is hidden — without this, the current default
(`false`) pauses polling on blur and notifications would almost never
fire. When the preference is off, the query keeps today's behavior, so
we don't spend extra rate-limit budget for users who don't want
notifications. `Dashboard` reads `notificationsEnabled` from the store
and threads it into both `usePRs` and `useDesktopNotifications`.

## Data flow

```
usePRs(notificationsEnabled)        store.notificationsEnabled
        │ prs                                  │
        ▼                                      ▼
Dashboard ──prs, enabled──► useDesktopNotifications
        │                          │ computeNotifications(prevRef, prs)
        │                          ▼
        │                   new Notification(...) per event
        └──onOpenPR(id)◄────onclick
```

## Testing

- `src/lib/notifications.test.ts` covers `computeNotifications`:
  - first poll (empty prev) fires nothing;
  - each transition fires exactly the right kind;
  - non-author PRs are ignored;
  - no event when fields are unchanged;
  - `ciStatus` → `pending` or `→ success` does not fire;
  - a PR with multiple simultaneous changes yields multiple events.
- The hook and the `Notification` side effect are not unit-tested,
  consistent with the spec's "no UI/integration tests" stance. Browser
  `Notification` has no jsdom equivalent worth mocking for value.

## Files touched

- `src/lib/storage.ts` — `getNotifications` / `setNotifications`.
- `src/store.ts` — `notificationsEnabled` state + setter.
- `src/lib/notifications.ts` — `computeNotifications` + types (new).
- `src/lib/notifications.test.ts` — unit tests (new).
- `src/hooks/useDesktopNotifications.ts` — hook (new).
- `src/hooks/usePRs.ts` — `notificationsEnabled` arg →
  `refetchIntervalInBackground`.
- `src/components/Settings.tsx` — Notifications group.
- `src/components/Dashboard.tsx` — wire store → usePRs +
  useDesktopNotifications with `onOpenPR`.
- `CLAUDE.md` — note the client-only notification boundary (no push /
  service worker) under "Things that regularly bite".
