'use client'

import { useState } from 'react'
import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import PredictionForm from '@/components/bolao/PredictionForm'
import PredictionDisplay from '@/components/bolao/PredictionDisplay'
import ScoreDisplay from '@/components/bolao/ScoreDisplay'
import { useGameRealtime } from '@/lib/hooks/useGameRealtime'
import { useScoreRealtime } from '@/lib/hooks/useScoreRealtime'
import { useParticipantsRealtime } from '@/lib/hooks/useParticipantsRealtime'
import { calculateLiveScore } from '@/lib/scoring'
import GameParticipantsList from '@/components/bolao/GameParticipantsList'
import { ParticipantEntry } from '@/lib/types/participant'
import { getTeamFlag } from '@/lib/utils/teamFlag'

interface GameCardProps {
  game: Game
  prediction?: Prediction | null
  score?: Score | null
  participants?: ParticipantEntry[]
  userId?: string // necessário para filtrar Realtime por usuário
  groupId: string // grupo ativo — enviado no POST/PATCH de predictions
}

// Formata horário do jogo para exibição em BRT (UTC-3)
function formatMatchTime(matchDate: string): string {
  return new Date(matchDate).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isDeadlinePassed(matchDate: string): boolean {
  return Date.now() >= new Date(matchDate).getTime() - 5 * 60 * 1000
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
  participants = [],
  userId,
  groupId,
}: GameCardProps) {
  // Estado local da prediction — permite atualizar após edição sem reload
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(
    prediction ?? null
  )
  // Estado de edição — controla se o formulário está aberto no modo edição
  const [isEditing, setIsEditing] = useState(false)
  // Estado de expansão da seção de palpites dos participantes — colapsado por padrão
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false)
  // Estado de expansão do breakdown de pontuação — colapsado por padrão
  const [isScoreExpanded, setIsScoreExpanded] = useState(false)
  // Estado de hover do toggle — inverte cores para reforçar que é clicável
  const [isHoveringToggle, setIsHoveringToggle] = useState(false)

  // Subscreve ao canal Realtime do Supabase para este jogo específico.
  const { game: liveGame } = useGameRealtime(game.id, game)

  // Subscreve ao score do usuário para este jogo.
  // liveScore atualiza quando o trigger Postgres calcula pontuação após jogo encerrado.
  const liveScore = useScoreRealtime(game.id, userId ?? '', score)

  // Gerencia palpites dos participantes em tempo real.
  // Faz fetch dos palpites revelados quando o jogo muda para live/finished —
  // resolve o bug em que participants ficavam como OCULTO/PENDENTE após a transição Realtime.
  const liveParticipants = useParticipantsRealtime(
    game.id,
    groupId,
    participants,
    game.status as 'pending' | 'live' | 'finished'
  )

  const isLive = liveGame.status === 'live'
  const isFinished = liveGame.status === 'finished'
  const isPending = liveGame.status === 'pending'

  // Para jogos ao vivo o banco pode ainda ter home_score/away_score null
  // enquanto o placar real é 0×0 — tratamos null como 0 nesse contexto.
  const liveHomeScore = isLive ? (liveGame.home_score ?? 0) : liveGame.home_score
  const liveAwayScore = isLive ? (liveGame.away_score ?? 0) : liveGame.away_score

  // Para jogos ao vivo: sempre calcular no cliente com o placar atual do Realtime.
  // O registro em `scores` (liveScore) só é gravado pelo trigger ao encerrar —
  // se existir durante o jogo, pode ter breakdown nulo ou desatualizado.
  // Para jogos encerrados: usar liveScore do banco (calculado pelo trigger).
  const provisionalScore =
    isLive && currentPrediction
      ? calculateLiveScore(
          { home_score: liveHomeScore, away_score: liveAwayScore },
          currentPrediction
        )
      : null
  const displayScore = isLive ? provisionalScore : liveScore
  const hasScore = liveGame.home_score !== null && liveGame.away_score !== null
  const matchTime = formatMatchTime(liveGame.match_date)
  const scoreText = hasScore
    ? `${liveGame.home_score} × ${liveGame.away_score}`
    : isLive
      ? '0 × 0'
      : '- × -'

  const cardBorderColor = isLive ? 'var(--color-primary)' : 'var(--color-border)'
  const cardBorderStyle = isFinished ? 'dashed' : 'solid'
  const cardBg = isLive ? 'rgba(0, 156, 59, 0.18)' : 'var(--color-surface)'
  const canEdit = isPending && currentPrediction != null && !isDeadlinePassed(liveGame.match_date)

  // Handler chamado pelo PredictionForm ao concluir edição bem-sucedida
  function handleEditSuccess(updated: Prediction) {
    setCurrentPrediction(updated)
    setIsEditing(false)
  }

  return (
    <div
      style={{
        border: `1px ${cardBorderStyle} ${cardBorderColor}`,
        backgroundColor: cardBg,
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
        filter: isFinished ? 'grayscale(45%) opacity(0.75)' : undefined,
      }}
    >
      {/* Header do card: rodada · data · horário */}
      <div
        style={{
          borderBottom: `1px ${cardBorderStyle} ${cardBorderColor}`,
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
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div
            style={{
              fontSize: '28px',
              lineHeight: 1,
            }}
          >
            {getTeamFlag(liveGame.home_team_code)}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              marginTop: '0.25rem',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
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
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div
            style={{
              fontSize: '28px',
              lineHeight: 1,
            }}
          >
            {getTeamFlag(liveGame.away_team_code)}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              marginTop: '0.25rem',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {liveGame.away_team}
          </div>
        </div>
      </div>

      {/* Footer do card: status */}
      <div
        style={{
          borderTop: `1px ${cardBorderStyle} ${cardBorderColor}`,
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          overflow: 'hidden',
        }}
      >
        {/* Badge de status */}
        {isLive && (
          <>
            <span
              style={{
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                border: '1px solid var(--color-primary)',
                padding: '0.1rem 0.4rem',
                flexShrink: 0,
              }}
            >
              ■ AO VIVO
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

        {isPending && (
          <>
            <span
              style={{
                color: 'var(--color-muted)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid transparent',
                padding: '0.1rem 0.4rem',
                flexShrink: 0,
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
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                border: '1px solid var(--color-muted)',
                padding: '0.1rem 0.4rem',
                flexShrink: 0,
              }}
            >
              □ ENCERRADO
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
              maxWidth: '80px',
              flexShrink: 0,
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
                groupId={groupId}
                homeTeamCode={liveGame.home_team_code}
                awayTeamCode={liveGame.away_team_code}
                matchDate={liveGame.match_date}
                initialPrediction={currentPrediction}
                onCancelEdit={() => setIsEditing(false)}
                onSuccess={handleEditSuccess}
              />
            )}

            {/* Há palpite e não está editando: exibir PredictionDisplay */}
            {currentPrediction && !isEditing && (
              <PredictionDisplay
                homeScore={currentPrediction.home_score}
                awayScore={currentPrediction.away_score}
                homeTeamCode={liveGame.home_team_code}
                awayTeamCode={liveGame.away_team_code}
                submittedAt={currentPrediction.submitted_at}
                onEditRequest={canEdit ? () => setIsEditing(true) : undefined}
              />
            )}

            {/* Sem palpite ainda: formulário de criação */}
            {!currentPrediction && !isEditing && (
              <PredictionForm
                gameId={liveGame.id}
                groupId={groupId}
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
                  isExpandable={!!(displayScore && liveHomeScore !== null && liveAwayScore !== null)}
                  isExpanded={isScoreExpanded}
                  onToggle={() => setIsScoreExpanded((prev) => !prev)}
                  points={displayScore?.points ?? null}
                />
                {/* Breakdown de pontuação — revelado ao clicar no palpite */}
                {isScoreExpanded &&
                  displayScore &&
                  liveHomeScore !== null &&
                  liveAwayScore !== null && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <ScoreDisplay
                        points={displayScore.points}
                        breakdown={displayScore.breakdown}
                      />
                    </div>
                  )}
              </>
            ) : (
              <div
                style={{
                  position: 'relative',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  padding: '0.75rem',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                }}
              >
                {/* Linha de título — espaço equivalente ao "✓ SEU PALPITE" */}
                <div style={{ marginBottom: '0.5rem', height: '1.4rem' }} />
                {/* Placar placeholder */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1, opacity: 0.4 }}>
                    {getTeamFlag(liveGame.home_team_code)}
                  </span>
                  <span
                    style={{
                      fontSize: '22px',
                      fontWeight: 'bold',
                      color: 'var(--color-muted)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    - × -
                  </span>
                  <span style={{ fontSize: '18px', lineHeight: 1, opacity: 0.4 }}>
                    {getTeamFlag(liveGame.away_team_code)}
                  </span>
                </div>
                {/* Espaço equivalente ao horário de envio */}
                <div style={{ height: '10px', marginTop: '0.35rem' }} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Toggle de expansão — só aparece quando há participantes para mostrar */}
      {liveParticipants.length > 0 && (
        <button
          type="button"
          onClick={() => setIsParticipantsExpanded((prev) => !prev)}
          onMouseEnter={() => setIsHoveringToggle(true)}
          onMouseLeave={() => setIsHoveringToggle(false)}
          aria-expanded={isParticipantsExpanded}
          aria-controls={`participants-${liveGame.id}`}
          style={{
            width: '100%',
            border: 'none',
            borderTop: '1px solid var(--color-primary)',
            backgroundColor: isHoveringToggle
              ? 'rgba(0, 156, 59, 0.75)'
              : 'var(--color-primary)',
            padding: '0.6rem 0.75rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'var(--color-bg)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {isParticipantsExpanded ? 'OCULTAR PALPITES ▴' : 'VER PALPITES ▾'}
        </button>
      )}

      {/* Seção de palpites de todos os participantes — exibida sob demanda via toggle */}
      {liveParticipants.length > 0 && isParticipantsExpanded && (
        <div id={`participants-${liveGame.id}`}>
          <GameParticipantsList
            participants={liveParticipants}
            gameStatus={liveGame.status as 'pending' | 'live' | 'finished'}
            currentUserId={userId}
            liveGame={{ home_score: liveGame.home_score, away_score: liveGame.away_score }}
          />
        </div>
      )}
    </div>
  )
}
