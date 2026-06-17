'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DeleteGroupButtonProps {
  groupId: string
  groupName: string
}

type ButtonState = 'idle' | 'confirming' | 'loading' | 'error'

export function DeleteGroupButton({ groupId, groupName }: DeleteGroupButtonProps) {
  const router = useRouter()
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
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setErrorMessage('Sessão expirada. Faça login novamente.')
        setState('error')
        return
      }

      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (res.ok) {
        router.push('/grupos')
        return
      }

      let message = 'Erro ao excluir o grupo. Tente novamente.'
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
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '0.4rem 0.75rem',
          cursor: 'pointer',
        }}
      >
        EXCLUIR GRUPO
      </button>

      {/* Modal de confirmação */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-group-modal-title"
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
              id="delete-group-modal-title"
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--color-error)',
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-error)',
              }}
            >
              EXCLUIR GRUPO
            </div>

            {/* Corpo do modal */}
            <div
              style={{
                padding: '1rem',
                fontSize: '13px',
                color: 'var(--color-text)',
                lineHeight: 1.6,
              }}
            >
              <p style={{ margin: '0 0 0.75rem 0' }}>
                Você está prestes a excluir o grupo{' '}
                <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
                  &ldquo;{groupName}&rdquo;
                </span>
                .
              </p>

              <p style={{ margin: '0 0 0.5rem 0' }}>Esta ação é irreversível:</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--color-error)' }}>✗ Todos os palpites serão deletados</span>
                <span style={{ color: 'var(--color-error)' }}>✗ Todas as pontuações serão deletadas</span>
                <span style={{ color: 'var(--color-win)' }}>✓ Os perfis dos participantes não serão afetados</span>
              </div>

              {/* Mensagem de erro inline */}
              {state === 'error' && errorMessage && (
                <p
                  style={{
                    margin: '0.5rem 0 0 0',
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
                  textTransform: 'uppercase',
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
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0.4rem 0.75rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? 'EXCLUINDO...' : 'CONFIRMAR EXCLUSÃO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
