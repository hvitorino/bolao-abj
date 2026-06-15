# Fix 1: Como Pontuar

**Slug:** como-pontuar
**Data:** 2026-06-15
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Exemplo 2 exibe pontuação incorreta — +4 pts em vez de +3 pts
**Arquivo:** `app/(dashboard)/como-pontuar/page.tsx` (linhas 30–46)
**Severidade:** crítico
**Descrição:** O `EXEMPLO_2` (BRA 2×0 MEX, palpite BRA 1×0 MEX) exibe `total: 4` com a linha "Somente placar do perdedor" marcada como `hit: true` com `points: 1`. Isso está errado.

Conforme `lib/scoring.ts` (linhas 118–134), `loser_score_points` só é calculado dentro do bloco `else` — ou seja, apenas quando `predWinner !== realWinner`. No Exemplo 2, o usuário acertou o vencedor (BRA ganhou, palpite BRA ganhou), então o código nunca entra no bloco `else` e `loser_score_points` permanece 0.

O total correto para BRA 2×0 MEX com palpite BRA 1×0 MEX é:
- winner_points = +3 (acertou vencedor)
- exact_points = 0 (1≠2)
- winner_score_points = 0 (pred.home=1 ≠ game.home=2)
- diff_points = 0 (predDiff=1 ≠ realDiff=2)
- loser_score_points = 0 (não aplica — acertou vencedor)
- goleada_points = 0
- **Total: +3 pts**

A nota explicativa no componente também induz ao erro: `'Diferença real = 2, palpite = 1 — não bate. Placar do perdedor (MEX 0 no palpite = MEX 0 no jogo real).'`

**Correção esperada:** Em `app/(dashboard)/como-pontuar/page.tsx`, corrigir o `EXEMPLO_2` da seguinte forma:

```typescript
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
    { label: 'Somente placar do vencedor', points: 0, hit: false },
    { label: 'Diferença de gols correta', points: 0, hit: false },
    { label: 'Somente placar do perdedor', points: 0, hit: false },
  ],
  total: 3,
  note: 'Diferença real = 2, palpite = 1 — não bate. Placar do vencedor (BRA): pred=1 ≠ real=2 — não bate. "Somente placar do perdedor" não aplica quando o vencedor foi acertado.',
}
```

---

## Itens OK (não precisam ser revisados novamente)

- `components/bolao/ScoringRulesTable.tsx` — tabela correta com 6 eventos, estilos adequados, máximo de +9 pts conforme `scoring.ts`
- `components/bolao/ScoringExample.tsx` — componente correto, prop `note` adicional é aceitável
- `app/(dashboard)/nav-links.tsx` — item REGRAS adicionado corretamente com isActive funcionando
- Exemplo 1 (BRA 3×1 ARG → +8 pts): breakdown e total corretos
- Exemplo 3 (ALE 1×1 FRA → +8 pts): breakdown e total corretos, nota pedagógica adequada
- Bloco "BÔNUS SÃO CUMULATIVOS": conteúdo correto
- Bloco "EMPATE": conteúdo correto
- Máximo exibido (+9): correto conforme `scoring.ts` (caminho exact: 3+5+1=9; caminho winner_score+diff: 3+3+2+1=9)
- Grid responsivo via `<style>` inline: abordagem aceitável para Server Component
- Proteção de rota via DashboardLayout: correto conforme spec
- Tipografia JetBrains Mono em toda a página: OK
- Paleta de cores conforme DESIGN.md: OK
- Sem ícones SVG — apenas símbolos ASCII: OK
- Sem sombras nos cards: OK
- Feature inteiramente estática sem chamadas de API: OK
- Commits em português com prefixos corretos: OK
- Branch `feature/como-pontuar`: OK
