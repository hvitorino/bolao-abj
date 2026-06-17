import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveGroup } from '@/lib/active-group'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import { getTeamFlag } from '@/lib/utils/teamFlag'

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

/**
 * Página /meus-palpites
 *
 * Lista todos os palpites do usuário autenticado com:
 * - Informações do jogo (times, rodada, data)
 * - Palpite enviado
 * - Resultado real (quando disponível)
 * - Pontuação calculada (quando jogo encerrado)
 *
 * Design: tabela estilo Elifoot, fonte monospace, paleta DESIGN.md
 */

interface PredictionRow {
  prediction: Prediction
  game: Game
  score: Score | null
}

// Formata data curta: "14 JUN"
function formatDate(matchDate: string): string {
  return new Date(matchDate)
    .toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: 'short',
    })
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/ DE /g, ' ')
}

// Remove prefixo "Copa do Mundo NNNN" do nome da rodada
function formatRound(round: string): string {
  return round.replace(/copa do mundo \d{4}\s*[-–]?\s*/i, '').trim()
}

// Formata status em português
function formatStatus(status: string): string {
  switch (status) {
    case 'finished':
      return 'ENCERRADO'
    case 'live':
      return 'AO VIVO'
    default:
      return 'PENDENTE'
  }
}

interface MeusPalpitesPageProps {
  searchParams: Promise<{ group?: string }>
}

export default async function MeusPalpitesPage({ searchParams }: MeusPalpitesPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value

  const activeGroup = await resolveActiveGroup(
    supabase,
    user.id,
    params.group,
    '/meus-palpites',
    {},
    cookieGroupId
  )

  if ('error' in activeGroup) {
    return (
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          border: '1px solid var(--color-error)',
          backgroundColor: 'var(--color-surface)',
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--color-error)',
          fontSize: '13px',
        }}
      >
        ✗ VOCÊ NÃO PARTICIPA DESTE GRUPO
      </div>
    )
  }

  const { groupId: activeGroupId } = activeGroup

  // 1. Buscar todos os palpites do usuário neste grupo (mais recentes primeiro)
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)
    .eq('group_id', activeGroupId)
    .order('submitted_at', { ascending: false })

  const predictionList: Prediction[] = predictions ?? []

  let rows: PredictionRow[] = []
  let totalPoints = 0

  if (predictionList.length > 0) {
    const gameIds = predictionList.map((p) => p.game_id)

    // 2. Buscar os jogos correspondentes
    const { data: gamesData } = await supabase
      .from('games')
      .select('*')
      .in('id', gameIds)

    const gamesById: Record<string, Game> = Object.fromEntries(
      (gamesData ?? []).map((g: Game) => [g.id, g])
    )

    // 3. Buscar scores calculados (escopados por grupo — um usuário pode ter
    // palpites para o mesmo jogo em grupos diferentes)
    const { data: scoresData } = await supabase
      .from('scores')
      .select('*')
      .eq('user_id', user.id)
      .eq('group_id', activeGroupId)
      .in('game_id', gameIds)

    const scoresByPredictionId: Record<string, Score> = Object.fromEntries(
      (scoresData ?? []).map((s: Score) => [s.prediction_id, s])
    )

    // Montar linhas e calcular total de pontos
    rows = predictionList
      .filter((p) => gamesById[p.game_id]) // segurança: ignora palpites sem jogo
      .map((p) => {
        const score = scoresByPredictionId[p.id] ?? null
        if (score) totalPoints += score.points
        return { prediction: p, game: gamesById[p.game_id], score }
      })
  }

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: 'var(--color-text)',
        maxWidth: '960px',
        margin: '0 auto',
      }}
    >
      {/* Estado vazio */}
      {rows.length === 0 && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            NENHUM PALPITE REGISTRADO
          </span>
        </div>
      )}

      {/* Tabela de palpites */}
      {rows.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                {(['JOGO', 'PALPITE', 'RESULTADO', 'PONTOS'] as const).map((col, i) => (
                  <th
                    key={col}
                    style={{
                      padding: '0.5rem 0.75rem',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--color-muted)',
                      fontWeight: 'bold',
                      borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
                      borderBottom: '1px solid var(--color-border)',
                      textAlign: i === 0 ? 'left' : 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map(({ prediction, game, score }, index) => {
                const isFinished = game.status === 'finished'
                const isLive = game.status === 'live'
                const hasResult = game.home_score !== null && game.away_score !== null
                const rowBg = index % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)'
                const cellBorder = '1px solid var(--color-border)'

                return (
                  <tr key={prediction.id} style={{ backgroundColor: rowBg }}>
                    {/* JOGO */}
                    <td style={{ padding: '0.6rem 0.75rem', borderTop: cellBorder }}>
                      <div
                        style={{
                          fontWeight: 'bold',
                          fontSize: '16px',
                          color: 'var(--color-text)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {getTeamFlag(game.home_team_code)} × {getTeamFlag(game.away_team_code)}
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'var(--color-muted)',
                          marginTop: '0.2rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        {formatRound(game.round)} · {formatDate(game.match_date)}
                      </div>
                    </td>

                    {/* PALPITE */}
                    <td
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderTop: cellBorder,
                        borderLeft: cellBorder,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: 'var(--color-accent)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {prediction.home_score} × {prediction.away_score}
                      </span>
                    </td>

                    {/* RESULTADO */}
                    <td
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderTop: cellBorder,
                        borderLeft: cellBorder,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      {hasResult ? (
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: isFinished ? 'var(--color-text)' : 'var(--color-live)',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {game.home_score} × {game.away_score}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '10px',
                            color: isLive ? 'var(--color-live)' : 'var(--color-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: isLive ? 'bold' : 'normal',
                          }}
                        >
                          {formatStatus(game.status)}
                        </span>
                      )}
                    </td>

                    {/* PONTOS */}
                    <td
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderTop: cellBorder,
                        borderLeft: cellBorder,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      {isFinished && score ? (
                        <>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '15px',
                              fontWeight: 'bold',
                              color: score.points > 0 ? 'var(--color-accent)' : 'var(--color-muted)',
                              letterSpacing: '0.05em',
                            }}
                          >
                            +{score.points}
                          </span>
                          {score.points > 0 && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: '9px',
                                color: 'var(--color-win)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                marginTop: '0.1rem',
                              }}
                            >
                              {score.breakdown.exact > 0
                                ? '✓ exato'
                                : score.breakdown.winner > 0
                                  ? '✓ venc.'
                                  : '✓ parcial'}
                            </span>
                          )}
                        </>
                      ) : isFinished && !score ? (
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--color-muted)',
                            textTransform: 'uppercase',
                          }}
                        >
                          —
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--color-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          PENDENTE
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {totalPoints > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                  <td
                    colSpan={3}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderTop: '1px solid var(--color-border)',
                      textAlign: 'right',
                      fontSize: '10px',
                      color: 'var(--color-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    TOTAL
                  </td>
                  <td
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderTop: '1px solid var(--color-border)',
                      borderLeft: '1px solid var(--color-border)',
                      textAlign: 'center',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: 'var(--color-accent)',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {totalPoints} pts
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
