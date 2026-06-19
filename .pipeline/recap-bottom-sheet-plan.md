# Plano de Implementação: Botão Fixo no Rodapé com Bottom Sheet de Resumo

**Slug:** recap-bottom-sheet
**Branch:** feature/recap-bottom-sheet
**Data:** 2026-06-19
**Spec:** .pipeline/recap-bottom-sheet-spec.md

## Tarefas

- [ ] 1. Adicionar keyframes `slideUp` e `slideDown` em `app/globals.css`
- [ ] 2. Criar `components/bolao/RecapFooterButton.tsx` — botão fixo full-width no rodapé
- [ ] 3. Criar `components/bolao/RecapBottomSheet.tsx` — bottom sheet com animação slide-up/slide-down e mesmo conteúdo do DailyRecapModal
- [ ] 4. Atualizar `components/bolao/RecapController.tsx` — trocar imports, migrar lógica de abertura automática (localStorage), passar `data` para o bottom sheet
- [ ] 5. Remover `components/bolao/RecapFloatingButton.tsx` (verificar importadores antes)
- [ ] 6. Remover `components/bolao/DailyRecapModal.tsx` (verificar importadores antes)
- [ ] 7. Ajustar `app/(dashboard)/layout.tsx` — adicionar `paddingBottom` ao `<main>` quando `activeGroup` existir
- [ ] 8. Verificar conflito de z-index com `GroupChatWidget` — chip usa zIndex 50; bottom sheet usa zIndex 201; confirmar que não há sobreposição indesejada
- [ ] 9. Rodar `npm run lint` e `npm run build` e corrigir eventuais erros
