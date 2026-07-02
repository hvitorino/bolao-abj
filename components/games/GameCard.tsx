'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  hideAnalysisLink?: boolean
  onPredictionChange?: () => void
  /** Quando fornecido, substitui useGameRealtime — o jogo já é reativo vindo do ScoreCache */
  liveGame?: Game
  /** Quando fornecido, substitui useParticipantsRealtime — participantes já são reativos */
  liveParticipants?: ParticipantEntry[]
}

// Formata data e horário do jogo para exibição em BRT (UTC-3)
function formatMatchTime(matchDate: string): string {
  const d = new Date(matchDate)
  const date = d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  })
  const time = d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${date} · ${time}`
}

function isDeadlinePassed(matchDate: string): boolean {
  return Date.now() >= new Date(matchDate).getTime() - 5 * 60 * 1000
}


export default function GameCard({
  game,
  prediction = null,
  score = null,
  participants = [],
  userId,
  groupId,
  hideAnalysisLink = false,
  onPredictionChange,
  liveGame: liveGameProp,
  liveParticipants: liveParticipantsProp,
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
  // Estado do botão de copiar link — feedback visual por 2s após cópia
  const [copied, setCopied] = useState(false)

  // Se liveGame foi fornecido pelo pai (JogosRealtime via ScoreCache), usa ele.
  // Caso contrário, mantém o comportamento antigo com useGameRealtime.
  const liveGameFromHook = useGameRealtime(game.id, game)
  const liveGame = liveGameProp ?? liveGameFromHook.game

  // Subscreve ao score do usuário para este jogo.
  // liveScore atualiza quando o trigger Postgres calcula pontuação após jogo encerrado.
  const liveScore = useScoreRealtime(game.id, userId ?? '', score)

  // Gerencia palpites dos participantes em tempo real.
  // Se liveParticipants foi fornecido pelo pai, usa ele.
  // Caso contrário, mantém useParticipantsRealtime (comportamento antigo).
  const liveParticipantsFromHook = useParticipantsRealtime(
    game.id,
    groupId,
    participants,
    liveGame.status as 'pending' | 'live' | 'finished'
  )
  const liveParticipants = liveParticipantsProp ?? liveParticipantsFromHook

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
    onPredictionChange?.()
  }

  // Copia o link da página pública deste jogo para a área de transferência
  async function handleCopyLink() {
    try {
      const url = `${window.location.origin}/jogos/${liveGame.id}/publico?grupo=${groupId}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Contexto não-seguro ou API não disponível — silencioso
    }
  }

  return (
    <div
      style={{
        border: `1px ${cardBorderStyle} ${cardBorderColor}`,
        backgroundColor: cardBg,
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Header do card: status · horário · estádio */}
      <div
        style={{
          borderBottom: `1px ${cardBorderStyle} ${cardBorderColor}`,
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          overflow: 'hidden',
        }}
      >
        {isLive && (
          <span
            style={{
              color: 'var(--color-bg)',
              backgroundColor: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0.1rem 0.4rem',
              flexShrink: 0,
            }}
          >
            ● AO VIVO
          </span>
        )}
        {isPending && (
          <span
            style={{
              color: 'var(--color-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: '1px solid var(--color-border)',
              padding: '0.1rem 0.4rem',
              flexShrink: 0,
            }}
          >
            ◷ EM BREVE
          </span>
        )}
        {isFinished && (
          <span
            style={{
              color: 'var(--color-accent)',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: '1px solid var(--color-accent)',
              padding: '0.1rem 0.4rem',
              flexShrink: 0,
            }}
          >
            ✓ ENCERRADO
          </span>
        )}
        <span
          style={{
            color: 'var(--color-muted)',
            fontSize: '11px',
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          {matchTime} BRT
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
                onSuccess={(created) => {
                  setCurrentPrediction(created)
                  onPredictionChange?.()
                }}
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
                {displayScore && liveHomeScore !== null && liveAwayScore !== null && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: isScoreExpanded ? '1fr' : '0fr',
                      transition: 'grid-template-rows 300ms ease',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ marginTop: '0.5rem' }}>
                        <ScoreDisplay
                          points={displayScore.points}
                          breakdown={displayScore.breakdown}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  position: 'relative',
                  border: '1px solid var(--color-border)',
                  padding: '0.75rem',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                }}
              >
                {/* Linha superior: label + badge — espelha "✓ SEU PALPITE" + "+N PTS" */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--color-muted)',
                      fontWeight: 'bold',
                    }}
                  >
                    ✗ SEM PALPITE
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      letterSpacing: '0.05em',
                      padding: '0.2rem 0.5rem',
                      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                      lineHeight: 1.4,
                      backgroundColor: 'var(--color-border)',
                      color: 'var(--color-muted)',
                    }}
                  >
                    +0 PTS
                  </div>
                </div>
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
                {/* Linha de envio — espelha "enviado às HH:MM BRT" */}
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-muted)',
                    textAlign: 'center',
                    marginTop: '0.35rem',
                    opacity: 0.6,
                  }}
                >
                  não enviado
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Barra de ações: VER ANÁLISE (esquerda) | VER PALPITES (direita) */}
      {(!hideAnalysisLink || liveParticipants.length > 0) && (
        <div style={{ display: 'flex', borderTop: '1px solid var(--color-primary)' }}>
          {!hideAnalysisLink && (
            <Link
              href={`/jogos/${liveGame.id}/analise`}
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 0.75rem',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-bg)',
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                textDecoration: 'none',
              }}
            >
              ► VER ANÁLISE
            </Link>
          )}

          {liveParticipants.length > 0 && (
            <button
              type="button"
              onClick={() => setIsParticipantsExpanded((prev) => !prev)}
              aria-expanded={isParticipantsExpanded}
              aria-controls={`participants-${liveGame.id}`}
              style={{
                flex: 1,
                border: 'none',
                borderLeft: !hideAnalysisLink ? '1px solid var(--color-primary)' : 'none',
                backgroundColor: 'var(--color-primary)',
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
              {isParticipantsExpanded ? 'OCULTAR PALPITES' : 'VER PALPITES'}
              <span
                style={{
                  display: 'inline-block',
                  transform: isParticipantsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 250ms ease',
                }}
              >
                ▾
              </span>
            </button>
          )}
        </div>
      )}

      {/* Seção de palpites de todos os participantes — exibida sob demanda via toggle */}
      {liveParticipants.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateRows: isParticipantsExpanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 300ms ease',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <div id={`participants-${liveGame.id}`}>
              <GameParticipantsList
                participants={liveParticipants}
                gameStatus={liveGame.status as 'pending' | 'live' | 'finished'}
                currentUserId={userId}
                liveGame={{ home_score: liveGame.home_score, away_score: liveGame.away_score }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Botão de copiar link da página pública — utilitário, abaixo das CTAs principais */}
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          type="button"
          onClick={handleCopyLink}
          style={{
            width: '100%',
            border: 'none',
            backgroundColor: 'transparent',
            padding: '0.5rem 0.75rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '10px',
            color: copied ? 'var(--color-win)' : 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            transition: 'color 150ms ease',
          }}
        >
          {copied ? '✓ COPIADO!' : '⎘ COPIAR LINK'}
        </button>
      </div>
    </div>
  )
}
