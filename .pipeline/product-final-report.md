# Relatório Final — Bolão do Cartola ABJ

Data de conclusão: 2026-06-15

## Features Implementadas

1. [auth] — Autenticação — 2026-06-13
2. [game-navigation] — Navegação por Jogos — 2026-06-13
3. [predictions] — Palpites — 2026-06-13
4. [live-scores] — Placares em Tempo Real — 2026-06-13
5. [scoring] — Pontuação por Jogo em Tempo Real — 2026-06-13
6. [ranking] — Ranking em Tempo Real — 2026-06-13
7. [predictions-edit] — Edição de Palpites — 2026-06-14
8. [fix-ranking-visibility] — Correção: Visibilidade no Ranking — 2026-06-14
9. [ranking-mobile-fit] — Ajuste Mobile do Ranking — 2026-06-14
10. [live-scores-realtime] — Placares em Tempo Real (Realtime) — 2026-06-14
11. [game-participants-view] — Palpites e Pontuação dos Participantes por Jogo — 2026-06-14
12. [fix-goleada-scoring] — Correção: Regra de Goleada na Pontuação — 2026-06-14
13. [fix-team-code-display] — Correção: Exibição dos Códigos de Times — 2026-06-14
14. [fix-long-names] — Correção: Nomes Longos nos Cards de Jogo — 2026-06-14
15. [fix-live-scores-display] — Correção: Exibição e Atualização de Placar em Tempo Real — 2026-06-14
16. [fix-initial-state-load] — Correção: Carregamento do Estado Inicial nos Hooks Realtime — 2026-06-14
17. [fix-prediction-visibility] — Correção: Visibilidade Temporal dos Palpites — 2026-06-15
18. [como-pontuar] — Página "Como Pontuar" — 2026-06-15
19. [live-scoring] — Pontuação em Tempo Real Durante Jogos ao Vivo — 2026-06-15

## Resumo

O Bolão do Cartola ABJ foi construído do zero em três dias de desenvolvimento (2026-06-13 a 2026-06-15). A aplicação permite que um grupo de amigos registre palpites de placar para os jogos da Copa do Mundo FIFA 2026, acompanhe resultados em tempo real e dispute uma classificação geral.

A stack escolhida (Next.js 15 + Supabase + Ruby/Sinatra) provou-se adequada: o Supabase Realtime eliminou a necessidade de polling para placares e ranking; o Sinatra como Vercel Function manteve a lógica de pontuação e validações server-side; o App Router do Next.js separou claramente rotas públicas e protegidas via middleware.

O pipeline de cinco agentes (Gerente de Produto, Analista de Sistema, Programador, Revisor, Explorador) entregou as 19 features do roadmap com revisão estruturada, changelogs rastreáveis e branches isoladas mergeadas via --no-ff. Além das 6 funcionalidades centrais previstas em `CLAUDE.md` (auth, game-navigation, predictions, live-scores, scoring, ranking), o pipeline endereçou 13 rodadas de correções e melhorias identificadas durante o uso real: a regra de goleada passou a exigir 4+ gols do vencedor tanto no palpite quanto no placar real (ao invés de 3+); códigos de times passaram a exibir as 3 letras corretamente em todos os cards; nomes longos de times e estádios passaram a ser truncados em vez de quebrar o layout; a exibição/atualização de placares `live` via Realtime foi corrigida e os hooks (`useGameRealtime`, `useScoreRealtime`) passaram a carregar o estado inicial via fetch no mount, eliminando a tela vazia ao recarregar a página; uma regra de privacidade temporal passou a ocultar palpites de terceiros antes do início do jogo (`fix-prediction-visibility`); uma página educativa (`/como-pontuar`) passou a explicar as regras de pontuação com exemplo concreto; e a feature `game-participants-view` consolidou, em cada card de jogo, o palpite e a pontuação de todos os participantes.

A última entrega, `live-scoring`, fechou a lacuna entre placar em andamento e pontuação: durante um jogo `live`, a pontuação parcial/provisória de cada participante agora é calculada 100% client-side (reaproveitando `calculateScore()` de `lib/scoring.ts`, sem nova tabela e sem escrita em `scores`), exibida nos cards de jogo com indicador visual distinto (coluna PTS* em `color-live`) e somada à pontuação oficial no ranking geral via `useLivePointsByUser`, com recálculo de `rank_position` no cliente fiel à semântica de `RANK()` do Postgres — incluindo o tratamento correto de empates, ajustado em uma segunda rodada de revisão após uma regressão visual identificada nos testes do Revisor.

## Próximos passos sugeridos

- **Dados oficiais dos jogos:** substituir o seed fictício de jogos placeholder pelos jogos oficiais da Copa 2026 assim que a FIFA divulgar o calendário completo verificável; o script `db/seeds/seed_games.rb` já possui lógica de upsert idempotente
- **Painel de administração:** criar rota protegida `/admin/games` para atualizar placares e status de jogos sem precisar usar o Supabase Dashboard diretamente; o endpoint `PATCH /api/admin/games/[id]` já existe e está autenticado via `X-Admin-Secret`
- **Notificações push:** alertar participantes quando falta 30 minutos para o deadline de um jogo sem palpite; explorado superficialmente pelo Explorador mas não implementado por dependência de infraestrutura de push
- **Histórico de pontuação parcial:** persistir snapshots da pontuação parcial calculada durante jogos `live` (feature `live-scoring`) para permitir auditoria/replay de como o placar e a pontuação evoluíram ao longo da partida, caso isso se torne relevante
- **Testes automatizados:** a lógica de pontuação em `lib/scoring.ts` e no trigger Postgres está espelhada mas não possui suite de testes automatizada (validação tem sido feita via scripts ad hoc com `npx tsx` em cada rodada de revisão); adicionar Jest para o TypeScript e RSpec/minitest para o Ruby reduz risco de regressão em ajustes de regras, incluindo o cálculo de pontuação parcial client-side
- **Testes end-to-end:** considerar Playwright cobrindo os fluxos críticos (login → palpite → pontuação → ranking, incluindo a transição live → finished sem "pulo" de pontos)
- **Histórico de palpites por rodada:** agrupar a página `/meus-palpites` por rodada (Grupo A, Oitavas, etc.) em vez de lista plana, melhorando a navegação conforme o torneio avança
- **Aproveitamento máximo real:** o cálculo de aproveitamento atual usa uma estimativa de pontos máximos por jogo; refinar para calcular o máximo teórico por regras exatas e expor esse dado no ranking
- **Performance do cálculo client-side:** monitorar o custo de recalcular pontuação parcial e `rank_position` no cliente para todos os participantes em jogos `live` simultâneos, caso o grupo cresça além do uso atual de "pequeno grupo de amigos"
- **Deploy de produção:** configurar variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`) no Vercel e executar as migrations no Supabase de produção antes de abrir o bolão aos participantes
