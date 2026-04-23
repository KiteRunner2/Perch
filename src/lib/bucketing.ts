import type { Bucket, BucketId, DashboardPR } from '../types/dashboard';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Has the viewer directly interacted with this PR (author, requested, reviewed)? */
function viewerInvolved(pr: DashboardPR): boolean {
  return (
    pr.viewerIsAuthor ||
    pr.viewerIsRequestedReviewer ||
    pr.viewerReviewState !== 'none'
  );
}

/**
 * Assign a bucket to a PR. Rules are evaluated in priority order;
 * first match wins. See instructions.md for the spec.
 */
export function bucketOf(pr: DashboardPR): BucketId {
  // 1. Waiting on me: viewer is a requested reviewer and hasn't acted.
  if (pr.viewerIsRequestedReviewer && !pr.viewerIsAuthor) {
    const acted =
      pr.viewerReviewState === 'approved' ||
      pr.viewerReviewState === 'changes';
    if (!acted) return 'waiting';
  }

  if (pr.viewerIsAuthor) {
    // 2. Blocked: author sees CHANGES_REQUESTED or failing CI.
    if (pr.approvalState === 'changes' || pr.ciStatus === 'failure') {
      return 'blocked';
    }

    // 3. Ready to merge: approved + green + mergeable + not draft.
    //    (approvalState 'changes' already short-circuited above.)
    if (
      pr.approvalCount >= 1 &&
      pr.ciStatus === 'success' &&
      pr.mergeable === 'MERGEABLE' &&
      !pr.isDraft
    ) {
      return 'ready';
    }

    // 4. In review: any viewer-authored PR that isn't blocked or ready.
    if (pr.waitingTimeMs < SEVEN_DAYS_MS) {
      return 'inreview';
    }
  }

  // 5. Stale: viewer-involved PR not updated in 7+ days.
  if (viewerInvolved(pr) && pr.waitingTimeMs >= SEVEN_DAYS_MS) {
    return 'stale';
  }

  // 6. Team: broader-scope PRs where viewer has no direct relation.
  if (!viewerInvolved(pr)) {
    return 'team';
  }

  return 'other';
}

export interface BucketPlan {
  id: BucketId;
  title: string;
  color: string;
}

export const BUCKET_PLAN: BucketPlan[] = [
  { id: 'waiting', title: 'Waiting on me', color: 'var(--bucket-primary)' },
  { id: 'ready', title: 'Ready to merge', color: 'var(--bucket-merge)' },
  { id: 'blocked', title: 'Blocked', color: 'var(--bucket-block)' },
  { id: 'inreview', title: 'In review', color: 'var(--bucket-review)' },
  { id: 'stale', title: 'Stale', color: 'var(--bucket-stale)' },
  { id: 'team', title: 'Team', color: 'var(--info)' },
  { id: 'other', title: 'Other', color: 'var(--fg-3)' },
];

const BUCKET_ORDER: Record<BucketId, number> = {
  waiting: 0,
  ready: 1,
  blocked: 2,
  inreview: 3,
  stale: 4,
  team: 5,
  other: 6,
};

function sortPRs(a: DashboardPR, b: DashboardPR): number {
  // Escalated (waiting >24h) first, then oldest updatedAt first within a bucket.
  if (a.escalate !== b.escalate) return a.escalate ? -1 : 1;
  return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
}

/** Bucket a list of PRs, returning an ordered array of buckets (empty ones kept). */
export function bucketize(prs: DashboardPR[]): Bucket[] {
  const groups = new Map<BucketId, DashboardPR[]>();
  for (const plan of BUCKET_PLAN) groups.set(plan.id, []);

  for (const pr of prs) {
    const id = bucketOf(pr);
    groups.get(id)!.push(pr);
  }

  const out: Bucket[] = [];
  for (const plan of BUCKET_PLAN) {
    const items = groups.get(plan.id)!;
    items.sort(sortPRs);
    out.push({
      id: plan.id,
      title: plan.title,
      color: plan.color,
      items,
      meta: bucketMeta(plan.id, items),
    });
  }
  out.sort((a, b) => BUCKET_ORDER[a.id] - BUCKET_ORDER[b.id]);
  return out;
}

function bucketMeta(id: BucketId, items: DashboardPR[]): string | undefined {
  if (id === 'waiting') {
    const over24 = items.filter((p) => p.escalate).length;
    return over24 > 0 ? `${over24} over 24h` : undefined;
  }
  if (id === 'ready' && items.length > 0) return 'Safe to merge';
  if (id === 'stale' && items.length > 0) return '7+ days';
  if (id === 'team' && items.length > 0) return 'From tracked orgs';
  return undefined;
}
