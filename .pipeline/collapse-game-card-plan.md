# Plano de Implementação: Colapsar/Expandir Card de Jogo com Palpites dos Participantes

**Slug:** collapse-game-card
**Branch:** feature/collapse-game-card
**Data:** 2026-06-16
**Spec:** .pipeline/collapse-game-card-spec.md

## Tarefas

- [ ] 1. Adicionar estado `isParticipantsExpanded` (useState, inicial `false`) em `components/games/GameCard.tsx`, sem mover `useGameRealtime`/`useScoreRealtime` de posição
- [ ] 2. Substituir o bloco de renderização incondicional de `GameParticipantsList` (linhas 438-446) por: botão de toggle (`<button type="button">` com `aria-expanded`, `aria-controls`, texto `VER PALPITES ▾` / `OCULTAR PALPITES ▴`) + renderização condicional de `GameParticipantsList` dentro de `<div id={`participants-${liveGame.id}`}>` somente quando `isParticipantsExpanded === true`
- [ ] 3. Validar manualmente que `GameParticipantsList.tsx` e `GameList.tsx`/`app/(dashboard)/jogos/page.tsx` não precisam de nenhuma alteração (conforme spec) — apenas leitura de confirmação, sem edição
- [ ] 4. Rodar `npm run lint` e `npm run build` para garantir ausência de erros
- [ ] 5. Escrever `.pipeline/collapse-game-card-changelog.md` documentando a mudança
