export interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score: string
  team: {
    displayName: string
    abbreviation: string
  }
}

export interface EspnEvent {
  id: string
  date: string // ISO 8601 UTC
  status: {
    type: {
      name:
        | 'STATUS_SCHEDULED'
        | 'STATUS_IN_PROGRESS'
        | 'STATUS_FULL_TIME'
        | 'STATUS_FINAL'
        | string
      shortDetail: string
      state: 'pre' | 'in' | 'post' | string
    }
  }
  competitions: Array<{
    competitors: EspnCompetitor[]
    venue?: {
      fullName: string
    }
    notes?: Array<{
      headline: string
    }>
  }>
}

export interface EspnScoreboardResponse {
  events: EspnEvent[]
}

export interface SyncResult {
  synced: number
  created: number
  updated: number
  deleted: number
  errors: Array<{ espn_id: string; message: string }>
}
