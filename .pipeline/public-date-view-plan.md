# Plano de Implementação: Página Pública por Data

**Slug:** public-date-view
**Branch:** feature/public-date-view
**Data:** 2026-06-25
**Spec:** .pipeline/public-date-view-spec.md

## Tarefas

- [ ] 1. Criar tipos em `lib/types/public-date.ts` — `PublicDateGame`, `ProfileEntry` e `PublicDateClientProps`
- [ ] 2. Criar Server Component `app/publico/[groupId]/[date]/page.tsx` — busca dados via service_role, validações inline, monta `ParticipantEntry[]` por jogo, passa dados ao `PublicDateClient`
- [ ] 3. Criar Client Component `app/publico/[groupId]/[date]/public-date-client.tsx` — estado de jogos e palpites, Realtime de `games` e `scores`, cálculo de ranking do dia, renderiza `PublicDateGameSection` + `PublicDateRanking`
- [ ] 4. Criar componente `components/bolao/PublicDateGameSection.tsx` — mini placar + reutiliza `PublicParticipantsList` existente, formatação de rodada/horário BRT
- [ ] 5. Criar componente `components/bolao/PublicDateRanking.tsx` — tabela de ranking do dia com pontos oficiais + ao vivo, badge `★ AO VIVO`, rodapé provisório
- [ ] 6. Modificar `app/(dashboard)/palpites/palpites-live-section.tsx` — adicionar botão `⎘ COPIAR LINK DO DIA` com feedback visual de 2 segundos
