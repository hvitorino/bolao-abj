'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface AtivarGrupoButtonProps {
  groupId: string
  groupName: string
}

type ButtonState = 'idle' | 'loading' | 'error'

/**
 * Botão "ATIVAR" — único gatilho de troca do grupo ativo persistente.
 * Presente apenas em `/grupos` (lista) e `/grupos/[id]` (detalhes), conforme
 * a regra de negócio "o grupo ativo só muda na área de Grupos" da spec
 * `grupo-ativo-persistente`.
 *
 * Em sucesso, chama `router.refresh()` para que os Server Components da
 * página atual (lista de grupos, header do layout) releiam o cookie recém
 * gravado pelo backend e exibam o novo estado "ativo" imediatamente.
 */
export function AtivarGrupoButton({ groupId, groupName }: AtivarGrupoButtonProps) {
  const router = useRouter()
  const [estado, setEstado] = useState<ButtonState>('idle')

  async function handleClick() {
    setEstado('loading')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setEstado('error')
        return
      }

      const res = await fetch('/api/groups/active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ group_id: groupId }),
      })

      if (!res.ok) {
        setEstado('error')
        return
      }

      setEstado('idle')
      router.refresh()
    } catch {
      setEstado('error')
    }
  }

  const isLoading = estado === 'loading'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end' }}>
      <Button
        type="button"
        variant="secondary"
        disabled={isLoading}
        onClick={handleClick}
        aria-label={`Ativar grupo ${groupName}`}
        style={{ padding: '0.3rem 0.75rem', fontSize: '11px' }}
      >
        {isLoading ? 'ATIVANDO...' : 'ATIVAR'}
      </Button>
      {estado === 'error' && (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-error)',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            textTransform: 'uppercase',
            textAlign: 'right',
          }}
        >
          ✗ Não foi possível ativar este grupo — tente novamente.
        </span>
      )}
    </div>
  )
}
