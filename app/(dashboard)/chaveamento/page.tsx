import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { BracketTree } from '@/components/bolao/BracketTree'
import { buildBracketTree } from '@/lib/bracket'
import { resolveActiveGroup } from '@/lib/active-group'
import type { BracketSlot, Game, BracketSlotWithGame } from '@/lib/types/game'
import type { Prediction } from '@/lib/types/prediction'

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

  // Resolve active group (needed for GameAnaliseDrawer)
  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get('bolao_active_group')?.value
  const activeGroupResult = await resolveActiveGroup(supabase, user.id, undefined, '', {}, cookieGroupId)
  const groupId = 'error' in activeGroupResult ? '' : activeGroupResult.groupId

  // Fetch bracket slots, games, and user predictions in parallel
  const [
    { data: slots, error: slotsError },
    { data: games, error: gamesError },
    { data: predictions, error: predictionsError },
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
    supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id),
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

  // Build game_id → prediction map for the current user
  const typedPredictions = (predictions ?? []) as Prediction[]
  const predictionByGameId: Record<string, Prediction> = {}
  for (const p of typedPredictions) {
    predictionByGameId[p.game_id] = p
  }

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", color: 'var(--color-text)' }}>
      {/* Page header */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.35rem',
          marginBottom: '0.5rem',
        }}
      >
        <h1
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-accent)',
            margin: 0,
          }}
        >
          CHAVEAMENTO — MATA-MATA
        </h1>
      </div>

      {/* Bracket visualization */}
      <BracketTree roots={roots} predictions={predictionByGameId} groupId={groupId} currentUserId={user.id} />
    </div>
  )
}
