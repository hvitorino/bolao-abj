# Plano de Implementação: Ajuste Mobile do Ranking

**Slug:** ranking-mobile-fit
**Branch:** feature/ranking-mobile-fit
**Data:** 2026-06-14
**Spec:** .pipeline/ranking-mobile-fit-spec.md

## Tarefas

- [ ] 1. Simplificar `app/(dashboard)/ranking/page.tsx` — remover bloco de título (h1 + separador + subtítulo) e simplificar wrapper externo
- [ ] 2. Atualizar `components/bolao/RankingTable.tsx` — reduzir padding do `<thead>` de `0.5rem 0.75rem` para `0.35rem 0.5rem`, ocultar `<th>` APROVEIT. em mobile com `hidden md:table-cell` e remover `overflowX: 'auto'`
- [ ] 3. Atualizar `components/bolao/RankingRow.tsx` — reduzir padding de todos os `<td>` para `0.35rem 0.5rem`, ocultar `<td>` APROVEIT. com `hidden md:table-cell` e adicionar `className="ranking-name-cell"` na célula PARTICIPANTE
- [ ] 4. Adicionar regra `.ranking-name-cell` em `app/globals.css` — 12px em mobile, 14px a partir de `md:` (768px)
