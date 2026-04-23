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
      title={`New build ${latestShortSha} available — click to reload`}
      style={{
        height: 24,
        padding: '0 10px',
        borderRadius: 5,
        border: '1px solid var(--accent)',
        background: 'var(--info-bg)',
        color: 'var(--accent)',
        cursor: 'pointer',
        fontSize: 11.5,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 0 3px rgba(106,169,255,0.25)',
        }}
      />
      <span>New build</span>
      <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 10.5 }}>
        {latestShortSha}
      </span>
      <RefreshCw size={10} />
    </button>
  );
}
