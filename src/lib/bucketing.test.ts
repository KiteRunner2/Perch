import { describe, expect, it } from 'vitest';
import { bucketOf, bucketize, isReadyToMerge } from './bucketing';
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
    updatedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    repoNameWithOwner: 'example/repo',
    author: { login: 'alice', av: 'a' },
    viewerIsAuthor: false,
    viewerIsRequestedReviewer: false,
    approvalCount: 0,
    reviewerCount: 0,
    approvalState: 'pending',
    viewerReviewState: 'none',
    ciStatus: 'none',
    labels: [],
    reviewers: [],
    waitingTimeMs: 60 * 60 * 1000,
    escalate: false,
    isMerged: false,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    commitCount: 1,
    commentCount: 0,
    headRefName: 'feature/example',
    baseRefName: 'main',
    timeline: [],
  };
  return { ...base, ...overrides };
}

describe('bucketOf', () => {
  it('places a PR waiting on me when viewer is requested and has not acted', () => {
    const pr = makePR({
      viewerIsRequestedReviewer: true,
      viewerReviewState: 'none',
    });
    expect(bucketOf(pr)).toBe('waiting');
  });

  it('does not place viewer-reviewed PR in waiting once approved', () => {
    const pr = makePR({
      viewerIsRequestedReviewer: true,
      viewerReviewState: 'approved',
    });
    expect(bucketOf(pr)).not.toBe('waiting');
  });

  it('treats a pending-state viewer review (not submitted) as still waiting', () => {
    const pr = makePR({
      viewerIsRequestedReviewer: true,
      viewerReviewState: 'pending',
    });
    expect(bucketOf(pr)).toBe('waiting');
  });

  it('blocks an authored PR with CHANGES_REQUESTED', () => {
    const pr = makePR({
      viewerIsAuthor: true,
      approvalState: 'changes',
      ciStatus: 'success',
    });
    expect(bucketOf(pr)).toBe('blocked');
  });

  it('blocks an authored PR with failing CI', () => {
    const pr = makePR({
      viewerIsAuthor: true,
      approvalState: 'pending',
      ciStatus: 'failure',
    });
    expect(bucketOf(pr)).toBe('blocked');
  });

  it('marks ready when approved, green CI, mergeable, and not draft', () => {
    const pr = makePR({
      viewerIsAuthor: true,
      approvalCount: 2,
      reviewerCount: 2,
      approvalState: 'approved',
      ciStatus: 'success',
      mergeable: 'MERGEABLE',
      isDraft: false,
    });
    expect(bucketOf(pr)).toBe('ready');
  });

  it('does not mark ready when draft', () => {
    const pr = makePR({
      viewerIsAuthor: true,
      approvalCount: 2,
      reviewerCount: 2,
      approvalState: 'approved',
      ciStatus: 'success',
      mergeable: 'MERGEABLE',
      isDraft: true,
      reviewers: [{ login: 'bob', av: 'b', state: 'approved' }],
    });
    expect(bucketOf(pr)).toBe('inreview');
  });

  it('marks inreview when authored PR has pending reviewers but is not blocked or ready', () => {
    const pr = makePR({
      viewerIsAuthor: true,
      ciStatus: 'success',
      approvalState: 'pending',
      reviewers: [{ login: 'bob', av: 'b', state: 'requested' }],
    });
    expect(bucketOf(pr)).toBe('inreview');
  });

  it('marks own old authored PR as stale', () => {
    const pr = makePR({
      viewerIsAuthor: true,
      waitingTimeMs: 10 * 24 * 60 * 60 * 1000,
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(bucketOf(pr)).toBe('stale');
  });

  it('team PRs (viewer uninvolved, fully reviewed) go to team bucket', () => {
    // Two reviewers so the needsreview rule doesn't claim it.
    const pr = makePR({
      viewerIsAuthor: false,
      viewerIsRequestedReviewer: false,
      viewerReviewState: 'none',
      reviewers: [
        { login: 'one', av: 'a', state: 'requested' },
        { login: 'two', av: 'b', state: 'requested' },
      ],
      waitingTimeMs: 60 * 60 * 1000,
    });
    expect(bucketOf(pr)).toBe('team');
  });

  it('old team PR still buckets as team, not stale', () => {
    const pr = makePR({
      viewerIsAuthor: false,
      viewerIsRequestedReviewer: false,
      viewerReviewState: 'none',
      reviewers: [
        { login: 'one', av: 'a', state: 'requested' },
        { login: 'two', av: 'b', state: 'requested' },
      ],
      waitingTimeMs: 14 * 24 * 60 * 60 * 1000,
    });
    expect(bucketOf(pr)).toBe('team');
  });

  it('teammate PR the viewer already approved still buckets as team', () => {
    const pr = makePR({
      viewerIsAuthor: false,
      viewerIsRequestedReviewer: true,
      viewerReviewState: 'approved',
    });
    expect(bucketOf(pr)).toBe('team');
  });

  it('teammate PR the viewer only commented on buckets as team', () => {
    const pr = makePR({
      viewerIsAuthor: false,
      viewerIsRequestedReviewer: false,
      viewerReviewState: 'commented',
    });
    expect(bucketOf(pr)).toBe('team');
  });

  describe('needsreview bucket', () => {
    it('routes a non-draft PR with 0 reviewers and no viewer involvement', () => {
      const pr = makePR({
        viewerIsAuthor: false,
        viewerIsRequestedReviewer: false,
        viewerReviewState: 'none',
        isDraft: false,
        reviewers: [],
      });
      expect(bucketOf(pr)).toBe('needsreview');
    });

    it('routes a PR with exactly 1 reviewer', () => {
      const pr = makePR({
        viewerIsAuthor: false,
        viewerIsRequestedReviewer: false,
        viewerReviewState: 'none',
        reviewers: [{ login: 'someone', av: 'a', state: 'requested' }],
      });
      expect(bucketOf(pr)).toBe('needsreview');
    });

    it('does not catch a PR with 2+ reviewers — those go to team', () => {
      const pr = makePR({
        viewerIsAuthor: false,
        viewerIsRequestedReviewer: false,
        viewerReviewState: 'none',
        reviewers: [
          { login: 'one', av: 'a', state: 'requested' },
          { login: 'two', av: 'b', state: 'requested' },
        ],
      });
      expect(bucketOf(pr)).toBe('team');
    });

    it('does not catch a draft PR', () => {
      const pr = makePR({
        viewerIsAuthor: false,
        viewerIsRequestedReviewer: false,
        viewerReviewState: 'none',
        isDraft: true,
        reviewers: [],
      });
      expect(bucketOf(pr)).toBe('team');
    });

    it('does not catch a PR the viewer was requested on (waiting wins)', () => {
      const pr = makePR({
        viewerIsAuthor: false,
        viewerIsRequestedReviewer: true,
        viewerReviewState: 'none',
        reviewers: [],
      });
      expect(bucketOf(pr)).toBe('waiting');
    });

    it('does not catch a PR the viewer already reviewed', () => {
      const pr = makePR({
        viewerIsAuthor: false,
        viewerIsRequestedReviewer: false,
        viewerReviewState: 'commented',
        reviewers: [],
      });
      expect(bucketOf(pr)).toBe('team');
    });
  });

  it('routes merged PRs to the merged bucket regardless of other signals', () => {
    const pr = makePR({
      isMerged: true,
      viewerIsAuthor: true,
      // Would normally be Blocked (changes requested, failing CI).
      approvalState: 'changes',
      ciStatus: 'failure',
    });
    expect(bucketOf(pr)).toBe('merged');
  });

  it('priority: waiting-on-me wins over blocked for a shared-author scenario', () => {
    // Viewer is author AND a requested reviewer (rare, but possible via GH team add).
    // Spec says: waiting-on-me is checked first, but only if not author.
    // We guard with !viewerIsAuthor, so author falls through to blocked logic.
    const pr = makePR({
      viewerIsAuthor: true,
      viewerIsRequestedReviewer: true,
      approvalState: 'changes',
    });
    expect(bucketOf(pr)).toBe('blocked');
  });
});

describe('isReadyToMerge', () => {
  const readyBase = {
    approvalCount: 2,
    reviewerCount: 2,
    approvalState: 'approved' as const,
    ciStatus: 'success' as const,
    mergeable: 'MERGEABLE' as const,
    isDraft: false,
  };

  it('returns true for an approved + green + mergeable open PR regardless of authorship', () => {
    expect(isReadyToMerge(makePR({ ...readyBase, viewerIsAuthor: true }))).toBe(
      true
    );
    // Teammate PR — not in `ready` bucket, but still ready to merge.
    expect(
      isReadyToMerge(makePR({ ...readyBase, viewerIsAuthor: false }))
    ).toBe(true);
  });

  it('returns false for draft, failing CI, changes requested, or merged PRs', () => {
    expect(isReadyToMerge(makePR({ ...readyBase, isDraft: true }))).toBe(false);
    expect(isReadyToMerge(makePR({ ...readyBase, ciStatus: 'failure' }))).toBe(
      false
    );
    expect(
      isReadyToMerge(makePR({ ...readyBase, approvalState: 'changes' }))
    ).toBe(false);
    expect(isReadyToMerge(makePR({ ...readyBase, isMerged: true }))).toBe(
      false
    );
    expect(
      isReadyToMerge(makePR({ ...readyBase, mergeable: 'CONFLICTING' }))
    ).toBe(false);
    expect(isReadyToMerge(makePR({ ...readyBase, approvalCount: 0 }))).toBe(
      false
    );
  });
});

describe('bucketize', () => {
  it('returns all buckets in canonical order with correct grouping', () => {
    const waiting = makePR({
      id: 'A',
      viewerIsRequestedReviewer: true,
    });
    const ready = makePR({
      id: 'B',
      viewerIsAuthor: true,
      approvalCount: 1,
      reviewerCount: 1,
      approvalState: 'approved',
      ciStatus: 'success',
      mergeable: 'MERGEABLE',
    });
    const blocked = makePR({
      id: 'C',
      viewerIsAuthor: true,
      ciStatus: 'failure',
    });
    const buckets = bucketize([waiting, ready, blocked]);
    expect(buckets.map((b) => b.id)).toEqual([
      'waiting',
      'ready',
      'blocked',
      'inreview',
      'stale',
      'needsreview',
      'team',
      'other',
      'merged',
    ]);
    expect(buckets[0]!.items.map((p) => p.id)).toEqual(['A']);
    expect(buckets[1]!.items.map((p) => p.id)).toEqual(['B']);
    expect(buckets[2]!.items.map((p) => p.id)).toEqual(['C']);
  });

  it('within waiting bucket, escalated PRs come first', () => {
    const hot = makePR({
      id: 'HOT',
      viewerIsRequestedReviewer: true,
      escalate: true,
      updatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    });
    const fresh = makePR({
      id: 'FRESH',
      viewerIsRequestedReviewer: true,
      escalate: false,
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    });
    const buckets = bucketize([fresh, hot]);
    const waiting = buckets.find((b) => b.id === 'waiting')!;
    expect(waiting.items.map((p) => p.id)).toEqual(['HOT', 'FRESH']);
    expect(waiting.meta).toBe('1 over 24h');
  });
});
