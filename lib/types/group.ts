export type GroupRole = 'admin' | 'member'

export interface GroupMembership {
  id: string
  name: string
  role: GroupRole
  created_at: string // ISO 8601
}

export interface GroupDetails {
  id: string
  name: string
  role: GroupRole
  member_count: number
  invite_token?: string // presente apenas quando role === 'admin'
}

export interface GroupMemberEntry {
  userId: string
  name: string
  role: GroupRole
  joinedAt: string // ISO 8601
}
