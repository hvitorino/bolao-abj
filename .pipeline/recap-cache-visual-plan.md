# Plano de Implementação: Cache LocalStorage e Visual Aprimorado do Recap

**Slug:** recap-cache-visual
**Branch:** feature/recap-cache-visual
**Data:** 2026-06-19
**Spec:** .pipeline/recap-cache-visual-spec.md

## Tarefas

- [ ] 1. Adicionar keyframe `blink` em `app/globals.css` (necessária para o ponto animado do RecapFooterButton)
- [ ] 2. Implementar cache localStorage em `lib/hooks/useDailyRecap.ts` — função `getRecapCacheKey()`, hit imediato + background sync
- [ ] 3. Atualizar visual do `RecapFooterButton.tsx` — fundo verde, borda amarela, texto preto, ponto animado, hover no container
- [ ] 4. Atualizar `RecapBottomSheet.tsx` — cabeçalho com faixa colorida (título + mensagem lúdica integrada), handle acima do header, sectionLabel RANKING e DESTAQUES em color-text, linha líder e usuário atual destacadas, badges com borderLeft verde e nome em color-accent 15px bold, th com borderBottom
