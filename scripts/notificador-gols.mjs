#!/usr/bin/env node
/**
 * Notificador de gols — Bolão Cartola ABJ
 *
 * Roda em paralelo com `next dev`. Faz polling a cada 30s,
 * detecta mudança de placar e envia mensagem no grupo do WhatsApp.
 *
 * Uso:
 *   node scripts/notificador-gols.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { MENSAGENS_GOL } from './mensagens-gol.mjs'

// ── Env ──────────────────────────────────────────────────────────────────────

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

try {
  const envFile = readFileSync(join(ROOT, '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    process.env[key] ??= val
  }
} catch {
  // .env.local opcional — vars já podem estar no ambiente
}

const EVOLUTION_URL      = process.env.EVOLUTION_API_URL      ?? 'http://localhost:8080'
const EVOLUTION_KEY      = process.env.EVOLUTION_API_KEY      ?? 'bolao-whatsapp-key'
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE     ?? 'bolao'
const NEXT_URL           = 'http://localhost:3000'
const GROUP_JID          = '558888316623-1398189424@g.us'
const POLL_MS            = 30_000

// ── Estado ───────────────────────────────────────────────────────────────────

/** matchId → { home: number, away: number, status: string } */
const lastState = new Map()
let initialized = false

// ── API helpers ───────────────────────────────────────────────────────────────

async function getMatches() {
  const res = await fetch(`${NEXT_URL}/api/bolaofutebol/matches`)
  if (!res.ok) throw new Error(`matches: ${res.status}`)
  return res.json()
}

async function sendToGroup(text) {
  const res = await fetch(
    `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({ number: GROUP_JID, text }),
    }
  )
  if (!res.ok) console.error('[notificador] erro ao enviar:', res.status)
}

// ── Formatação ────────────────────────────────────────────────────────────────

function mensagemGol(match, scoringTeam) {
  const custom = MENSAGENS_GOL[scoringTeam]
    ?? `⚽ *GOL de ${scoringTeam}!*`

  const score = `${match.home_team} *${match.home_score}×${match.away_score}* ${match.away_team}`
  return `${custom}\n\n${score}\n_!palpites para ver os palpites_`
}

function mensagemFim(match) {
  const score = `${match.home_team} *${match.home_score}×${match.away_score}* ${match.away_team}`
  return `🏁 *FIM DE JOGO*\n${score}\n_!ranking para ver a classificação_`
}

// ── Loop de polling ───────────────────────────────────────────────────────────

async function poll() {
  let matches
  try {
    matches = await getMatches()
  } catch (err) {
    console.error('[notificador] falha ao buscar partidas:', err.message)
    return
  }

  const relevant = matches.filter(
    (m) => m.status === 'live' || m.status === 'finished'
  )

  for (const m of relevant) {
    const currHome = m.home_score ?? 0
    const currAway = m.away_score ?? 0
    const prev = lastState.get(m.id)

    if (initialized && prev) {
      // Gol do time da casa
      if (currHome > prev.home) {
        const msg = mensagemGol(m, m.home_team)
        console.log(`[notificador] GOL ${m.home_team}: ${currHome}×${currAway}`)
        await sendToGroup(msg)
      }
      // Gol do time visitante
      if (currAway > prev.away) {
        const msg = mensagemGol(m, m.away_team)
        console.log(`[notificador] GOL ${m.away_team}: ${currHome}×${currAway}`)
        await sendToGroup(msg)
      }
      // Jogo encerrado
      if (prev.status === 'live' && m.status === 'finished') {
        console.log(`[notificador] FIM ${m.home_team} × ${m.away_team}`)
        await sendToGroup(mensagemFim(m))
      }
    }

    lastState.set(m.id, { home: currHome, away: currAway, status: m.status })
  }

  if (!initialized) {
    initialized = true
    const live = relevant.filter((m) => m.status === 'live')
    if (live.length > 0) {
      console.log(
        `[notificador] iniciado com ${live.length} jogo(s) ao vivo — sem notificações retroativas`
      )
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

console.log(`[notificador] iniciado — polling a cada ${POLL_MS / 1000}s`)
console.log(`[notificador] grupo: ${GROUP_JID}`)

poll()
setInterval(poll, POLL_MS)
