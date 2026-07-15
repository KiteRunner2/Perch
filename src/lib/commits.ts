import { format, isSameDay } from 'date-fns';
import type {
  CommitDateGroup,
  CommitSortOrder,
  PRCommit,
  PRCommitsResult,
} from '../types/commits';
import { createClient } from './github';
import { avatarKey } from './transform';

export const PR_COMMITS_QUERY = /* GraphQL */ `
  query PRCommits($pullRequestId: ID!) {
    node(id: $pullRequestId) {
      ... on PullRequest {
        commits(last: 100) {
          totalCount
          nodes {
            commit {
              oid
              url
              messageHeadline
              messageBody
              authoredDate
              author {
                name
                user {
                  login
                  avatarUrl
                }
              }
            }
          }
        }
      }
    }
  }
`;

export interface GqlPRCommitNode {
  commit: {
    oid: string;
    url: string;
    messageHeadline: string;
    messageBody: string;
    authoredDate: string;
    author: {
      name: string | null;
      user: { login: string; avatarUrl: string } | null;
    } | null;
  };
}

interface GqlPRCommitsResponse {
  node: {
    commits: {
      totalCount: number;
      nodes: GqlPRCommitNode[];
    };
  } | null;
}

export function transformCommitNode(node: GqlPRCommitNode): PRCommit {
  const raw = node.commit;
  const login = raw.author?.user?.login?.trim() || null;
  const rawName = raw.author?.name?.trim() || '';
  const name = rawName || login || 'Unknown author';
  const headline = raw.messageHeadline.trim() || '(No commit message)';

  return {
    sha: raw.oid,
    url: raw.url,
    headline,
    body: raw.messageBody.trim(),
    authoredAt: raw.authoredDate,
    author: {
      name,
      login,
      ...(raw.author?.user?.avatarUrl
        ? { avatarUrl: raw.author.user.avatarUrl }
        : {}),
      av: avatarKey(login ?? name),
    },
  };
}

export function transformCommitResult(
  nodes: GqlPRCommitNode[],
  totalCount: number
): PRCommitsResult {
  const commits = nodes.map(transformCommitNode);
  return {
    commits,
    totalCount,
    truncated: totalCount > commits.length,
  };
}

/** Return a new ordered array without mutating react-query's cached data. */
export function orderCommits(
  commits: PRCommit[],
  order: CommitSortOrder
): PRCommit[] {
  return order === 'newest' ? [...commits].reverse() : [...commits];
}

/** Group consecutive commits by their authored date in the viewer's timezone. */
export function groupCommitsByLocalDay(
  commits: PRCommit[],
  now: Date = new Date()
): CommitDateGroup[] {
  const groups: CommitDateGroup[] = [];

  for (const commit of commits) {
    const date = new Date(commit.authoredAt);
    const valid = !Number.isNaN(date.getTime());
    const key = valid ? format(date, 'yyyy-MM-dd') : 'unknown';
    const label = valid
      ? isSameDay(date, now)
        ? 'Today'
        : format(date, 'MMM d, yyyy')
      : 'Unknown date';
    const current = groups.at(-1);

    if (current?.key === key) current.commits.push(commit);
    else groups.push({ key, label, commits: [commit] });
  }

  return groups;
}

export async function fetchPRCommits(
  token: string,
  pullRequestId: string
): Promise<PRCommitsResult> {
  const client = createClient(token);
  const data = await client.request<GqlPRCommitsResponse>(PR_COMMITS_QUERY, {
    pullRequestId,
  });
  if (!data.node) throw new Error('Pull request not found');
  return transformCommitResult(data.node.commits.nodes, data.node.commits.totalCount);
}
