import type { Metadata } from 'next'
import Link from 'next/link'
import { ScoringRulesTable } from '@/components/bolao/ScoringRulesTable'
import { ScoringExample } from '@/components/bolao/ScoringExample'

export const metadata: Metadata = {
  title: 'Como Pontuar — Bolão do Cartola ABJ',
}

// Exemplo 1: Placar exato (BRA 3×1 ARG, palpite 3×1) → +8 pts
const EXEMPLO_1 = {
  title: 'EXEMPLO 1 — PLACAR EXATO',
  homeTeam: 'BRA',
  awayTeam: 'ARG',
  homeScore: 3,
  awayScore: 1,
  predHome: 3,
  predAway: 1,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 5, hit: true },
    { label: 'Diferença de gols', points: 0, hit: false },
    { label: 'Placar do perdedor', points: 0, hit: false },
  ],
  total: 8,
  note: 'Placar exato engloba "placar do vencedor" e "diferença de gols" — não são cumulativos.',
}

// Exemplo 2: Acerto parcial (BRA 2×0 MEX, palpite BRA 1×0 MEX) → +4 pts
const EXEMPLO_2 = {
  title: 'EXEMPLO 2 — ACERTO PARCIAL',
  homeTeam: 'BRA',
  awayTeam: 'MEX',
  homeScore: 2,
  awayScore: 0,
  predHome: 1,
  predAway: 0,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 0, hit: false },
    { label: 'Somente placar do perdedor', points: 1, hit: true },
  ],
  total: 4,
  note: 'Diferença real = 2, palpite = 1 — não bate. Placar do perdedor (MEX 0 no palpite = MEX 0 no jogo real).',
}

// Exemplo 3: Empate exato (ALE 1×1 FRA, palpite 1×1) → +8 pts
const EXEMPLO_3 = {
  title: 'EXEMPLO 3 — EMPATE EXATO',
  homeTeam: 'ALE',
  awayTeam: 'FRA',
  homeScore: 1,
  awayScore: 1,
  predHome: 1,
  predAway: 1,
  breakdown: [
    { label: 'Acertou o empate (= vencedor)', points: 3, hit: true },
    { label: 'Placar exato no empate', points: 5, hit: true },
    { label: 'Diferença de gols', points: 0, hit: false },
  ],
  total: 8,
  note: 'Empate conta como acerto do vencedor. Placar exato no empate aplica +5 normalmente.',
}

export default function ComoPontuarPage() {
  return (
    <main
      style={{
        padding: '1.5rem',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      {/* Header da página */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-primary)',
            margin: 0,
          }}
        >
          COMO PONTUAR
        </h1>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-muted)',
            margin: '0.25rem 0 0',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          BOLÃO DO CARTOLA ABJ · COPA 2026
        </p>
      </div>

      {/* Bloco de aviso introdutório */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '13px',
          color: 'var(--color-text)',
        }}
      >
        <span style={{ color: 'var(--color-primary)', marginRight: '0.5rem' }}>
          ►
        </span>
        Os bônus são <strong>cumulativos</strong> com o acerto do vencedor.
        Exceto: placar exato e &quot;somente placar do vencedor&quot; / &quot;diferença de gols&quot; são
        mutuamente exclusivos — estes não se acumulam com o placar exato.
      </div>

      {/* Tabela de pontuação */}
      <div style={{ marginBottom: '2rem' }}>
        <ScoringRulesTable />
      </div>

      {/* Seção de exemplos */}
      <div style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-primary)',
            marginBottom: '1rem',
            marginTop: 0,
          }}
        >
          EXEMPLOS DE CÁLCULO
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: '1rem',
          }}
          className="scoring-examples-grid"
        >
          <ScoringExample {...EXEMPLO_1} />
          <ScoringExample {...EXEMPLO_2} />
          <ScoringExample {...EXEMPLO_3} />
        </div>
      </div>

      {/* Seção de regras especiais */}
      <div style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-primary)',
            marginBottom: '1rem',
            marginTop: 0,
          }}
        >
          REGRAS ESPECIAIS
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Bloco 1 — Cumulatividade */}
          <div
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              padding: '0.75rem 1rem',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-primary)',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ marginRight: '0.5rem' }}>►</span>
              BÔNUS SÃO CUMULATIVOS
            </div>
            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: '0.5rem',
                fontSize: '13px',
                color: 'var(--color-text)',
                lineHeight: '1.6',
              }}
            >
              Todos os bônus somam com o acerto do vencedor. Exceto: placar exato
              já inclui &quot;placar do vencedor&quot; e &quot;diferença de gols&quot; — estes não
              se acumulam com o placar exato.
            </div>
          </div>

          {/* Bloco 2 — Regra de Empate */}
          <div
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              padding: '0.75rem 1rem',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-primary)',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ marginRight: '0.5rem' }}>►</span>
              EMPATE
            </div>
            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: '0.5rem',
                fontSize: '13px',
                color: 'var(--color-text)',
                lineHeight: '1.6',
              }}
            >
              Acertar o empate conta como acerto do vencedor (+3 pts). Se o placar
              for exato, aplica-se também o bônus de placar exato (+5 pts).
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé com link de volta */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: '1rem',
        }}
      >
        <Link
          href="/jogos"
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '13px',
            color: 'var(--color-primary)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          ← VOLTAR PARA JOGOS
        </Link>
      </div>

      {/* Estilos responsivos inline via style tag */}
      <style>{`
        @media (min-width: 768px) {
          .scoring-examples-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>
    </main>
  )
}
