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
  onCancelEdit?: () => void // Se presente, exibir botão "CANCELAR" no modo edição
  onSuccess?: (updated: Prediction) => void // Callback chamado após submit bem-sucedido
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
  onCancelEdit,
  onSuccess,
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
    // Só pré-popula submittedPrediction se NÃO estamos no modo edição
    // (no modo edição, onCancelEdit está definido e queremos mostrar o formulário)
    initialPrediction != null && onCancelEdit == null ? initialPrediction : null
  )
  const [minutesRemaining, setMinutesRemaining] = useState<number>(() =>
    minutesUntilDeadline(matchDate)
  )

  // Modo edição: initialPrediction está definido e o formulário está sendo exibido
  // (onCancelEdit sinaliza que fomos abertos pelo botão EDITAR do GameCard)
  const isEditMode = initialPrediction != null && onCancelEdit != null

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

  // Se já tem palpite enviado e não estamos no modo edição, exibir PredictionDisplay
  if (submittedPrediction && !isEditMode) {
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
  function handleScoreInput(value: string, setter: (v: string) => void) {
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

      let res: Response

      if (isEditMode && initialPrediction) {
        // Modo edição: PATCH /api/predictions/:id
        res = await fetch(`/api/predictions/${initialPrediction.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            home_score: home,
            away_score: away,
          }),
        })
      } else {
        // Modo criação: POST /api/predictions
        res = await fetch('/api/predictions', {
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
      }

      const data = await res.json()

      if (res.ok) {
        const updatedPrediction = data as Prediction
        setStatus('success')
        setSubmittedPrediction(updatedPrediction)
        // Notifica o pai (GameCard) sobre o sucesso
        onSuccess?.(updatedPrediction)
      } else if (data.error === 'deadline_expired') {
        setStatus('error')
        setErrorMessage('Prazo encerrado. Não é possível editar o palpite.')
      } else if (data.error === 'forbidden') {
        setStatus('error')
        setErrorMessage('Acesso negado.')
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
        {isEditMode ? 'EDITAR PALPITE' : 'SEU PALPITE'}
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
              color: isCountdownUrgent ? 'var(--color-error)' : 'var(--color-muted)',
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
              backgroundColor: isLoading ? 'var(--color-muted)' : 'var(--color-primary)',
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
            {isLoading ? '...' : isEditMode ? 'SALVAR ALTERAÇÃO' : 'CONFIRMAR PALPITE'}
          </button>
        )}

        {/* Botão CANCELAR — somente no modo edição, independente do deadline */}
        {isEditMode && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            style={{
              marginTop: '0.4rem',
              width: '100%',
              padding: '0.25rem',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--color-muted)',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            CANCELAR
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
