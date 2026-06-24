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

  return (
    <div data-date={date} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '1rem',
        }}
      >
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
          {games.map((game) => (
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
    </div>
  )
}
