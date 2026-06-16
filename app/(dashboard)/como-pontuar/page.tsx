import type { Metadata } from 'next'
import Link from 'next/link'
import { ScoringRulesTable } from '@/components/bolao/ScoringRulesTable'
import { ScoringExample } from '@/components/bolao/ScoringExample'

export const metadata: Metadata = {
  title: 'Como Pontuar — Bolão da Copa',
}

// Exemplo 1 — Regra 1: Acerto do vencedor (BRA 2×0 MEX, palpite 3×2) → +3 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:0, winner_score:0, diff:0, loser_score:0, goleada:0}
const EXEMPLO_1 = {
  title: 'EXEMPLO 1 — ACERTO DO VENCEDOR',
  ruleLabel: 'Acerto do vencedor',
  homeTeam: 'BRA',
  awayTeam: 'MEX',
  homeScore: 2,
  awayScore: 0,
  predHome: 3,
  predAway: 2,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Somente placar do vencedor', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 0, hit: false },
  ],
  total: 3,
  note: 'Acertou que o BRA venceria, mas errou o placar do vencedor (real=2, palpite=3), a diferença de gols (real=2, palpite=1) e o placar do perdedor (real=0, palpite=2). Nenhum bônus adicional se aplica.',
}

// Exemplo 2 — Regra 2: Placar exato (BRA 3×1 ARG, palpite 3×1) → +8 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:5, winner_score:0, diff:0, loser_score:0, goleada:0}
const EXEMPLO_2 = {
  title: 'EXEMPLO 2 — PLACAR EXATO',
  ruleLabel: 'Placar exato',
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
  ],
  total: 8,
  note: 'Placar exato engloba "placar do vencedor" e "diferença de gols" — não são cumulativos com o placar exato.',
}

// Exemplo 3 — Regra 3: Somente placar do vencedor (BRA 2×0 MEX, palpite 2×1) → +6 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:0, winner_score:3, diff:0, loser_score:0, goleada:0}
const EXEMPLO_3 = {
  title: 'EXEMPLO 3 — SOMENTE PLACAR DO VENCEDOR',
  ruleLabel: 'Somente placar do vencedor',
  homeTeam: 'BRA',
  awayTeam: 'MEX',
  homeScore: 2,
  awayScore: 0,
  predHome: 2,
  predAway: 1,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Somente placar do vencedor', points: 3, hit: true },
    { label: 'Diferença de gols correta', points: 0, hit: false },
  ],
  total: 6,
  note: 'Acertou o placar do BRA (vencedor, 2 gols), mas errou o placar do MEX (palpite 1, real 0) — não é placar exato. Diferença real é 2, palpite é 1 — não bate, então o bônus de diferença de gols não se aplica.',
}

// Exemplo 4 — Regra 4: Diferença de gols correta (BRA 2×0 MEX, palpite 3×1) → +5 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:0, winner_score:0, diff:2, loser_score:0, goleada:0}
const EXEMPLO_4 = {
  title: 'EXEMPLO 4 — DIFERENÇA DE GOLS CORRETA',
  ruleLabel: 'Diferença de gols correta',
  homeTeam: 'BRA',
  awayTeam: 'MEX',
  homeScore: 2,
  awayScore: 0,
  predHome: 3,
  predAway: 1,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Somente placar do vencedor', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 2, hit: true },
  ],
  total: 5,
  note: 'Diferença real e do palpite são iguais (2 gols), mas nenhum dos dois placares individuais bateu exatamente (BRA: palpite 3 ≠ real 2; MEX: palpite 1 ≠ real 0). Ainda assim, acertar a diferença com o vencedor certo garante o bônus de +2.',
}

// Exemplo 5 — Regra 5: Somente placar do perdedor (BRA 3×1 ARG, palpite 2×1) → +4 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:0, winner_score:0, diff:0, loser_score:1, goleada:0}
const EXEMPLO_5 = {
  title: 'EXEMPLO 5 — SOMENTE PLACAR DO PERDEDOR',
  ruleLabel: 'Somente placar do perdedor',
  homeTeam: 'BRA',
  awayTeam: 'ARG',
  homeScore: 3,
  awayScore: 1,
  predHome: 2,
  predAway: 1,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Somente placar do vencedor', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 0, hit: false },
    { label: 'Somente placar do perdedor', points: 1, hit: true },
  ],
  total: 4,
  note: 'Acertou que o BRA venceria (placar do vencedor errado: real=3, palpite=2; diferença real=2, palpite=1) e, além disso, acertou exatamente o placar do time que perdeu (ARG, 1 gol). Esse bônus agora exige ter acertado o vencedor — diferente da versão anterior da regra.',
}

// Exemplo 6 — Regra 6: Goleada (BRA 5×0 MEX, palpite 4×0) → +5 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:0, winner_score:0, diff:0, loser_score:1, goleada:1}
const EXEMPLO_6 = {
  title: 'EXEMPLO 6 — GOLEADA',
  ruleLabel: 'Goleada',
  homeTeam: 'BRA',
  awayTeam: 'MEX',
  homeScore: 5,
  awayScore: 0,
  predHome: 4,
  predAway: 0,
  breakdown: [
    { label: 'Acertou o vencedor', points: 3, hit: true },
    { label: 'Placar exato', points: 0, hit: false },
    { label: 'Somente placar do vencedor', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 0, hit: false },
    { label: 'Somente placar do perdedor', points: 1, hit: true },
    { label: 'Goleada', points: 1, hit: true },
  ],
  total: 5,
  note: 'Goleada é cumulativa com o acerto do vencedor e independente de acertar o placar exato ou a diferença: basta o vencedor do palpite ter feito 4+ gols (palpite: BRA fez 4) E a diferença real do jogo ter sido de 4+ gols (real: 5−0=5). Neste cenário, o placar do perdedor (MEX, 0 gols) também bateu, somando o bônus de "somente placar do perdedor" (+1).',
}

// Exemplo Bônus — Empate exato (ALE 1×1 FRA, palpite 1×1) → +8 pts
// Confirmado contra calculateScore(): breakdown {winner:3, exact:5, winner_score:0, diff:0, loser_score:0, goleada:0}
const EXEMPLO_BONUS_EMPATE = {
  title: 'EXEMPLO BÔNUS — EMPATE EXATO',
  ruleLabel: 'Placar exato (empate)',
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
  note: 'Empate conta como acerto do vencedor. Placar exato no empate aplica +5 normalmente — não há regras especiais de "placar do vencedor/perdedor" ou "diferença de gols" em empates, pois não existe vencedor/perdedor definido.',
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
          BOLÃO DA COPA · 2026
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
            marginBottom: '0.25rem',
            marginTop: 0,
          }}
        >
          EXEMPLOS DE CÁLCULO
        </h2>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-muted)',
            margin: '0 0 1rem',
          }}
        >
          Cada exemplo abaixo corresponde, na mesma ordem, a uma linha da tabela de pontuação.
        </p>

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
          <ScoringExample {...EXEMPLO_4} />
          <ScoringExample {...EXEMPLO_5} />
          <ScoringExample {...EXEMPLO_6} />
        </div>

        {/* Exemplo complementar — fora da numeração 1-6 */}
        <div style={{ marginTop: '1.5rem' }}>
          <h3
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-muted)',
              marginBottom: '0.75rem',
              marginTop: 0,
            }}
          >
            EXEMPLO COMPLEMENTAR
          </h3>
          <ScoringExample {...EXEMPLO_BONUS_EMPATE} />
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
        @media (min-width: 640px) {
          .scoring-examples-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (min-width: 1024px) {
          .scoring-examples-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>
    </main>
  )
}
