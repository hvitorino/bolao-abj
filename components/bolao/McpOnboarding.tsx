'use client'

import { useState } from 'react'

interface McpOnboardingProps {
  serverUrl: string
}

type CopyState = 'idle' | 'copied'

export function McpOnboarding({ serverUrl }: McpOnboardingProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(serverUrl)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      // Fallback para ambientes sem clipboard API
      const el = document.createElement('textarea')
      el.value = serverUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  const monoStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        padding: '1.25rem',
        ...monoStyle,
      }}
    >
      {/* Título */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-primary)',
          marginBottom: '0.75rem',
        }}
      >
        CONECTAR VIA IA (MCP)
      </div>

      {/* Separador */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          marginBottom: '0.75rem',
        }}
      />

      {/* Label URL */}
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-muted)',
          marginBottom: '0.375rem',
        }}
      >
        URL DO SERVIDOR:
      </div>

      {/* URL + botão copiar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <input
          type="text"
          readOnly
          value={serverUrl}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          style={{
            ...monoStyle,
            flex: '1',
            minWidth: '200px',
            fontSize: '13px',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-border)',
            padding: '0.375rem 0.5rem',
            outline: 'none',
            cursor: 'text',
          }}
          aria-label="URL do servidor MCP"
        />
        <button
          onClick={handleCopy}
          style={{
            ...monoStyle,
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0.375rem 0.75rem',
            backgroundColor: 'transparent',
            color: copyState === 'copied' ? 'var(--color-win)' : 'var(--color-text)',
            border: `1px solid ${copyState === 'copied' ? 'var(--color-win)' : 'var(--color-border)'}`,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (copyState !== 'copied') {
              e.currentTarget.style.color = 'var(--color-primary)'
              e.currentTarget.style.borderColor = 'var(--color-primary)'
            }
          }}
          onMouseLeave={(e) => {
            if (copyState !== 'copied') {
              e.currentTarget.style.color = 'var(--color-text)'
              e.currentTarget.style.borderColor = 'var(--color-border)'
            }
          }}
        >
          {copyState === 'copied' ? 'COPIADO ✓' : 'COPIAR URL'}
        </button>
      </div>

      {/* Instrução */}
      <p
        style={{
          ...monoStyle,
          fontSize: '12px',
          color: 'var(--color-muted)',
          margin: 0,
          lineHeight: '1.6',
        }}
      >
        Compatível com Claude Desktop, Claude.ai e outros clientes MCP.
        Na primeira conexão, você será redirecionado para fazer login normalmente.
      </p>
    </div>
  )
}
