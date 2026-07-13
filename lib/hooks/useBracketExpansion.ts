'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { buildBracketTree } from '@/lib/bracket'
import { createClient } from '@/lib/supabase/client'
import { upsertPredictions } from '@/lib/cache/prediction-cache'
import type { BracketSlot, BracketSlotWithGame, Game } from '@/lib/types/game'
import type { Prediction } from '@/lib/types/prediction'

export function useBracketExpansion(currentUserId: string, groupId: string) {
  const [expanded, setExpanded] = useState(false)
  const [roots, setRoots] = useState<BracketSlotWithGame[] | null>(null)
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [loading, setLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Lazy fetch bracket data ─────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (roots !== null) return // already loaded
    setLoading(true)
    try {
      const supabase = createClient()

      const [
        { data: slots },
        { data: games },
        { data: preds },
      ] = await Promise.all([
        supabase.from('bracket_slots').select('*').order('phase').order('position'),
        supabase.from('games').select('*').not('bracket_slot_id', 'is', null),
        supabase.from('predictions').select('*').eq('user_id', currentUserId).eq('group_id', groupId),
      ])

      const typedSlots = (slots ?? []) as BracketSlot[]
      const typedGames = (games ?? []) as Game[]

      const gameBySlotId: Record<string, Game> = {}
      for (const game of typedGames) {
        if (game.bracket_slot_id) {
          gameBySlotId[game.bracket_slot_id] = game
        }
      }

      const gamesBySlotLabel: Record<string, Game | null> = {}
      for (const slot of typedSlots) {
        gamesBySlotLabel[slot.label] = gameBySlotId[slot.id] ?? null
      }

      const tree = buildBracketTree(typedSlots, gamesBySlotLabel)

      const typedPreds = (preds ?? []) as Prediction[]
      const predMap: Record<string, Prediction> = {}
      for (const p of typedPreds) {
        predMap[p.game_id] = p
      }

      // Write-through: os palpites vindos do banco alimentam o cache (fonte única).
      upsertPredictions(
        groupId,
        typedPreds.map((p) => ({
          user_id: p.user_id,
          game_id: p.game_id,
          home_score: p.home_score,
          away_score: p.away_score,
        }))
      )

      setRoots(tree)
      setPredictions(predMap)
    } catch (err) {
      console.error('[useBracketExpansion] erro:', err)
    } finally {
      setLoading(false)
    }
  }, [roots, currentUserId, groupId])

  // ── Toggle with transition ──────────────────────────────────────
  const toggle = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    transitionRef.current = setTimeout(() => {
      setExpanded((v) => !v)
      setIsTransitioning(false)
    }, 160)
  }, [isTransitioning])

  // Trigger lazy fetch when expanding
  useEffect(() => {
    if (expanded) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  useEffect(() => () => {
    if (transitionRef.current) clearTimeout(transitionRef.current)
  }, [])

  return { expanded, roots, predictions, loading, isTransitioning, toggle }
}
