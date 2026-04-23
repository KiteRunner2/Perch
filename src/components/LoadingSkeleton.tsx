import { Shimmer } from './primitives';

export function LoadingSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {[
        { title: 'Waiting on me', color: 'var(--bucket-primary)', rows: 4 },
        { title: 'Ready to merge', color: 'var(--bucket-merge)', rows: 2 },
        { title: 'Blocked', color: 'var(--bucket-block)', rows: 1 },
      ].map((b) => (
        <section key={b.title}>
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--line-1)',
              background: 'var(--bg-1)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: b.color,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{b.title}</span>
            <Shimmer w={20} h={14} />
          </div>
          {Array.from({ length: b.rows }).map((_, i) => (
            <SkelRow key={i} />
          ))}
        </section>
      ))}
    </div>
  );
}

function SkelRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 14px',
        height: 46,
        borderBottom: '1px solid var(--line-1)',
      }}
    >
      <Shimmer w={20} h={20} r={10} />
      <Shimmer w={40} h={10} />
      <Shimmer w={260} h={10} />
      <span style={{ flex: 1 }} />
      <Shimmer w={40} h={16} />
      <Shimmer w={16} h={16} r={8} />
      <Shimmer w={60} h={16} />
      <Shimmer w={40} h={10} />
    </div>
  );
}
