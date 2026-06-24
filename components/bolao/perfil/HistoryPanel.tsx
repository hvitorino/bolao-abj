'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getTeamFlag } from '@/lib/utils/teamFlag'
import type { SectionState } from './PerfilDashboard'
import type { Trophy } from './TrophiesPanel'

export interface HistoryItem {
  game_id: string
  match_date: string
  match_day: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  home_score: number
  away_score: number
  pred_home: number | null
  pred_away: number | null
  points: number
  breakdown: Record<string, number> | null
  is_miss: boolean
  trophy_unlocked_id: string | null
}

export interface HistoryData {
  items: HistoryItem[]
  total: number
  has_more: boolean
}

interface HistoryPanelProps {
  state: SectionState<HistoryData>
  onLoadMore: () => void
  loadingMore: boolean
  trophies: Trophy[]
  negativeTrophies: Trophy[]
}

const TROPHY_NAMES: Record<string, string> = {
  estreia: 'ESTREIA',
  abriu_o_placar: 'ABRIU O PLACAR',
  cravada: 'CRAVADA',
  rei_da_goleada: 'REI DA GOLEADA',
  embalado: 'EMBALADO',
  em_chamas: 'EM CHAMAS',
  imparavel: 'IMPARÁVEL',
  profeta: 'PROFETA',
  vidente: 'VIDENTE',
  artilheiro: 'ARTILHEIRO',
  perfeito_na_rodada: 'PERFEITO NA RODADA',
  fiel: 'FIEL',
  cartola: 'CARTOLA',
  zebreiro: 'ZEBREIRO',
  podio: 'PÓDIO',
}

function formatDayHeader(matchDay: string): string {
  const d = new Date(matchDay + 'T12:00:00')
  return d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .toUpperCase()
    .replace(/\./g, '')
}

function formatMatchTime(matchDate: string): string {
  const d = new Date(matchDate)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

const MONO_FONT = "'JetBrains Mono', 'Courier New', monospace"

function variantColor(variant: 'win' | 'neutral' | 'miss'): string {
  return variant === 'win' ? 'var(--color-win)' : variant === 'miss' ? 'var(--color-error)' : 'var(--color-muted)'
}

function ScoreCard({
  home_team_code,
  away_team_code,
  home_score,
  away_score,
  variant,
}: {
  home_team_code: string
  away_team_code: string
  home_score: number
  away_score: number
  variant: 'win' | 'neutral' | 'miss'
}) {
  const color = variantColor(variant)
  return (
    <div style={{
      fontSize: '11px', color,
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      fontFamily: MONO_FONT,
      border: `1px solid ${color}`,
      padding: '0.2rem 0.4rem',
      whiteSpace: 'nowrap',
    }}>
      <span>{getTeamFlag(home_team_code)}</span>
      <span>{home_team_code}</span>
      <span>{home_score}×{away_score}</span>
      <span>{away_team_code}</span>
      <span>{getTeamFlag(away_team_code)}</span>
    </div>
  )
}

function PointsBadge({ points, variant }: { points: number; variant: 'win' | 'neutral' | 'miss' }) {
  const color = variantColor(variant)
  return (
    <div style={{
      fontSize: '11px', color,
      fontFamily: MONO_FONT,
      border: `1px solid ${color}`,
      padding: '0.2rem 0.4rem',
      whiteSpace: 'nowrap',
      fontWeight: points > 0 ? 'bold' : 'normal',
    }}>
      +{points}
    </div>
  )
}

function groupByDay(items: HistoryItem[]): [string, HistoryItem[]][] {
  const map = new Map<string, HistoryItem[]>()
  for (const item of items) {
    if (!map.has(item.match_day)) {
      map.set(item.match_day, [])
    }
    map.get(item.match_day)!.push(item)
  }
  return [...map.entries()]
}

const PANEL: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 0,
  boxShadow: 'none',
}

const HEADER: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--color-bg)',
  backgroundColor: 'var(--color-primary)',
  padding: '0.5rem 1rem',
}

export function HistoryPanel({ state, onLoadMore, loadingMore, negativeTrophies }: HistoryPanelProps) {
  const gameIdToNegTrophy = new Map<string, Trophy>()
  for (const t of negativeTrophies) {
    if (t.status === 'unlocked') {
      for (const g of t.contributing_games) {
        if (!gameIdToNegTrophy.has(g.game_id)) gameIdToNegTrophy.set(g.game_id, t)
      }
    }
  }
  const [open, setOpen] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const defaultSetRef = useRef(false)

  useEffect(() => {
    if (state.status === 'populated' && !defaultSetRef.current) {
      const days = groupByDay(state.data.items)
      if (days.length > 0) {
        defaultSetRef.current = true
        setExpandedDays(new Set([days[0][0]]))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

  function toggleDay(day: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const headerBtn = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      style={{
        ...HEADER,
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {open ? '▼' : '▶'} HISTÓRICO
    </button>
  )

  if (state.status === 'loading') {
    return (
      <div style={PANEL}>
        {headerBtn}
        {open && <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
          CARREGANDO...
        </div>}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={PANEL}>
        {headerBtn}
        {open && <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-error)', textTransform: 'uppercase' }}>
          ✗ ERRO AO CARREGAR HISTÓRICO
        </div>}
      </div>
    )
  }

  const { items, has_more } = state.data
  const days = groupByDay(items)

  return (
    <div style={PANEL}>
      {headerBtn}

      {open && items.length === 0 && (
        <div style={{ padding: '1.5rem 1rem', fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
          NENHUM JOGO ENCERRADO AINDA
        </div>
      )}

      {open && days.map(([day, dayItems]) => {
        const expanded = expandedDays.has(day)
        return (
        <div key={day}>
          {/* Cabeçalho do dia — clicável para expandir/recolher */}
          <button
            onClick={() => toggleDay(day)}
            style={{
              width: '100%',
              padding: '0.35rem 1rem',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              backgroundColor: 'var(--color-bg)',
              borderBottom: '1px solid var(--color-border)',
              letterSpacing: '0.05em',
              fontFamily: 'inherit',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>{expanded ? '▼' : '▶'}</span>
            <span>{formatDayHeader(day)}</span>
            {!expanded && (
              <span style={{ color: 'var(--color-muted)', fontWeight: 'normal' }}>
                ({dayItems.length} {dayItems.length === 1 ? 'jogo' : 'jogos'})
              </span>
            )}
          </button>

          {/* Jogos do dia — só renderiza quando expandido */}
          {expanded && dayItems.map((item, idx) => {
            const hasPred = item.pred_home !== null && item.pred_away !== null
            const resultVariant: 'win' | 'neutral' | 'miss' = item.is_miss ? 'miss' : item.points > 0 ? 'win' : 'neutral'
            const posTrophyName = item.trophy_unlocked_id
              ? (TROPHY_NAMES[item.trophy_unlocked_id] ?? item.trophy_unlocked_id)
              : null
            const negTrophy = gameIdToNegTrophy.get(item.game_id)
            const hasTrophy = !!posTrophyName || !!negTrophy

            return (
              <Link
                key={item.game_id}
                href={`/jogos/${item.game_id}/analise`}
                style={{
                  padding: '0.5rem 1rem',
                  borderBottom: idx < dayItems.length - 1 ? '1px solid var(--color-border)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.3rem',
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {/* Linha 1: hora | resultado | palpite | pontos */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--color-muted)', fontSize: '11px', fontFamily: MONO_FONT }}>
                    {formatMatchTime(item.match_date)}
                  </span>

                  <ScoreCard
                    home_team_code={item.home_team_code}
                    away_team_code={item.away_team_code}
                    home_score={item.home_score}
                    away_score={item.away_score}
                    variant={resultVariant}
                  />

                  {hasPred ? (
                    <>
                      <ScoreCard
                        home_team_code={item.home_team_code}
                        away_team_code={item.away_team_code}
                        home_score={item.pred_home!}
                        away_score={item.pred_away!}
                        variant={resultVariant}
                      />
                      <PointsBadge points={item.points} variant={resultVariant} />
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-error)', fontSize: '11px', fontFamily: MONO_FONT }}>
                      SEM PALPITE
                    </span>
                  )}
                </div>

                {/* Linha 2: troféus centralizados */}
                {hasTrophy && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {posTrophyName && (
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--color-accent)',
                        border: '1px solid var(--color-accent)',
                        backgroundColor: 'rgba(255,223,0,0.08)',
                        padding: '0.1rem 0.5rem',
                        fontFamily: MONO_FONT,
                        fontWeight: 'bold',
                        letterSpacing: '0.04em',
                      }}>
                        🏆 {posTrophyName}
                      </span>
                    )}
                    {negTrophy && (
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--color-error)',
                        border: '1px solid var(--color-error)',
                        backgroundColor: 'rgba(255,69,58,0.08)',
                        padding: '0.1rem 0.5rem',
                        fontFamily: MONO_FONT,
                        fontWeight: 'bold',
                        letterSpacing: '0.04em',
                      }}>
                        🫠 {negTrophy.name}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}

          {/* Borda inferior de separação entre dias */}
          <div style={{ borderBottom: '1px solid var(--color-border)' }} />
        </div>
        )
      })}

      {/* Botão VER MAIS */}
      {open && has_more && (
        <div style={{ padding: '0.75rem 1rem' }}>
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              backgroundColor: 'transparent',
              color: loadingMore ? 'var(--color-muted)' : 'var(--color-primary)',
              border: `1px solid ${loadingMore ? 'var(--color-border)' : 'var(--color-primary)'}`,
              borderRadius: 0,
              cursor: loadingMore ? 'not-allowed' : 'pointer',
            }}
          >
            {loadingMore ? 'CARREGANDO...' : 'VER MAIS'}
          </button>
        </div>
      )}
    </div>
  )
}
