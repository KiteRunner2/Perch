import { RefreshCw } from 'lucide-react';

interface Props {
  latestShortSha: string;
}

export function UpdateAvailableChip({ latestShortSha }: Props) {
  function reload() {
    window.location.reload();
  }

  return (
    <button
      onClick={reload}
      title={`Build ${latestShortSha} is live — click to reload`}
      style={{
        height: 26,
        padding: '0 12px',
        borderRadius: 5,
        border: '1px solid var(--accent)',
        background: 'var(--info-bg)',
        color: 'var(--accent)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 0 3px rgba(106,169,255,0.25)',
          animation: 'pulse 1.6s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      <span>New version available — click to refresh</span>
      <RefreshCw size={11} aria-hidden />
    </button>
  );
}
