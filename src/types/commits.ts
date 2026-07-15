/** Display order for the Commits tab. */
export type CommitSortOrder = 'oldest' | 'newest';

export interface CommitAuthor {
  /** Raw Git author name, or the linked login when no name is available. */
  name: string;
  /** GitHub login when the commit author is linked to an account. */
  login: string | null;
  avatarUrl?: string;
  /** Deterministic avatar gradient key, matching the dashboard palette. */
  av: string;
}

/** Domain model for one commit in a pull request. */
export interface PRCommit {
  sha: string;
  url: string;
  headline: string;
  body: string;
  authoredAt: string;
  author: CommitAuthor;
}

export interface PRCommitsResult {
  /** Latest commits in GitHub's source order (oldest to newest). */
  commits: PRCommit[];
  totalCount: number;
  truncated: boolean;
}

export interface CommitDateGroup {
  key: string;
  label: string;
  commits: PRCommit[];
}
