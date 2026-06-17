'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RemoveMemberButtonProps {
  groupId: string
  userId: string
  memberName: string
  onRemoved: () => void
}

type ButtonState = 'idle' | 'confirming' | 'loading' | 'error'

export function RemoveMemberButton({
  groupId,
  userId,
  memberName,
  onRemoved,
}: RemoveMemberButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleOpenModal() {
    setState('confirming')
    setErrorMessage(null)
  }

  function handleCancel() {
    setState('idle')
    setErrorMessage(null)
  }

  async function handleConfirm() {
    setState('loading')
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setErrorMessage('Sessão expirada. Faça login novamente.')
        setState('error')
        return
      }

      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (res.ok) {
        setState('idle')
        onRemoved()
        return
      }

      let message = 'Erro ao remover participante. Tente novamente.'
      try {
        const body = await res.json()
        if (body?.message) message = body.message
      } catch {
        // mantém mensagem padrão
      }

      setErrorMessage(message)
      setState('error')
    } catch {
      setErrorMessage('Erro de conexão. Tente novamente.')
      setState('error')
    }
  }

  const isLoading = state === 'loading'
  const showModal = state === 'confirming' || state === 'loading' || state === 'error'

  return (
    <>
      {/* Botão de trigger — estado idle */}
      <button
        type="button"
        onClick={handleOpenModal}
        style={{
          backgroundColor: 'transparent',
          border: '1px solid var(--color-error)',
          color: 'var(--color-error)',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '11px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          padding: '0.2rem 0.5rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap' as const,
        }}
      >
        REMOVER
      </button>

      {/* Modal de confirmação */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-member-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,14,26,0.85)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-error)',
              maxWidth: '420px',
              width: '100%',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            }}
          >
            {/* Cabeçalho do modal */}
            <div
              id="remove-member-modal-title"
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--color-error)',
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.05em',
                color: 'var(--color-error)',
              }}
            >
              REMOVER PARTICIPANTE
            </div>

            {/* Corpo do modal */}
            <div
              style={{
                padding: '1rem',
                lineHeight: 1.6,
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '13px', color: 'var(--color-text)' }}>
                Você está prestes a remover{' '}
                <span style={{ fontWeight: 'bold' }}>{memberName.toUpperCase()}</span> deste grupo.
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>
                Esta ação é reversível — o participante pode entrar novamente via link de convite.
              </p>

              {/* Mensagem de erro inline */}
              {state === 'error' && errorMessage && (
                <p
                  style={{
                    margin: '0.75rem 0 0 0',
                    color: 'var(--color-error)',
                    fontSize: '12px',
                  }}
                >
                  ✗ {errorMessage}
                </p>
              )}
            </div>

            {/* Rodapé com botões */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-muted)',
                  color: 'var(--color-muted)',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: '12px',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  padding: '0.4rem 0.75rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                CANCELAR
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                style={{
                  backgroundColor: 'var(--color-error)',
                  border: '1px solid var(--color-error)',
                  color: 'var(--color-bg)',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: '12px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  padding: '0.4rem 0.75rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? 'REMOVENDO...' : state === 'error' ? 'TENTAR NOVAMENTE' : 'CONFIRMAR REMOÇÃO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
