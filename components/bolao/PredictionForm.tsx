'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Prediction } from '@/lib/types/prediction'
import PredictionDisplay from './PredictionDisplay'

interface PredictionFormProps {
  gameId: string
  homeTeamCode: string
  awayTeamCode: string
  matchDate: string // ISO 8601
  initialPrediction?: Prediction | null
}

type FormStatus = 'idle' | 'loading' | 'success' | 'error'

// Calcula minutos restantes até o deadline (5min antes do jogo)
function minutesUntilDeadline(matchDate: string): number {
  const deadline = new Date(matchDate).getTime() - 5 * 60 * 1000
  return Math.floor((deadline - Date.now()) / 60000)
}

// Formata countdown para exibição
function formatCountdown(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `⏱ FECHA EM ${h}h ${m}min`
  }
  return `⏱ FECHA EM ${minutes}min`
}

export default function PredictionForm({
  gameId,
  homeTeamCode,
  awayTeamCode,
  matchDate,
  initialPrediction,
}: PredictionFormProps) {
  const [homeScore, setHomeScore] = useState<string>(
    initialPrediction != null ? String(initialPrediction.home_score) : ''
  )
  const [awayScore, setAwayScore] = useState<string>(
    initialPrediction != null ? String(initialPrediction.away_score) : ''
  )
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submittedPrediction, setSubmittedPrediction] = useState<Prediction | null>(
    initialPrediction ?? null
  )
  const [minutesRemaining, setMinutesRemaining] = useState<number>(() =>
    minutesUntilDeadline(matchDate)
  )

  // Atualiza countdown a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setMinutesRemaining(minutesUntilDeadline(matchDate))
    }, 1000)
    return () => clearInterval(interval)
  }, [matchDate])

  const isDeadlinePassed = minutesRemaining <= 0
  const showCountdown = minutesRemaining > 0 && minutesRemaining < 120
  const isCountdownUrgent = minutesRemaining <= 30

  // Se já tem palpite enviado, exibir PredictionDisplay
  if (submittedPrediction) {
    return (
      <PredictionDisplay
        homeScore={submittedPrediction.home_score}
        awayScore={submittedPrediction.away_score}
        homeTeamCode={homeTeamCode}
        awayTeamCode={awayTeamCode}
        submittedAt={submittedPrediction.submitted_at}
      />
    )
  }

  // Valida e sanitiza input numérico (apenas inteiros >= 0)
  function handleScoreInput(
    value: string,
    setter: (v: string) => void
  ) {
    if (value === '') {
      setter('')
      return
    }
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0) {
      setter(String(num))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    // Re-validar deadline no submit
    if (isDeadlinePassed) {
      setErrorMessage('Prazo encerrado. Não é possível registrar palpite.')
      return
    }

    const home = parseInt(homeScore, 10)
    const away = parseInt(awayScore, 10)

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setErrorMessage('Informe os placares para os dois times.')
      return
    }

    setStatus('loading')

    try {
      // Obter token JWT do Supabase
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setStatus('error')
        setErrorMessage('Sessão expirada. Faça login novamente.')
        return
      }

      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          game_id: gameId,
          home_score: home,
          away_score: away,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setSubmittedPrediction(data as Prediction)
      } else if (data.error === 'deadline_expired') {
        setStatus('error')
        setErrorMessage('Prazo encerrado. Não é possível registrar palpite.')
      } else if (data.error === 'already_submitted') {
        setStatus('error')
        setErrorMessage('Você já enviou um palpite para este jogo.')
      } else {
        setStatus('error')
        setErrorMessage(data.message || 'Erro ao registrar palpite. Tente novamente.')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Erro de conexão. Tente novamente.')
    }
  }

  const isLoading = status === 'loading'
  const isDisabled = isDeadlinePassed || isLoading

  // Estilos dos inputs numéricos — estilo LED DESIGN.md
  const inputStyle: React.CSSProperties = {
    width: '48px',
    textAlign: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    backgroundColor: 'var(--color-bg)',
    border: isDisabled
      ? '2px solid var(--color-muted)'
      : '2px solid var(--color-accent)',
    color: isDisabled ? 'var(--color-muted)' : 'var(--color-accent)',
    padding: '0.25rem',
    outline: 'none',
    appearance: 'textfield' as React.CSSProperties['appearance'],
    MozAppearance: 'textfield',
    opacity: isDisabled ? 0.6 : 1,
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
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
          color: 'var(--color-muted)',
          marginBottom: '0.5rem',
        }}
      >
        SEU PALPITE
      </div>

      {/* Formulário de placar */}
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {homeTeamCode}
          </span>
          <input
            type="number"
            min="0"
            max="99"
            value={homeScore}
            onChange={(e) => handleScoreInput(e.target.value, setHomeScore)}
            disabled={isDisabled}
            style={inputStyle}
            aria-label={`Placar ${homeTeamCode}`}
            placeholder="0"
          />
          <span
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'var(--color-muted)',
            }}
          >
            ×
          </span>
          <input
            type="number"
            min="0"
            max="99"
            value={awayScore}
            onChange={(e) => handleScoreInput(e.target.value, setAwayScore)}
            disabled={isDisabled}
            style={inputStyle}
            aria-label={`Placar ${awayTeamCode}`}
            placeholder="0"
          />
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {awayTeamCode}
          </span>
        </div>

        {/* Countdown visual (< 2h para o jogo) */}
        {showCountdown && (
          <div
            style={{
              fontSize: '11px',
              textAlign: 'center',
              marginBottom: '0.5rem',
              color: isCountdownUrgent
                ? 'var(--color-error)'
                : 'var(--color-muted)',
              fontWeight: isCountdownUrgent ? 'bold' : 'normal',
            }}
          >
            {formatCountdown(minutesRemaining)}
          </div>
        )}

        {/* Deadline expirado */}
        {isDeadlinePassed && (
          <div
            style={{
              fontSize: '11px',
              textAlign: 'center',
              marginBottom: '0.5rem',
              color: 'var(--color-error)',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            ✗ PRAZO ENCERRADO
          </div>
        )}

        {/* Botão de confirmação */}
        {!isDeadlinePassed && (
          <button
            type="submit"
            disabled={isDisabled}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: isLoading
                ? 'var(--color-muted)'
                : 'var(--color-primary)',
              color: 'var(--color-bg)',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              border: 'none',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
            }}
          >
            {isLoading ? '...' : 'CONFIRMAR PALPITE'}
          </button>
        )}
      </form>

      {/* Feedback de erro */}
      {status === 'error' && errorMessage && (
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '11px',
            color: 'var(--color-error)',
            textAlign: 'center',
          }}
        >
          ✗ {errorMessage}
        </div>
      )}
    </div>
  )
}
