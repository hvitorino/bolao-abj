'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface DayNavigatorProps {
  currentDate: string   // YYYY-MM-DD
  gameCount: number     // total de jogos no dia atual
  guessCount: number    // palpites do usuário no dia atual
}

// Formata data para exibição em português
// Ex: "2026-06-13" → "SÁBADO, 13 JUN 2026"
function formatDateDisplay(dateStr: string): string {
  // Usar Date com T00:00:00 para evitar problema de timezone ao criar a data
  const date = new Date(`${dateStr}T12:00:00Z`)
  const formatted = date.toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  // Capitalizar e remover pontos de abreviação (global replace para todos os "DE" e pontos)
  return formatted.toUpperCase().replace(/\./g, '').replace(/ DE /g, ' ')
}

// Soma ou subtrai dias de uma data YYYY-MM-DD
function offsetDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Verifica se a data é hoje (em BRT)
function isToday(dateStr: string): boolean {
  const today = new Date()
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-')
  return dateStr === today
}

export default function DayNavigator({ currentDate, gameCount, guessCount }: DayNavigatorProps) {
  const router = useRouter()
  const today = isToday(currentDate)

  const prevDate = offsetDate(currentDate, -1)
  const nextDate = offsetDate(currentDate, 1)

  function navigate(date: string) {
    router.push(`/jogos?date=${date}`)
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Linha de navegação com setas e data */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Button
          variant="secondary"
          onClick={() => navigate(prevDate)}
          aria-label="Dia anterior"
          style={{ padding: '0.25rem 0.75rem', fontSize: '16px' }}
        >
          ◀
        </Button>

        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              color: today ? 'var(--color-accent)' : 'var(--color-text)',
              fontSize: '14px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {formatDateDisplay(currentDate)}
          </span>
          {today && (
            <span
              style={{
                display: 'inline-block',
                marginLeft: '0.5rem',
                color: 'var(--color-accent)',
                fontSize: '11px',
                textTransform: 'uppercase',
              }}
            >
              (HOJE)
            </span>
          )}
        </div>

        <Button
          variant="secondary"
          onClick={() => navigate(nextDate)}
          aria-label="Próximo dia"
          style={{ padding: '0.25rem 0.75rem', fontSize: '16px' }}
        >
          ▶
        </Button>
      </div>

      {/* Linha de contadores */}
      <div
        style={{
          padding: '0.5rem 1rem',
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
        }}
      >
        <span
          style={{
            color: 'var(--color-muted)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {gameCount} {gameCount === 1 ? 'JOGO' : 'JOGOS'}
        </span>

        <span style={{ color: 'var(--color-muted)', fontSize: '11px' }}>·</span>

        <span
          style={{
            color: guessCount > 0 ? 'var(--color-primary)' : 'var(--color-muted)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {guessCount} {guessCount === 1 ? 'PALPITE' : 'PALPITES'} REGISTRADO{guessCount !== 1 ? 'S' : ''}
        </span>
      </div>
    </div>
  )
}
