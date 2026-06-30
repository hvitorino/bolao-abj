import type { BracketSlot, BracketSlotWithGame, Game } from './types/game'

/**
 * Static bracket tree structure for the 2026 World Cup knockout stage.
 *
 * The bracket defines which slots connect to which. We build a tree from the
 * flat slot list using `next_slot_label` to link children → parent.
 *
 * Phases in display order (left to right in bracket visualization):
 */
export const PHASE_ORDER = [
  '16 avos de Final',
  'Oitavas de Final',
  'Quartas de Final',
  'Semifinal',
  'Terceiro Lugar',
  'Final',
] as const

/**
 * Builds a tree from flat bracket_slots + optional linked games.
 *
 * The tree is built bottom-up: R32 slots are leaves, FINAL is the root.
 * Each non-leaf slot contains its two child slots.
 * 3RD and FINAL are siblings under SF slots.
 *
 * Returns the root nodes (FINAL and 3RD).
 */
export function buildBracketTree(
  slots: BracketSlot[],
  gamesBySlotLabel: Record<string, Game | null>,
): BracketSlotWithGame[] {
  // Index slots by label for O(1) lookup
  const slotMap = new Map<string, BracketSlotWithGame>()
  const roots: BracketSlotWithGame[] = []

  // First pass: create BracketSlotWithGame for every slot
  for (const slot of slots) {
    slotMap.set(slot.label, {
      ...slot,
      game: gamesBySlotLabel[slot.label] ?? null,
      children: [],
    })
  }

  // Second pass: build parent-child relationships
  for (const slot of slots) {
    const node = slotMap.get(slot.label)!
    if (slot.next_slot_label) {
      const parent = slotMap.get(slot.next_slot_label)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      // No next_slot_label = this is a root (FINAL, 3RD)
      roots.push(node)
    }
  }

  // Sort children by position for consistent display
  for (const [, node] of slotMap) {
    node.children.sort((a, b) => a.position - b.position)
  }

  // Sort roots: FINAL last (rightmost in display)
  roots.sort((a, b) => {
    if (a.label === 'FINAL') return 1
    if (b.label === 'FINAL') return -1
    if (a.label === '3RD') return 1
    if (b.label === '3RD') return -1
    return a.position - b.position
  })

  return roots
}

/**
 * Given a flat list of slots, returns them organized as columns
 * (one array per phase, in PHASE_ORDER).
 */
export function slotsByPhase(slots: BracketSlot[]): Record<string, BracketSlot[]> {
  const result: Record<string, BracketSlot[]> = {}
  for (const phase of PHASE_ORDER) {
    result[phase] = []
  }
  for (const slot of slots) {
    if (result[slot.phase]) {
      result[slot.phase].push(slot)
    }
  }
  // Sort within each phase by position
  for (const phase of PHASE_ORDER) {
    result[phase].sort((a, b) => a.position - b.position)
  }
  return result
}
