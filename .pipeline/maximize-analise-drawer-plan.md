# Plano de Implementação: Maximizar Bottom Sheet de Análise de Jogo

**Slug:** maximize-analise-drawer
**Branch:** feature/maximize-analise-drawer
**Data:** 2026-07-01
**Spec:** .pipeline/maximize-analise-drawer-spec.md

## Tarefas

- [ ] 1. Adicionar estado `isMaximized` ao bloco de estados do `GameAnaliseDrawer`
- [ ] 2. Resetar `isMaximized` no `handleClose` (antes de `setIsOpen(false)`)
- [ ] 3. Resetar `isMaximized` no `useEffect` de abertura (junto com `setLoading`, `setError`, `setData`)
- [ ] 4. Atualizar o `style` do painel `<div role="dialog">` com `maxHeight` e `borderRadius` condicionais e `transition` expandida
- [ ] 5. Reestruturar o drag handle para layout `position: relative` com pill centralizado e botão `▲`/`▼` posicionado à direita (`position: absolute`)
