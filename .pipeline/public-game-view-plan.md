# Plano de Implementação: Página Pública de Jogo

**Slug:** public-game-view
**Branch:** feature/public-game-view
**Data:** 2026-06-24
**Spec:** .pipeline/public-game-view-spec.md

## Tarefas

- [ ] 1. Verificar middleware.ts e confirmar que rota /jogos/[gameId]/publico está desprotegida
- [ ] 2. Criar `app/jogos/[gameId]/publico/page.tsx` — Server Component com queries via createServiceClient(), montagem de ParticipantEntry[] e metadata SEO
- [ ] 3. Criar `components/bolao/PublicGameClient.tsx` — Client Component que gerencia estado compartilhado do jogo via useGameRealtime e passa props para os filhos
- [ ] 4. Criar `components/bolao/PublicScoreCard.tsx` — exibe placar, times com bandeiras, status e rodada; recebe liveGame via props do PublicGameClient
- [ ] 5. Criar `components/bolao/PublicParticipantsList.tsx` — tabela PARTICIPANTE/PALPITE/PTS com Realtime de scores e cálculo de pontuação ao vivo
- [ ] 6. Adicionar botão "copiar link" no `components/games/GameCard.tsx` — estado copied, handleCopyLink, feedback visual ✓ COPIADO!
