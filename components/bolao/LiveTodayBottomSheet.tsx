'use client'

import { useEffect, useState } from 'react'
import { useLiveTodayRanking } from '@/lib/hooks/useLiveTodayRanking'

// ---------------------------------------------------------------------------
// Constantes de estilo
// ---------------------------------------------------------------------------

const FONT = "'JetBrains Mono', 'Courier New', monospace"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LiveTodayBottomSheetProps {
  groupId: string
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function LiveTodayBottomSheet({
  groupId,
  currentUserId,
  isOpen,
  onClose,
}: LiveTodayBottomSheetProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [closeBtnHovered, setCloseBtnHovered] = useState(false)

  const { entries, loading } = useLiveTodayRanking(groupId)

  // Controle de animação — mesmo padrão do RecapBottomSheet
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setVisible(true)
        setAnimating(false)
      })
    } else if (visible) {
      queueMicrotask(() => setAnimating(true))
      const timer = setTimeout(() => {
        setVisible(false)
        setAnimating(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Travar scroll do body
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  if (!visible) return null

  const panelAnimation = animating
    ? 'slideDown 0.3s ease-in forwards'
    : 'slideUp 0.3s ease-out forwards'

  // Verifica se alguma entrada tem jogo live para exibir a legenda
  const hasAnyLiveGame = entries.some((e) => e.hasLiveGame)

  // Estado vazio: sem pontuação disponível (todos os jogos ainda pending)
  const allZero = entries.length > 0 && entries.every((e) => e.points === 0 && !e.hasLiveGame)

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0,0,0,0.7)',
        }}
      />

      {/* Painel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ranking ao vivo do dia"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          padding: '1.25rem 1.5rem',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          fontFamily: FONT,
          animation: panelAnimation,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle de arrasto */}
        <div
          style={{
            width: '40px',
            height: '3px',
            background: 'var(--color-border)',
            borderRadius: '2px',
            margin: '0 auto 1rem',
          }}
        />

        {/* Cabeçalho colorido */}
        <div
          style={{
            backgroundColor: 'var(--color-primary)',
            margin: '-1.25rem -1.5rem 0',
            padding: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: '15px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                color: 'var(--color-accent)',
                letterSpacing: '0.12em',
              }}
            >
              TÁ ROLANDO
            </div>
            <button
              type="button"
              onClick={onClose}
              onMouseEnter={() => setCloseBtnHovered(true)}
              onMouseLeave={() => setCloseBtnHovered(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: '14px',
                color: closeBtnHovered ? 'var(--color-accent)' : 'rgba(240,244,248,0.7)',
                padding: '0 0.25rem',
                transition: 'color 0.15s ease',
                flexShrink: 0,
                marginLeft: '0.5rem',
              }}
              aria-label="Fechar ranking ao vivo"
            >
              ✕
            </button>
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: '11px',
              color: 'rgba(240,244,248,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            PONTUAÇÃO DO DIA · AO VIVO
          </div>
        </div>

        {/* Corpo */}
        <div style={{ marginTop: '1.25rem' }}>
          {loading ? (
            <div
              style={{
                fontFamily: FONT,
                fontSize: '13px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '1rem 0',
              }}
            >
              CARREGANDO...
            </div>
          ) : entries.length === 0 ? (
            <div
              style={{
                fontFamily: FONT,
                fontSize: '13px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '1rem 0',
              }}
            >
              SEM PALPITES PARA OS JOGOS DE HOJE
            </div>
          ) : allZero ? (
            <div
              style={{
                fontFamily: FONT,
                fontSize: '13px',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '1rem 0',
              }}
            >
              SEM PONTUAÇÃO DISPONÍVEL — AGUARDANDO INÍCIO DOS JOGOS
            </div>
          ) : (
            <>
              {/* Tabela de ranking */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: FONT,
                  fontSize: '13px',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        color: 'var(--color-muted)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        paddingBottom: '0.25rem',
                        fontWeight: 'normal',
                        borderBottom: '1px solid var(--color-border)',
                        width: '2rem',
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        color: 'var(--color-muted)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        paddingBottom: '0.25rem',
                        fontWeight: 'normal',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      PARTICIPANTE
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        color: 'var(--color-muted)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        paddingBottom: '0.25rem',
                        fontWeight: 'normal',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      PTS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const isLeader = entry.rankPosition === 1
                    const isCurrentUser = entry.userId === currentUserId

                    const nameColor = isLeader
                      ? 'var(--color-accent)'
                      : isCurrentUser
                        ? 'var(--color-primary)'
                        : 'var(--color-text)'

                    const ptsColor =
                      entry.hasLiveGame && entry.points > 0
                        ? 'var(--color-live)'
                        : 'var(--color-text)'

                    return (
                      <tr key={entry.userId}>
                        <td
                          style={{
                            paddingTop: '0.2rem',
                            paddingBottom: '0.2rem',
                            color: 'var(--color-muted)',
                            verticalAlign: 'middle',
                            width: '2rem',
                          }}
                        >
                          {entry.rankPosition}
                        </td>
                        <td
                          style={{
                            paddingTop: '0.2rem',
                            paddingBottom: '0.2rem',
                            color: nameColor,
                            fontWeight: isLeader ? 'bold' : 'normal',
                            verticalAlign: 'middle',
                          }}
                        >
                          {isLeader ? '► ' : '  '}
                          {entry.name}
                        </td>
                        <td
                          style={{
                            paddingTop: '0.2rem',
                            paddingBottom: '0.2rem',
                            color: ptsColor,
                            textAlign: 'right',
                            verticalAlign: 'middle',
                          }}
                        >
                          {entry.points}
                          {entry.hasLiveGame && entry.points > 0 ? '*' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Legenda de pontos parciais */}
              {hasAnyLiveGame && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontFamily: FONT,
                    fontSize: '11px',
                    color: 'var(--color-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  * PARCIAL — AO VIVO
                </div>
              )}
            </>
          )}
        </div>

        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-bg)',
            fontFamily: FONT,
            textTransform: 'uppercase',
            padding: '0.625rem',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            marginTop: '1rem',
            fontSize: '13px',
            letterSpacing: '0.1em',
            fontWeight: 'bold',
          }}
        >
          FECHAR
        </button>
      </div>
    </>
  )
}
