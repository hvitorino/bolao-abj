# Plano de Implementação: Refatoração do Daily Recap Modal — Bottom Sheet + Revisão de Badges

**Slug:** daily-recap-modal-refactor
**Branch:** feature/daily-recap-modal-refactor
**Data:** 2026-06-19
**Spec:** .pipeline/daily-recap-modal-refactor-spec.md

## Tarefas

- [ ] 1. Atualizar `useDailyRecap.ts`: expandir tipo `RawPrediction` com `home_score/away_score`, atualizar query de predictions, adicionar `secondaryDescription?: string` ao tipo `RecapBadge`, e refatorar `calcBadges` para retornar exatamente 3 badges (Craque do Dia, Mãe Diná, Pé-frio) com nova lógica de artilharia de palpites
- [ ] 2. Atualizar `DailyRecapModal.tsx`: adicionar renderização condicional do `secondaryDescription` para o badge `mae_dina`
- [ ] 3. Criar `components/bolao/RecapFloatingButton.tsx`: chip fixo no canto inferior esquerdo, estilo DESIGN.md, retorna null quando loading ou sem dados, usa callback externo ao clicar
- [ ] 4. Criar `components/bolao/RecapController.tsx`: componente client que gerencia estado `forceOpen`, renderiza `RecapFloatingButton` + `DailyRecapModal` em uma única instância
- [ ] 5. Atualizar `app/(dashboard)/nav-links.tsx`: remover import e uso de `RecapButton`, remover props `groupId` e `currentUserId` da interface `NavLinksProps`
- [ ] 6. Atualizar `app/(dashboard)/layout.tsx`: substituir `DailyRecapModal` direto + props em `NavLinks` por `RecapController`, ajustar chamada `NavLinks` removendo props desnecessárias
