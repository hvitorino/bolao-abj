# Plano de Implementação: Redesign da Navegação (Abas)

**Slug:** nav-redesign
**Branch:** feature/nav-redesign
**Data:** 2026-06-27
**Spec:** .pipeline/nav-redesign-spec.md

## Tarefas

- [ ] 1. Criar `components/bolao/ChatBottomSheet.tsx` — bottom sheet com lazy-mount de ChatPanelContent, drag handle, backdrop, animação slide-up, handler ESC e trava de scroll
- [ ] 2. Modificar `components/bolao/TabBar.tsx` — nova interface de props, reordenar MAIN_ITEMS (EU, RANKING, PALPITES, CHAT), adicionar estados chatOpen/chatUnreadCount, badge de não lidas, renderizar ChatBottomSheet
- [ ] 3. Modificar `app/(dashboard)/layout.tsx` — passar groupId, currentUserId e activeGroupName para TabBar
- [ ] 4. Modificar `components/bolao/SidePanelContainer.tsx` — remover pull tab CHAT, painel CHAT, ChatPanelContent, estados chatEverOpened/chatUnreadCount e simplificar overflowY
