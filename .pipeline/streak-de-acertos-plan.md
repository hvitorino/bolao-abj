# Plano de Implementação: Sequência de Acertos

**Slug:** streak-de-acertos
**Branch:** feature/streak-de-acertos
**Data:** 2026-06-21
**Spec:** .pipeline/streak-de-acertos-spec.md

## Tarefas

- [ ] 1. Criar migration Supabase com função `get_streak_for_group(p_group_id uuid)`
- [ ] 2. Adicionar campo `streak: number` à interface `RankingEntry` em `lib/types/ranking.ts`
- [ ] 3. Estender `GET /api/ranking` para chamar `get_streak_for_group` no modo GERAL e incluir `streak` na resposta
- [ ] 4. Adicionar indicador visual `🔥×N` na célula PARTICIPANTE de `RankingRow` (visível apenas quando streak > 0)
- [ ] 5. Adicionar entrada de legenda `🔥 SEQUÊNCIA DE ACERTOS` no rodapé do `RankingTable` (modo GERAL)
- [ ] 6. Escrever changelog
