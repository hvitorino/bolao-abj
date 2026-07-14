/**
 * lib/participant-profile.ts
 *
 * Motor determinístico do "Perfil Público do Participante" (feature
 * `perfil-participante`). Zero IA, zero pesquisa externa — apenas regras e
 * templates aplicados sobre os palpites do grupo e os placares reais dos
 * jogos `live`/`finished`.
 *
 * Funções puras e testáveis isoladamente (mesmo padrão de `lib/scoring.ts`).
 *
 * IMPORTANTE — recorte de visibilidade: os chamadores DEVEM garantir que
 * `games`, `targetPredictions` e `groupPredictions` contenham apenas jogos
 * com `status IN ('live', 'finished')`. Este módulo não filtra por status —
 * ele confia no contrato de entrada para nunca expor palpites de jogos
 * `pending` de terceiros.
 */

import { calculateScore } from '@/lib/scoring'

// ---------------------------------------------------------------------------
// Constantes de calibragem (nomeadas para facilitar ajuste futuro)
// ---------------------------------------------------------------------------

/** Amostra mínima de palpites (live/finished) para os eixos `volume` e `underdog` ficarem "confident". */
const MIN_SAMPLE_PRED = 5

/** Amostra mínima de jogos `finished` com palpite para os eixos `calibration` e `style_reader`. */
const MIN_SAMPLE_FINISHED = 3

/** Nº mínimo de times com dados suficientes de estilo para `style_reader` ficar "confident". */
const MIN_TEAMS_FOR_STYLE = 4

/** Nº mínimo de jogos finalizados de um time para ele entrar no cálculo de `inferTeamStyle`. */
const MIN_GAMES_PER_TEAM = 2

/** Largura fixa (em blocos █/░) de toda barra de espectro. */
const BAR_WIDTH = 12

/** Meia-largura (em gols) da janela de normalização do eixo `volume` ao redor da média do grupo. */
const VOLUME_NORMALIZATION_HALF_RANGE = 1.5

/** Total de gols palpitados considerado "aposta de goleada" para a stat de volume. */
const VOLUME_HIGH_GOALS_THRESHOLD = 3

/** Erro médio de gols (em `calibration`) que mapeia para o extremo "Calculista" (position = 1). */
const CALIBRATION_ERROR_CEILING = 4

/** Diferença real de gols (em módulo) até a qual um jogo é considerado "apertado". */
const CALIBRATION_TIGHT_GAME_MAX_DIFF = 1

/** Diferença real de gols (em módulo) a partir da qual um jogo é considerado "goleada". */
const CALIBRATION_BLOWOUT_MIN_DIFF = 3

// ---------------------------------------------------------------------------
// Tipos de entrada
// ---------------------------------------------------------------------------

export type GameStatusLite = 'live' | 'finished'

export interface GameLite {
  id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: GameStatusLite
}

export interface PredLite {
  user_id: string
  game_id: string
  home_score: number
  away_score: number
}

export interface ProfileInput {
  targetUserId: string
  games: GameLite[] // apenas live/finished do grupo
  targetPredictions: PredLite[] // palpites do alvo
  groupPredictions: PredLite[] // palpites de todos (para consenso)
}

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------

export type AxisKey = 'volume' | 'underdog' | 'calibration' | 'style_reader'

export interface AxisStat {
  label: string
  value: string
}

export interface Axis {
  key: AxisKey
  leftLabel: string
  rightLabel: string
  position: number // 0..1
  bar: string // string ASCII pronta (█/░), largura fixa
  confident: boolean
  stats: AxisStat[]
}

export interface Archetype {
  name: string
  paragraph: string
}

export interface TeamStyleEntry {
  team: string
  offensiveRating: number
  defensiveRating: number
  gamesPlayed: number
}

export type TeamStyleTable = Record<string, TeamStyleEntry>

export interface ParticipantProfile {
  sampleSize: number
  axes: Axis[]
  archetype: Archetype
  teamStyle?: TeamStyleTable
}

// ---------------------------------------------------------------------------
// Utilidades numéricas — nunca deixam NaN escapar
// ---------------------------------------------------------------------------

function safeAvg(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, v) => acc + v, 0)
  return sum / values.length
}

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function positionToBar(position: number, width: number = BAR_WIDTH): string {
  const p = clamp01(position)
  const filled = Math.round(p * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pct(value: number, digits: number = 0): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '0%'
  return `${(value * 100).toFixed(digits)}%`
}

function fmt(value: number, digits: number = 1): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '0'
  return value.toFixed(digits)
}

// ---------------------------------------------------------------------------
// §6 — Estilo dos times (inferido dos placares reais)
// ---------------------------------------------------------------------------

/**
 * Infere `offensiveRating` (média de gols marcados) e `defensiveRating`
 * (média de gols sofridos) por time, a partir de jogos `finished`. Times com
 * menos de `MIN_GAMES_PER_TEAM` jogos finalizados são ignorados (dados
 * insuficientes).
 */
export function inferTeamStyle(games: GameLite[]): TeamStyleTable {
  const goalsFor: Record<string, number[]> = {}
  const goalsAgainst: Record<string, number[]> = {}

  for (const game of games) {
    if (game.status !== 'finished') continue
    if (game.home_score === null || game.away_score === null) continue

    goalsFor[game.home_team] = goalsFor[game.home_team] ?? []
    goalsFor[game.home_team].push(game.home_score)
    goalsAgainst[game.home_team] = goalsAgainst[game.home_team] ?? []
    goalsAgainst[game.home_team].push(game.away_score)

    goalsFor[game.away_team] = goalsFor[game.away_team] ?? []
    goalsFor[game.away_team].push(game.away_score)
    goalsAgainst[game.away_team] = goalsAgainst[game.away_team] ?? []
    goalsAgainst[game.away_team].push(game.home_score)
  }

  const table: TeamStyleTable = {}
  for (const team of Object.keys(goalsFor)) {
    const played = goalsFor[team].length
    if (played < MIN_GAMES_PER_TEAM) continue
    table[team] = {
      team,
      offensiveRating: safeAvg(goalsFor[team]),
      defensiveRating: safeAvg(goalsAgainst[team]),
      gamesPlayed: played,
    }
  }
  return table
}

// ---------------------------------------------------------------------------
// §5.1 — volume: Retranqueiro ◄──► Artilheiro
// ---------------------------------------------------------------------------

function computeVolumeAxis(input: ProfileInput): Axis {
  const targetTotals = input.targetPredictions.map((p) => p.home_score + p.away_score)
  const groupTotals = input.groupPredictions.map((p) => p.home_score + p.away_score)

  const targetAvg = safeAvg(targetTotals)
  const groupAvg = safeAvg(groupTotals)

  const lower = groupAvg - VOLUME_NORMALIZATION_HALF_RANGE
  const upper = groupAvg + VOLUME_NORMALIZATION_HALF_RANGE
  const range = upper - lower
  const position = range > 0 ? clamp01((targetAvg - lower) / range) : 0.5

  const highGoalCount = targetTotals.filter((t) => t >= VOLUME_HIGH_GOALS_THRESHOLD).length
  const lockedCount = input.targetPredictions.filter(
    (p) =>
      (p.home_score === 0 && p.away_score === 0) ||
      (p.home_score === 1 && p.away_score === 0) ||
      (p.home_score === 0 && p.away_score === 1)
  ).length

  const sampleSize = input.targetPredictions.length

  return {
    key: 'volume',
    leftLabel: 'Retranqueiro',
    rightLabel: 'Artilheiro',
    position,
    bar: positionToBar(position),
    confident: sampleSize >= MIN_SAMPLE_PRED,
    stats: [
      { label: 'Média de gols/palpite', value: fmt(targetAvg) },
      { label: 'Média do grupo', value: fmt(groupAvg) },
      { label: 'Palpites com 3+ gols', value: pct(sampleSize > 0 ? highGoalCount / sampleSize : 0) },
      { label: 'Palpites travados (0x0/1x0)', value: pct(sampleSize > 0 ? lockedCount / sampleSize : 0) },
    ],
  }
}

// ---------------------------------------------------------------------------
// §5.2 — underdog: Cauteloso ◄──► Destemido
// ---------------------------------------------------------------------------

type Winner = 'home' | 'away' | 'draw'

function winnerOf(homeScore: number, awayScore: number): Winner {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}

/** Determina o "vencedor de consenso" do grupo para um jogo: a moda dos vencedores palpitados. Empates na moda contam como 'draw'. */
function consensusWinner(predictionsForGame: PredLite[]): Winner | null {
  if (predictionsForGame.length === 0) return null

  const counts: Record<Winner, number> = { home: 0, away: 0, draw: 0 }
  for (const p of predictionsForGame) {
    counts[winnerOf(p.home_score, p.away_score)] += 1
  }

  const max = Math.max(counts.home, counts.away, counts.draw)
  const winners = (['home', 'away', 'draw'] as Winner[]).filter((w) => counts[w] === max)

  // Empate na moda (§9): trata o vencedor de consenso como empate.
  if (winners.length > 1) return 'draw'
  return winners[0]
}

function computeUnderdogAxis(input: ProfileInput): Axis {
  const predictionsByGame = new Map<string, PredLite[]>()
  for (const p of input.groupPredictions) {
    const list = predictionsByGame.get(p.game_id) ?? []
    list.push(p)
    predictionsByGame.set(p.game_id, list)
  }

  const gamesByIdMap = new Map(input.games.map((g) => [g.id, g]))

  let contrarianCount = 0
  let contrarianAndCorrectCount = 0
  const sampleSize = input.targetPredictions.length

  for (const targetPred of input.targetPredictions) {
    const gamePredictions = predictionsByGame.get(targetPred.game_id) ?? []
    const consensus = consensusWinner(gamePredictions)
    if (consensus === null) continue

    const targetWinner = winnerOf(targetPred.home_score, targetPred.away_score)
    if (targetWinner === consensus) continue

    contrarianCount += 1

    const game = gamesByIdMap.get(targetPred.game_id)
    if (game && game.status === 'finished' && game.home_score !== null && game.away_score !== null) {
      const realWinner = winnerOf(game.home_score, game.away_score)
      if (realWinner === targetWinner) {
        contrarianAndCorrectCount += 1
      }
    }
  }

  const contrarianRate = sampleSize > 0 ? contrarianCount / sampleSize : 0
  const position = clamp01(contrarianRate)

  return {
    key: 'underdog',
    leftLabel: 'Cauteloso',
    rightLabel: 'Destemido',
    position,
    bar: positionToBar(position),
    confident: sampleSize >= MIN_SAMPLE_PRED,
    stats: [
      { label: 'Contra o consenso do grupo', value: pct(contrarianRate) },
      { label: 'Bancou o azarão e acertou', value: `${contrarianAndCorrectCount}x` },
    ],
  }
}

// ---------------------------------------------------------------------------
// §5.3 — calibration: Distraído ◄──► Calculista
// ---------------------------------------------------------------------------

function computeCalibrationAxis(input: ProfileInput): Axis {
  const gamesByIdMap = new Map(input.games.map((g) => [g.id, g]))

  const finishedPairs = input.targetPredictions
    .map((p) => ({ pred: p, game: gamesByIdMap.get(p.game_id) }))
    .filter(
      (
        pair
      ): pair is { pred: PredLite; game: GameLite & { home_score: number; away_score: number } } =>
        !!pair.game &&
        pair.game.status === 'finished' &&
        pair.game.home_score !== null &&
        pair.game.away_score !== null
    )

  const sampleSize = finishedPairs.length

  const errors: number[] = []
  let exactCount = 0
  let winnerCount = 0
  let tightTotal = 0
  let tightWinnerCorrect = 0
  let blowoutTotal = 0
  let blowoutWinnerCorrect = 0

  for (const { pred, game } of finishedPairs) {
    const errorGoals =
      Math.abs(pred.home_score - game.home_score) + Math.abs(pred.away_score - game.away_score)
    errors.push(errorGoals)

    const result = calculateScore(
      { home_score: game.home_score, away_score: game.away_score },
      { home_score: pred.home_score, away_score: pred.away_score }
    )
    if (result.breakdown.exact > 0) exactCount += 1
    if (result.breakdown.winner > 0) winnerCount += 1

    const realDiff = Math.abs(game.home_score - game.away_score)
    if (realDiff <= CALIBRATION_TIGHT_GAME_MAX_DIFF) {
      tightTotal += 1
      if (result.breakdown.winner > 0) tightWinnerCorrect += 1
    } else if (realDiff >= CALIBRATION_BLOWOUT_MIN_DIFF) {
      blowoutTotal += 1
      if (result.breakdown.winner > 0) blowoutWinnerCorrect += 1
    }
  }

  const avgError = safeAvg(errors)
  // Erro menor => mais "Calculista" (position mais próxima de 1).
  const position = clamp01(1 - avgError / CALIBRATION_ERROR_CEILING)

  const exactRate = sampleSize > 0 ? exactCount / sampleSize : 0
  const winnerRate = sampleSize > 0 ? winnerCount / sampleSize : 0
  const tightRate = tightTotal > 0 ? tightWinnerCorrect / tightTotal : null
  const blowoutRate = blowoutTotal > 0 ? blowoutWinnerCorrect / blowoutTotal : null

  const stats: AxisStat[] = [
    { label: 'Erro médio de gols', value: fmt(avgError) },
    { label: 'Taxa de placar exato', value: pct(exactRate) },
    { label: 'Taxa de acerto de vencedor', value: pct(winnerRate) },
  ]
  if (tightRate !== null) {
    stats.push({ label: 'Acerto em jogos apertados', value: pct(tightRate) })
  }
  if (blowoutRate !== null) {
    stats.push({ label: 'Acerto em goleadas', value: pct(blowoutRate) })
  }

  return {
    key: 'calibration',
    leftLabel: 'Distraído',
    rightLabel: 'Calculista',
    position,
    bar: positionToBar(position),
    confident: sampleSize >= MIN_SAMPLE_FINISHED,
    stats,
  }
}

// ---------------------------------------------------------------------------
// §5.4 — style_reader: Torcedor ◄──► Analista
// ---------------------------------------------------------------------------

/** Correlação de Pearson entre dois vetores numéricos de mesmo tamanho. Retorna 0 em casos degenerados (variância zero, amostra < 2). */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2 || ys.length !== n) return 0

  const meanX = safeAvg(xs)
  const meanY = safeAvg(ys)

  let numerator = 0
  let sumSqX = 0
  let sumSqY = 0

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    numerator += dx * dy
    sumSqX += dx * dx
    sumSqY += dy * dy
  }

  const denominator = Math.sqrt(sumSqX * sumSqY)
  if (denominator === 0) return 0

  const r = numerator / denominator
  if (Number.isNaN(r) || !Number.isFinite(r)) return 0
  return r
}

function computeStyleReaderAxis(input: ProfileInput, teamStyle: TeamStyleTable): Axis {
  const gamesByIdMap = new Map(input.games.map((g) => [g.id, g]))

  const finishedPairs = input.targetPredictions
    .map((p) => ({ pred: p, game: gamesByIdMap.get(p.game_id) }))
    .filter(
      (pair): pair is { pred: PredLite; game: GameLite } =>
        !!pair.game && pair.game.status === 'finished'
    )

  const sampleSize = finishedPairs.length

  // Para cada palpite, gera dois pontos (gols dados ao mandante, gols dados ao visitante)
  // versus a força ofensiva inferida daquele time — apenas para times com dados suficientes.
  const predictedGoals: number[] = []
  const offensiveRatings: number[] = []
  const examples: string[] = []

  for (const { pred, game } of finishedPairs) {
    const homeStyle = teamStyle[game.home_team]
    const awayStyle = teamStyle[game.away_team]

    if (homeStyle) {
      predictedGoals.push(pred.home_score)
      offensiveRatings.push(homeStyle.offensiveRating)
    }
    if (awayStyle) {
      predictedGoals.push(pred.away_score)
      offensiveRatings.push(awayStyle.offensiveRating)
    }
  }

  const teamsWithData = Object.keys(teamStyle).length
  const rawCorrelation = pearsonCorrelation(predictedGoals, offensiveRatings)
  const correlation = Math.max(0, rawCorrelation)
  const position = clamp01(correlation)

  // Exemplo textual: palpite mais generoso de gols dado a um time ofensivo com dados suficientes.
  const rankedTeams = Object.values(teamStyle).sort((a, b) => b.offensiveRating - a.offensiveRating)
  const mostOffensiveTeam = rankedTeams[0]
  if (mostOffensiveTeam) {
    const predsAgainstThatTeam = finishedPairs
      .map(({ pred, game }) => {
        if (game.home_team === mostOffensiveTeam.team) return pred.home_score
        if (game.away_team === mostOffensiveTeam.team) return pred.away_score
        return null
      })
      .filter((v): v is number => v !== null)

    if (predsAgainstThatTeam.length > 0) {
      const maxGiven = Math.max(...predsAgainstThatTeam)
      examples.push(`Deu ${maxGiven} gol${maxGiven === 1 ? '' : 's'} para ${mostOffensiveTeam.team}, o time mais ofensivo do grupo`)
    }
  }

  const confident = sampleSize >= MIN_SAMPLE_FINISHED && teamsWithData >= MIN_TEAMS_FOR_STYLE

  const stats: AxisStat[] = [
    { label: 'Concordância com estilo ofensivo', value: pct(correlation) },
  ]
  for (const ex of examples) {
    stats.push({ label: 'Exemplo', value: ex })
  }

  return {
    key: 'style_reader',
    leftLabel: 'Torcedor',
    rightLabel: 'Analista',
    position,
    bar: positionToBar(position),
    confident,
    stats,
  }
}

// ---------------------------------------------------------------------------
// §7 — Arquétipo (nome + parágrafo)
// ---------------------------------------------------------------------------

interface PoleDescriptor {
  adjective: string
  sentence: (axis: Axis) => string
}

// Tabela de adjetivos e frases por polo de cada eixo. Tom leve/divertido, em
// português. Cada `sentence` injeta apenas valores já calculados (nunca
// números inventados).
const POLE_TABLE: Record<AxisKey, { left: PoleDescriptor; right: PoleDescriptor }> = {
  volume: {
    left: {
      adjective: 'Retranqueiro',
      sentence: (axis) =>
        `Aposta no jogo truncado — média de ${axis.stats[0]?.value ?? '0'} gols por palpite, bem abaixo do grupo.`,
    },
    right: {
      adjective: 'Artilheiro',
      sentence: (axis) =>
        `Não tem medo de goleada — média de ${axis.stats[0]?.value ?? '0'} gols por palpite.`,
    },
  },
  underdog: {
    left: {
      adjective: 'Cauteloso',
      sentence: () => `Confia no favoritismo e raramente contraria o consenso do grupo.`,
    },
    right: {
      adjective: 'Destemido',
      sentence: (axis) =>
        `Gosta de contrariar o grupo — foi contra o consenso em ${axis.stats[0]?.value ?? '0%'} dos palpites.`,
    },
  },
  calibration: {
    left: {
      adjective: 'Distraído',
      sentence: (axis) =>
        `Erra o placar com frequência — erro médio de ${axis.stats[0]?.value ?? '0'} gols por jogo.`,
    },
    right: {
      adjective: 'Calculista',
      sentence: (axis) =>
        `Tem faro para o placar certo — cravou ${axis.stats[1]?.value ?? '0%'} dos jogos finalizados.`,
    },
  },
  style_reader: {
    left: {
      adjective: 'Torcedor',
      sentence: () => `Palpita mais pelo coração do que pelo retrospecto dos times.`,
    },
    right: {
      adjective: 'Analista',
      sentence: (axis) =>
        `Lê bem o estilo dos times ao distribuir os gols nos palpites (concordância de ${axis.stats[0]?.value ?? '0%'}).`,
    },
  },
}

const NEUTRAL_ARCHETYPE: Archetype = {
  name: 'Recém-chegado',
  paragraph:
    'Ainda não há jogos suficientes (ao vivo ou encerrados) com palpites para traçar um perfil. Volte depois que mais jogos rolarem.',
}

function selectArchetype(axes: Axis[]): Archetype {
  const confidentAxes = axes.filter((a) => a.confident)
  if (confidentAxes.length === 0) return NEUTRAL_ARCHETYPE

  const dominant = [...confidentAxes]
    .sort((a, b) => Math.abs(b.position - 0.5) - Math.abs(a.position - 0.5))
    .slice(0, 2)

  const descriptors = dominant.map((axis) => {
    const pole = axis.position >= 0.5 ? POLE_TABLE[axis.key].right : POLE_TABLE[axis.key].left
    return { axis, pole }
  })

  // Nome: "<adjetivo do 1º eixo dominante> <adjetivo do 2º eixo dominante>",
  // no padrão dos exemplos da spec (ex: "Destemido Artilheiro").
  // Convenção: o adjetivo mais "extremo" (maior distância de 0.5) vem por último
  // para casar com os exemplos ("volume→Artilheiro + underdog→Destemido ⇒ Destemido Artilheiro").
  const [primary, secondary] = descriptors
  const name = secondary
    ? `${secondary.pole.adjective} ${primary.pole.adjective}`
    : primary.pole.adjective

  const sentences = descriptors.map(({ axis, pole }) => pole.sentence(axis))
  const paragraph = sentences.join(' ')

  return { name, paragraph }
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

export function computeParticipantProfile(input: ProfileInput): ParticipantProfile {
  const teamStyle = inferTeamStyle(input.games)

  const axes: Axis[] = [
    computeVolumeAxis(input),
    computeUnderdogAxis(input),
    computeCalibrationAxis(input),
    computeStyleReaderAxis(input, teamStyle),
  ]

  const archetype = selectArchetype(axes)

  return {
    sampleSize: input.targetPredictions.length,
    axes,
    archetype,
    teamStyle,
  }
}
