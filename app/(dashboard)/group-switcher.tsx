'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface GroupSwitcherProps {
  groups: { id: string; name: string; role: 'admin' | 'member' }[]
  // Opcional: o layout do dashboard não tem acesso a `searchParams` (apenas
  // páginas recebem esse prop no App Router), então o próprio GroupSwitcher
  // lê `useSearchParams().get('group')` como fallback quando a prop não é
  // informada — mantém a flexibilidade de quem already conhece o grupo ativo
  // (ex: se um dia for renderizado a partir de uma page) passar explicitamente.
  activeGroupId?: string
}

export function GroupSwitcher({ groups, activeGroupId }: GroupSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const resolvedActiveId = activeGroupId ?? searchParams.get('group') ?? groups[0]?.id ?? ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newGroupId = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    params.set('group', newGroupId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={resolvedActiveId}
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
        maxWidth: '50vw',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
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
