import { X } from 'lucide-react';
import { Kbd } from './primitives';
import { useUIStore } from '../store';

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['j'], label: 'Select next PR' },
  { keys: ['k'], label: 'Select previous PR' },
  { keys: ['↵'], label: 'Open selected PR on GitHub' },
  { keys: ['e'], label: 'Toggle detail drawer' },
  { keys: ['/'], label: 'Focus filter' },
  { keys: ['r'], label: 'Refresh now' },
  { keys: [','], label: 'Open settings' },
  { keys: ['?'], label: 'Toggle this help' },
  { keys: ['Esc'], label: 'Close drawer / modal' },
];

export function HelpOverlay() {
  const helpOpen = useUIStore((s) => s.helpOpen);
  const setHelpOpen = useUIStore((s) => s.setHelpOpen);

  if (!helpOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      onClick={(e) => {
        if (e.target === e.currentTarget) setHelpOpen(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '95vw',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-2)',
          borderRadius: 10,
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--line-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            Keyboard shortcuts
          </h2>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setHelpOpen(false)}
            aria-label="Close"
            style={{
              width: 24,
              height: 24,
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
        <div style={{ padding: 8 }}>
          {SHORTCUTS.map((s) => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 10px',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--fg-1)', flex: 1 }}>
                {s.label}
              </span>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {s.keys.map((k, i) => (
                  <Kbd key={`${k}-${i}`}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
