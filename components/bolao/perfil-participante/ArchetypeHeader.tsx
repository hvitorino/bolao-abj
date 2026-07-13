import type { Archetype } from '@/lib/participant-profile'

interface ArchetypeHeaderProps {
  targetName: string
  archetype: Archetype
}

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
}

/**
 * Cabeçalho interpretativo do perfil: nome do participante, o nome do
 * arquétipo composto em destaque, e o parágrafo determinístico que sustenta
 * a leitura.
 */
export function ArchetypeHeader({ targetName, archetype }: ArchetypeHeaderProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 0,
        boxShadow: 'none',
        marginBottom: '1px',
        padding: '1.25rem 1rem',
      }}
    >
      <div
        style={{
          ...MONO,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-muted)',
          marginBottom: '0.3rem',
        }}
      >
        {targetName}
      </div>

      <div
        style={{
          ...MONO,
          fontSize: '22px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-accent)',
          marginBottom: '0.6rem',
        }}
      >
        {archetype.name}
      </div>

      <p
        style={{
          ...MONO,
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'var(--color-text)',
          margin: 0,
        }}
      >
        {archetype.paragraph}
      </p>
    </div>
  )
}
