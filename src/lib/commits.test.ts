import { describe, expect, it } from 'vitest';
import type { PRCommit } from '../types/commits';
import {
  groupCommitsByLocalDay,
  orderCommits,
  transformCommitNode,
  transformCommitResult,
  type GqlPRCommitNode,
} from './commits';

function makeNode(
  overrides: Partial<GqlPRCommitNode['commit']> = {}
): GqlPRCommitNode {
  return {
    commit: {
      oid: '0123456789abcdef',
      url: 'https://github.com/example/repo/commit/0123456789abcdef',
      messageHeadline: 'Ship the feature',
      messageBody: 'Explain why the feature exists.',
      authoredDate: '2026-07-15T16:00:00Z',
      author: {
        name: 'Alice Example',
        user: { login: 'alice', avatarUrl: 'https://example.com/alice.png' },
      },
      ...overrides,
    },
  };
}

function makeCommit(sha: string, authoredAt: string): PRCommit {
  return {
    sha,
    url: `https://example.com/${sha}`,
    headline: sha,
    body: '',
    authoredAt,
    author: { name: 'Alice', login: 'alice', av: 'a' },
  };
}

describe('commit transformation', () => {
  it('keeps linked account identity and the full message fields', () => {
    const commit = transformCommitNode(makeNode());

    expect(commit).toMatchObject({
      sha: '0123456789abcdef',
      headline: 'Ship the feature',
      body: 'Explain why the feature exists.',
      authoredAt: '2026-07-15T16:00:00Z',
      author: {
        name: 'Alice Example',
        login: 'alice',
        avatarUrl: 'https://example.com/alice.png',
      },
    });
  });

  it('uses the raw Git author when no GitHub user is linked', () => {
    const commit = transformCommitNode(
      makeNode({ author: { name: 'Patch Author', user: null } })
    );

    expect(commit.author).toMatchObject({ name: 'Patch Author', login: null });
  });

  it('falls back safely when author and headline are absent', () => {
    const commit = transformCommitNode(
      makeNode({ author: null, messageHeadline: '   ', messageBody: '  body  ' })
    );

    expect(commit.author).toMatchObject({ name: 'Unknown author', login: null });
    expect(commit.headline).toBe('(No commit message)');
    expect(commit.body).toBe('body');
  });

  it('preserves source order and marks a partial result as truncated', () => {
    const result = transformCommitResult(
      [makeNode({ oid: 'first' }), makeNode({ oid: 'second' })],
      120
    );

    expect(result.commits.map((commit) => commit.sha)).toEqual(['first', 'second']);
    expect(result).toMatchObject({ totalCount: 120, truncated: true });
  });
});

describe('commit ordering and grouping', () => {
  it('reverses a copy for newest-first without mutating cached data', () => {
    const source = [
      makeCommit('one', '2026-07-13T16:00:00Z'),
      makeCommit('two', '2026-07-14T16:00:00Z'),
      makeCommit('three', '2026-07-15T16:00:00Z'),
    ];

    expect(orderCommits(source, 'newest').map((commit) => commit.sha)).toEqual([
      'three',
      'two',
      'one',
    ]);
    expect(orderCommits(source, 'oldest').map((commit) => commit.sha)).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(source.map((commit) => commit.sha)).toEqual(['one', 'two', 'three']);
  });

  it('groups consecutive commits by local day in the selected order', () => {
    const now = new Date(2026, 6, 15, 18, 0, 0);
    const todayMorning = new Date(2026, 6, 15, 9, 0, 0).toISOString();
    const todayAfternoon = new Date(2026, 6, 15, 15, 0, 0).toISOString();
    const yesterday = new Date(2026, 6, 14, 15, 0, 0).toISOString();
    const commits = [
      makeCommit('old', yesterday),
      makeCommit('newer', todayMorning),
      makeCommit('newest', todayAfternoon),
    ];

    const groups = groupCommitsByLocalDay(orderCommits(commits, 'newest'), now);
    expect(groups.map((group) => group.label)).toEqual(['Today', 'Jul 14, 2026']);
    expect(groups[0]!.commits.map((commit) => commit.sha)).toEqual([
      'newest',
      'newer',
    ]);
    expect(groups[1]!.commits.map((commit) => commit.sha)).toEqual(['old']);
  });
});
