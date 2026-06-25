# Plano de Implementação: Aba de Palpites com Jogos ao Vivo e Ranking

**Slug:** palpites-ao-vivo
**Branch:** feature/palpites-ao-vivo
**Data:** 2026-06-25
**Spec:** .pipeline/palpites-ao-vivo-spec.md

## Tarefas

- [ ] 1. Criar hook `lib/hooks/usePalpitesAoVivo.ts` com polling de 10 segundos, buscando jogos live+finished, palpites, scores e ranking do grupo
- [ ] 2. Criar componente `components/bolao/PalpitesLiveCard.tsx` — cards sticky de jogos ao vivo com palpite do usuário
- [ ] 3. Criar componente `components/bolao/PalpitesRankingRow.tsx` — linha do ranking com accordion de breakdown por jogo
- [ ] 4. Criar componente `components/bolao/PalpitesRanking.tsx` — ranking com animação FLIP e contador de próxima atualização
- [ ] 5. Criar página `app/(dashboard)/palpites/page.tsx` — Server Component que resolve userId e groupId e monta a página
- [ ] 6. Modificar `components/bolao/TabBar.tsx` — adicionar item PALPITES entre JOGOS e RANKING, ajustar font-size para 12px em telas de 320px
