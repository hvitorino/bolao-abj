import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateGroupForm } from '@/components/bolao/CreateGroupForm'

export const metadata = {
  title: 'Criar Grupo — Bolão da Copa',
}

export default async function NovoGrupoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div
        style={{
          marginBottom: '1.25rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
          }}
        >
          CRIAR NOVO GRUPO
        </span>
      </div>

      <CreateGroupForm />
    </div>
  )
}
