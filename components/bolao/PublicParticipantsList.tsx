'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ParticipantEntry } from '@/lib/types/participant'
import { calculateLiveScore } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/client'
import type { ScoreBreakdown } from '@/lib/types/score'

interface PublicParticipantsListProps {
  participants: ParticipantEntry[]
  gameStatus: 'pending' | 'live' | 'finished'
  gameId: string
  groupId: string
  liveHomeScore: number | null
  liveAwayScore: number | null
}

/**
 * Ordena participantes conforme status do jogo.
 *
 * - pending:  quem tem palpite (hasPrediction=true) primeiro; desempate por nome pt-BR.
 * - live:     pontuação efetiva calculada no cliente via calculateLiveScore; sem palpite = -1.
 * - finished: pontuação oficial de p.points; sem palpite = -1.
 *
 * Desempate sempre por nome pt-BR ascendente (estável e determinístico).
 */
function sortParticipants(
  participants: ParticipantEntry[],
  gameStatus: 'pending' | 'live' | 'finished',
  liveHomeScore: number | null,
  liveAwayScore: number | null
): ParticipantEntry[] {
  const copy = [...participants]

  if (gameStatus === 'pending') {
    return copy.sort((a, b) => {
      // Quem tem palpite vem antes
      if (a.hasPrediction !== b.hasPrediction) {
        return a.hasPrediction ? -1 : 1
      }
      // Desempate: nome pt-BR ascendente
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }

  // live ou finished: ordenar por pontuação efetiva decrescente
  const getEffectivePoints = (p: ParticipantEntry): number => {
    if (!p.prediction) return -1

    if (gameStatus === 'live') {
      if (liveHomeScore === null || liveAwayScore === null) return -1
      const result = calculateLiveScore(
        { home_score: liveHomeScore, away_score: liveAwayScore },
        p.prediction
      )
      return result?.points ?? -1
    }

    // finished
    return p.points ?? -1
  }

  return copy.sort((a, b) => {
    const ptsA = getEffectivePoints(a)
    const ptsB = getEffectivePoints(b)

    if (ptsA !== ptsB) {
      return ptsB - ptsA // decrescente
    }

    // Desempate: nome pt-BR ascendente
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

/**
 * Tabela pública de palpites e pontuações dos participantes do bolão.
 * Sem accordion de breakdown (simplificado em relação a GameParticipantsList).
 * Sem destacar usuário atual (sem currentUserId na página pública).
 *
 * Visibilidade:
 * - pending: OCULTO (hasPrediction=true) ou PENDENTE (hasPrediction=false); sem coluna PTS
 * - live: palpite real + pontuação provisória calculada no cliente via calculateLiveScore
 * - finished: palpite real + pontuação oficial de scores
 *
 * Realtime de scores (finished): subscreve ao canal public-scores-${gameId} para atualizar
 * pontos quando scores são inseridos/atualizados no Supabase.
 *
 * Animação: FLIP manual via useLayoutEffect + CSS transitions (350ms ease-in-out).
 * Ordena por pontuação efetiva decrescente em live/finished; reordena animado a cada update.
 */
export default function PublicParticipantsList({
  participants: initialParticipants,
  gameStatus,
  gameId,
  groupId,
  liveHomeScore,
  liveAwayScore,
}: PublicParticipantsListProps) {
  const [participants, setParticipants] = useState<ParticipantEntry[]>(initialParticipants)

  const showPoints = gameStatus === 'finished'
  const showLivePoints = gameStatus === 'live'
  const isPending = gameStatus === 'pending'

  // Ordenação derivada: recalcula sempre que participants, status ou placares mudam
  const sortedParticipants = useMemo(
    () => sortParticipants(participants, gameStatus, liveHomeScore, liveAwayScore),
    [participants, gameStatus, liveHomeScore, liveAwayScore]
  )

  // Refs FLIP: mapa userId → elemento DOM da row
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Posições anteriores de cada row (FIRST step do FLIP)
  const prevPositions = useRef<Map<string, DOMRect>>(new Map())

  // Guard: suprime animação no primeiro render
  const isFirstRender = useRef(true)

  // Captura posições atuais antes de uma re-renderização (chamado antes de setParticipants)
  const capturePositions = () => {
    const map = new Map<string, DOMRect>()
    rowRefs.current.forEach((el, userId) => {
      if (el) {
        map.set(userId, el.getBoundingClientRect())
      }
    })
    prevPositions.current = map
  }

  // FLIP: executa após cada mudança de sortedParticipants
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      // Salva posições iniciais sem animar
      capturePositions()
      return
    }

    // Para cada row visível, calcular delta entre posição anterior (FIRST) e atual (LAST)
    const elements: Array<{ el: HTMLDivElement; deltaY: number }> = []

    rowRefs.current.forEach((el, userId) => {
      if (!el) return
      const first = prevPositions.current.get(userId)
      if (!first) return
      const last = el.getBoundingClientRect()
      const deltaY = first.top - last.top

      if (deltaY !== 0) {
        elements.push({ el, deltaY })
      }
    })

    if (elements.length === 0) {
      // Sem mudança de posição — apenas atualiza prevPositions para próximo ciclo
      capturePositions()
      return
    }

    // INVERT: aplicar transform reverso (sem transition para posicionar instantaneamente)
    elements.forEach(({ el, deltaY }) => {
      el.style.transition = 'none'
      el.style.transform = `translateY(${deltaY}px)`
    })

    // Forçar reflow para garantir que o browser aplique o estado INVERT antes de PLAY
    void elements[0]?.el.getBoundingClientRect()

    // PLAY: remover transform — o CSS transition anima de volta para translateY(0)
    elements.forEach(({ el }) => {
      el.style.transition = 'transform 350ms ease-in-out'
      el.style.transform = ''
    })

    // Atualiza prevPositions para o próximo ciclo
    capturePositions()
  }, [sortedParticipants])

  // Realtime de scores — somente para jogos encerrados
  // (ao vivo, pontuação é calculada no cliente; pending, não há pontuação)
  useEffect(() => {
    if (gameStatus !== 'finished') return

    const supabase = createClient()

    const channel = supabase
      .channel(`public-scores-${gameId}-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newScore = payload.new as {
            user_id: string
            points: number
            breakdown: ScoreBreakdown
          }
          if (!newScore?.user_id) return

          // Captura posições ANTES de atualizar o estado (step FIRST do FLIP)
          capturePositions()

          // Atualiza apenas participantes que pertencem ao grupo (já filtrados via SSR)
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === newScore.user_id
                ? { ...p, points: newScore.points, breakdown: newScore.breakdown }
                : p
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, groupId, gameStatus])

  // Callback ref para registrar/desregistrar rows no mapa
  const getRowRef = (userId: string) => (el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(userId, el)
    } else {
      rowRefs.current.delete(userId)
    }
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
      {/* Cabeçalho da seção */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          PALPITES DOS PARTICIPANTES
        </span>
        {showLivePoints && (
          <span
            style={{
              fontSize: '9px',
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            AO VIVO
          </span>
        )}
      </div>

      {/* Estado vazio */}
      {sortedParticipants.length === 0 && (
        <div
          style={{
            padding: '0.75rem',
            fontSize: '11px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          SEM PARTICIPANTES
        </div>
      )}

      {/* Lista de palpites com roles ARIA e animação FLIP */}
      {sortedParticipants.length > 0 && (
        <div
          role="table"
          aria-label="Palpites dos participantes"
          style={{ width: '100%', fontSize: '11px' }}
        >
          {/* Cabeçalho da tabela */}
          <div role="rowgroup">
            <div
              role="row"
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div
                role="columnheader"
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  textAlign: 'left',
                  color: 'var(--color-muted)',
                  fontWeight: 'normal',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0.4rem 0.75rem',
                }}
              >
                PARTICIPANTE
              </div>
              <div
                role="columnheader"
                style={{
                  flex: '0 0 auto',
                  minWidth: '80px',
                  textAlign: 'center',
                  color: 'var(--color-muted)',
                  fontWeight: 'normal',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0.4rem 0.75rem',
                }}
              >
                PALPITE
              </div>
              {(showPoints || showLivePoints) && (
                <div
                  role="columnheader"
                  style={{
                    flex: '0 0 auto',
                    minWidth: '48px',
                    textAlign: 'right',
                    color: 'var(--color-muted)',
                    fontWeight: 'normal',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '0.4rem 0.75rem',
                  }}
                >
                  {showLivePoints ? 'PTS*' : 'PTS'}
                </div>
              )}
            </div>
          </div>

          {/* Corpo da tabela: rows animáveis */}
          <div role="rowgroup">
            {sortedParticipants.map((p) => {
              // Visibilidade de palpites em jogos pendentes
              const predictionLabel = isPending
                ? p.hasPrediction
                  ? 'OCULTO'
                  : 'PENDENTE'
                : p.prediction
                  ? `${p.prediction.home_score} × ${p.prediction.away_score}`
                  : '-'

              // Pontuação ao vivo calculada no cliente
              const liveResult =
                showLivePoints && p.prediction && liveHomeScore !== null && liveAwayScore !== null
                  ? calculateLiveScore(
                      {
                        home_score: liveHomeScore,
                        away_score: liveAwayScore,
                      },
                      p.prediction
                    )
                  : null

              const effectivePoints = showLivePoints ? (liveResult?.points ?? null) : p.points

              const predictionColor = isPending
                ? p.hasPrediction
                  ? 'var(--color-muted)'
                  : 'var(--color-error)'
                : p.prediction
                  ? 'var(--color-accent)'
                  : 'var(--color-muted)'

              const pointsColor =
                p.prediction === null
                  ? 'var(--color-muted)'
                  : effectivePoints !== null && effectivePoints > 0
                    ? 'var(--color-accent)'
                    : 'var(--color-muted)'

              return (
                <div
                  key={p.userId}
                  ref={getRowRef(p.userId)}
                  role="row"
                  style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--color-border)',
                    // transition inicial padrão (será sobrescrito dinamicamente pelo FLIP)
                    transition: 'transform 350ms ease-in-out',
                  }}
                >
                  {/* PARTICIPANTE */}
                  <div
                    role="cell"
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      padding: '0.35rem 0.75rem',
                      color: 'var(--color-text)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {p.name}
                  </div>

                  {/* PALPITE */}
                  <div
                    role="cell"
                    style={{
                      flex: '0 0 auto',
                      minWidth: '80px',
                      padding: '0.35rem 0.75rem',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      color: predictionColor,
                      textTransform: isPending ? 'uppercase' : undefined,
                      letterSpacing: isPending ? '0.05em' : undefined,
                    }}
                  >
                    {predictionLabel}
                  </div>

                  {/* PTS / PTS* */}
                  {(showPoints || showLivePoints) && (
                    <div
                      role="cell"
                      style={{
                        flex: '0 0 auto',
                        minWidth: '48px',
                        padding: '0.35rem 0.75rem',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: pointsColor,
                      }}
                    >
                      {p.prediction === null
                        ? '-'
                        : effectivePoints !== null
                          ? `+${effectivePoints}`
                          : '-'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rodapé com legenda para pontuação ao vivo */}
      {showLivePoints && (
        <div
          style={{
            padding: '0.4rem 0.75rem',
            borderTop: '1px solid var(--color-border)',
            fontSize: '10px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          * PONTUAÇÃO PROVISÓRIA — ATUALIZA EM TEMPO REAL
        </div>
      )}
    </div>
  )
}
