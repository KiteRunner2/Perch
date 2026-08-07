import { describe, expect, it } from 'vitest';
import {
  computeNotifications,
  snapshotAuthored,
  snapshotPR,
} from './notifications';
import type { DashboardPR, TimelineEvent } from '../types/dashboard';

const VIEWER = 'me';

/** A comment timeline event from `login` at `at` (ISO). */
function comment(login: string, at: string, id = `${login}-${at}`): TimelineEvent {
  return {
    id,
    kind: 'comment',
    author: { login, av: 'a' },
    at,
  };
}

function makePR(overrides: Partial<DashboardPR> = {}): DashboardPR {
  const now = Date.now();
  const base: DashboardPR = {
    id: 'PR_1',
    number: 1,
    title: 'Example PR',
    url: 'https://github.com/example/repo/pull/1',
    jiraTicketKey: null,
    isDraft: false,
    mergeable: 'MERGEABLE',
    updatedAt: new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
    repoNameWithOwner: 'example/repo',
    mergeMethod: 'MERGE',
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

describe('computeNotifications', () => {
  it('fires nothing when the PR was not in the previous snapshot', () => {
    const pr = makePR({ timeline: [comment('alice', '2026-01-01T00:00:00Z')] });
    expect(computeNotifications(new Map(), [pr], VIEWER)).toEqual([]);
  });

  it('ignores PRs the viewer did not author', () => {
    const before = makePR({ viewerIsAuthor: false, timeline: [] });
    const after = makePR({
      viewerIsAuthor: false,
      timeline: [comment('alice', '2026-01-01T00:00:00Z')],
    });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    expect(computeNotifications(prev, [after], VIEWER)).toEqual([]);
  });

  it('fires nothing when nothing changed', () => {
    const pr = makePR({
      ciStatus: 'success',
      timeline: [comment('alice', '2026-01-01T00:00:00Z')],
    });
    const prev = new Map([[pr.id, snapshotPR(pr, VIEWER)]]);
    expect(computeNotifications(prev, [pr], VIEWER)).toEqual([]);
  });

  it('fires a comment event when someone else comments', () => {
    const before = makePR({ timeline: [comment('alice', '2026-01-01T00:00:00Z')] });
    const after = makePR({
      timeline: [
        comment('alice', '2026-01-01T00:00:00Z'),
        comment('bob', '2026-01-02T00:00:00Z'),
      ],
    });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    const events = computeNotifications(prev, [after], VIEWER);
    expect(events.map((e) => e.kind)).toEqual(['comment']);
    expect(events[0]).toMatchObject({ prId: 'PR_1', prNumber: 1 });
  });

  it('does not fire a comment for the viewer\'s own comment', () => {
    const before = makePR({ timeline: [comment('alice', '2026-01-01T00:00:00Z')] });
    const after = makePR({
      timeline: [
        comment('alice', '2026-01-01T00:00:00Z'),
        comment(VIEWER, '2026-01-02T00:00:00Z'),
      ],
    });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    expect(computeNotifications(prev, [after], VIEWER)).toEqual([]);
  });

  it('still fires when a foreign comment lands after the viewer comments', () => {
    const before = makePR({
      timeline: [
        comment('alice', '2026-01-01T00:00:00Z'),
        comment(VIEWER, '2026-01-02T00:00:00Z'),
      ],
    });
    const after = makePR({
      timeline: [
        comment('alice', '2026-01-01T00:00:00Z'),
        comment(VIEWER, '2026-01-02T00:00:00Z'),
        comment('bob', '2026-01-03T00:00:00Z'),
      ],
    });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    expect(
      computeNotifications(prev, [after], VIEWER).map((e) => e.kind)
    ).toEqual(['comment']);
  });

  it('fires ci-fail only when ciStatus transitions into failure', () => {
    const before = makePR({ ciStatus: 'pending' });
    const after = makePR({ ciStatus: 'failure' });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    expect(
      computeNotifications(prev, [after], VIEWER).map((e) => e.kind)
    ).toEqual(['ci-fail']);
  });

  it('does not fire on ciStatus transitions into pending or success', () => {
    const before = makePR({ ciStatus: 'none' });
    const toPending = makePR({ ciStatus: 'pending' });
    const toSuccess = makePR({ ciStatus: 'success' });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    expect(computeNotifications(prev, [toPending], VIEWER)).toEqual([]);
    expect(computeNotifications(prev, [toSuccess], VIEWER)).toEqual([]);
  });

  it('does not re-fire ci-fail when already failing', () => {
    const before = makePR({ ciStatus: 'failure' });
    const after = makePR({ ciStatus: 'failure' });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    expect(computeNotifications(prev, [after], VIEWER)).toEqual([]);
  });

  it('fires merged when isMerged flips true', () => {
    const before = makePR({ isMerged: false });
    const after = makePR({ isMerged: true });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    expect(
      computeNotifications(prev, [after], VIEWER).map((e) => e.kind)
    ).toEqual(['merged']);
  });

  it('fires approved and changes on approvalState transitions', () => {
    const before = makePR({ approvalState: 'pending' });
    const approved = makePR({ approvalState: 'approved' });
    const changes = makePR({ approvalState: 'changes' });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    expect(
      computeNotifications(prev, [approved], VIEWER).map((e) => e.kind)
    ).toEqual(['approved']);
    expect(
      computeNotifications(prev, [changes], VIEWER).map((e) => e.kind)
    ).toEqual(['changes']);
  });

  it('emits multiple events for a PR with multiple simultaneous changes', () => {
    const before = makePR({ ciStatus: 'pending', timeline: [] });
    const after = makePR({
      ciStatus: 'failure',
      timeline: [comment('alice', '2026-01-01T00:00:00Z')],
    });
    const prev = new Map([[before.id, snapshotPR(before, VIEWER)]]);
    const kinds = computeNotifications(prev, [after], VIEWER).map((e) => e.kind);
    expect(kinds).toEqual(['comment', 'ci-fail']);
  });
});

describe('snapshotAuthored', () => {
  it('keeps only authored PRs', () => {
    const mine = makePR({ id: 'mine', viewerIsAuthor: true });
    const theirs = makePR({ id: 'theirs', viewerIsAuthor: false });
    const result = snapshotAuthored([mine, theirs], VIEWER);
    expect([...result.keys()]).toEqual(['mine']);
  });
});
