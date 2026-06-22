# Plano de Implementação: Redesign da Navegação (Header + Tab Bar + Pull Tabs)

**Slug:** menu-redesign
**Branch:** feature/menu-redesign
**Data:** 2026-06-22
**Spec:** .pipeline/menu-redesign-spec.md

## Tarefas

- [ ] 1. Criar `components/bolao/TabBar.tsx` — tab bar fixa no rodapé com 4 itens (CAMPANHA, JOGOS, RANKING, MAIS) e popover para cima com GRUPOS, REGRAS, CONFIG
- [ ] 2. Criar `components/bolao/RecapPanelContent.tsx` — conteúdo extraído de `RecapBottomSheet.tsx` sem wrapper de bottom sheet, com header interno (título + botão FECHAR)
- [ ] 3. Criar `components/bolao/LiveTodayPanelContent.tsx` — conteúdo extraído de `LiveTodayBottomSheet.tsx` sem wrapper de bottom sheet, com header interno
- [ ] 4. Criar `components/bolao/ChatPanelContent.tsx` — conteúdo extraído de `GroupChatWidget.tsx` sem chip flutuante e sem drag, com `isVisible`, `onUnreadCountChange` e scroll automático ao abrir
- [ ] 5. Criar `components/bolao/SidePanelContainer.tsx` — orquestrador dos pull tabs (ONTEM, AO VIVO, CHAT) + painel lateral deslizante + abertura automática do recap + lazy-mount do chat
- [ ] 6. Refatorar `app/(dashboard)/layout.tsx` — header de uma linha, paddingTop/Bottom ajustados, remover NavLinks/GroupChatWidget/RecapController, adicionar TabBar e SidePanelContainer
- [ ] 7. Ajustar `app/(dashboard)/group-switcher.tsx` — alterar `fontSize` de `11px` para `13px` no objeto `MONO`
