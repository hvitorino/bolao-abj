interface PredictionDisplayProps {
  homeScore: number
  awayScore: number
  homeTeamCode: string
  awayTeamCode: string
  submittedAt?: string // ISO 8601
}

// Formata horário de envio em BRT
function formatSubmittedAt(submittedAt: string): string {
  return new Date(submittedAt).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PredictionDisplay({
  homeScore,
  awayScore,
  homeTeamCode,
  awayTeamCode,
  submittedAt,
}: PredictionDisplayProps) {
  return (
    <div
      style={{
        border: '1px solid var(--color-primary)',
        backgroundColor: 'var(--color-surface)',
        padding: '0.75rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Título */}
      <div
        style={{
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-win)',
          marginBottom: '0.5rem',
          fontWeight: 'bold',
        }}
      >
        ✓ SEU PALPITE
      </div>

      {/* Placar do palpite */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {homeTeamCode}
        </span>
        <span
          style={{
            fontSize: '22px',
            fontWeight: 'bold',
            color: 'var(--color-accent)',
            letterSpacing: '0.05em',
          }}
        >
          {homeScore} × {awayScore}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {awayTeamCode}
        </span>
      </div>

      {/* Horário de envio */}
      {submittedAt && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            textAlign: 'center',
            marginTop: '0.35rem',
          }}
        >
          enviado às {formatSubmittedAt(submittedAt)} BRT
        </div>
      )}
    </div>
  )
}
