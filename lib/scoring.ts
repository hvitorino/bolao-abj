/**
 * lib/scoring.ts
 *
 * Lógica de pontuação do Bolão do Cartola ABJ.
 * Espelha a função Postgres `calculate_scores_for_game` para uso no frontend.
 *
 * Regras (de CLAUDE.md):
 *   winner_points      = +3 se acertou o vencedor (ou empate)
 *   exact_points       = +5 se placar exato (home E away corretos)
 *   winner_score_points= +3 se acertou SOMENTE o placar do vencedor (não o exato, não em empate)
 *   diff_points        = +2 se acertou a diferença de gols E acertou o vencedor (não exato, não empate)
 *   loser_score_points = +1 se acertou SOMENTE o placar do perdedor (não acertou vencedor, não empate)
 *   goleada_points     = +1 se acertou vencedor E vencedor no palpite >=4 gols E diferença real >=4 gols
 *
 * Exclusividades:
 *   - exact_points e winner_score_points são mutuamente exclusivos
 *   - exact_points e diff_points são mutuamente exclusivos
 *   - loser_score_points só aplica se NÃO acertou o vencedor
 *   - Em empate sem acerto: loser_score_points NÃO aplica (não há "perdedor")
 *   - winner_score_points e diff_points NÃO se excluem mutuamente
 */

import type { ScoreBreakdown } from '@/lib/types/score'

type Winner = 'home' | 'away' | 'draw'

function getWinner(homeScore: number, awayScore: number): Winner {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}

interface GameScores {
  home_score: number
  away_score: number
}

interface PredictionScores {
  home_score: number
  away_score: number
}

export interface ScoringResult {
  points: number
  breakdown: ScoreBreakdown
}

/**
 * Calcula a pontuação de um palpite dado o resultado real do jogo.
 *
 * @param game - Placar real do jogo (home_score, away_score)
 * @param prediction - Palpite do usuário (home_score, away_score)
 * @returns ScoringResult com pontuação total e breakdown detalhado
 */
export function calculateScore(
  game: GameScores,
  prediction: PredictionScores
): ScoringResult {
  const realWinner = getWinner(game.home_score, game.away_score)
  const predWinner = getWinner(prediction.home_score, prediction.away_score)

  let winner_points = 0
  let exact_points = 0
  let winner_score_points = 0
  let diff_points = 0
  let loser_score_points = 0
  let goleada_points = 0

  if (predWinner === realWinner) {
    // Regra 1: acertou vencedor (ou empate)
    winner_points = 3

    // Regra 2: placar exato (mutuamente exclusivo com regras 3 e 4)
    if (
      prediction.home_score === game.home_score &&
      prediction.away_score === game.away_score
    ) {
      exact_points = 5
      // winner_score_points e diff_points ficam em 0 quando placar exato
    } else {
      // Regra 3: somente placar do vencedor (não aplica em empate)
      if (realWinner !== 'draw') {
        if (realWinner === 'home' && prediction.home_score === game.home_score) {
          winner_score_points = 3
        } else if (
          realWinner === 'away' &&
          prediction.away_score === game.away_score
        ) {
          winner_score_points = 3
        }
      }

      // Regra 4: diferença de gols correta (não aplica em empate)
      // Em empate: diff=0; acertar seria placar exato (coberto acima)
      if (realWinner !== 'draw') {
        const realDiff = Math.abs(game.home_score - game.away_score)
        const predDiff = Math.abs(prediction.home_score - prediction.away_score)
        if (predDiff === realDiff) {
          diff_points = 2
        }
      }
    }

    // Regra 6: goleada
    // Condições simultâneas:
    //   1. acertou vencedor (já garantido por estar dentro do bloco predWinner === realWinner)
    //   2. vencedor no palpite marcou >= 4 gols
    //   3. diferença de gols no resultado real >= 4
    // Não aplica em empate (não há vencedor)
    if (realWinner !== 'draw') {
      const predWinnerScore =
        realWinner === 'home' ? prediction.home_score : prediction.away_score
      const realGoalDiff = Math.abs(game.home_score - game.away_score)
      if (predWinnerScore >= 4 && realGoalDiff >= 4) {
        goleada_points = 1
      }
    }
  } else {
    // Não acertou vencedor
    // Regra 5: somente placar do perdedor
    // "Perdedor" em empate não existe → não aplica quando realWinner = 'draw'
    if (realWinner === 'home') {
      // Vencedor foi home; perdedor foi away
      if (prediction.away_score === game.away_score) {
        loser_score_points = 1
      }
    } else if (realWinner === 'away') {
      // Vencedor foi away; perdedor foi home
      if (prediction.home_score === game.home_score) {
        loser_score_points = 1
      }
    }
    // realWinner = 'draw' e predWinner != 'draw': zero pontos
  }

  const points =
    winner_points +
    exact_points +
    winner_score_points +
    diff_points +
    loser_score_points +
    goleada_points

  const breakdown: ScoreBreakdown = {
    winner: winner_points,
    exact: exact_points,
    winner_score: winner_score_points,
    diff: diff_points,
    loser_score: loser_score_points,
    goleada: goleada_points,
  }

  return { points, breakdown }
}

/**
 * Rótulos em português para cada componente do breakdown.
 * Usados pelo componente ScoreDisplay.
 */
export const BREAKDOWN_LABELS: Record<keyof ScoreBreakdown, string> = {
  winner: 'Acertou o vencedor',
  exact: 'Placar exato',
  winner_score: 'Placar do vencedor',
  diff: 'Diferença de gols',
  loser_score: 'Placar do perdedor',
  goleada: 'Goleada',
}

/**
 * Calcula a pontuação parcial/provisória de um palpite com base no placar
 * momentâneo de um jogo ao vivo (`status === 'live'`).
 *
 * Reaproveita `calculateScore()` sem nenhuma reimplementação de regras —
 * a única diferença é a tolerância a placar ainda não definido (`null`),
 * retornando `null` nesse caso defensivo em vez de quebrar.
 *
 * @param game - Placar atual do jogo ao vivo (home_score/away_score podem ser null)
 * @param prediction - Palpite do usuário (home_score, away_score)
 * @returns ScoringResult com a pontuação parcial, ou `null` se o placar ainda não está definido
 */
export function calculateLiveScore(
  game: { home_score: number | null; away_score: number | null },
  prediction: PredictionScores
): ScoringResult | null {
  if (game.home_score === null || game.away_score === null) return null
  return calculateScore(
    { home_score: game.home_score, away_score: game.away_score },
    prediction
  )
}
