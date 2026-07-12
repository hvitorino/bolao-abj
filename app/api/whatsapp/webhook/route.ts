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
import { fetchEspnScores, overlayEspnScore } from '@/lib/espn'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!
const BDF_GROUP_ID = 'ba08470f-94e7-4e51-b324-dc65c60c78af'

// Chats onde o bot NÃO responde (adicionar JIDs aqui para silenciá-lo)
const IGNORED_JIDS = new Set<string>([])

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
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_KEY,
    },
    body: JSON.stringify({ number: to, text }),
  })
  if (!res.ok) {
    console.error('[whatsapp/webhook] sendText falhou', res.status, await res.text())
  }
}

// ── Comandos ─────────────────────────────────────────────────────────────────

async function cmdRanking(): Promise<string> {
  const [lbData, allMatches, espnScores] = await Promise.all([
    bdfFetch<{ entries: LeaderboardEntry[] }>(
      `/groups/${BDF_GROUP_ID}/leaderboard?limit=1000&tiebreaker=true`
    ),
    bdfFetch<BdfMatch[]>('/matches'),
    fetchEspnScores(),
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

  // Indicar jogos ao vivo no rodapé (placar ESPN)
  const liveNow = liveOrFinished.filter((m) => m.status === 'live')
  const liveStr = liveNow.length > 0
    ? `\n\n🔴 *Ao vivo:* ${liveNow.map((m) => { const s = overlayEspnScore(m, espnScores); return `${s.home_team} ${s.home_score ?? 0}×${s.away_score ?? 0} ${s.away_team}` }).join(' · ')}`
    : ''

  return `🏆 *RANKING — CARTOLA ABJ*\n\n${lines.join('\n')}${liveStr}`
}

async function cmdHoje(): Promise<string> {
  const [allMatches, espnScores] = await Promise.all([
    bdfFetch<BdfMatch[]>('/matches'),
    fetchEspnScores(),
  ])
  const today = todayBRT()

  const todayMatches = allMatches.filter((m) => {
    const brt = new Date(new Date(m.start_time).getTime() - 3 * 60 * 60 * 1000)
    return brt.toISOString().slice(0, 10) === today
  })

  if (todayMatches.length === 0) return '📅 Nenhum jogo hoje.'

  const lines = todayMatches.map((m) => {
    const s = overlayEspnScore(m, espnScores)
    const time = toBrtTime(m.start_time)
    if (m.status === 'finished') {
      return `✅ *${s.home_team} ${s.home_score} × ${s.away_score} ${s.away_team}*`
    }
    if (m.status === 'live') {
      return `🔴 *${s.home_team} ${s.home_score ?? 0} × ${s.away_score ?? 0} ${s.away_team}* — AO VIVO`
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
  const [allMatches, espnScores] = await Promise.all([
    bdfFetch<BdfMatch[]>('/matches'),
    fetchEspnScores(),
  ])
  const liveMatches = allMatches.filter((m) => m.status === 'live')

  if (liveMatches.length === 0) return '📭 Nenhum jogo ao vivo agora.'

  const sections: string[] = []

  for (const m of liveMatches) {
    const preds = await bdfFetch<BdfPrediction[]>(
      `/matches/${encodeURIComponent(m.id)}/predictions?groupId=${BDF_GROUP_ID}`
    )

    const s = overlayEspnScore(m, espnScores)
    const header = `⚽ *${s.home_team} ${s.home_score ?? 0}×${s.away_score ?? 0} ${s.away_team}*\n🔴 ${subStatusLabel(m.sub_status)}`

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

const RESETA_REPLIES = [
  'Resetar pra quê? Pra tu perder de novo?',
  'Esse comando é exclusivo do 1º colocado. Tu não.',
  'O ranking não, mas tua vergonha bem que precisava de um reset',
  'Chora menos e palpita mais, macho',
]

const CHUPA_REPLIES = [
  'KAAAAANAAAAAAALLLLL',
  'É O ANO TODO DE CHIBATA PAPAI!!!',
  'QUE FODA MEU IRMÃO!!!',
  'BOM DIA (TARDE E NOITE) COM ALEGRIA!!!',
  'BOOOOMMMM !!! DÍVIDA TÁ DIMINUINDO EM RELAÇÃO AOS OUTROS ANOS !!!',
]

const TUTEMPENA_REPLIES = [
  'Quem refresca cu de pato é lagoa!',
  'Eu quero é que se lasque!',
  'Pode baixar as portas!',
  'Se acaba nãããããooooo KANAAAAAALLLL!',
  'Se eu fosse de ter pena eu teria pena, como eu não sou, EU QUERO É QUE SE LASQUE!',
  'Como ter pena da extinta raça dos kanalaenses!?',
]

const VIADINHO_REPLIES = [
  'Fale assim de Didier do Cohabece não',
  'Chamou Xexas?',
  'Vai deixar, Xexas?',
  'Oxe, se identificou foi, macho?',
  'Respeita Didier do Cohabece, criatura.',
  'Eita, bateu saudade de Xexas foi?',
  'Quem chama é porque conhece, né?',
  'Xexas leu isso e já tá digitando…',
  'Cuidado que Didier do Cohabece tá online.',
  'Falou o quê?? Repete perto de Xexas pra tu ver.',
]

const VASCO_REPLIES = [
  'Se chorei ou se sorri o importante é que vascaino eu não nasci',
  'O Vasco tá jogando demais!',
  'Rir do Vasco é fácil, difícil é parar de rir!',
  'Tá tranquilo!',
  'Se levante! Se sente!',
  'Carai de Vasco, omi!',
  'Você quis dizer "vice"?',
  'Vasco é pra quem acredita... kkkkkkkkk',
  'Pêa de novo?',
  'Eu tenho estádio!!!',
  'Brandt vem aí!!!',
  'Nike vem aí!!!',
  'Leila vem aí!!!',
]

const FALLBACK_REPLIES = [
  'Que diabo de comando é esse, mah?',
  'Isso aí não existe não. Manda !ajuda que tu aprende.',
  'Hã?? Fala direito, criatura.',
  'Comando inválido. Igual teus palpites.',
  'Tu digitou isso com o cotovelo foi?',
  'Nem o VAR salva um comando desse.',
  'Esse comando tá mais perdido que zagueiro em contra-ataque.',
  'Oxe, inventando comando agora? Manda !ajuda, vai.',
  'Errou o comando igual erra placar. Impressionante a consistência.',
  'Isso aí não roda nem no computador da NASA, macho.',
  'Comando desconhecido. Que nem tu no topo do ranking.',
  'Aprende a digitar primeiro, depois tu aprende a palpitar.',
  'Vish, esse comando foi pra fora igual pênalti do teu time.',
  'Tá inventando moda? Aqui só funciona o que tá no !ajuda.',
  'Se palpite fosse comando, o teu também não funcionava.',
  'Digitou de olho fechado foi, criatura?',
  'Esse comando aí só existe na tua imaginação, mah.',
  'Nem o Google acha o que tu quis dizer.',
  'Impedimento! Comando irregular, jogada anulada.',
  'Tu quer que eu adivinhe? Nem teus palpites eu entendo.',
  'Comando errado. Vai treinar no !ajuda antes de voltar pro jogo.',
  'Isso é comando ou tu dormiu em cima do teclado?',
  'Cartão amarelo por tentativa de comando inexistente.',
  'Aqui não é o ChatGPT não, macho. Manda !ajuda.',
]

function pick(replies: string[]): string {
  return replies[Math.floor(Math.random() * replies.length)]
}

function cmdAjuda(): string {
  return [
    '⚽ *Bolão Cartola ABJ*',
    '',
    '*!ranking* — ranking completo',
    '*!hoje* — jogos do dia',
    '*!palpites* — palpites do jogo ao vivo',
    '*!reseta* — comando secreto',
    '*!chupa* — grito de guerra',
    '*!tutempena* — resposta pra quem tá chorando',
    '*!viadinho* — chamou Xexas?',
    '*!vasco* — zoa o Vasco',
    '*!ajuda* — esta mensagem',
  ].join('\n')
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as EvolutionWebhook

  if (body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

  const text = extractText(body.data)?.trim().toLowerCase()
  console.log(
    '[whatsapp/webhook] upsert',
    JSON.stringify({
      jid: body.data.key?.remoteJid,
      fromMe: body.data.key?.fromMe,
      type: body.data.messageType,
      text: text?.slice(0, 40) ?? null,
    })
  )
  if (!text?.startsWith('!')) return NextResponse.json({ ok: true })

  const jid = body.data.key.remoteJid
  if (IGNORED_JIDS.has(jid)) return NextResponse.json({ ok: true })

  try {
    let reply: string
    if (text === '!ranking') reply = await cmdRanking()
    else if (text === '!hoje') reply = await cmdHoje()
    else if (text === '!palpites') reply = await cmdPalpites()
    else if (text === '!reseta') reply = pick(RESETA_REPLIES)
    else if (text === '!chupa') reply = pick(CHUPA_REPLIES)
    else if (text === '!tutempena') reply = pick(TUTEMPENA_REPLIES)
    else if (text === '!viadinho') reply = pick(VIADINHO_REPLIES)
    else if (text === '!vasco' || text === '!va6co') reply = pick(VASCO_REPLIES)
    else if (text === '!ajuda') reply = cmdAjuda()
    else reply = pick(FALLBACK_REPLIES)

    await sendMessage(jid, reply)
  } catch (err) {
    console.error('[whatsapp/webhook]', err)
    await sendMessage(jid, '❌ Erro ao buscar dados. Tente novamente.')
  }

  return NextResponse.json({ ok: true })
}
