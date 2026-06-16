'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import type { UserSearchResult } from '@/lib/types/group-invite'

interface InviteUserSearchProps {
  groupId: string
}

type SearchState = 'idle' | 'searching' | 'results' | 'empty' | 'error'

const DEBOUNCE_MS = 400
const MIN_QUERY_LENGTH = 2
const CONFIRM_DURATION_MS = 2000

type ResultItemState = 'idle' | 'inviting' | 'invited' | 'already_member' | 'already_pending'

export function InviteUserSearch({ groupId }: InviteUserSearchProps) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>('idle')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [itemStates, setItemStates] = useState<Record<string, ResultItemState>>({})
  const [errorMessage, setErrorMessage] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setState('error')
        setErrorMessage('Sessão expirada. Faça login novamente.')
        return
      }

      const res = await fetch(`/api/groups/${groupId}/invites/search-users?q=${encodeURIComponent(q)}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMessage(data.message || 'Erro ao buscar usuários.')
        return
      }

      const mapped: UserSearchResult[] = (data as { id: string; name: string; already_invited: boolean }[]).map((row) => ({
        id: row.id,
        name: row.name,
        alreadyInvited: row.already_invited,
      }))

      setResults(mapped)
      setItemStates({})
      setState(mapped.length === 0 ? 'empty' : 'results')
    } catch {
      setState('error')
      setErrorMessage('Erro de conexão. Tente novamente.')
    }
  }, [groupId])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return
    }

    debounceRef.current = setTimeout(() => {
      setState('searching')
      void runSearch(trimmed)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setState('idle')
      setResults([])
    }
  }

  async function handleInvite(userId: string) {
    setItemStates((prev) => ({ ...prev, [userId]: 'inviting' }))

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setState('error')
        setErrorMessage('Sessão expirada. Faça login novamente.')
        setItemStates((prev) => ({ ...prev, [userId]: 'idle' }))
        return
      }

      const res = await fetch(`/api/groups/${groupId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invited_user_id: userId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.message || 'Erro ao convidar usuário.')
        setItemStates((prev) => ({ ...prev, [userId]: 'idle' }))
        return
      }

      if (data.status === 'already_member') {
        setItemStates((prev) => ({ ...prev, [userId]: 'already_member' }))
        return
      }

      if (data.status === 'already_pending') {
        setItemStates((prev) => ({ ...prev, [userId]: 'already_pending' }))
        return
      }

      // status === 'created'
      setItemStates((prev) => ({ ...prev, [userId]: 'invited' }))
      window.setTimeout(() => {
        setResults((prev) => prev.filter((r) => r.id !== userId))
      }, CONFIRM_DURATION_MS)
    } catch {
      setErrorMessage('Erro de conexão. Tente novamente.')
      setItemStates((prev) => ({ ...prev, [userId]: 'idle' }))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="BUSCAR POR NOME OU E-MAIL..."
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '13px',
          color: 'var(--color-text)',
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          padding: '0.5rem 0.75rem',
          width: '100%',
          outline: 'none',
        }}
      />

      {state === 'searching' && (
        <div style={{ fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
          BUSCANDO...
        </div>
      )}

      {state === 'empty' && (
        <div style={{ fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
          NENHUM USUÁRIO ENCONTRADO.
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div style={{ fontSize: '13px', color: 'var(--color-error)' }}>
          ✗ {errorMessage}
        </div>
      )}

      {state === 'results' && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {results.map((result) => {
            const itemState = itemStates[result.id] ?? 'idle'
            const showAlreadyInvited = result.alreadyInvited && itemState === 'idle'

            return (
              <div
                key={result.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  fontSize: '13px',
                  padding: '0.35rem 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span style={{ color: 'var(--color-text)' }}>{result.name.toUpperCase()}</span>

                {showAlreadyInvited && (
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    JÁ CONVIDADO
                  </span>
                )}

                {!showAlreadyInvited && itemState === 'idle' && (
                  <Button type="button" variant="primary" onClick={() => handleInvite(result.id)} style={{ padding: '0.3rem 0.75rem', fontSize: '11px' }}>
                    + CONVIDAR
                  </Button>
                )}

                {itemState === 'inviting' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    CONVIDANDO...
                  </span>
                )}

                {itemState === 'invited' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-win)', textTransform: 'uppercase' }}>
                    ✓ CONVIDADO
                  </span>
                )}

                {itemState === 'already_member' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    ESTE USUÁRIO JÁ PARTICIPA DO GRUPO.
                  </span>
                )}

                {itemState === 'already_pending' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    CONVITE JÁ ENVIADO E PENDENTE.
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
