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
