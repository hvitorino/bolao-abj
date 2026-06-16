'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface GroupSwitcherProps {
  groups: { id: string; name: string; role: 'admin' | 'member' }[]
  activeGroupId: string
}

export function GroupSwitcher({ groups, activeGroupId }: GroupSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newGroupId = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    params.set('group', newGroupId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={activeGroupId}
      onChange={handleChange}
      aria-label="Selecionar grupo ativo"
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        padding: '0.3rem 0.5rem',
        cursor: 'pointer',
      }}
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  )
}
