import { RefreshCw, Search, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useUIStore } from '../store';
import { Kbd } from './primitives';
import type { Theme } from '../lib/storage';

interface HeaderProps {
  total: number;
  lastUpdatedLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
  viewerLogin: string | null;
  viewerAvatarUrl?: string;
}

export function Header({
  total,
  lastUpdatedLabel,
  refreshing,
  onRefresh,
  viewerLogin,
  viewerAvatarUrl,
}: HeaderProps) {
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const scope = useUIStore((s) => s.scope);
  const setScope = useUIStore((s) => s.setScope);
  const orgs = useUIStore((s) => s.orgs);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <header
      style={{
        height: 48,
        padding: '0 16px',
        borderBottom: '1px solid var(--line-1)',
        background: 'var(--bg-0)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: 'var(--fg-0)',
          }}
        >
          Inbox
        </h1>
        <span
          className="mono num"
          style={{
            fontSize: 11,
            color: 'var(--fg-2)',
            fontWeight: 500,
            padding: '1px 6px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line-1)',
            borderRadius: 3,
          }}
        >
          {total} open
        </span>
      </div>

      {/* Search */}
      <label
        style={{
          marginLeft: 16,
          width: 320,
          height: 28,
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 8,
        }}
      >
        <Search size={12} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
        <input
          data-search
          value={searchQuery}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Filter PRs, repos, authors…"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: 'var(--fg-0)',
            fontSize: 12,
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <Kbd>/</Kbd>
      </label>

      {orgs.length > 0 && (
        <div
          role="tablist"
          aria-label="Scope"
          style={{
            display: 'flex',
            gap: 2,
            padding: 2,
            background: 'var(--bg-2)',
            border: '1px solid var(--line-1)',
            borderRadius: 6,
            height: 26,
            alignItems: 'center',
          }}
        >
          <ScopeBtn
            active={scope === 'inbox'}
            onClick={() => setScope('inbox')}
            title="Your PRs + review-requested"
          >
            Inbox
          </ScopeBtn>
          <ScopeBtn
            active={scope === 'all'}
            onClick={() => setScope('all')}
            title={`All open PRs in ${orgs.join(', ')}`}
          >
            Team
          </ScopeBtn>
        </div>
      )}

      <span style={{ flex: 1 }} />

      {/* Refresh status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--fg-2)',
          padding: '0 8px',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: refreshing ? 'var(--warn)' : 'var(--ok)',
            boxShadow: `0 0 0 3px ${
              refreshing ? 'rgba(224,166,75,0.15)' : 'rgba(78,201,168,0.15)'
            }`,
            animation: refreshing ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }}
        />
        <span>
          {refreshing ? 'Refreshing…' : `Updated ${lastUpdatedLabel}`}
        </span>
      </div>

      <IconButton
        onClick={onRefresh}
        title="Refresh (r)"
        aria-label="Refresh"
        disabled={refreshing}
      >
        <RefreshCw size={14} style={{
          animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
        }} />
      </IconButton>
      <IconButton
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </IconButton>
      <IconButton
        onClick={() => setSettingsOpen(true)}
        title="Settings (,)"
        aria-label="Settings"
      >
        <SettingsIcon size={14} />
      </IconButton>

      {viewerLogin && (
        <span
          title={`@${viewerLogin}`}
          className={`av-${avKey(viewerLogin)}`}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            color: '#0b0d10',
            fontSize: 11,
            fontWeight: 600,
            marginLeft: 4,
          }}
        >
          {viewerAvatarUrl ? (
            <img src={viewerAvatarUrl} alt="" width={24} height={24} style={{ width: '100%', height: '100%' }} />
          ) : (
            viewerLogin[0]?.toUpperCase()
          )}
        </span>
      )}
    </header>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={rest['aria-label']}
      style={{
        width: 28,
        height: 28,
        borderRadius: 4,
        border: 'none',
        background: 'transparent',
        color: 'var(--fg-2)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ScopeBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={title}
      style={{
        height: 20,
        padding: '0 10px',
        border: 'none',
        borderRadius: 4,
        background: active ? 'var(--bg-4)' : 'transparent',
        color: active ? 'var(--fg-0)' : 'var(--fg-2)',
        fontSize: 11.5,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function avKey(login: string): string {
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  let hash = 0;
  for (let i = 0; i < login.length; i++) hash = (hash * 31 + login.charCodeAt(i)) >>> 0;
  return keys[hash % keys.length]!;
}
