import { useState } from 'react';
import { ExternalLink, Check, AlertCircle, Loader2 } from 'lucide-react';
import { testConnection } from '../lib/github';
import { useUIStore } from '../store';
import { redactToken } from '../lib/storage';
import { Kbd } from './primitives';

const TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo,read:org,read:user&description=Perch%20PR%20dashboard';

type Status =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; login: string }
  | { kind: 'err'; message: string };

export function TokenSetup() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const setToken = useUIStore((s) => s.setToken);

  async function onTest() {
    const token = input.trim();
    if (!token) {
      setStatus({ kind: 'err', message: 'Enter a token first.' });
      return;
    }
    setStatus({ kind: 'testing' });
    try {
      const { login } = await testConnection(token);
      setStatus({ kind: 'ok', login });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const message = rawMessage.replace(token, redactToken(token));
      setStatus({ kind: 'err', message });
    }
  }

  function onSave() {
    if (status.kind !== 'ok') return;
    setToken(input.trim());
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'var(--bg-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 480,
          background: 'var(--bg-1)',
          border: '1px solid var(--line-1)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 22px 16px',
            borderBottom: '1px solid var(--line-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, var(--accent), var(--violet))',
              color: 'var(--accent-fg)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            ⌥
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Perch
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2 }}>
              Personal GitHub PR inbox
            </div>
          </div>
        </div>

        <div style={{ padding: '18px 22px 8px' }}>
          <p
            style={{
              fontSize: 13,
              color: 'var(--fg-1)',
              lineHeight: 1.55,
              margin: '0 0 14px',
            }}
          >
            Perch runs entirely in your browser. Paste a GitHub Personal Access
            Token with <Code>repo</Code>, <Code>read:org</Code>, and{' '}
            <Code>read:user</Code> scopes. The token is stored in{' '}
            <Code>localStorage</Code> — nothing leaves this machine except the
            GitHub API calls.
          </p>

          <a
            href={TOKEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              color: 'var(--accent)',
              textDecoration: 'none',
              marginBottom: 14,
            }}
          >
            Create a token on GitHub
            <ExternalLink size={12} />
          </a>

          <label
            style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--fg-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
              marginBottom: 6,
              marginTop: 4,
            }}
          >
            Personal Access Token
          </label>
          <input
            type="password"
            spellCheck={false}
            autoComplete="off"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (status.kind !== 'idle') setStatus({ kind: 'idle' });
            }}
            placeholder="ghp_… or github_pat_…"
            style={{
              width: '100%',
              height: 34,
              padding: '0 12px',
              border: '1px solid var(--line-2)',
              background: 'var(--bg-2)',
              borderRadius: 6,
              color: 'var(--fg-0)',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onTest();
            }}
          />

          <div style={{ height: 12 }} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onTest}
              disabled={status.kind === 'testing' || !input.trim()}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 6,
                border: '1px solid var(--line-2)',
                background: 'var(--bg-2)',
                color: 'var(--fg-0)',
                fontSize: 12,
                fontWeight: 500,
                cursor: status.kind === 'testing' ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                opacity: !input.trim() ? 0.5 : 1,
              }}
            >
              {status.kind === 'testing' && (
                <Loader2 size={12} style={{ animation: 'spin .8s linear infinite' }} />
              )}
              Test connection
            </button>

            <button
              onClick={onSave}
              disabled={status.kind !== 'ok'}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 6,
                border: 'none',
                background: status.kind === 'ok' ? 'var(--accent)' : 'var(--bg-3)',
                color: status.kind === 'ok' ? 'var(--accent-fg)' : 'var(--fg-3)',
                fontSize: 12,
                fontWeight: 600,
                cursor: status.kind === 'ok' ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Continue
              <Kbd>↵</Kbd>
            </button>
          </div>

          <div style={{ height: 14 }} />

          {status.kind === 'ok' && (
            <StatusLine tone="ok" icon={<Check size={12} />}>
              Connected as <strong>@{status.login}</strong>
            </StatusLine>
          )}
          {status.kind === 'err' && (
            <StatusLine tone="err" icon={<AlertCircle size={12} />}>
              {status.message}
            </StatusLine>
          )}
        </div>

        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--line-1)',
            background: 'var(--bg-2)',
            fontSize: 11,
            color: 'var(--fg-3)',
            lineHeight: 1.5,
          }}
        >
          Tokens are never transmitted anywhere except the GitHub GraphQL API.
          Reset anytime from Settings.
        </div>
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="mono"
      style={{
        padding: '1px 5px',
        background: 'var(--bg-2)',
        border: '1px solid var(--line-1)',
        borderRadius: 3,
        fontSize: 11.5,
        color: 'var(--fg-1)',
      }}
    >
      {children}
    </code>
  );
}

function StatusLine({
  tone,
  icon,
  children,
}: {
  tone: 'ok' | 'err';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = tone === 'ok' ? 'var(--ok)' : 'var(--err)';
  const b = tone === 'ok' ? 'var(--ok-bg)' : 'var(--err-bg)';
  const bd = tone === 'ok' ? 'var(--ok-line)' : 'var(--err-line)';
  return (
    <div
      style={{
        padding: '8px 10px',
        border: `1px solid ${bd}`,
        background: b,
        color: c,
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
      }}
    >
      {icon}
      <span style={{ color: 'var(--fg-1)' }}>{children}</span>
    </div>
  );
}
