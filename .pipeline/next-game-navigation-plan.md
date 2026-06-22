# Plano de Implementação: Navegação para o Próximo Jogo na Análise

**Slug:** next-game-navigation
**Branch:** feature/next-game-navigation
**Data:** 2026-06-22
**Spec:** .pipeline/next-game-navigation-spec.md

## Tarefas

- [ ] 1. Criar componente `NextGameLink` em `components/bolao/NextGameLink.tsx` — Client Component com Link do Next.js para `/jogos/[nextGameId]/analise`, texto `PRÓXIMO JOGO ►`, JetBrains Mono 12px bold uppercase, cor `var(--color-primary)`, sem sublinhado, sem background, sem borda
- [ ] 2. Adicionar query de próximo jogo em `app/(dashboard)/jogos/[gameId]/analise/page.tsx` — `SELECT id FROM games WHERE match_date > '<match_date atual>' ORDER BY match_date ASC LIMIT 1` via Supabase JS, executada em paralelo no `Promise.all` existente
- [ ] 3. Substituir seção "Botão de voltar" na `AnalisePage` por faixa de navegação com `display: flex; justify-content: space-between` — `BackButton` à esquerda e `NextGameLink` à direita (omitido quando `nextGameId` é null)
