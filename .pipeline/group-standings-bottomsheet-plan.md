# Plano de Implementação: Classificação do Grupo no Bottom Sheet

**Slug:** group-standings-bottomsheet
**Branch:** feature/group-standings-bottomsheet
**Data:** 2026-06-29
**Spec:** .pipeline/group-standings-bottomsheet-spec.md

## Tarefas

- [ ] 1. Criar `lib/analytics/group-standings.ts` com tipo `StandingEntry` e função `calculateGroupStandings`
- [ ] 2. Estender `app/api/analise-data/route.ts` com query de jogos do grupo e chamada a `calculateGroupStandings`, retornando `groupStandings` no JSON
- [ ] 3. Criar componente `components/bolao/GroupStandingsCard.tsx` com layout tabular, destaque de times, SG colorido e estado vazio
- [ ] 4. Estender `GameAnaliseDrawer.tsx`: adicionar campo `groupStandings` em `AnaliseData`, importar `GroupStandingsCard` e renderizar condicionalmente após `RecentGamesSection`
