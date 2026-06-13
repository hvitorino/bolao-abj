import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'

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

// Formata data curta: "14 JUN 2026"
function formatDate(matchDate: string): string {
  return new Date(matchDate)
    .toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/ DE /g, ' ')
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

export default async function MeusPalpitesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. Buscar todos os palpites do usuário (mais recentes primeiro)
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)
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

    // 3. Buscar scores calculados
    const { data: scoresData } = await supabase
      .from('scores')
      .select('*')
      .eq('user_id', user.id)
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
      {/* Cabeçalho */}
      <div
        style={{
          marginBottom: '1.25rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-primary)',
            }}
          >
            MEUS PALPITES
          </span>
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {rows.length} palpite{rows.length !== 1 ? 's' : ''}
            {totalPoints > 0 && (
              <>
                {' '}·{' '}
                <span style={{ color: 'var(--color-accent)' }}>
                  {totalPoints} pontos no total
                </span>
              </>
            )}
          </span>
        </div>
      </div>

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
          {/* Cabeçalho da tabela */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              gap: '0',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
            }}
          >
            {['JOGO', 'PALPITE', 'RESULTADO', 'PONTOS'].map((col, i) => (
              <div
                key={col}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--color-muted)',
                  fontWeight: 'bold',
                  borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {col}
              </div>
            ))}
          </div>

          {/* Linhas da tabela */}
          {rows.map(({ prediction, game, score }, index) => {
            const isFinished = game.status === 'finished'
            const isLive = game.status === 'live'
            const hasResult = game.home_score !== null && game.away_score !== null
            const rowBg = index % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)'

            return (
              <div
                key={prediction.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  backgroundColor: rowBg,
                  borderTop: index > 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {/* Coluna: JOGO */}
                <div
                  style={{
                    padding: '0.6rem 0.75rem',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 'bold',
                      fontSize: '12px',
                      color: 'var(--color-text)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {game.home_team_code} × {game.away_team_code}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-muted)',
                      marginTop: '0.2rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {game.round} · {formatDate(game.match_date)}
                  </div>
                </div>

                {/* Coluna: PALPITE */}
                <div
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderLeft: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
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
                </div>

                {/* Coluna: RESULTADO */}
                <div
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderLeft: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    minWidth: '80px',
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
                </div>

                {/* Coluna: PONTOS */}
                <div
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderLeft: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    minWidth: '72px',
                  }}
                >
                  {isFinished && score ? (
                    <>
                      <span
                        style={{
                          fontSize: '15px',
                          fontWeight: 'bold',
                          color: score.points > 0 ? 'var(--color-accent)' : 'var(--color-muted)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        +{score.points}
                      </span>
                      {/* Resumo do maior bônus conquistado */}
                      {score.points > 0 && (
                        <span
                          style={{
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
                </div>
              </div>
            )
          })}

          {/* Rodapé com total */}
          {totalPoints > 0 && (
            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.75rem',
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
                TOTAL
              </span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'var(--color-accent)',
                  letterSpacing: '0.05em',
                  minWidth: '72px',
                  textAlign: 'center',
                }}
              >
                {totalPoints} pts
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
