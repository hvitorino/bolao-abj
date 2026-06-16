export type GroupInviteStatus = 'pending' | 'accepted' | 'declined'

export interface GroupInviteSent {
  id: string
  invitedUserId: string
  invitedUserName: string
  status: GroupInviteStatus
  createdAt: string // ISO 8601
  respondedAt: string | null
}

export interface PendingInviteReceived {
  id: string
  groupId: string
  groupName: string
  invitedByName: string
  createdAt: string // ISO 8601
}

export interface UserSearchResult {
  id: string
  name: string
  alreadyInvited: boolean
}
