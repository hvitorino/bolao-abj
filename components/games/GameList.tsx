import { Game } from '@/lib/types/game'
import { Prediction } from '@/lib/types/prediction'
import { Score } from '@/lib/types/score'
import { ParticipantEntry } from '@/lib/types/participant'
import GameCard from './GameCard'

interface GameListProps {
  games: Game[]
  date: string // YYYY-MM-DD — para contexto de exibição
  predictionsByGameId?: Record<string, Prediction>
  scoresByGameId?: Record<string, Score>
  participantsByGameId?: Record<string, ParticipantEntry[]>
  userId?: string
  groupId: string
}

export default function GameList({
  games,
  date,
  predictionsByGameId = {},
  scoresByGameId = {},
  participantsByGameId = {},
  userId,
  groupId,
}: GameListProps) {
  if (games.length === 0) {
    return (
      <div
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
          NENHUM JOGO NESTE DIA
        </span>
      </div>
    )
  }

  // Agrupar jogos por rodada para exibir separadores
  const gamesByRound: Record<string, Game[]> = {}
  games.forEach((game) => {
    if (!gamesByRound[game.round]) {
      gamesByRound[game.round] = []
    }
    gamesByRound[game.round].push(game)
  })

  const rounds = Object.keys(gamesByRound)

  return (
    <div data-date={date} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {rounds.map((round) => (
        <div key={round}>
          {/* Separador de rodada quando há mais de um grupo no dia */}
          {rounds.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <span
                style={{
                  color: 'var(--color-primary)',
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                }}
              >
                {round}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  backgroundColor: 'var(--color-border)',
                }}
              />
            </div>
          )}

          {/* Grid de GameCards para este round */}
          {/* alignItems: 'start' evita que o grid estique os cards mais curtos até a
              altura da linha (definida pelo card mais alto), o que faria a área de
              cards vizinhos crescer quando um deles expande os palpites */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
              alignItems: 'start',
            }}
          >
            {gamesByRound[round].map((game) => (
              <GameCard
                key={game.id}
                game={game}
                prediction={predictionsByGameId[game.id] ?? null}
                score={scoresByGameId[game.id] ?? null}
                participants={participantsByGameId[game.id] ?? []}
                userId={userId}
                groupId={groupId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
