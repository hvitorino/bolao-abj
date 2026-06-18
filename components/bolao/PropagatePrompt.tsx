'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTeamFlag } from '@/lib/utils/teamFlag'

interface PropagatePromptProps {
  gameId: string
  homeScore: number
  awayScore: number
  homeTeamCode: string
  awayTeamCode: string
  onChooseSingle: () => void // "ESTE GRUPO" — fecha o prompt sem broadcast
  onChooseAll: () => void    // "TODOS OS GRUPOS" — chamado após broadcast concluído
}

type PromptStatus = 'idle' | 'loading' | 'done' | 'error'

interface BroadcastResult {
  group_id: string
  group_name: string
  status: 'saved' | 'deadline_expired'
}

interface BroadcastResponse {
  updated_count: number
  results: BroadcastResult[]
}

export default function PropagatePrompt({
  gameId,
  homeScore,
  awayScore,
  homeTeamCode,
  awayTeamCode,
  onChooseSingle,
  onChooseAll,
}: PropagatePromptProps) {
  const [promptStatus, setPromptStatus] = useState<PromptStatus>('idle')
  const [broadcastData, setBroadcastData] = useState<BroadcastResponse | null>(null)

  // Auto-fechar após 2s nos estados done e error
  useEffect(() => {
    if (promptStatus === 'done') {
      const timer = setTimeout(() => {
        onChooseAll()
      }, 2000)
      return () => clearTimeout(timer)
    }
    if (promptStatus === 'error') {
      const timer = setTimeout(() => {
        onChooseSingle()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [promptStatus, onChooseAll, onChooseSingle])

  async function handleBroadcast() {
    setPromptStatus('loading')

    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setPromptStatus('error')
        return
      }

      const res = await fetch('/api/predictions/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          game_id: gameId,
          home_score: homeScore,
          away_score: awayScore,
        }),
      })

      if (!res.ok) {
        setPromptStatus('error')
        return
      }

      const data: BroadcastResponse = await res.json()
      setBroadcastData(data)
      setPromptStatus('done')
    } catch {
      setPromptStatus('error')
    }
  }

  const expiredCount = broadcastData?.results.filter((r) => r.status === 'deadline_expired').length ?? 0

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
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-win)',
          marginBottom: '0.5rem',
        }}
      >
        ✓ PALPITE REGISTRADO
      </div>

      {/* Separador */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          marginBottom: '0.5rem',
        }}
      />

      {/* Placar resumido */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <span style={{ fontSize: '18px', lineHeight: 1 }}>
          {getTeamFlag(homeTeamCode)}
        </span>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'var(--color-accent)',
            letterSpacing: '0.05em',
          }}
        >
          {homeScore} × {awayScore}
        </span>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>
          {getTeamFlag(awayTeamCode)}
        </span>
      </div>

      {/* Estado idle — opções de propagação */}
      {promptStatus === 'idle' && (
        <>
          <div
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-muted)',
              textAlign: 'center',
              marginBottom: '0.6rem',
            }}
          >
            Aplicar este palpite em:
          </div>

          {/* Botões lado a lado; empilham em telas muito estreitas via flexWrap */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={onChooseSingle}
              style={{
                flex: '1 1 120px',
                padding: '0.5rem',
                backgroundColor: 'var(--color-border)',
                color: 'var(--color-text)',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              ESTE GRUPO
            </button>

            <button
              type="button"
              onClick={handleBroadcast}
              style={{
                flex: '1 1 120px',
                padding: '0.5rem',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-bg)',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              TODOS OS GRUPOS
            </button>
          </div>
        </>
      )}

      {/* Estado loading */}
      {promptStatus === 'loading' && (
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          Salvando em outros grupos...
        </div>
      )}

      {/* Estado done — feedback com contagem */}
      {promptStatus === 'done' && broadcastData && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-win)',
              marginBottom: expiredCount > 0 ? '0.35rem' : 0,
            }}
          >
            ✓ PALPITE SALVO EM {broadcastData.updated_count}{' '}
            {broadcastData.updated_count === 1 ? 'GRUPO' : 'GRUPOS'}
          </div>
          {expiredCount > 0 && (
            <div
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--color-muted)',
                letterSpacing: '0.05em',
              }}
            >
              ({expiredCount} {expiredCount === 1 ? 'grupo' : 'grupos'} com prazo encerrado{' '}
              {expiredCount === 1 ? 'foi ignorado' : 'foram ignorados'})
            </div>
          )}
        </div>
      )}

      {/* Estado error */}
      {promptStatus === 'error' && (
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            color: 'var(--color-error)',
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          ✗ Erro ao propagar. Palpite salvo apenas neste grupo.
        </div>
      )}
    </div>
  )
}
