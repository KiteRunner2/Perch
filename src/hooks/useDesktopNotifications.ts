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
      // No single PR to open for a summary — just surface the tab.
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
  viewerLogin: string | null,
  onOpenPR: (prId: string) => void
): void {
  const snapshotRef = useRef<Map<string, PRSnapshot> | null>(null);
  const onOpenRef = useRef(onOpenPR);
  onOpenRef.current = onOpenPR;

  useEffect(() => {
    const prev = snapshotRef.current;
    const nextSnapshot = snapshotAuthored(prs, viewerLogin);

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
      fire(computeNotifications(prev, prs, viewerLogin), onOpenRef.current);
    }

    snapshotRef.current = nextSnapshot;
  }, [prs, enabled, viewerLogin]);
}
