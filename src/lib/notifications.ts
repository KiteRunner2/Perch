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
