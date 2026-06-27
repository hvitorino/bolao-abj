# Plano de Implementação: Modo Acompanhar

**Slug:** modo-acompanhar
**Branch:** feature/modo-acompanhar
**Data:** 2026-06-27
**Spec:** .pipeline/modo-acompanhar-spec.md

## Tarefas

- [ ] 1. Criar componente `AcompanharToggle.tsx` — botão toggle Preencher/Acompanhar com dois estados visuais (outline vs preenchido) e flex: 1
- [ ] 2. Criar componente `CompartilharButton.tsx` — extrair lógica de cópia de link de `palpites-live-section.tsx` para componente reutilizável com feedback "✓ COPIADO!" por 2s
- [ ] 3. Criar componente `AcompanharCarrossel.tsx` — carrossel horizontal de mini-cards com 4 estados (em-breve, ao-vivo, final, pontuado) e overflow-x auto
- [ ] 4. Criar componente `AcompanharRanking.tsx` — tabela simples de ranking do dia sem accordion/FLIP, com indicador de líder (►), usuário atual (■) e pontuação ao vivo (*)
- [ ] 5. Adicionar regra CSS `.acompanhar-carrossel::-webkit-scrollbar { display: none }` no `app/globals.css`
- [ ] 6. Modificar `palpites-live-section.tsx` — adicionar estado `viewMode` com persistência em sessionStorage, reset por grupo, renderização condicional dos componentes e substituição do botão antigo pela linha de dois botões
