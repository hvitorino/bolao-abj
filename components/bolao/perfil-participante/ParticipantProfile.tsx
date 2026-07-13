'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BackButton from '@/components/bolao/BackButton'
import { ArchetypeHeader } from './ArchetypeHeader'
import { AxisSpectrum } from './AxisSpectrum'
import type { ParticipantProfile as ParticipantProfileData } from '@/lib/participant-profile'

interface ParticipantProfileProps {
  groupId: string
  targetUserId: string
  targetName: string
}

type SectionState =
  | { status: 'loading' }
  | { status: 'error'; message?: string }
  | { status: 'populated'; data: ParticipantProfileData }

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

const PANEL: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 0,
  boxShadow: 'none',
  marginBottom: '1px',
}

const HEADER: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--color-bg)',
  backgroundColor: 'var(--color-primary)',
  padding: '0.5rem 1rem',
}

/**
 * Client component: busca `/api/profile/style` para o par (groupId,
 * targetUserId) e renderiza o cabeçalho interpretativo + os 4 eixos como
 * espectros ASCII. Sem realtime — leitura analítica sob demanda (§10 da spec).
 */
export function ParticipantProfile({ groupId, targetUserId, targetName }: ParticipantProfileProps) {
  const [state, setState] = useState<SectionState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function fetchProfile() {
      setState({ status: 'loading' })

      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const token = session?.access_token
      if (!token) {
        if (!cancelled) setState({ status: 'error', message: 'Sessão expirada.' })
        return
      }

      try {
        const qs = `group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(targetUserId)}`
        const response = await fetch(`/api/profile/style?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error(`${response.status}`)
        }

        const data: ParticipantProfileData = await response.json()
        if (!cancelled) setState({ status: 'populated', data })
      } catch (error) {
        if (!cancelled) setState({ status: 'error', message: String(error) })
      }
    }

    fetchProfile()

    return () => {
      cancelled = true
    }
  }, [groupId, targetUserId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div>
        <BackButton fallbackHref="/ranking" label="← VOLTAR AO RANKING" />
      </div>

      {state.status === 'loading' && (
        <div style={PANEL}>
          <div style={HEADER}>PERFIL DO PARTICIPANTE</div>
          <div
            style={{
              ...MONO,
              padding: '1.5rem 1rem',
              fontSize: '12px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
            }}
          >
            CARREGANDO...
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div style={PANEL}>
          <div style={HEADER}>PERFIL DO PARTICIPANTE</div>
          <div
            style={{
              ...MONO,
              padding: '1.5rem 1rem',
              fontSize: '12px',
              color: 'var(--color-error)',
              textTransform: 'uppercase',
            }}
          >
            ✗ ERRO AO CARREGAR PERFIL
          </div>
        </div>
      )}

      {state.status === 'populated' && (
        <>
          <ArchetypeHeader targetName={targetName} archetype={state.data.archetype} />

          <div style={PANEL}>
            <div style={HEADER}>EIXOS DE COMPORTAMENTO</div>
            {state.data.axes.map((axis) => (
              <AxisSpectrum key={axis.key} axis={axis} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
