import { GraphQLClient } from 'graphql-request';
import type { GqlDashboardResponse } from '../types/github';

export const GITHUB_ENDPOINT = 'https://api.github.com/graphql';

export const DASHBOARD_QUERY = /* GraphQL */ `
  query PRDashboard($searchQuery: String!) {
    viewer {
      login
      avatarUrl
      pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes { ...PRFields }
      }
    }
    reviewRequested: search(query: $searchQuery, type: ISSUE, first: 50) {
      nodes {
        ... on PullRequest { ...PRFields }
      }
    }
    rateLimit {
      remaining
      resetAt
    }
  }

  fragment PRFields on PullRequest {
    id
    number
    title
    url
    isDraft
    mergeable
    updatedAt
    createdAt
    repository { nameWithOwner }
    author {
      login
      ... on User { avatarUrl }
    }
    assignees(first: 5) { nodes { login avatarUrl } }
    reviewRequests(first: 10) {
      nodes {
        requestedReviewer {
          __typename
          ... on User { login avatarUrl }
          ... on Team { name }
        }
      }
    }
    reviews(last: 20) {
      nodes {
        author {
          login
          ... on User { avatarUrl }
        }
        state
        submittedAt
      }
    }
    commits(last: 1) {
      nodes {
        commit {
          statusCheckRollup { state }
        }
      }
    }
    labels(first: 10) {
      nodes { name color }
    }
  }
`;

export const SEARCH_QUERY = 'is:open is:pr review-requested:@me archived:false';

export function createClient(token: string): GraphQLClient {
  return new GraphQLClient(GITHUB_ENDPOINT, {
    headers: {
      authorization: `Bearer ${token}`,
      'user-agent': 'perch-dashboard',
    },
  });
}

export async function testConnection(token: string): Promise<{ login: string }> {
  const client = createClient(token);
  const data = await client.request<{ viewer: { login: string } }>(
    'query { viewer { login } }'
  );
  return data.viewer;
}

export async function fetchDashboard(token: string): Promise<GqlDashboardResponse> {
  const client = createClient(token);
  return client.request<GqlDashboardResponse>(DASHBOARD_QUERY, {
    searchQuery: SEARCH_QUERY,
  });
}
