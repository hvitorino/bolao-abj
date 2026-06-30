'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ── Mapeamento de usuários (bolaodefutebol → nome) ──────────────────────
const USERS: Record<string, string> = {
  '7f6249ad-4b2b-4ca1-b298-f078dfc8d03b': 'Hamon Vitorino',
  '6e7e3f9a-3456-4296-8c5b-f3b8ef14d103': 'David Macedo',
  'ef712a54-8b7b-492f-936b-c38dabc01f8e': 'Thiago Brito',
  '8d271d3a-139e-4273-baec-729bfb2dfd1b': 'Michel Egidio',
  '0d5d7248-ef8c-460e-a5d3-49997ed3d2fe': 'Roberto Sales',
  '08648e5c-81f7-4fcb-a581-ba1c8a2596e0': 'Fabio Oliveira',
  '9d4a0595-3e1d-40fc-9715-370c3e072b57': 'Henrique Saraiva',
  'a7501df4-0689-4ac3-a367-3b23c31ea88f': 'JoaoFilho',
  '4ccdf0db-c9e6-43c2-ad83-ca7507fb0b55': 'Civilizado',
  'eba7845b-7895-4a46-bf47-6f87b4dcc44c': 'Raimundo Nonato',
  '8e709090-f455-4d03-8308-3e74d55624ad': 'Hermes Junior',
  'f197cbe1-3de8-410f-b6ef-03170e16667d': 'Josue',
}

function userName(id: string): string {
  return USERS[id] ?? id.slice(0, 8)
}

// ── Tipos ────────────────────────────────────────────────────────────────

interface BdfMatch {
  id: string
  home_team: string
  away_team: string
  start_time: string
  status: string
  home_score?: number | null
  away_score?: number | null
  winner: string | null
  sub_status: string
  match_number: number
  stage: string
  phase: string
  allow_extra_time: boolean
  allow_penalties: boolean
  extra_time_result: string
  penalties_winner?: string
}

interface BdfPrediction {
  user_id: string
  home_score: number
  away_score: number
  predicted_winner: string
  predicted_diff: number
  points_earned: number
  status: string
  scoring_state: string
}

interface LeaderboardEntry {
  user_id: string
  user_name: string
  total_points: number
  rank: number
  tiebreaker_stats: {
    winner_count: number
    exact_score_count: number
    goal_diff_count: number
    loser_goals_count: number
    goleada_count: number
    entry_order: number
  }
}

const POLL_MS = 10_000

// ── Helpers ──────────────────────────────────────────────────────────────

/** Retorna a data de hoje no fuso BRT (UTC-3) como YYYY-MM-DD */
function todayBRT(): string {
  const now = new Date()
  // BRT = UTC-3
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(0, 10)
}

/** Converte uma data ISO (UTC) para YYYY-MM-DD no fuso BRT */
function toBrtDate(isoString: string): string {
  const utc = new Date(isoString)
  const brt = new Date(utc.getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(0, 10)
}

/** Converte horário UTC para string BRT (HH:MM) */
function toBrtTime(isoString: string): string {
  const utc = new Date(isoString)
  const brt = new Date(utc.getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(11, 16)
}

function statusLabel(match: BdfMatch): string {
  if (match.status === 'live') {
    const sub: Record<string, string> = {
      first_half: '1º Tempo',
      second_half: '2º Tempo',
      half_time: 'Intervalo',
      extra_time_first: 'Prorrogação',
      extra_time_second: 'Prorrogação',
    }
    return sub[match.sub_status] ?? 'AO VIVO'
  }
  if (match.status === 'finished') {
    if (match.extra_time_result === 'penalties') return 'Pênaltis'
    return 'Finalizado'
  }
  const time = toBrtTime(match.start_time)
  return `${time} BRT`
}

function matchScore(m: BdfMatch): string {
  if (m.home_score == null || m.away_score == null) return '×'
  return `${m.home_score} × ${m.away_score}`
}

function predictionIndicator(
  pred: BdfPrediction,
  match: BdfMatch
): { icon: string; vde: string } {
  if (match.status !== 'finished' && match.status !== 'live') {
    return { icon: '', vde: '' }
  }
  const realHome = match.home_score ?? 0
  const realAway = match.away_score ?? 0
  const realDiff = Math.abs(realHome - realAway)
  const exact =
    pred.home_score === realHome && pred.away_score === realAway
  const diffMatch =
    !exact &&
    pred.predicted_winner === match.winner &&
    Math.abs(pred.home_score - pred.away_score) === realDiff
  const winnerMatch = pred.predicted_winner === match.winner

  if (exact) return { icon: '✅', vde: 'V+D+E' }
  if (diffMatch) return { icon: '⚡', vde: 'V+D' }
  if (winnerMatch) return { icon: '🏆', vde: 'V' }
  return { icon: '❌', vde: '—' }
}

// ── Componente principal ─────────────────────────────────────────────────

export default function CartolaClient() {
  const [matches, setMatches] = useState<BdfMatch[]>([])
  const [predictions, setPredictions] = useState<Record<string, BdfPrediction[]>>({})
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [todayPoints, setTodayPoints] = useState<Record<string, number>>({})
  const [tiers, setTiers] = useState<Record<string, string>>({})
  const prevScoresKey = useRef('')
  const hasData = useRef(false)
  const tiersFetched = useRef(false)

  const fetchAll = useCallback(async () => {
    try {
      // Buscar tiers (só na primeira vez — não mudam durante a sessão)
      if (!tiersFetched.current) {
        const tRes = await fetch('/api/bolaofutebol/tiers')
        if (tRes.ok) {
          const tData = await tRes.json()
          const map: Record<string, string> = {}
          for (const e of tData.entries ?? []) {
            map[e.user_id] = e.tier
          }
          setTiers(map)
          tiersFetched.current = true
        }
      }

      // Buscar todos os jogos
      const mRes = await fetch('/api/bolaofutebol/matches')
      if (!mRes.ok) throw new Error(`Matches: ${mRes.status}`)
      const allMatches: BdfMatch[] = await mRes.json()

      // Buscar leaderboard
      const lRes = await fetch('/api/bolaofutebol/leaderboard')
      const lbData = lRes.ok
        ? await lRes.json()
        : { entries: [] }

      // Filtrar jogos de hoje (BRT) + ao vivo
      const t = todayBRT()
      const liveIds = allMatches
        .filter((m) => m.status === 'live')
        .map((m) => m.id)
      const todayMatches = allMatches.filter((m) => {
        const brtDay = toBrtDate(m.start_time)
        return brtDay === t || liveIds.includes(m.id)
      })

      // Fingerprint para evitar re-render desnecessário
      const scoresKey = todayMatches
        .map((m) => `${m.id}:${m.status}:${m.home_score}:${m.away_score}`)
        .join('|')
      const scoresChanged = scoresKey !== prevScoresKey.current
      prevScoresKey.current = scoresKey

      // Buscar palpites para jogos live/finished (em paralelo)
      const liveOrFinished = todayMatches.filter(
        (m) => m.status === 'live' || m.status === 'finished'
      )
      const newPreds: Record<string, BdfPrediction[]> = {}
      let newTodayPoints: Record<string, number> = {}

      if (liveOrFinished.length > 0) {
        const predResults = await Promise.all(
          liveOrFinished.map(async (m) => {
            const pRes = await fetch(
              `/api/bolaofutebol/matches/${m.id}/predictions`
            )
            const pData: BdfPrediction[] = pRes.ok ? await pRes.json() : []
            return { matchId: m.id, predictions: pData }
          })
        )
        for (const { matchId, predictions: pData } of predResults) {
          newPreds[matchId] = pData
          for (const p of pData) {
            if (
              p.status === 'processed' &&
              p.scoring_state === 'scored' &&
              p.points_earned > 0
            ) {
              newTodayPoints[p.user_id] =
                (newTodayPoints[p.user_id] ?? 0) + p.points_earned
            }
          }
        }
      }

      if (scoresChanged || !hasData.current) {
        setMatches(todayMatches)
        setPredictions(newPreds)
        setLeaderboard(lbData.entries ?? [])
        setTodayPoints(newTodayPoints)
        setLastUpdate(new Date())
      }

      hasData.current = true
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      if (!hasData.current) setError(msg)
      console.error('[CartolaClient]', msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    let initialTimer: ReturnType<typeof setTimeout>

    function start() {
      void fetchAll()
      interval = setInterval(() => void fetchAll(), POLL_MS)
    }

    function stop() {
      if (interval) { clearInterval(interval); interval = null }
    }

    function onVis() {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    initialTimer = setTimeout(start, 0)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      clearTimeout(initialTimer)
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fetchAll])

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
        CARREGANDO...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          border: '1px solid var(--color-error)',
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          fontSize: '12px',
          color: 'var(--color-error)',
          textTransform: 'uppercase',
        }}
      >
        ✗ {error}
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          fontSize: '12px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        NENHUM JOGO HOJE
      </div>
    )
  }

  // Separar jogos live e finished
  const liveMatches = matches.filter((m) => m.status === 'live')
  const finishedMatches = matches.filter((m) => m.status === 'finished')
  const upcomingMatches = matches.filter(
    (m) => m.status !== 'live' && m.status !== 'finished'
  )

  // Montar ranking combinado (leaderboard + pontos de hoje)
  const combinedRanking = leaderboard.map((entry) => {
    const tPts = todayPoints[entry.user_id] ?? 0
    return {
      ...entry,
      combined_total: entry.total_points + tPts,
      today_points: tPts,
    }
  })
  combinedRanking.sort((a, b) => b.combined_total - a.combined_total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Jogos ao vivo ── */}
      {liveMatches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          predictions={predictions[m.id] ?? []}
          tiers={tiers}
          isLive
        />
      ))}

      {/* ── Jogos finalizados ── */}
      {finishedMatches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          predictions={predictions[m.id] ?? []}
          tiers={tiers}
          isLive={false}
        />
      ))}

      {/* ── Jogos pendentes ── */}
      {upcomingMatches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          predictions={[]}
          tiers={tiers}
          isLive={false}
        />
      ))}

      {/* ── Ranking ── */}
      <RankingSection
        ranking={combinedRanking}
        todayPoints={todayPoints}
        tiers={tiers}
      />

      {/* ── Footer: última atualização ── */}
      <div
        style={{
          fontSize: '10px',
          color: 'var(--color-muted)',
          textAlign: 'right',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {lastUpdate
          ? `ATUALIZADO ${lastUpdate.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })} BRT · ${POLL_MS / 1000}s`
          : 'ATUALIZANDO...'}
      </div>
    </div>
  )
}

// ── Subcomponentes ───────────────────────────────────────────────────────

function MatchCard({
  match,
  predictions,
  tiers,
  isLive,
}: {
  match: BdfMatch
  predictions: BdfPrediction[]
  tiers: Record<string, string>
  isLive: boolean
}) {
  const label = statusLabel(match)
  const showPredictions =
    predictions.length > 0 &&
    (match.status === 'live' || match.status === 'finished')
  const pending = match.status !== 'live' && match.status !== 'finished'

  // Ordenar palpites por pontos
  const sorted = [...predictions].sort((a, b) => {
    if (b.points_earned !== a.points_earned)
      return b.points_earned - a.points_earned
    return userName(a.user_id).localeCompare(userName(b.user_id))
  })

  return (
    <div
      style={{
        border: `1px solid ${isLive ? 'var(--color-live)' : 'var(--color-border)'}`,
        backgroundColor: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho do jogo */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'var(--color-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {match.home_team}{' '}
            <span style={{ color: 'var(--color-accent)' }}>
              {matchScore(match)}
            </span>{' '}
            {match.away_team}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--color-muted)',
              marginTop: '0.25rem',
              textTransform: 'uppercase',
            }}
          >
            #{match.match_number} · {match.stage} ·{' '}
            {toBrtTime(match.start_time)} BRT
          </div>
        </div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: isLive ? 'var(--color-live)' : 'var(--color-muted)',
            ...(isLive ? { animation: 'blink 1s step-end infinite' } : {}),
          }}
        >
          {isLive ? `██ ${label} ██` : label}
        </div>
      </div>

      {/* Tabela de palpites */}
      {showPredictions && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-muted)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                <th style={thStyle}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Participante</th>
                <th style={thStyle}>Palpite</th>
                {!pending && (
                  <>
                    <th style={thStyle}>Acertos</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Pts</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const { icon, vde } = predictionIndicator(p, match)
                return (
                  <tr
                    key={p.user_id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      height: '28px',
                    }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-muted)', width: '2rem' }}>
                      {i + 1}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                      {userName(p.user_id)}
                      {tiers[p.user_id] === 'pro' && (
                        <span style={{ marginLeft: '0.3rem', fontSize: '9px', fontWeight: 'bold', color: 'var(--color-accent)', verticalAlign: 'top' }}>PRO</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-accent)', fontWeight: 'bold' }}>
                      {p.home_score}×{p.away_score}
                    </td>
                    {!pending && (
                      <>
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: '11px' }}>
                          {icon} {vde}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: 'right',
                            color: p.points_earned > 0 ? 'var(--color-win)' : 'var(--color-muted)',
                            fontWeight: 'bold',
                            width: '4rem',
                          }}
                        >
                          {p.points_earned > 0 ? `${Math.round(p.points_earned / 100)}` : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sem palpites ainda */}
      {pending && (
        <div
          style={{
            padding: '0.75rem 1rem',
            fontSize: '11px',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Palpites disponíveis após início do jogo
        </div>
      )}

      {showPredictions && (
        <div
          style={{
            padding: '0.5rem 1rem',
            fontSize: '10px',
            color: 'var(--color-muted)',
            borderTop: '1px solid var(--color-border)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {sorted.length} participantes
          {match.status === 'live' && ' · Pontuação provisória'}
        </div>
      )}
    </div>
  )
}

// ── Ranking ──────────────────────────────────────────────────────────────

function RankingSection({
  ranking,
  todayPoints,
  tiers,
}: {
  ranking: (LeaderboardEntry & {
    combined_total: number
    today_points: number
  })[]
  todayPoints: Record<string, number>
  tiers: Record<string, string>
}) {
  if (ranking.length === 0) return null

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '13px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-accent)',
          textAlign: 'center',
        }}
      >
        🏆 RANKING — CARTOLA ABJ
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--color-border)',
                color: 'var(--color-muted)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <th style={thStyle}>#</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Participante</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Hoje</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>E/D/V</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((entry, i) => {
              const name = USERS[entry.user_id] ?? entry.user_name
              const total = entry.combined_total / 100
              const today = (todayPoints[entry.user_id] ?? 0) / 100
              const ts = entry.tiebreaker_stats
              const isLeader = i === 0

              return (
                <tr
                  key={entry.user_id}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    height: '30px',
                    ...(isLeader
                      ? {
                          backgroundColor: 'var(--color-bg)',
                        }
                      : {}),
                  }}
                >
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'center',
                      width: '2rem',
                      color: isLeader
                        ? 'var(--color-accent)'
                        : 'var(--color-muted)',
                      fontWeight: isLeader ? 'bold' : 'normal',
                    }}
                  >
                    {isLeader ? '►' : ''} {i + 1}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'left',
                      color: isLeader
                        ? 'var(--color-accent)'
                        : 'var(--color-text)',
                      fontWeight: isLeader ? 'bold' : 'normal',
                    }}
                  >
                    {name}
                    {tiers[entry.user_id] === 'pro' && (
                      <span style={{ marginLeft: '0.3rem', fontSize: '9px', fontWeight: 'bold', color: 'var(--color-accent)', verticalAlign: 'top' }}>PRO</span>
                    )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: 'bold',
                      color: 'var(--color-accent)',
                      width: '4.5rem',
                    }}
                  >
                    {Math.round(total)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      color:
                        today > 0 ? 'var(--color-win)' : 'var(--color-muted)',
                      width: '4rem',
                    }}
                  >
                    {today > 0 ? `+${Math.round(today)}` : '—'}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'center',
                      color: 'var(--color-muted)',
                      fontSize: '10px',
                      width: '5rem',
                    }}
                  >
                    {ts.exact_score_count}/{ts.goal_diff_count}/
                    {ts.winner_count}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          padding: '0.5rem 1rem',
          fontSize: '10px',
          color: 'var(--color-muted)',
          borderTop: '1px solid var(--color-border)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Total = Acumulado BDF + Pontos de hoje · E/D/V = Exatos / Diferença / Vencedores
      </div>
    </div>
  )
}

// ── Estilos de tabela ────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.5rem',
  textAlign: 'center',
  fontWeight: 'normal',
}

const tdStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem',
}
