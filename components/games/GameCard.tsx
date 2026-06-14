'use client'

import { useEffect, useState } from 'react'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import PredictionForm from '@/components/bolao/PredictionForm'
import PredictionDisplay from '@/components/bolao/PredictionDisplay'
import ScoreDisplay from '@/components/bolao/ScoreDisplay'
import { useGameRealtime } from '@/lib/hooks/useGameRealtime'
import { useScoreRealtime } from '@/lib/hooks/useScoreRealtime'
import GameParticipantsList from '@/components/bolao/GameParticipantsList'
import { ParticipantEntry } from '@/lib/types/participant'

interface GameCardProps {
  game: Game
  prediction?: Prediction | null
  score?: Score | null
  participants?: ParticipantEntry[]
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

// Formata o tempo decorrido desde a última atualização do placar
function formatElapsed(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}min`
}

export default function GameCard({
  game,
  prediction = null,
  score = null,
  participants = [],
  userId,
}: GameCardProps) {
  // Estado local da prediction — permite atualizar após edição sem reload
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(
    prediction ?? null
  )
  // Estado de edição — controla se o formulário está aberto no modo edição
  const [isEditing, setIsEditing] = useState(false)

  // Tick de 10s para recalcular o texto "atualizado há Xs" sem reload
  const [tick, setTick] = useState(0)

  // Subscreve ao canal Realtime do Supabase para este jogo específico.
  // Desestrutura o novo retorno: { game: liveGame, lastUpdatedAt, connectionStatus }
  const { game: liveGame, lastUpdatedAt } = useGameRealtime(game.id, game)

  // Subscreve ao score do usuário para este jogo.
  // liveScore atualiza quando o trigger Postgres calcula pontuação após jogo encerrado.
  const liveScore = useScoreRealtime(game.id, userId ?? '', score)

  const isLive = liveGame.status === 'live'
  const isFinished = liveGame.status === 'finished'
  const isPending = liveGame.status === 'pending'
  const hasScore = liveGame.home_score !== null && liveGame.away_score !== null
  const matchTime = formatMatchTime(liveGame.match_date)
  const scoreText = hasScore
    ? `${liveGame.home_score} × ${liveGame.away_score}`
    : isLive
      ? '0 × 0'
      : '- × -'

  const cardBorderColor = isLive ? 'var(--color-live)' : 'var(--color-border)'

  // Tick de 10s — criado apenas quando o jogo está ao vivo para economizar recursos.
  // Ao atualizar `tick`, causa re-render que recalcula formatElapsed(lastUpdatedAt).
  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => setTick(t => t + 1), 10_000)
    return () => clearInterval(interval)
  }, [isLive])

  // Suprime aviso de variável não usada: tick é consumido indiretamente via re-render
  void tick

  // Handler chamado pelo PredictionForm ao concluir edição bem-sucedida
  function handleEditSuccess(updated: Prediction) {
    setCurrentPrediction(updated)
    setIsEditing(false)
  }

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
          <div
            style={{
              fontSize: hasScore ? '28px' : '22px',
              fontWeight: 'bold',
              color: hasScore || isLive ? 'var(--color-accent)' : 'var(--color-muted)',
              letterSpacing: '0.05em',
            }}
          >
            {scoreText}
          </div>
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
          flexWrap: 'wrap',
        }}
      >
        {/* Badge de status */}
        {isLive && (
          <>
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
              {matchTime} BRT
            </span>
            {/* Timestamp de última atualização — visível somente após receber evento Realtime */}
            {lastUpdatedAt !== null && (
              <>
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
                  atualizado há {formatElapsed(lastUpdatedAt)}
                </span>
              </>
            )}
          </>
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
              {matchTime} BRT
            </span>
          </>
        )}

        {isFinished && (
          <>
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
              {matchTime} BRT
            </span>
          </>
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
          <>
            {/* Modo edição: formulário pré-preenchido com palpite atual */}
            {isEditing && currentPrediction && (
              <PredictionForm
                gameId={liveGame.id}
                homeTeamCode={liveGame.home_team_code}
                awayTeamCode={liveGame.away_team_code}
                matchDate={liveGame.match_date}
                initialPrediction={currentPrediction}
                onCancelEdit={() => setIsEditing(false)}
                onSuccess={handleEditSuccess}
              />
            )}

            {/* Há palpite e não está editando: exibir PredictionDisplay com botão EDITAR */}
            {currentPrediction && !isEditing && (
              <PredictionDisplay
                homeScore={currentPrediction.home_score}
                awayScore={currentPrediction.away_score}
                homeTeamCode={liveGame.home_team_code}
                awayTeamCode={liveGame.away_team_code}
                submittedAt={currentPrediction.submitted_at}
                matchDate={liveGame.match_date}
                onEditRequest={() => setIsEditing(true)}
              />
            )}

            {/* Sem palpite ainda: formulário de criação */}
            {!currentPrediction && !isEditing && (
              <PredictionForm
                gameId={liveGame.id}
                homeTeamCode={liveGame.home_team_code}
                awayTeamCode={liveGame.away_team_code}
                matchDate={liveGame.match_date}
                initialPrediction={null}
                onSuccess={(created) => setCurrentPrediction(created)}
              />
            )}
          </>
        )}

        {/* Jogo ao vivo ou encerrado: exibe palpite ou "sem palpite" */}
        {(isLive || isFinished) && (
          <>
            {currentPrediction ? (
              <>
                <PredictionDisplay
                  homeScore={currentPrediction.home_score}
                  awayScore={currentPrediction.away_score}
                  homeTeamCode={liveGame.home_team_code}
                  awayTeamCode={liveGame.away_team_code}
                  submittedAt={currentPrediction.submitted_at}
                  // Sem matchDate/onEditRequest — jogos ao vivo/encerrados nunca exibem botão EDITAR
                />
                {/* Breakdown de pontuação — visível quando jogo encerrado e score calculado */}
                {isFinished &&
                  liveScore &&
                  liveGame.home_score !== null &&
                  liveGame.away_score !== null && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <ScoreDisplay
                        points={liveScore.points}
                        breakdown={liveScore.breakdown}
                        predictionHomeScore={currentPrediction.home_score}
                        predictionAwayScore={currentPrediction.away_score}
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

      {/* Seção de palpites de todos os participantes — sempre visível quando há dados */}
      {participants.length > 0 && (
        <GameParticipantsList
          participants={participants}
          gameStatus={liveGame.status as 'pending' | 'live' | 'finished'}
          currentUserId={userId}
        />
      )}
    </div>
  )
}
