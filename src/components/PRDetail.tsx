import { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCw,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DashboardPR, TimelineEvent } from '../types/dashboard';
import {
  Avatar,
  DraftChip,
  LabelPill,
  TONE_STYLE,
} from './primitives';
import { DiffTab } from './DiffTab';
import { useSubmitReview } from '../hooks/useSubmitReview';
import { useRerunPipeline } from '../hooks/useRerunPipeline';
import { reviewActionEnabled, type ReviewEvent } from '../lib/reviewActions';
import { redactToken } from '../lib/storage';
import { useUIStore } from '../store';

interface Props {
  pr: DashboardPR;
  onClose: () => void;
  /** 0-based index of this PR in the nav list, or -1 if not present. */
  navIndex: number;
  /** Total PRs in the nav list (deduped, collapsed buckets excluded). */
  navTotal: number;
  /** Previous PR id, or null at the start of the list. */
  prevId: string | null;
  /** Next PR id, or null at the end of the list. */
  nextId: string | null;
  /** Switch the modal to a different PR without closing. */
  onNavigate: (id: string) => void;
}

type DrawerTab = 'timeline' | 'diff';

// Centered modal layout (experimenting). Sized generously for Diff
// readability — since the modal floats over the bucket list with a
// dim backdrop, we don't need to leave horizontal room behind it.
// Caps at 1100px wide / 92vh tall, scales down to 92vw / 92vh on
// smaller monitors.
const MODAL_WIDTH = 'min(1100px, 92vw)';
const MODAL_HEIGHT = 'min(900px, 92vh)';

export function PRDetail({
  pr,
  onClose,
  navIndex,
  navTotal,
  prevId,
  nextId,
  onNavigate,
}: Props) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('timeline');

  const mergeableTone =
    pr.mergeable === 'MERGEABLE'
      ? 'ok'
      : pr.mergeable === 'CONFLICTING'
        ? 'err'
        : 'warn';

  return (
    <div
      // Backdrop. Click anywhere outside the panel to dismiss; Esc
      // is still wired through useKeyboardNav.
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Pull request ${pr.repoNameWithOwner} #${pr.number}`}
        // Stop clicks inside the panel from bubbling to the backdrop
        // and triggering close.
        onClick={(e) => e.stopPropagation()}
        style={{
          width: MODAL_WIDTH,
          height: MODAL_HEIGHT,
          background: 'var(--bg-1)',
          border: '1px solid var(--line-2)',
          borderRadius: 10,
          boxShadow: '0 32px 80px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--line-1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
          {pr.repoNameWithOwner}
        </span>
        <span style={{ color: 'var(--fg-4)' }}>·</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>
          #{pr.number}
        </span>
        <span style={{ flex: 1 }} />
        {navTotal > 1 && (
          <NavControls
            navIndex={navIndex}
            navTotal={navTotal}
            prevId={prevId}
            nextId={nextId}
            onNavigate={onNavigate}
          />
        )}
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open on GitHub"
          style={{
            height: 24,
            padding: '0 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--fg-2)',
            fontSize: 11,
            textDecoration: 'none',
          }}
        >
          <ExternalLink size={12} />
          Open
        </a>
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
          style={{
            height: 24,
            width: 24,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--fg-2)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div
        style={{
          padding: '16px 18px 14px 18px',
          borderBottom: '1px solid var(--line-1)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: 'var(--fg-0)',
            lineHeight: 1.35,
          }}
        >
          {pr.title}
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          <Avatar user={pr.author} size={18} />
          <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>
            <span style={{ fontWeight: 500 }}>@{pr.author.login}</span>
            <span style={{ color: 'var(--fg-3)' }}> opened </span>
            <span className="mono" style={{ color: 'var(--fg-1)' }}>
              {formatDistanceToNowStrict(new Date(pr.createdAt), { addSuffix: true })}
            </span>
          </span>
          {pr.isDraft && <DraftChip />}
        </div>

        <BranchLine head={pr.headRefName} base={pr.baseRefName} />

        <PRUrlLine url={pr.url} />

        {pr.labels.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pr.labels.map((l, i) => (
              <LabelPill key={`${l.name}-${i}`} label={l} />
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}
        >
          <StatusCard
            label="Approval"
            tone={pr.approvalState === 'approved' ? 'ok' : pr.approvalState === 'changes' ? 'err' : 'warn'}
            value={
              pr.approvalState === 'changes'
                ? 'Changes requested'
                : pr.approvalState === 'approved'
                  ? `${pr.approvalCount}/${Math.max(pr.reviewerCount, pr.approvalCount)} approved`
                  : `${pr.approvalCount}/${Math.max(pr.reviewerCount, pr.approvalCount) || '—'} approvals`
            }
            sub={
              pr.reviewers[0]
                ? `latest: @${pr.reviewers[0].login}`
                : 'no reviews yet'
            }
          />
          <StatusCard
            label="CI"
            tone={
              pr.ciStatus === 'success'
                ? 'ok'
                : pr.ciStatus === 'failure'
                  ? 'err'
                  : pr.ciStatus === 'pending'
                    ? 'warn'
                    : 'neutral'
            }
            value={
              pr.ciStatus === 'success'
                ? 'Passing'
                : pr.ciStatus === 'failure'
                  ? 'Failing'
                  : pr.ciStatus === 'pending'
                    ? 'Running'
                    : 'No checks'
            }
            sub=""
          />
          <StatusCard
            label="Mergeable"
            tone={mergeableTone}
            value={
              pr.mergeable === 'MERGEABLE'
                ? 'Clean'
                : pr.mergeable === 'CONFLICTING'
                  ? 'Conflicts'
                  : 'Unknown'
            }
            sub=""
          />
        </div>

        {/* File stats strip — matches design's slim mono row. */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            fontSize: 11.5,
            color: 'var(--fg-2)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>
            {pr.changedFiles} {pr.changedFiles === 1 ? 'file' : 'files'}
          </span>
          <span style={{ color: 'var(--ok)' }}>+{pr.additions}</span>
          <span style={{ color: 'var(--err)' }}>−{pr.deletions}</span>
          <span style={{ flex: 1 }} />
          <span>
            {pr.commitCount}{' '}
            {pr.commitCount === 1 ? 'commit' : 'commits'}
          </span>
          <span>
            {pr.reviewers.length}{' '}
            {pr.reviewers.length === 1 ? 'reviewer' : 'reviewers'}
          </span>
        </div>
      </div>

      <TabStrip
        activeTab={activeTab}
        onChange={setActiveTab}
        timelineCount={pr.timeline.length}
        fileCount={pr.changedFiles}
      />

      {activeTab === 'diff' ? (
        <DiffTab pr={pr} active={activeTab === 'diff'} />
      ) : (
        <div
          style={{
            padding: '14px 18px',
            overflow: 'auto',
            flex: 1,
          }}
          className="scroll-zone"
        >
          <SectionLabel>Timeline</SectionLabel>
          <Timeline events={pr.timeline} />

        <div style={{ height: 20 }} />

        <SectionLabel>Reviewers ({pr.reviewers.length})</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pr.reviewers.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              No reviewers yet.
            </div>
          )}
          {pr.reviewers.map((r, i) => {
            const { c, b } =
              r.state === 'changes'
                ? { c: 'var(--err)', b: 'requested changes' }
                : r.state === 'approved'
                  ? { c: 'var(--ok)', b: 'approved' }
                  : r.state === 'commented'
                    ? { c: 'var(--info)', b: 'commented' }
                    : r.state === 'requested'
                      ? { c: 'var(--fg-3)', b: 'review requested' }
                      : { c: 'var(--fg-3)', b: 'pending' };
            return (
              <div
                key={`${r.login}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  borderRadius: 5,
                  background: 'var(--bg-2)',
                }}
              >
                <Avatar user={r} size={18} />
                <span
                  style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500 }}
                >
                  @{r.login}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: c }}>{b}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    color: 'var(--fg-3)',
                    minWidth: 60,
                    textAlign: 'right',
                  }}
                >
                  {r.submittedAt
                    ? formatDistanceToNowStrict(new Date(r.submittedAt)) + ' ago'
                    : '—'}
                </span>
              </div>
            );
          })}
        </div>

        </div>
      )}

      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--line-1)',
          background: 'var(--bg-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <ReviewComposer key={pr.id} pr={pr} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: 30,
              padding: '0 12px',
              borderRadius: 6,
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              fontSize: 12,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} />
            Open on GitHub
          </a>
          <RerunButton key={pr.id} pr={pr} />
          <span style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              height: 30,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid var(--line-2)',
              background: 'var(--bg-1)',
              color: 'var(--fg-1)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      </div>
      </aside>
    </div>
  );
}

function BranchLine({ head, base }: { head: string; base: string }) {
  return (
    <div
      style={{
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11.5,
        color: 'var(--fg-3)',
        fontFamily: 'var(--font-mono)',
        minWidth: 0,
      }}
    >
      <CopyableBranch name={head} />
      <span aria-hidden style={{ color: 'var(--fg-4)' }}>
        →
      </span>
      <span
        style={{
          color: 'var(--fg-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {base}
      </span>
    </div>
  );
}

function PRUrlLine({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore — clipboard may be blocked in some contexts */
    }
  }

  return (
    <div
      style={{
        marginTop: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11.5,
        fontFamily: 'var(--font-mono)',
        minWidth: 0,
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={url}
        style={{
          color: 'var(--accent)',
          textDecoration: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {url.replace(/^https?:\/\//, '')}
      </a>
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copied' : 'Copy URL'}
        aria-label={copied ? 'Copied' : 'Copy PR URL'}
        style={{
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: 4,
          background: 'transparent',
          color: copied ? 'var(--ok)' : 'var(--fg-3)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  );
}

function CopyableBranch({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const command = `git checkout ${name}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore — clipboard may be blocked in some contexts */
    }
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: 'var(--fg-1)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={name}
      >
        {name}
      </span>
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copied' : `Copy "${command}"`}
        aria-label={copied ? 'Copied' : `Copy ${command}`}
        style={{
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: 4,
          background: 'transparent',
          color: copied ? 'var(--ok)' : 'var(--fg-3)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </span>
  );
}

function NavControls({
  navIndex,
  navTotal,
  prevId,
  nextId,
  onNavigate,
}: {
  navIndex: number;
  navTotal: number;
  prevId: string | null;
  nextId: string | null;
  onNavigate: (id: string) => void;
}) {
  // Counter is `index + 1 / total`. When the selected PR has fallen
  // out of the nav list (rare — e.g. the bucket it was in just got
  // collapsed, or filters changed), index is -1; show "—" instead of
  // a misleading 0.
  const label =
    navIndex >= 0
      ? `${navIndex + 1}/${navTotal}`
      : `—/${navTotal}`;
  const prevDisabled = !prevId;
  const nextDisabled = !nextId;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        marginRight: 4,
      }}
    >
      <button
        onClick={() => prevId && onNavigate(prevId)}
        disabled={prevDisabled}
        title="Previous PR (k or ←)"
        aria-label="Previous PR"
        style={navBtnStyle(prevDisabled)}
      >
        <ChevronLeft size={14} />
      </button>
      <span
        className="mono num"
        style={{
          fontSize: 11,
          color: 'var(--fg-3)',
          minWidth: 44,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {label}
      </span>
      <button
        onClick={() => nextId && onNavigate(nextId)}
        disabled={nextDisabled}
        title="Next PR (j or →)"
        aria-label="Next PR"
        style={navBtnStyle(nextDisabled)}
      >
        <ChevronRight size={14} />
      </button>
    </span>
  );
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 24,
    width: 24,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: disabled ? 'var(--fg-4)' : 'var(--fg-2)',
    cursor: disabled ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function TabStrip({
  activeTab,
  onChange,
  timelineCount,
  fileCount,
}: {
  activeTab: DrawerTab;
  onChange: (tab: DrawerTab) => void;
  timelineCount: number;
  fileCount: number;
}) {
  return (
    <div
      style={{
        padding: '0 14px',
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--line-2)',
        background: 'var(--bg-1)',
      }}
    >
      <TabButton
        label="Timeline"
        count={timelineCount}
        active={activeTab === 'timeline'}
        onClick={() => onChange('timeline')}
      />
      <TabButton
        label="Diff"
        count={fileCount}
        active={activeTab === 'diff'}
        onClick={() => onChange('diff')}
      />
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 36,
        padding: '0 12px',
        border: 'none',
        background: 'transparent',
        color: active ? 'var(--fg-0)' : 'var(--fg-2)',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        borderBottom: active
          ? '2px solid var(--accent)'
          : '2px solid transparent',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: -1,
      }}
    >
      {label}
      {count != null && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: active ? 'var(--fg-1)' : 'var(--fg-3)',
            padding: '1px 5px',
            borderRadius: 3,
            background: active ? 'var(--bg-3)' : 'var(--bg-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: 'var(--fg-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function StatusCard({
  label,
  tone,
  value,
  sub,
}: {
  label: string;
  tone: keyof typeof TONE_STYLE;
  value: string;
  sub: string;
}) {
  const t = TONE_STYLE[tone];
  return (
    <div
      style={{
        padding: '8px 10px',
        border: `1px solid ${t.bd}`,
        background: t.b,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--fg-2)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: t.c,
          fontWeight: 600,
          marginTop: 2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--fg-3)',
            marginTop: 2,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
        No activity yet.
      </div>
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 11,
          top: 8,
          bottom: 8,
          width: 1,
          background: 'var(--line-2)',
        }}
      />
      {events.map((e) => (
        <TimelineItem key={e.id} event={e} />
      ))}
    </div>
  );
}

const EVENT_META: Record<
  TimelineEvent['kind'],
  { dot: string; verb: string }
> = {
  opened: { dot: 'var(--fg-3)', verb: 'opened this PR' },
  'review-approved': { dot: 'var(--ok)', verb: 'approved' },
  'review-changes': { dot: 'var(--err)', verb: 'requested changes' },
  'review-comment': { dot: 'var(--info)', verb: 'reviewed' },
  'inline-comment': { dot: 'var(--info)', verb: 'commented on' },
  comment: { dot: 'var(--info)', verb: 'commented' },
};

function TimelineItem({ event }: { event: TimelineEvent }) {
  const meta = EVENT_META[event.kind];
  const when = (() => {
    try {
      return formatDistanceToNowStrict(new Date(event.at)) + ' ago';
    } catch {
      return '';
    }
  })();
  const locationLabel =
    event.kind === 'inline-comment' && event.path
      ? `${event.path}${event.line != null ? `:${event.line}` : ''}`
      : null;
  return (
    <div style={{ position: 'relative', paddingLeft: 30, marginBottom: 12 }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 4,
          top: 4,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'var(--bg-1)',
          border: `2px solid ${meta.dot}`,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          minWidth: 0,
        }}
      >
        <Avatar user={event.author} size={16} />
        <span
          style={{
            color: 'var(--fg-0)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          @{event.author.login}
        </span>
        <span
          style={{
            color: 'var(--fg-2)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {meta.verb}
        </span>
        {locationLabel && (
          <span
            className="mono"
            style={{
              color: 'var(--fg-1)',
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flexShrink: 1,
            }}
            title={locationLabel}
          >
            {locationLabel}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span
          className="mono"
          style={{
            color: 'var(--fg-3)',
            fontSize: 10.5,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          title={event.at}
        >
          {when}
        </span>
      </div>
      {event.body && <CommentBubble body={event.body} />}
    </div>
  );
}

function CommentBubble({ body }: { body: string }) {
  const cleaned = stripRawHtml(body);
  if (cleaned.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 6,
        padding: '8px 10px',
        background: 'var(--bg-2)',
        border: '1px solid var(--line-1)',
        borderRadius: 5,
        fontSize: 12,
        color: 'var(--fg-1)',
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}
    >
      <CommentMarkdown body={cleaned} />
    </div>
  );
}

/**
 * Render a GitHub comment body as styled Markdown.
 * react-markdown v10 leaves raw HTML as text by default, so we strip
 * HTML comments (bot markers like `<!-- BUGBOT_REVIEW -->`) and tags
 * (like `<picture>` / `<img>` badges) before handing off to the
 * renderer. Markdown links, images, code, etc. still work.
 */
function stripRawHtml(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, '') // comments, including multi-line
    .replace(/<\/?[a-zA-Z][^>]*>/g, '') // tags
    .replace(/\n{3,}/g, '\n\n') // collapse blank runs left by stripped blocks
    .trim();
}

function CommentMarkdown({ body }: { body: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{ margin: '0 0 6px 0' }}>{children}</p>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: '0 0 6px 0', paddingLeft: 20 }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: '0 0 6px 0', paddingLeft: 20 }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ margin: '2px 0' }}>{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote
            style={{
              // Reset browser default 40px indent — drawer's narrow.
              margin: '4px 0',
              padding: '2px 0 2px 10px',
              borderLeft: '3px solid var(--line-3)',
              color: 'var(--fg-2)',
            }}
          >
            {children}
          </blockquote>
        ),
        code: ({ className, children, ...rest }) => {
          const isBlock = /language-/.test(className ?? '');
          return (
            <code
              className={className}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                background: isBlock ? 'transparent' : 'var(--bg-3)',
                padding: isBlock ? 0 : '1px 4px',
                borderRadius: 3,
              }}
              {...rest}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre
            style={{
              margin: '6px 0',
              padding: '8px 10px',
              background: 'var(--bg-3)',
              border: '1px solid var(--line-1)',
              borderRadius: 5,
              overflow: 'auto',
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            {children}
          </pre>
        ),
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt ?? ''}
            style={{
              maxWidth: '100%',
              borderRadius: 4,
              margin: '4px 0',
            }}
          />
        ),
        h1: ({ children }) => (
          <h3 style={{ margin: '8px 0 4px 0', fontSize: 13 }}>{children}</h3>
        ),
        h2: ({ children }) => (
          <h3 style={{ margin: '8px 0 4px 0', fontSize: 13 }}>{children}</h3>
        ),
        h3: ({ children }) => (
          <h3 style={{ margin: '8px 0 4px 0', fontSize: 12.5 }}>{children}</h3>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '4px 0' }}>
            <table
              style={{
                borderCollapse: 'collapse',
                fontSize: 11,
              }}
            >
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th
            style={{
              border: '1px solid var(--line-2)',
              padding: '4px 6px',
              textAlign: 'left',
              background: 'var(--bg-3)',
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td
            style={{
              border: '1px solid var(--line-2)',
              padding: '4px 6px',
            }}
          >
            {children}
          </td>
        ),
        hr: () => (
          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--line-2)',
              margin: '6px 0',
            }}
          />
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}

/**
 * Re-run the PR's whole Actions pipeline for its head SHA — green runs
 * included. Exists mainly to revive branch sandboxes that get torn
 * down nightly, so it's offered regardless of CI state, except while
 * checks are running (GitHub 403s re-run of unfinished runs).
 */
function RerunButton({ pr }: { pr: DashboardPR }) {
  const token = useUIStore((s) => s.token);
  const mutation = useRerunPipeline();

  // Merged PRs are historical; their sandbox is gone for good and the
  // runs are likely past the 30-day re-run window anyway.
  if (pr.isMerged) return null;

  const running = pr.ciStatus === 'pending';
  const enabled = !running && !mutation.isPending;
  const title = running
    ? 'Checks are already running — GitHub cannot re-run unfinished workflows'
    : 'Re-run all workflows for the latest commit (e.g. to redeploy the branch sandbox)';

  const errorMessage = (() => {
    if (!mutation.error) return null;
    let msg = mutation.error.message;
    if (token) msg = msg.split(token).join(redactToken(token));
    if (/permission|forbidden|403|not authorized|scope|resource not accessible/i.test(msg)) {
      return `${msg} — your token may lack write access. Re-running workflows needs the "repo" scope (classic) or "Actions: Read and write" (fine-grained).`;
    }
    return msg;
  })();

  const statusText = errorMessage
    ? errorMessage
    : mutation.isSuccess
      ? mutation.data.started > 0
        ? `Re-run started (${mutation.data.started} ${mutation.data.started === 1 ? 'workflow' : 'workflows'})`
        : 'Pipeline already running'
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() =>
          mutation.mutate({
            repoNameWithOwner: pr.repoNameWithOwner,
            headSha: pr.headSha,
          })
        }
        disabled={!enabled}
        title={title}
        style={{
          height: 30,
          padding: '0 12px',
          borderRadius: 6,
          border: '1px solid var(--line-2)',
          background: 'var(--bg-1)',
          color: 'var(--fg-1)',
          fontSize: 12,
          fontWeight: 600,
          cursor: enabled ? 'pointer' : 'not-allowed',
          opacity: enabled ? 1 : 0.45,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {mutation.isPending ? (
          <Loader2 size={12} className="spin" aria-hidden />
        ) : (
          <RotateCw size={12} aria-hidden />
        )}
        Re-run CI
      </button>
      {statusText && (
        <span
          role={errorMessage ? 'alert' : 'status'}
          style={{
            fontSize: 11,
            color: errorMessage ? 'var(--err)' : 'var(--ok)',
            lineHeight: 1.4,
            maxWidth: 360,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={statusText}
        >
          {statusText}
        </span>
      )}
    </>
  );
}

const VERDICTS: { event: ReviewEvent; label: string; tone: 'ok' | 'err' | 'neutral' }[] = [
  { event: 'APPROVE', label: 'Approve', tone: 'ok' },
  { event: 'REQUEST_CHANGES', label: 'Request changes', tone: 'err' },
  { event: 'COMMENT', label: 'Comment', tone: 'neutral' },
];

function ReviewComposer({ pr }: { pr: DashboardPR }) {
  const [body, setBody] = useState('');
  const token = useUIStore((s) => s.token);
  const mutation = useSubmitReview();

  // No review actions on merged PRs — they're historical, and GitHub
  // rejects approve/request-changes on a merged PR.
  if (pr.isMerged) return null;

  const pending = mutation.isPending;
  const activeEvent = mutation.variables?.event;

  function submit(event: ReviewEvent) {
    mutation.mutate(
      { pullRequestId: pr.id, event, body },
      { onSuccess: () => setBody('') },
    );
  }

  // Redact the PAT from any error before display, then add a friendly
  // hint for the common "token lacks write scope" failure.
  const errorMessage = (() => {
    if (!mutation.error) return null;
    let msg = mutation.error.message;
    if (token) msg = msg.split(token).join(redactToken(token));
    if (/permission|forbidden|403|not authorized|scope|resource not accessible/i.test(msg)) {
      return `${msg} — your token may lack write access. It needs the "repo" scope (classic) or "Pull requests: Read and write" (fine-grained).`;
    }
    return msg;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Review comment"
        placeholder="Leave a review comment (optional for Approve)…"
        rows={2}
        disabled={pending}
        style={{
          width: '100%',
          resize: 'vertical',
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid var(--line-2)',
          background: 'var(--bg-1)',
          color: 'var(--fg-0)',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />
      {errorMessage && (
        <div
          role="alert"
          style={{
            fontSize: 11.5,
            color: 'var(--err)',
            lineHeight: 1.4,
          }}
        >
          {errorMessage}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {VERDICTS.map(({ event, label, tone }) => {
          const enabled =
            !pending && reviewActionEnabled(event, body, pr.viewerIsAuthor);
          const isActive = pending && activeEvent === event;
          const needsBody = event !== 'APPROVE' && body.trim().length === 0;
          const blockedAsAuthor = pr.viewerIsAuthor && event !== 'COMMENT';
          const title = blockedAsAuthor
            ? 'GitHub does not allow approving or requesting changes on your own PR'
            : needsBody
              ? 'A comment is required for this action'
              : undefined;
          return (
            <button
              key={event}
              type="button"
              onClick={() => submit(event)}
              disabled={!enabled}
              title={title}
              style={verdictBtnStyle(tone, enabled)}
            >
              {isActive && <Loader2 size={12} className="spin" aria-hidden />}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function verdictBtnStyle(
  tone: 'ok' | 'err' | 'neutral',
  enabled: boolean,
): React.CSSProperties {
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'err' ? 'var(--err)' : 'var(--fg-1)';
  const border = tone === 'neutral' ? 'var(--line-2)' : color;
  return {
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    border: `1px solid ${border}`,
    background: 'var(--bg-1)',
    color,
    fontSize: 12,
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.45,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };
}
