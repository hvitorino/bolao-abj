export default function JogosPage() {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: 'var(--color-text)',
      }}
    >
      <div
        style={{
          border: '1px solid var(--color-border)',
          padding: '1rem',
          backgroundColor: 'var(--color-surface)',
          display: 'inline-block',
        }}
      >
        <span style={{ color: 'var(--color-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
          JOGOS — Em breve
        </span>
      </div>
    </div>
  )
}
