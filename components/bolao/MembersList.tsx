'use client'

import { useState } from 'react'
import { RemoveMemberButton } from '@/components/bolao/RemoveMemberButton'
import type { GroupMemberEntry } from '@/lib/types/group'

interface MembersListProps {
  groupId: string
  initialMembers: GroupMemberEntry[]
  currentUserId: string
  isAdmin: boolean
}

export function MembersList({
  groupId,
  initialMembers,
  currentUserId,
  isAdmin,
}: MembersListProps) {
  const [members, setMembers] = useState<GroupMemberEntry[]>(initialMembers)

  function handleRemoved(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {members.map((member) => {
        const showRemoveButton = isAdmin && member.userId !== currentUserId

        return (
          <div
            key={member.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              fontSize: '13px',
              flexWrap: 'nowrap',
            }}
          >
            {/* Nome do membro à esquerda */}
            <span
              style={{
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              • {member.name.toUpperCase()}
            </span>

            {/* Badge de papel + botão de remoção agrupados à direita */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  color: member.role === 'admin' ? 'var(--color-accent)' : 'var(--color-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                {member.role === 'admin' ? 'ADMIN' : 'MEMBRO'}
              </span>

              {showRemoveButton && (
                <RemoveMemberButton
                  groupId={groupId}
                  userId={member.userId}
                  memberName={member.name}
                  onRemoved={() => handleRemoved(member.userId)}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
