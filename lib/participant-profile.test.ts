import { describe, it, expect } from 'vitest'
import {
  computeParticipantProfile,
  inferTeamStyle,
  type ProfileInput,
  type GameLite,
  type PredLite,
} from '@/lib/participant-profile'

const USER = 'user-alvo'
const OTHER1 = 'user-outro-1'
const OTHER2 = 'user-outro-2'

function game(
  id: string,
  home_team: string,
  away_team: string,
  home_score: number | null,
  away_score: number | null,
  status: 'live' | 'finished' = 'finished'
): GameLite {
  return { id, home_team, away_team, home_score, away_score, status }
}

function pred(user_id: string, game_id: string, home_score: number, away_score: number): PredLite {
  return { user_id, game_id, home_score, away_score }
}

describe('computeParticipantProfile — bordas', () => {
  it('sem palpites em jogos resolvidos → arquétipo Recém-chegado e nenhum eixo confident', () => {
    const input: ProfileInput = {
      targetUserId: USER,
      games: [],
      targetPredictions: [],
      groupPredictions: [],
    }
    const profile = computeParticipantProfile(input)

    expect(profile.sampleSize).toBe(0)
    expect(profile.archetype.name).toBe('Recém-chegado')
    for (const axis of profile.axes) {
      expect(axis.confident).toBe(false)
      expect(Number.isNaN(axis.position)).toBe(false)
      expect(axis.position).toBeGreaterThanOrEqual(0)
      expect(axis.position).toBeLessThanOrEqual(1)
    }
  })

  it('sem jogos finished (só live) → calibration e style_reader não confident, volume/underdog funcionam', () => {
    const games: GameLite[] = [game('g1', 'BRA', 'ARG', 1, 1, 'live')]
    const targetPredictions = [pred(USER, 'g1', 2, 1)]
    const groupPredictions = [
      pred(USER, 'g1', 2, 1),
      pred(OTHER1, 'g1', 2, 0),
      pred(OTHER2, 'g1', 1, 0),
    ]

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions,
    })

    const calibration = profile.axes.find((a) => a.key === 'calibration')!
    const styleReader = profile.axes.find((a) => a.key === 'style_reader')!
    expect(calibration.confident).toBe(false)
    expect(styleReader.confident).toBe(false)
    expect(Number.isNaN(calibration.position)).toBe(false)
    expect(Number.isNaN(styleReader.position)).toBe(false)
  })

  it('nunca produz NaN/undefined nas posições e stats mesmo com listas vazias', () => {
    const profile = computeParticipantProfile({
      targetUserId: USER,
      games: [],
      targetPredictions: [],
      groupPredictions: [],
    })

    for (const axis of profile.axes) {
      expect(axis.position).not.toBeNaN()
      expect(axis.bar).toBeDefined()
      expect(axis.bar.length).toBe(12)
      for (const stat of axis.stats) {
        expect(stat.value).not.toContain('NaN')
        expect(stat.value).not.toBe('undefined')
      }
    }
  })

  it('empate no consenso (moda dividida) é tratado como vencedor de consenso = empate', () => {
    // Votos do grupo (incluindo o alvo) para o jogo: 2x home, 2x away → moda
    // empatada → consenso = draw. Alvo palpitou away (não-empate) → conta
    // como contra o consenso.
    const OTHER3 = 'user-outro-3'
    const games: GameLite[] = [game('g1', 'BRA', 'ARG', 1, 1, 'finished')]
    const othersPredictions = [
      pred(OTHER1, 'g1', 2, 0), // home
      pred(OTHER2, 'g1', 1, 0), // home
      pred(OTHER3, 'g1', 0, 2), // away
    ]
    const targetPredictions = [pred(USER, 'g1', 0, 1)] // away — não é empate

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: [...othersPredictions, ...targetPredictions],
    })

    const underdog = profile.axes.find((a) => a.key === 'underdog')!
    // Amostra pequena (1 palpite), mas o cálculo deve contar como contrário ao consenso.
    expect(underdog.stats[0].value).toBe('100%')
  })
})

describe('volume — Retranqueiro vs Artilheiro', () => {
  it('participante com média de gols muito acima do grupo tende ao polo Artilheiro', () => {
    const games: GameLite[] = Array.from({ length: 6 }, (_, i) =>
      game(`g${i}`, 'BRA', 'ARG', 2, 1, 'finished')
    )
    // Alvo sempre chuta muitos gols (média alta)
    const targetPredictions = games.map((g) => pred(USER, g.id, 4, 3))
    // Grupo (incluindo o alvo) tem uma média bem mais baixa
    const groupPredictions = [
      ...targetPredictions,
      ...games.map((g) => pred(OTHER1, g.id, 1, 0)),
      ...games.map((g) => pred(OTHER2, g.id, 0, 0)),
    ]

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions,
    })

    const volume = profile.axes.find((a) => a.key === 'volume')!
    expect(volume.confident).toBe(true)
    expect(volume.position).toBeGreaterThan(0.5)
  })

  it('participante com média de gols muito abaixo do grupo tende ao polo Retranqueiro', () => {
    const games: GameLite[] = Array.from({ length: 6 }, (_, i) =>
      game(`g${i}`, 'BRA', 'ARG', 2, 1, 'finished')
    )
    const targetPredictions = games.map((g) => pred(USER, g.id, 0, 0))
    const groupPredictions = [
      ...targetPredictions,
      ...games.map((g) => pred(OTHER1, g.id, 3, 2)),
      ...games.map((g) => pred(OTHER2, g.id, 4, 3)),
    ]

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions,
    })

    const volume = profile.axes.find((a) => a.key === 'volume')!
    expect(volume.confident).toBe(true)
    expect(volume.position).toBeLessThan(0.5)
  })

  it('marca confident=false quando amostra < MIN_SAMPLE_PRED (5)', () => {
    const games: GameLite[] = Array.from({ length: 3 }, (_, i) =>
      game(`g${i}`, 'BRA', 'ARG', 2, 1, 'finished')
    )
    const targetPredictions = games.map((g) => pred(USER, g.id, 2, 1))

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: targetPredictions,
    })

    const volume = profile.axes.find((a) => a.key === 'volume')!
    expect(volume.confident).toBe(false)
  })
})

describe('underdog — Cauteloso vs Destemido', () => {
  it('participante que sempre segue o consenso fica no polo Cauteloso (position baixa)', () => {
    const games: GameLite[] = Array.from({ length: 5 }, (_, i) =>
      game(`g${i}`, 'BRA', 'ARG', 2, 1, 'finished')
    )
    // Consenso: home vence em todos os jogos (2 outros participantes concordam)
    const consensusPreds = games.flatMap((g) => [pred(OTHER1, g.id, 2, 0), pred(OTHER2, g.id, 3, 1)])
    const targetPredictions = games.map((g) => pred(USER, g.id, 1, 0)) // também aposta em home

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: [...consensusPreds, ...targetPredictions],
    })

    const underdog = profile.axes.find((a) => a.key === 'underdog')!
    expect(underdog.confident).toBe(true)
    expect(underdog.position).toBe(0)
  })

  it('participante que sempre contraria o consenso fica no polo Destemido (position alta)', () => {
    const games: GameLite[] = Array.from({ length: 5 }, (_, i) =>
      game(`g${i}`, 'BRA', 'ARG', 0, 2, 'finished')
    )
    // Consenso: home vence (2 outros concordam)
    const consensusPreds = games.flatMap((g) => [pred(OTHER1, g.id, 2, 0), pred(OTHER2, g.id, 3, 1)])
    // Alvo sempre aposta no visitante (contra o consenso)
    const targetPredictions = games.map((g) => pred(USER, g.id, 0, 1))

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: [...consensusPreds, ...targetPredictions],
    })

    const underdog = profile.axes.find((a) => a.key === 'underdog')!
    expect(underdog.confident).toBe(true)
    expect(underdog.position).toBe(1)
    // Zebra bateu em todos (away venceu de fato) — deve contar em "bancou o azarão e acertou"
    expect(underdog.stats[1].value).toBe('5x')
  })
})

describe('calibration — Distraído vs Calculista (coerência com lib/scoring.ts)', () => {
  it('placar exato em todos os jogos → erro médio 0, taxa de exato 100%, position próxima de 1', () => {
    const games: GameLite[] = Array.from({ length: 4 }, (_, i) =>
      game(`g${i}`, 'BRA', 'ARG', 3, 1, 'finished')
    )
    const targetPredictions = games.map((g) => pred(USER, g.id, 3, 1))

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: targetPredictions,
    })

    const calibration = profile.axes.find((a) => a.key === 'calibration')!
    expect(calibration.confident).toBe(true)
    expect(calibration.position).toBe(1)
    expect(calibration.stats[0].value).toBe('0.0')
    expect(calibration.stats[1].value).toBe('100%')
  })

  it('erros grandes e nenhum acerto → position próxima de 0', () => {
    const games: GameLite[] = Array.from({ length: 4 }, (_, i) =>
      game(`g${i}`, 'BRA', 'ARG', 3, 0, 'finished')
    )
    // Alvo sempre erra feio: aposta o oposto (away vence)
    const targetPredictions = games.map((g) => pred(USER, g.id, 0, 3))

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: targetPredictions,
    })

    const calibration = profile.axes.find((a) => a.key === 'calibration')!
    expect(calibration.confident).toBe(true)
    expect(calibration.position).toBe(0)
    expect(calibration.stats[2].value).toBe('0%') // taxa de acerto de vencedor
  })

  it('marca confident=false quando jogos finished com palpite < MIN_SAMPLE_FINISHED (3)', () => {
    const games: GameLite[] = [
      game('g1', 'BRA', 'ARG', 1, 0, 'finished'),
      game('g2', 'BRA', 'ARG', 2, 0, 'finished'),
    ]
    const targetPredictions = games.map((g) => pred(USER, g.id, 1, 0))

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: targetPredictions,
    })

    const calibration = profile.axes.find((a) => a.key === 'calibration')!
    expect(calibration.confident).toBe(false)
  })
})

describe('inferTeamStyle', () => {
  it('calcula offensiveRating e defensiveRating apenas com jogos finished e mínimo de jogos por time', () => {
    const games: GameLite[] = [
      game('g1', 'BRA', 'ARG', 3, 1, 'finished'),
      game('g2', 'ARG', 'BRA', 0, 2, 'finished'),
      game('g3', 'BRA', 'MEX', 1, 1, 'pending' as unknown as 'finished'), // não deve contar (mesmo que status incorreto)
    ]
    const style = inferTeamStyle(games.filter((g) => g.status === 'finished'))

    expect(style['BRA'].gamesPlayed).toBe(2)
    expect(style['BRA'].offensiveRating).toBeCloseTo((3 + 2) / 2)
    expect(style['BRA'].defensiveRating).toBeCloseTo((1 + 0) / 2)

    expect(style['ARG'].gamesPlayed).toBe(2)
    expect(style['MEX']).toBeUndefined() // MEX só apareceu no jogo pending, filtrado fora
  })

  it('ignora times com menos jogos que MIN_GAMES_PER_TEAM (2)', () => {
    const games: GameLite[] = [game('g1', 'BRA', 'ARG', 3, 1, 'finished')]
    const style = inferTeamStyle(games)
    expect(style['BRA']).toBeUndefined()
    expect(style['ARG']).toBeUndefined()
  })
})

describe('style_reader — Torcedor vs Analista', () => {
  it('participante que dá mais gols ao time mais ofensivo tem correlação alta (position alta)', () => {
    // BRA ofensivo (marca muito), URU defensivo (marca pouco) — dados suficientes (2+ jogos cada)
    const games: GameLite[] = [
      game('g1', 'BRA', 'FRA', 4, 0, 'finished'),
      game('g2', 'BRA', 'ESP', 3, 1, 'finished'),
      game('g3', 'URU', 'FRA', 1, 0, 'finished'),
      game('g4', 'URU', 'ESP', 0, 0, 'finished'),
    ]
    // Alvo sempre dá muitos gols pro BRA (ofensivo) e poucos pro URU (defensivo)
    const targetPredictions = [
      pred(USER, 'g1', 4, 0),
      pred(USER, 'g2', 3, 1),
      pred(USER, 'g3', 0, 1),
      pred(USER, 'g4', 0, 0),
    ]

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: targetPredictions,
    })

    const styleReader = profile.axes.find((a) => a.key === 'style_reader')!
    expect(styleReader.position).toBeGreaterThan(0.5)
  })

  it('correlação negativa é "clampada" em 0 (nunca position negativa)', () => {
    const games: GameLite[] = [
      game('g1', 'BRA', 'FRA', 4, 0, 'finished'),
      game('g2', 'BRA', 'ESP', 3, 1, 'finished'),
      game('g3', 'URU', 'FRA', 1, 0, 'finished'),
      game('g4', 'URU', 'ESP', 0, 0, 'finished'),
    ]
    // Alvo inverte: dá poucos gols pro time ofensivo (BRA) e muitos pro defensivo (URU)
    const targetPredictions = [
      pred(USER, 'g1', 0, 0),
      pred(USER, 'g2', 0, 1),
      pred(USER, 'g3', 4, 1),
      pred(USER, 'g4', 3, 0),
    ]

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: targetPredictions,
    })

    const styleReader = profile.axes.find((a) => a.key === 'style_reader')!
    expect(styleReader.position).toBeGreaterThanOrEqual(0)
  })

  it('confident=false quando há menos de MIN_TEAMS_FOR_STYLE (4) times com dados suficientes', () => {
    const games: GameLite[] = [
      game('g1', 'BRA', 'ARG', 3, 1, 'finished'),
      game('g2', 'BRA', 'ARG', 2, 0, 'finished'),
      game('g3', 'BRA', 'ARG', 1, 1, 'finished'),
    ]
    const targetPredictions = games.map((g) => pred(USER, g.id, 2, 1))

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: targetPredictions,
    })

    const styleReader = profile.axes.find((a) => a.key === 'style_reader')!
    expect(styleReader.confident).toBe(false)
  })
})

describe('seleção de arquétipo', () => {
  it('underdog nunca entra no arquétipo, mesmo sendo o eixo mais extremo e confident', () => {
    // Monta um cenário com volume MUITO otimista, underdog MUITO destemido,
    // e os outros dois eixos deliberadamente sem confiança (poucos finished).
    // underdog é o eixo mais extremo (distância de 0.5 máxima), mas não pode
    // aparecer no nome do arquétipo — só volume (único elegível confident) deve entrar.
    const games: GameLite[] = Array.from({ length: 6 }, (_, i) =>
      game(`g${i}`, 'BRA', 'ARG', 1, 2, 'live')
    )
    const consensusPreds = games.flatMap((g) => [pred(OTHER1, g.id, 2, 0), pred(OTHER2, g.id, 3, 1)])
    // Alvo: muitos gols (otimista) e sempre contra o consenso (destemido)
    const targetPredictions = games.map((g) => pred(USER, g.id, 1, 4))

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: [...consensusPreds, ...targetPredictions],
    })

    const volume = profile.axes.find((a) => a.key === 'volume')!
    const underdog = profile.axes.find((a) => a.key === 'underdog')!
    const calibration = profile.axes.find((a) => a.key === 'calibration')!
    const styleReader = profile.axes.find((a) => a.key === 'style_reader')!

    expect(volume.confident).toBe(true)
    expect(underdog.confident).toBe(true)
    expect(calibration.confident).toBe(false) // só jogos live, nenhum finished
    expect(styleReader.confident).toBe(false)

    // underdog segue calculado e exibível na lista de eixos, só não define o arquétipo.
    expect(underdog.position).toBeGreaterThan(0.5)

    expect(profile.archetype.name).toBe('Artilheiro')
    expect(profile.archetype.name).not.toContain('Destemido')
    expect(profile.archetype.paragraph.length).toBeGreaterThan(0)
  })

  it('sem nenhum eixo confident → arquétipo neutro Recém-chegado', () => {
    const games: GameLite[] = [game('g1', 'BRA', 'ARG', 1, 1, 'live')]
    const targetPredictions = [pred(USER, 'g1', 1, 1)]

    const profile = computeParticipantProfile({
      targetUserId: USER,
      games,
      targetPredictions,
      groupPredictions: targetPredictions,
    })

    expect(profile.archetype.name).toBe('Recém-chegado')
  })
})
