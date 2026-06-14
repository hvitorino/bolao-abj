# Plano de Implementação: Correção — Carregamento do Estado Inicial nos Hooks Realtime

**Slug:** fix-initial-state-load
**Branch:** feature/fix-initial-state-load
**Data:** 2026-06-14
**Spec:** .pipeline/fix-initial-state-load-spec.md

## Tarefas

- [ ] 1. Adicionar useEffect de fetch inicial em useGameRealtime.ts (query `games` por gameId antes da subscription Realtime)
- [ ] 2. Adicionar useEffect de fetch inicial em useScoreRealtime.ts (query `scores` por gameId + userId antes da subscription Realtime, com early return para userId vazio)
- [ ] 3. Verificar que TypeScript compila sem erros (`tsc --noEmit`)
