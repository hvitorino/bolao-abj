# Plano de Implementação: Correção — Exibição dos Códigos de Times

**Slug:** fix-team-code-display
**Branch:** feature/fix-team-code-display
**Data:** 2026-06-14
**Spec:** .pipeline/fix-team-code-display-spec.md

## Tarefas

- [ ] 1. Verificar Hipótese A — query diagnóstico no banco (dados com < 3 chars) e documentar resultado
- [ ] 2. Verificar Hipótese C — consultar character_maximum_length das colunas home_team_code/away_team_code e documentar resultado
- [ ] 3. Implementar função `getTeamCode` em `app/api/admin/sync-games/route.ts` com fallback para abreviações < 3 chars
- [ ] 4. Criar migration de correção de dados `20260614000004_fix_team_codes.sql` com UPDATE dos registros problemáticos identificados no diagnóstico (condicional — se Hipótese A confirmada)
- [ ] 5. Criar migration de alteração de schema `20260614000004_fix_team_code_char3.sql` (condicional — se Hipótese C confirmada; numeração ajustada se ambas necessárias)
