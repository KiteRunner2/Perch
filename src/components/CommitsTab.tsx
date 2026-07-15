import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  RotateCw,
} from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import type { DashboardPR, DashboardUser } from '../types/dashboard';
import type { CommitSortOrder, PRCommit } from '../types/commits';
import { groupCommitsByLocalDay, orderCommits } from '../lib/commits';
import { redactToken } from '../lib/storage';
import { usePRCommits } from '../hooks/usePRCommits';
import { useUIStore } from '../store';
import { Avatar } from './primitives';

interface Props {
  pr: DashboardPR;
  active: boolean;
}

/** Compact, read-only history of the latest commits on a pull request. */
export function CommitsTab({ pr, active }: Props): JSX.Element {
  const token = useUIStore((s) => s.token);
  const sortOrder = useUIStore((s) => s.commitSortOrder);
  const setSortOrder = useUIStore((s) => s.setCommitSortOrder);
  const [expandedSha, setExpandedSha] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const query = usePRCommits({
    token,
    pullRequestId: pr.id,
    headSha: pr.headSha,
    enabled: active,
  });

  useEffect(() => {
    setExpandedSha(null);
    setCopiedSha(null);
  }, [pr.id]);

  if (!active) return <div />;

  if (query.isLoading) {
    return <CommitStatus>Loading commits…</CommitStatus>;
  }

  if (query.isError) {
    let message = String(query.error?.message ?? 'Unknown error');
    if (token) message = message.split(token).join(redactToken(token));
    return (
      <CommitStatus tone="err">
        <div>Couldn't load commits. {message}</div>
        <button onClick={() => void query.refetch()} style={retryButtonStyle}>
          <RotateCw size={11} aria-hidden />
          Retry
        </button>
      </CommitStatus>
    );
  }

  const data = query.data;
  if (!data || data.commits.length === 0) {
    return <CommitStatus>No commits returned for this pull request.</CommitStatus>;
  }

  return (
    <CommitsBody
      pr={pr}
      commits={data.commits}
      totalCount={data.totalCount}
      truncated={data.truncated}
      sortOrder={sortOrder}
      onSortOrderChange={setSortOrder}
      expandedSha={expandedSha}
      onExpandedShaChange={setExpandedSha}
      copiedSha={copiedSha}
      onCopiedShaChange={setCopiedSha}
    />
  );
}

function CommitsBody({
  pr,
  commits,
  totalCount,
  truncated,
  sortOrder,
  onSortOrderChange,
  expandedSha,
  onExpandedShaChange,
  copiedSha,
  onCopiedShaChange,
}: {
  pr: DashboardPR;
  commits: PRCommit[];
  totalCount: number;
  truncated: boolean;
  sortOrder: CommitSortOrder;
  onSortOrderChange: (order: CommitSortOrder) => void;
  expandedSha: string | null;
  onExpandedShaChange: (sha: string | null) => void;
  copiedSha: string | null;
  onCopiedShaChange: (sha: string | null) => void;
}): JSX.Element {
  const groups = useMemo(
    () => groupCommitsByLocalDay(orderCommits(commits, sortOrder)),
    [commits, sortOrder]
  );

  async function copySha(sha: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(sha);
      onCopiedShaChange(sha);
      window.setTimeout(() => {
        onCopiedShaChange(null);
      }, 1200);
    } catch {
      // Clipboard permission can be denied; leave the button unchanged.
    }
  }

  return (
    <div
      className="scroll-zone"
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: 'var(--bg-0)',
        padding: '0 18px 20px',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          minHeight: 46,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          padding: '8px 0',
          borderBottom: '1px solid var(--line-1)',
          background: 'var(--bg-0)',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>
          {truncated ? (
            <>
              Latest <span className="mono">{commits.length}</span> of{' '}
              <span className="mono">{totalCount}</span> commits ·{' '}
              <a
                href={`${pr.url}/commits`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--info)', textDecoration: 'none' }}
              >
                View full history
              </a>
            </>
          ) : (
            <>
              <span className="mono">{totalCount}</span>{' '}
              {totalCount === 1 ? 'commit' : 'commits'}
            </>
          )}
        </div>
        <span style={{ flex: 1 }} />
        <SortControl value={sortOrder} onChange={onSortOrderChange} />
      </div>

      {groups.map((group, groupIndex) => (
        <section key={`${group.key}-${groupIndex}`} aria-label={group.label}>
          <div
            style={{
              padding: '16px 2px 7px',
              color: 'var(--fg-3)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {group.label}
          </div>
          <div
            style={{
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-2)',
              overflow: 'hidden',
              background: 'var(--bg-1)',
            }}
          >
            {group.commits.map((commit, index) => (
              <CommitRow
                key={commit.sha}
                commit={commit}
                expanded={expandedSha === commit.sha}
                copied={copiedSha === commit.sha}
                divided={index > 0}
                onToggle={() =>
                  onExpandedShaChange(
                    expandedSha === commit.sha ? null : commit.sha
                  )
                }
                onCopy={() => void copySha(commit.sha)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SortControl({
  value,
  onChange,
}: {
  value: CommitSortOrder;
  onChange: (value: CommitSortOrder) => void;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Commit order"
      style={{
        display: 'inline-flex',
        padding: 2,
        border: '1px solid var(--line-2)',
        borderRadius: 6,
        background: 'var(--bg-1)',
      }}
    >
      {(['oldest', 'newest'] as const).map((order) => {
        const active = value === order;
        return (
          <button
            key={order}
            onClick={() => onChange(order)}
            aria-pressed={active}
            style={{
              height: 24,
              padding: '0 9px',
              border: 'none',
              borderRadius: 4,
              background: active ? 'var(--bg-3)' : 'transparent',
              color: active ? 'var(--fg-0)' : 'var(--fg-3)',
              fontSize: 10.5,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
            }}
          >
            {order === 'oldest' ? 'Oldest' : 'Newest'}
          </button>
        );
      })}
    </div>
  );
}

function CommitRow({
  commit,
  expanded,
  copied,
  divided,
  onToggle,
  onCopy,
}: {
  commit: PRCommit;
  expanded: boolean;
  copied: boolean;
  divided: boolean;
  onToggle: () => void;
  onCopy: () => void;
}): JSX.Element {
  const authorLabel = commit.author.login
    ? `@${commit.author.login}`
    : commit.author.name;
  const avatarUser: DashboardUser = {
    login: commit.author.login ?? commit.author.name,
    ...(commit.author.avatarUrl ? { avatarUrl: commit.author.avatarUrl } : {}),
    av: commit.author.av,
  };
  const date = new Date(commit.authoredAt);
  const validDate = !Number.isNaN(date.getTime());
  const relativeTime = validDate
    ? formatDistanceToNowStrict(date, { addSuffix: true })
    : 'Unknown time';
  const exactTime = validDate
    ? format(date, "MMM d, yyyy 'at' h:mm a xxx")
    : 'Unknown time';
  const panelId = `commit-details-${commit.sha}`;
  const fullMessage = commit.body
    ? `${commit.headline}\n\n${commit.body}`
    : commit.headline;

  return (
    <article style={{ borderTop: divided ? '1px solid var(--line-1)' : 'none' }}>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        style={{
          width: '100%',
          minHeight: 58,
          padding: '9px 12px',
          border: 'none',
          background: expanded ? 'var(--bg-2)' : 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '7px 10px',
        }}
      >
        <Avatar user={avatarUser} size={22} title={authorLabel} />
        <span style={{ minWidth: 180, flex: '1 1 360px' }}>
          <span
            style={{
              display: 'block',
              color: 'var(--fg-0)',
              fontSize: 12,
              fontWeight: 550,
              lineHeight: 1.35,
              overflowWrap: 'anywhere',
            }}
          >
            {commit.headline}
          </span>
          <span
            style={{
              display: 'block',
              marginTop: 3,
              color: 'var(--fg-3)',
              fontSize: 10.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {authorLabel}
          </span>
        </span>
        <span
          className="mono"
          style={{ color: 'var(--fg-2)', fontSize: 10.5, flexShrink: 0 }}
        >
          {commit.sha.slice(0, 7)}
        </span>
        <time
          dateTime={commit.authoredAt}
          title={exactTime}
          style={{
            minWidth: 92,
            color: 'var(--fg-3)',
            fontSize: 10.5,
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {relativeTime}
        </time>
        {expanded ? (
          <ChevronUp size={13} color="var(--fg-3)" aria-hidden />
        ) : (
          <ChevronDown size={13} color="var(--fg-3)" aria-hidden />
        )}
      </button>

      {expanded && (
        <div
          id={panelId}
          style={{
            padding: '12px 14px 14px 44px',
            borderTop: '1px solid var(--line-1)',
            background: 'var(--bg-2)',
          }}
        >
          <pre
            className="mono"
            style={{
              margin: 0,
              color: 'var(--fg-1)',
              fontSize: 11,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {fullMessage}
          </pre>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid var(--line-1)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              color: 'var(--fg-3)',
              fontSize: 10.5,
            }}
          >
            <span>{commit.author.name}</span>
            {commit.author.login && commit.author.name !== commit.author.login && (
              <span>@{commit.author.login}</span>
            )}
            <span aria-hidden>·</span>
            <time dateTime={commit.authoredAt}>{exactTime}</time>
            <span style={{ flex: 1 }} />
            <button
              onClick={onCopy}
              aria-label={copied ? 'Commit SHA copied' : 'Copy full commit SHA'}
              style={detailActionStyle}
            >
              {copied ? (
                <Check size={11} aria-hidden />
              ) : (
                <Copy size={11} aria-hidden />
              )}
              {copied ? 'Copied' : 'Copy SHA'}
            </button>
            <a
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...detailActionStyle, textDecoration: 'none' }}
            >
              <ExternalLink size={11} aria-hidden />
              Open commit
            </a>
          </div>
          <div
            className="mono"
            style={{ marginTop: 8, color: 'var(--fg-4)', fontSize: 9.5 }}
          >
            {commit.sha}
          </div>
        </div>
      )}
    </article>
  );
}

function CommitStatus({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'err';
}): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-0)',
        color: tone === 'err' ? 'var(--err)' : 'var(--fg-2)',
        fontSize: 12,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div>{children}</div>
    </div>
  );
}

const detailActionStyle: React.CSSProperties = {
  height: 26,
  padding: '0 8px',
  border: '1px solid var(--line-2)',
  borderRadius: 5,
  background: 'var(--bg-1)',
  color: 'var(--fg-2)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 10.5,
  cursor: 'pointer',
};

const retryButtonStyle: React.CSSProperties = {
  ...detailActionStyle,
  margin: '10px auto 0',
  color: 'var(--fg-1)',
};
