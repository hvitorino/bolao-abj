/**
 * POST /api/whatsapp/webhook
 *
 * Recebe eventos da Evolution API (WhatsApp) e responde a comandos do grupo.
 *
 * Comandos suportados:
 *   !ranking  — ranking completo do Cartola ABJ (bolaodefutebol)
 *   !hoje     — jogos do dia com placar
 *   !ajuda    — lista de comandos
 */
import { NextRequest, NextResponse } from 'next/server'
import { bdfFetch } from '@/lib/bolaofutebol'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!
const BDF_GROUP_ID = 'ba08470f-94e7-4e51-b324-dc65c60c78af'

// ── Tipos Evolution API ──────────────────────────────────────────────────────

interface EvolutionWebhook {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
    }
    messageType: string
    pushName?: string
  }
}

// ── Tipos BDF ────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  user_id: string
  user_name: string
  total_points: number
  rank: number
  tiebreaker_stats: {
    exact_score_count: number
    goal_diff_count: number
    winner_count: number
  }
}

interface BdfMatch {
  id: string
  home_team: string
  away_team: string
  start_time: string
  status: string
  home_score: number | null
  away_score: number | null
  winner: string | null
  match_number: number
  stage: string
  sub_status?: string
}

interface BdfPrediction {
  user_id: string
  home_score: number
  away_score: number
  predicted_winner: string
  points_earned: number
  status: string
  scoring_state: string
}

// Mapeamento user_id → nome amigável (espelho de cartola-client.tsx)
const USERS: Record<string, string> = {
  '7f6249ad-4b2b-4ca1-b298-f078dfc8d03b': 'Hamon',
  '6e7e3f9a-3456-4296-8c5b-f3b8ef14d103': 'David',
  'ef712a54-8b7b-492f-936b-c38dabc01f8e': 'Thiago',
  '8d271d3a-139e-4273-baec-729bfb2dfd1b': 'Michel',
  '0d5d7248-ef8c-460e-a5d3-49997ed3d2fe': 'Roberto',
  '08648e5c-81f7-4fcb-a581-ba1c8a2596e0': 'Fabio',
  '9d4a0595-3e1d-40fc-9715-370c3e072b57': 'Henrique',
  'a7501df4-0689-4ac3-a367-3b23c31ea88f': 'JoaoFilho',
  '4ccdf0db-c9e6-43c2-ad83-ca7507fb0b55': 'Civilizado',
  'eba7845b-7895-4a46-bf47-6f87b4dcc44c': 'Raimundo',
  '8e709090-f455-4d03-8308-3e74d55624ad': 'Hermes',
  'f197cbe1-3de8-410f-b6ef-03170e16667d': 'Josue',
}

function friendlyName(userId: string, fallback: string): string {
  return USERS[userId] ?? fallback
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractText(data: EvolutionWebhook['data']): string | null {
  return (
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    null
  )
}

function todayBRT(): string {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(0, 10)
}

function toBrtTime(iso: string): string {
  const brt = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(11, 16)
}

function pts(raw: number): string {
  return Math.round(raw / 100).toString()
}

async function sendMessage(to: string, text: string): Promise<void> {
  await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_KEY,
    },
    body: JSON.stringify({ number: to, text }),
  })
}

// ── Comandos ─────────────────────────────────────────────────────────────────

async function cmdRanking(): Promise<string> {
  const [lbData, allMatches] = await Promise.all([
    bdfFetch<{ entries: LeaderboardEntry[] }>(
      `/groups/${BDF_GROUP_ID}/leaderboard?limit=1000&tiebreaker=true`
    ),
    bdfFetch<BdfMatch[]>('/matches'),
  ])

  const entries = lbData.entries ?? []
  const today = todayBRT()

  // Jogos de hoje (BRT) que já estão ao vivo ou finalizados
  const liveOrFinished = allMatches.filter((m) => {
    const brtDay = new Date(new Date(m.start_time).getTime() - 3 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    return (brtDay === today) && (m.status === 'live' || m.status === 'finished')
  })

  // Buscar palpites de todos os jogos relevantes em paralelo
  const todayPoints: Record<string, number> = {}
  if (liveOrFinished.length > 0) {
    const predResults = await Promise.all(
      liveOrFinished.map((m) =>
        bdfFetch<BdfPrediction[]>(
          `/matches/${encodeURIComponent(m.id)}/predictions?groupId=${BDF_GROUP_ID}`
        )
      )
    )
    for (const preds of predResults) {
      for (const p of preds) {
        if (p.status === 'processed' && p.scoring_state === 'scored' && p.points_earned > 0) {
          todayPoints[p.user_id] = (todayPoints[p.user_id] ?? 0) + p.points_earned
        }
      }
    }
  }

  // Combinar leaderboard + pontos de hoje e reordenar
  const combined = entries
    .map((e) => ({
      ...e,
      combined: e.total_points + (todayPoints[e.user_id] ?? 0),
      todayPts: todayPoints[e.user_id] ?? 0,
    }))
    .sort((a, b) => b.combined - a.combined)

  const medals = ['🥇', '🥈', '🥉']
  const lines = combined.map((e, i) => {
    const medal = medals[i] ?? `${i + 1}.`
    const name = friendlyName(e.user_id, e.user_name)
    const total = pts(e.combined)
    const todayStr = e.todayPts > 0 ? ` _(+${pts(e.todayPts)} hoje)_` : ''
    return `${medal} *${name}* — ${total} pts${todayStr}`
  })

  // Indicar jogos ao vivo no rodapé
  const liveNow = liveOrFinished.filter((m) => m.status === 'live')
  const liveStr = liveNow.length > 0
    ? `\n\n🔴 *Ao vivo:* ${liveNow.map((m) => `${m.home_team} ${m.home_score ?? 0}×${m.away_score ?? 0} ${m.away_team}`).join(' · ')}`
    : ''

  return `🏆 *RANKING — CARTOLA ABJ*\n\n${lines.join('\n')}${liveStr}`
}

async function cmdHoje(): Promise<string> {
  const allMatches = await bdfFetch<BdfMatch[]>('/matches')
  const today = todayBRT()

  const todayMatches = allMatches.filter((m) => {
    const brt = new Date(new Date(m.start_time).getTime() - 3 * 60 * 60 * 1000)
    return brt.toISOString().slice(0, 10) === today
  })

  if (todayMatches.length === 0) return '📅 Nenhum jogo hoje.'

  const lines = todayMatches.map((m) => {
    const time = toBrtTime(m.start_time)
    if (m.status === 'finished') {
      return `✅ *${m.home_team} ${m.home_score} × ${m.away_score} ${m.away_team}*`
    }
    if (m.status === 'live') {
      return `🔴 *${m.home_team} ${m.home_score ?? 0} × ${m.away_score ?? 0} ${m.away_team}* — AO VIVO`
    }
    return `🕐 ${time} BRT — ${m.home_team} × ${m.away_team} _(${m.stage})_`
  })

  return `📅 *JOGOS DE HOJE*\n\n${lines.join('\n')}`
}

function subStatusLabel(sub?: string): string {
  const map: Record<string, string> = {
    first_half: '1º Tempo',
    second_half: '2º Tempo',
    half_time: 'Intervalo',
    extra_time_first: 'Prorrogação',
    extra_time_second: 'Prorrogação',
  }
  return sub ? (map[sub] ?? 'Ao Vivo') : 'Ao Vivo'
}

function predIcon(p: BdfPrediction, m: BdfMatch): string {
  const rh = m.home_score ?? 0
  const ra = m.away_score ?? 0
  const exact = p.home_score === rh && p.away_score === ra
  const diffMatch =
    !exact &&
    p.predicted_winner === m.winner &&
    Math.abs(p.home_score - p.away_score) === Math.abs(rh - ra)
  const winnerMatch = p.predicted_winner === m.winner
  if (exact) return '✅'
  if (diffMatch) return '⚡'
  if (winnerMatch) return '🏆'
  return '❌'
}

async function cmdPalpites(): Promise<string> {
  const allMatches = await bdfFetch<BdfMatch[]>('/matches')
  const liveMatches = allMatches.filter((m) => m.status === 'live')

  if (liveMatches.length === 0) return '📭 Nenhum jogo ao vivo agora.'

  const sections: string[] = []

  for (const m of liveMatches) {
    const preds = await bdfFetch<BdfPrediction[]>(
      `/matches/${encodeURIComponent(m.id)}/predictions?groupId=${BDF_GROUP_ID}`
    )

    const header = `⚽ *${m.home_team} ${m.home_score ?? 0}×${m.away_score ?? 0} ${m.away_team}*\n🔴 ${subStatusLabel(m.sub_status)}`

    const sorted = [...preds].sort((a, b) => {
      // Prioridade: ✅ > ⚡ > 🏆 > ❌, desempate por nome
      const order: Record<string, number> = { '✅': 0, '⚡': 1, '🏆': 2, '❌': 3 }
      const diff = (order[predIcon(a, m)] ?? 3) - (order[predIcon(b, m)] ?? 3)
      if (diff !== 0) return diff
      return friendlyName(a.user_id, a.user_id).localeCompare(
        friendlyName(b.user_id, b.user_id)
      )
    })

    const lines = sorted.map((p) => {
      const icon = predIcon(p, m)
      const name = friendlyName(p.user_id, p.user_id.slice(0, 6))
      const ptsStr =
        p.points_earned > 0 ? ` (+${pts(p.points_earned)})` : ''
      return `${icon} *${name}* — ${p.home_score}×${p.away_score}${ptsStr}`
    })

    sections.push(`${header}\n\n${lines.join('\n')}`)
  }

  return sections.join('\n\n─────────────\n\n')
}

function cmdAjuda(): string {
  return [
    '⚽ *Bolão Cartola ABJ*',
    '',
    '*!ranking* — ranking completo',
    '*!hoje* — jogos do dia',
    '*!palpites* — palpites do jogo ao vivo',
    '*!reseta* — comando secreto',
    '*!ajuda* — esta mensagem',
  ].join('\n')
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as EvolutionWebhook

  if (body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

  const text = extractText(body.data)?.trim().toLowerCase()
  if (!text?.startsWith('!')) return NextResponse.json({ ok: true })

  const jid = body.data.key.remoteJid

  try {
    let reply: string
    if (text === '!ranking') reply = await cmdRanking()
    else if (text === '!hoje') reply = await cmdHoje()
    else if (text === '!palpites') reply = await cmdPalpites()
    else if (text === '!reseta') reply = 'Reseta teu cu'
    else if (text === '!ajuda') reply = cmdAjuda()
    else return NextResponse.json({ ok: true })

    await sendMessage(jid, reply)
  } catch (err) {
    console.error('[whatsapp/webhook]', err)
    await sendMessage(jid, '❌ Erro ao buscar dados. Tente novamente.')
  }

  return NextResponse.json({ ok: true })
}
