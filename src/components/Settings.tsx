import { X } from 'lucide-react';
import { useUIStore } from '../store';
import { redactToken } from '../lib/storage';
import { Kbd } from './primitives';

interface Props {
  rateLimit?: { remaining: number; resetAt: string };
}

export function Settings({ rateLimit }: Props) {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const token = useUIStore((s) => s.token);
  const setToken = useUIStore((s) => s.setToken);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  if (!settingsOpen) return null;

  function onResetToken() {
    const ok = window.confirm(
      'Sign out of Perch? Your token will be removed from this browser.'
    );
    if (!ok) return;
    setToken(null);
    setSettingsOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSettingsOpen(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-2)',
          borderRadius: 10,
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        }}
        className="scroll-zone"
      >
        <header
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--line-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Settings</h2>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setSettingsOpen(false)}
            aria-label="Close"
            title="Close (Esc)"
            style={{
              width: 26,
              height: 26,
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
        </header>

        <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Group title="Appearance">
            <Row label="Theme" meta="Stored on this device">
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  padding: 3,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line-1)',
                  borderRadius: 6,
                }}
              >
                <SegBtn
                  active={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </SegBtn>
                <SegBtn
                  active={theme === 'light'}
                  onClick={() => setTheme('light')}
                >
                  Light
                </SegBtn>
              </div>
            </Row>
          </Group>

          <Group title="GitHub token">
            <Row label="Stored token" meta="Resetting clears localStorage">
              <span
                className="mono"
                style={{ fontSize: 12, color: 'var(--fg-2)' }}
              >
                {token ? redactToken(token) : '—'}
              </span>
            </Row>
            <div>
              <button
                onClick={onResetToken}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 5,
                  border: '1px solid var(--err-line)',
                  background: 'var(--err-bg)',
                  color: 'var(--err)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Reset token
              </button>
            </div>
          </Group>

          {rateLimit && (
            <Group title="API rate limit">
              <Row label="Remaining">
                <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)' }}>
                  {rateLimit.remaining}
                </span>
              </Row>
              <Row label="Resets at">
                <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)' }}>
                  {new Date(rateLimit.resetAt).toLocaleTimeString()}
                </span>
              </Row>
            </Group>
          )}

          <Group title="Keyboard shortcuts">
            <ShortcutRow keys={['j', 'k']} label="Move selection down / up" />
            <ShortcutRow keys={['↵']} label="Open selected PR on GitHub" />
            <ShortcutRow keys={['e']} label="Toggle detail drawer" />
            <ShortcutRow keys={['/']} label="Focus filter" />
            <ShortcutRow keys={['r']} label="Manual refresh" />
            <ShortcutRow keys={[',']} label="Open settings" />
            <ShortcutRow keys={['?']} label="Toggle shortcut help" />
            <ShortcutRow keys={['Esc']} label="Close drawer / modal" />
          </Group>
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--fg-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          border: '1px solid var(--line-1)',
          borderRadius: 8,
          background: 'var(--bg-2)',
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '8px 10px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 500 }}>
          {label}
        </div>
        {meta && (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
            {meta}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 10px',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--fg-1)', flex: 1 }}>{label}</span>
      <span style={{ display: 'inline-flex', gap: 4 }}>
        {keys.map((k, i) => (
          <Kbd key={`${k}-${i}`}>{k}</Kbd>
        ))}
      </span>
    </div>
  );
}

function SegBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 22,
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
