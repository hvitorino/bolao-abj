export type GameStatus = 'pending' | 'live' | 'finished'

export type GamePhase =
  | 'Fase de Grupos'
  | '16 avos de Final'
  | 'Oitavas de Final'
  | 'Quartas de Final'
  | 'Semifinal'
  | 'Terceiro Lugar'
  | 'Final'

export interface Game {
  id: string
  home_team: string
  away_team: string
  home_team_code: string
  away_team_code: string
  match_date: string        // ISO 8601 string
  home_score: number | null
  away_score: number | null
  status: GameStatus
  round: string
  phase: GamePhase
  venue: string | null
  espn_id: string | null    // ID do evento na ESPN (ex: "760415")
  bracket_slot_id: string | null  // FK para bracket_slots (NULL para fase de grupos)
  created_at: string
}

export interface BracketSlot {
  id: string
  label: string              // "R32-01", "QF-03", "FINAL"
  phase: string              // "16 avos de Final", "Oitavas de Final", etc.
  position: number           // ordering within the phase (1-based)
  source_home: string | null // "1º Grupo A" or "Venc. R32-01"
  source_away: string | null // "Melhor 3º C/D/E/F" or "Venc. R32-02"
  next_slot_label: string | null // "R16-01" (NULL for FINAL and 3RD)
  created_at: string
}

/** BracketSlot enriched with its linked game (if any) */
export interface BracketSlotWithGame extends BracketSlot {
  game: Game | null
  children: BracketSlotWithGame[]  // slots that feed into this one (empty for R32)
}
