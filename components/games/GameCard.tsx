'use client'

import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import PredictionForm from '@/components/bolao/PredictionForm'
import PredictionDisplay from '@/components/bolao/PredictionDisplay'
import ScoreDisplay from '@/components/bolao/ScoreDisplay'
import { useGameRealtime } from '@/lib/hooks/useGameRealtime'
import { useScoreRealtime } from '@/lib/hooks/useScoreRealtime'

interface GameCardProps {
  game: Game
  prediction?: Prediction | null
  score?: Score | null
  userId?: string // necessário para filtrar Realtime por usuário
}

// Formata horário do jogo para exibição em BRT (UTC-3)
function formatMatchTime(matchDate: string): string {
  return new Date(matchDate).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Formata data curta para o header do card
function formatMatchDate(matchDate: string): string {
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

export default function GameCard({
  game,
  prediction = null,
  score = null,
  userId,
}: GameCardProps) {
  // Subscreve ao canal Realtime do Supabase para este jogo específico.
  // liveGame começa com o estado SSR (game) e atualiza automaticamente
  // via WAL replication quando admin faz PATCH no placar ou status.
  const liveGame = useGameRealtime(game.id, game)

  // Subscreve ao score do usuário para este jogo.
  // liveScore atualiza quando o trigger Postgres calcula pontuação após jogo encerrado.
  const liveScore = useScoreRealtime(game.id, userId ?? '', score)

  const isLive = liveGame.status === 'live'
  const isFinished = liveGame.status === 'finished'
  const isPending = liveGame.status === 'pending'
  const hasScore = liveGame.home_score !== null && liveGame.away_score !== null

  const cardBorderColor = isLive ? 'var(--color-live)' : 'var(--color-border)'

  return (
    <div
      style={{
        border: `1px solid ${cardBorderColor}`,
        backgroundColor: 'var(--color-surface)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Header do card: rodada · data · horário */}
      <div
        style={{
          borderBottom: `1px solid ${cardBorderColor}`,
          padding: '0.5rem 0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            color: 'var(--color-muted)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {liveGame.round}
        </span>
        <span
          style={{
            color: 'var(--color-muted)',
            fontSize: '11px',
            textTransform: 'uppercase',
          }}
        >
          {formatMatchDate(liveGame.match_date)}
        </span>
      </div>

      {/* Corpo do card: times e placar */}
      <div
        style={{
          padding: '1rem 0.75rem',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {/* Time da casa */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              color: 'var(--color-text)',
              textTransform: 'uppercase',
            }}
          >
            {liveGame.home_team_code}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              marginTop: '0.25rem',
              letterSpacing: '0.05em',
            }}
          >
            {liveGame.home_team}
          </div>
        </div>

        {/* Placar central */}
        <div style={{ textAlign: 'center', minWidth: '80px' }}>
          {hasScore ? (
            <div
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: 'var(--color-accent)',
                letterSpacing: '0.05em',
              }}
            >
              {liveGame.home_score} × {liveGame.away_score}
            </div>
          ) : (
            <div
              style={{
                fontSize: '22px',
                fontWeight: 'bold',
                color: 'var(--color-muted)',
                letterSpacing: '0.05em',
              }}
            >
              - × -
            </div>
          )}
        </div>

        {/* Time visitante */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              color: 'var(--color-text)',
              textTransform: 'uppercase',
            }}
          >
            {liveGame.away_team_code}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              marginTop: '0.25rem',
              letterSpacing: '0.05em',
            }}
          >
            {liveGame.away_team}
          </div>
        </div>
      </div>

      {/* Footer do card: status */}
      <div
        style={{
          borderTop: `1px solid ${cardBorderColor}`,
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        {/* Badge de status */}
        {isLive && (
          <span
            className="blink"
            style={{
              color: 'var(--color-live)',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            ██ AO VIVO ██
          </span>
        )}

        {isPending && (
          <>
            <span
              style={{
                color: 'var(--color-muted)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              PENDENTE
            </span>
            <span
              style={{
                color: 'var(--color-muted)',
                fontSize: '11px',
              }}
            >
              ·
            </span>
            <span
              style={{
                color: 'var(--color-muted)',
                fontSize: '11px',
              }}
            >
              {formatMatchTime(liveGame.match_date)} BRT
            </span>
          </>
        )}

        {isFinished && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            ENCERRADO
          </span>
        )}

        {/* Sede (se disponível) */}
        {liveGame.venue && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '10px',
              marginLeft: 'auto',
              textAlign: 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '160px',
            }}
          >
            {liveGame.venue}
          </span>
        )}
      </div>

      {/* Área de palpite — separada do jogo por borda tracejada */}
      <div
        style={{
          borderTop: '1px dashed var(--color-border)',
          padding: '0.75rem',
        }}
      >
        {/* Jogo pendente: formulário de palpite ou palpite enviado */}
        {isPending && (
          <PredictionForm
            gameId={liveGame.id}
            homeTeamCode={liveGame.home_team_code}
            awayTeamCode={liveGame.away_team_code}
            matchDate={liveGame.match_date}
            initialPrediction={prediction}
          />
        )}

        {/* Jogo ao vivo ou encerrado: exibe palpite ou "sem palpite" */}
        {(isLive || isFinished) && (
          <>
            {prediction ? (
              <>
                <PredictionDisplay
                  homeScore={prediction.home_score}
                  awayScore={prediction.away_score}
                  homeTeamCode={liveGame.home_team_code}
                  awayTeamCode={liveGame.away_team_code}
                  submittedAt={prediction.submitted_at}
                />
                {/* Breakdown de pontuação — visível quando jogo encerrado e score calculado */}
                {isFinished && liveScore && liveGame.home_score !== null && liveGame.away_score !== null && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <ScoreDisplay
                      points={liveScore.points}
                      breakdown={liveScore.breakdown}
                      predictionHomeScore={prediction.home_score}
                      predictionAwayScore={prediction.away_score}
                      gameHomeScore={liveGame.home_score}
                      gameAwayScore={liveGame.away_score}
                      homeTeamCode={liveGame.home_team_code}
                      awayTeamCode={liveGame.away_team_code}
                    />
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-muted)',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0.25rem 0',
                }}
              >
                SEM PALPITE
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
