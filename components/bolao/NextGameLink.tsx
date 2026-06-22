'use client'

import Link from 'next/link'

interface NextGameLinkProps {
  nextGameId: string
}

export default function NextGameLink({ nextGameId }: NextGameLinkProps) {
  return (
    <Link
      href={`/jogos/${nextGameId}/analise`}
      style={{
        color: 'var(--color-primary)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        textDecoration: 'none',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      PRÓXIMO JOGO ►
    </Link>
  )
}
