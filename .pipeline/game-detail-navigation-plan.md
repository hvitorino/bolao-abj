# Plano de Implementação: Navegação para Detalhe do Jogo

**Slug:** game-detail-navigation
**Branch:** feature/game-detail-navigation
**Data:** 2026-06-22
**Spec:** .pipeline/game-detail-navigation-spec.md

## Tarefas

- [ ] 1. Alterar label padrão do `BackButton` de `'← VOLTAR AO PALPITE'` para `'← VOLTAR'` em `components/bolao/BackButton.tsx`
- [ ] 2. Tornar itens do feed clicáveis no `HistoryPanel` — substituir `<div>` por `<Link href={/jogos/${item.game_id}/analise}>` em `components/bolao/perfil/HistoryPanel.tsx`
- [ ] 3. Tornar coluna JOGO clicável em `/meus-palpites` — envolver conteúdo do `<td>` com `<Link href={/jogos/${game.id}/analise}>` e adicionar indicador `► VER ANÁLISE` em `app/(dashboard)/meus-palpites/page.tsx`
