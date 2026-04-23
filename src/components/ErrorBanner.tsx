import type { LabelTone } from '../types/dashboard';
import { TONE_STYLE } from './primitives';

export function ErrorBanner({
  tone = 'err',
  title,
  body,
  actionLabel,
  onAction,
}: {
  tone?: LabelTone;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = TONE_STYLE[tone];
  return (
    <div
      style={{
        margin: '12px 16px',
        padding: '10px 12px',
        border: `1px solid ${t.bd}`,
        borderRadius: 6,
        background: t.b,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1.4px solid ${t.c}`,
          color: t.c,
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        !
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: t.c, fontWeight: 600 }}>{title}</div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--fg-1)',
            marginTop: 2,
            lineHeight: 1.45,
          }}
        >
          {body}
        </div>
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            height: 26,
            padding: '0 10px',
            borderRadius: 5,
            border: `1px solid ${t.bd}`,
            background: 'var(--bg-1)',
            color: t.c,
            fontSize: 11.5,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
