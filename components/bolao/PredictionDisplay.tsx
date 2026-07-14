'use client'

interface PredictionDisplayProps {
  homeScore: number
  awayScore: number
  submittedAt?: string
}

function formatSubmittedAt(submittedAt: string): string {
  return new Date(submittedAt).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PredictionDisplay({ homeScore, awayScore, submittedAt }: PredictionDisplayProps) {
  const submittedLabel = submittedAt ? `enviado às ${formatSubmittedAt(submittedAt)} BRT` : null

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", textAlign: 'center' }}>
      <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-accent)', letterSpacing: '0.05em' }}>
        {homeScore} × {awayScore}
      </span>
      {submittedLabel && (
        <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '0.2rem' }}>{submittedLabel}</div>
      )}
    </div>
  )
}
