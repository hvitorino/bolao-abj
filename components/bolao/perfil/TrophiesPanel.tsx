'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SectionState } from './PerfilDashboard'
import { getTeamFlag } from '@/lib/utils/teamFlag'

export interface ContributingGame {
  game_id: string
  home_team_code: string
  away_team_code: string
  home_score: number
  away_score: number
}

export interface Trophy {
  id: string
  name: string
  status: 'unlocked' | 'locked'
  unlocked_at: string | null
  progress: number | null
  progress_max: number | null
  contributing_games: ContributingGame[]
}

export interface TrophiesData {
  trophies: Trophy[]
  negativeTrophies: Trophy[]
}

interface TrophiesPanelProps {
  state: SectionState<TrophiesData>
}

const TROPHY_CRITERIA: Record<string, string> = {
  estreia: 'primeiro palpite enviado',
  abriu_o_placar: 'primeiro acerto de vencedor',
  cravada: 'primeiro placar exato',
  rei_da_goleada: 'primeiro bônus de goleada',
  embalado: 'sequência de 3 acertos de vencedor consecutivos',
  em_chamas: 'sequência de 5 acertos consecutivos',
  imparavel: 'sequência de 8 acertos consecutivos',
  profeta: '5 placares exatos no total',
  vidente: '25 acertos de vencedor no total',
  artilheiro: '100 pontos acumulados no grupo',
  perfeito_na_rodada: 'acertou o vencedor de todos os jogos de um dia',
  fiel: 'palpitou em todos os jogos de um dia',
  cartola: 'já ocupou o 1º lugar do grupo',
  zebreiro: 'acertou o vencedor num jogo em que a maioria errou',
  podio: 'fechou uma rodada no top 3',
}

const NEGATIVE_TROPHY_CRITERIA: Record<string, string> = {
  placar_espelhado:  'acertou os números, errou o lado',
  ultima_hora:       'não é procrastinação, é estratégia',
  trono_de_papel:    'passeou na liderança mas a alegria logo se foi',
  quase:             'errou por 1 gol... tão perto, mas tão longe',
  solitario_do_erro: 'errou sozinho o vencedor... parabéns!',
  dia_ruim:          'errou todos os vencedores. toma teu troféu!',
  naufragando:       'sequência de 3 erros consecutivos',
  a_deriva:          'sequência de 5 erros consecutivos',
  sem_volta:         'sequência de 8 erros consecutivos',
}

function renderBar(rate: number, width: number = 5): string {
  const filled = Math.round(rate * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
  return d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
    .replace(/\./g, '')
}

const PANEL: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 0,
  boxShadow: 'none',
  marginBottom: '1px',
}

const GAME_LIST_STYLE: React.CSSProperties = {
  marginTop: '0.4rem',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.3rem',
}

function ContributingGameLine({
  game,
  unlocked,
}: {
  game: ContributingGame
  unlocked: boolean
}) {
  return (
    <Link
      href={`/jogos/${game.game_id}/analise`}
      style={{
        fontSize: '11px',
        color: unlocked ? 'var(--color-win)' : 'var(--color-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        border: `1px solid ${unlocked ? 'var(--color-win)' : 'var(--color-border)'}`,
        borderRadius: '4px',
        padding: '0.2rem 0.4rem',
        whiteSpace: 'nowrap',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      <span>{getTeamFlag(game.home_team_code)}</span>
      <span>{game.home_team_code}</span>
      <span>{game.home_score}</span>
      <span>×</span>
      <span>{game.away_score}</span>
      <span>{game.away_team_code}</span>
      <span>{getTeamFlag(game.away_team_code)}</span>
    </Link>
  )
}

export function TrophiesPanel({ state }: TrophiesPanelProps) {
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set())
  const [trophiesOpen, setTrophiesOpen] = useState(false)
  const [vexamesOpen, setVexamesOpen] = useState(false)

  function toggleGames(trophyId: string) {
    setExpandedGames((prev) => {
      const next = new Set(prev)
      if (next.has(trophyId)) next.delete(trophyId)
      else next.add(trophyId)
      return next
    })
  }

  if (state.status === 'loading') {
    return (
      <div style={PANEL}>
        <div style={{
          fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--color-bg)',
          backgroundColor: 'var(--color-primary)',
          padding: '0.5rem 1rem',
        }}>
          TROFÉUS
        </div>
        <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
          CARREGANDO...
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={PANEL}>
        <div style={{
          fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--color-bg)',
          backgroundColor: 'var(--color-primary)',
          padding: '0.5rem 1rem',
        }}>
          TROFÉUS
        </div>
        <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-error)', textTransform: 'uppercase' }}>
          ✗ ERRO AO CARREGAR TROFÉUS
        </div>
      </div>
    )
  }

  const { trophies } = state.data
  // Backward compat: se negativeTrophies vier undefined (cache antigo), usar []
  const negativeTrophies = state.data.negativeTrophies ?? []
  const unlocked = trophies.filter((t) => t.status === 'unlocked')
  const unlockedNeg = negativeTrophies.filter((t) => t.status === 'unlocked')
  const isAntiPlatina = negativeTrophies.length > 0 && negativeTrophies.every((t) => t.status === 'unlocked')

  return (
    <>
    <div style={PANEL}>
      {/* Header troféus positivos */}
      <button
        type="button"
        onClick={() => setTrophiesOpen((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
          fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--color-bg)',
          backgroundColor: 'var(--color-primary)',
          padding: '0.5rem 1rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        }}
      >
        <span>{trophiesOpen ? '▼' : '▶'} TROFÉUS</span>
        <span style={{ color: 'rgba(10, 14, 26, 0.65)' }}>
          {unlocked.length}/{trophies.length}
        </span>
      </button>

      {/* Grid vertical — troféus positivos */}
      {trophiesOpen && <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
        {trophies.map((trophy, index) => {
          const isLast = index === trophies.length - 1
          const itemStyle: React.CSSProperties = {
            padding: '0.5rem 1rem',
            cursor: 'default',
            borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
            fontSize: '12px',
          }

          const games = trophy.contributing_games ?? []

          if (trophy.status === 'unlocked') {
            const expanded = expandedGames.has(trophy.id)
            return (
              <div key={trophy.id} style={itemStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                  <span style={{ color: 'var(--color-win)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    🏆 {trophy.name}
                  </span>
                  {trophy.unlocked_at && (
                    <span style={{ fontSize: '11px', color: 'var(--color-win)' }}>
                      {formatDate(trophy.unlocked_at)}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '0.2rem', fontSize: '11px', color: 'var(--color-muted)' }}>
                  {TROPHY_CRITERIA[trophy.id] ?? ''}
                </div>
                {games.length > 0 && (
                  <>
                    <button
                      onClick={() => toggleGames(trophy.id)}
                      style={{
                        marginTop: '0.4rem',
                        fontSize: '10px',
                        color: 'var(--color-muted)',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {expanded ? `▲ ocultar jogos` : `▼ ver jogos (${games.length})`}
                    </button>
                    {expanded && (
                      <div style={GAME_LIST_STYLE}>
                        {games.map((game) => (
                          <ContributingGameLine key={game.game_id} game={game} unlocked={true} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          }

          const rate =
            trophy.progress !== null && trophy.progress_max
              ? trophy.progress / trophy.progress_max
              : 0

          return (
            <div key={trophy.id} style={itemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                <span style={{ color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                  🔒 {trophy.name}
                </span>
                {trophy.progress !== null && trophy.progress_max && (
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                    {trophy.progress}/{trophy.progress_max}{' '}
                    <span style={{ letterSpacing: '0.05em' }}>{renderBar(rate)}</span>
                  </span>
                )}
              </div>
              <div style={{ marginTop: '0.2rem', fontSize: '11px', color: 'var(--color-muted)' }}>
                {TROPHY_CRITERIA[trophy.id] ?? ''}
              </div>
            </div>
          )
        })}
      </div>}
    </div>

    {/* Painel separado — Galeria do Vexame */}
    {negativeTrophies.length > 0 && (
      <div style={PANEL}>
          {/* Header da seção negativa */}
          <button
            type="button"
            onClick={() => setVexamesOpen((v) => !v)}
            style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--color-bg)',
              backgroundColor: 'var(--color-error)',
              padding: '0.5rem 1rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            }}
          >
            <span>{vexamesOpen ? '▼' : '▶'} GALERIA DO VEXAME</span>
            <span style={{ color: 'rgba(10,14,26,0.65)' }}>{unlockedNeg.length}/9</span>
          </button>

          {/* Card Anti-Platina — exibido somente quando todos os 9 negativos estão desbloqueados */}
          {vexamesOpen && isAntiPlatina && (
            <div style={{
              padding: '0.5rem 1rem',
              borderBottom: '1px solid var(--color-border)',
              border: '1px solid var(--color-error)',
              backgroundColor: 'rgba(255, 69, 58, 0.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-error)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
                  🤡 COLECIONADOR DO CAOS
                </span>
              </div>
              <div style={{ marginTop: '0.2rem', fontSize: '11px', color: 'var(--color-error)' }}>
                desbloqueou todos os 9 troféus negativos — parabéns, campeão do caos
              </div>
            </div>
          )}

          {/* Cards dos 9 troféus negativos */}
          {vexamesOpen && <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
            {negativeTrophies.map((trophy, index) => {
              const isLast = index === negativeTrophies.length - 1
              const itemStyle: React.CSSProperties = {
                padding: '0.5rem 1rem',
                cursor: 'default',
                borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                fontSize: '12px',
              }
              const games = trophy.contributing_games ?? []

              if (trophy.status === 'unlocked') {
                const expanded = expandedGames.has(trophy.id)
                return (
                  <div key={trophy.id} style={itemStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                      <span style={{ color: 'var(--color-error)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        🤡 {trophy.name}
                      </span>
                      {trophy.unlocked_at && (
                        <span style={{ fontSize: '11px', color: 'var(--color-error)' }}>
                          {formatDate(trophy.unlocked_at)}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: '0.2rem', fontSize: '11px', color: 'var(--color-muted)' }}>
                      {NEGATIVE_TROPHY_CRITERIA[trophy.id] ?? ''}
                    </div>
                    {/* Barra de progresso para progressivos (muted mesmo quando desbloqueado) */}
                    {trophy.progress !== null && trophy.progress_max && (
                      <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                        {trophy.progress}/{trophy.progress_max}{' '}
                        <span style={{ letterSpacing: '0.05em' }}>{renderBar(trophy.progress / trophy.progress_max)}</span>
                      </span>
                    )}
                    {games.length > 0 && (
                      <>
                        <button
                          onClick={() => toggleGames(trophy.id)}
                          style={{
                            marginTop: '0.4rem',
                            fontSize: '10px',
                            color: 'var(--color-muted)',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            display: 'block',
                          }}
                        >
                          {expanded ? `▲ ocultar jogos` : `▼ ver jogos (${games.length})`}
                        </button>
                        {expanded && (
                          <div style={GAME_LIST_STYLE}>
                            {games.map((game) => (
                              <ContributingGameLine key={game.game_id} game={game} unlocked={false} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              }

              // Troféu negativo bloqueado
              return (
                <div key={trophy.id} style={itemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                      🔒 {trophy.name}
                    </span>
                    {trophy.progress !== null && trophy.progress_max && (
                      <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                        {trophy.progress}/{trophy.progress_max}{' '}
                        <span style={{ letterSpacing: '0.05em' }}>{renderBar(trophy.progress / trophy.progress_max)}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: '0.2rem', fontSize: '11px', color: 'var(--color-muted)' }}>
                    {NEGATIVE_TROPHY_CRITERIA[trophy.id] ?? ''}
                  </div>
                </div>
              )
            })}
          </div>}
      </div>
    )}
    </>
  )
}
