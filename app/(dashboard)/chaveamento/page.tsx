import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BracketTree } from '@/components/bolao/BracketTree'
import { buildBracketTree } from '@/lib/bracket'
import type { BracketSlot, Game, BracketSlotWithGame } from '@/lib/types/game'

export const metadata: Metadata = {
  title: 'Chaveamento — Bolão da Copa',
}

export default async function ChaveamentoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all bracket slots + linked games in parallel
  const [
    { data: slots, error: slotsError },
    { data: games, error: gamesError },
  ] = await Promise.all([
    supabase
      .from('bracket_slots')
      .select('*')
      .order('phase')
      .order('position'),
    supabase
      .from('games')
      .select('*')
      .not('bracket_slot_id', 'is', null),
  ])

  if (slotsError || gamesError) {
    return (
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          border: '1px solid var(--color-error)',
          backgroundColor: 'var(--color-surface)',
          padding: '1rem',
          color: 'var(--color-error)',
          fontSize: '13px',
        }}
      >
        ✗ ERRO AO CARREGAR CHAVEAMENTO — tente recarregar a página
      </div>
    )
  }

  const typedSlots = (slots ?? []) as BracketSlot[]
  const typedGames = (games ?? []) as Game[]

  // Build a map of bracket_slot_id → game
  const gameBySlotId: Record<string, Game> = {}
  for (const game of typedGames) {
    if (game.bracket_slot_id) {
      gameBySlotId[game.bracket_slot_id] = game
    }
  }

  // Build label → game map using slot index
  const slotIdToLabel: Record<string, string> = {}
  for (const slot of typedSlots) {
    slotIdToLabel[slot.id] = slot.label
  }

  const gamesBySlotLabel: Record<string, Game | null> = {}
  for (const slot of typedSlots) {
    const game = gameBySlotId[slot.id] ?? null
    gamesBySlotLabel[slot.label] = game
  }

  const roots: BracketSlotWithGame[] = buildBracketTree(typedSlots, gamesBySlotLabel)

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", color: 'var(--color-text)' }}>
      {/* Page header */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <h1
          style={{
            fontSize: '15px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-accent)',
            margin: 0,
          }}
        >
          CHAVEAMENTO — MATA-MATA
        </h1>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            margin: '0.25rem 0 0 0',
          }}
        >
          COPA DO MUNDO FIFA 2026 · {typedSlots.length} SLOTS
        </p>
      </div>

      {/* Bracket visualization */}
      <BracketTree roots={roots} />
    </div>
  )
}
