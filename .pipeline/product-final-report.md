# Relatório Final — Bolão do Cartola ABJ

Data de conclusão: 2026-06-16

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
20. [grupos] — Grupos Privados (Bolões Isolados) — 2026-06-15
21. [espn-sync] — Sincronização Automática de Jogos via ESPN API — 2026-06-16 (implementada fora do fluxo padrão do pipeline; registrada retroativamente no roadmap)

## Resumo

O Bolão do Cartola ABJ foi construído do zero a partir de 2026-06-13. A aplicação permite que grupos de amigos registrem palpites de placar para os jogos da Copa do Mundo FIFA 2026, acompanhem resultados em tempo real e disputem uma classificação geral — agora isolada por bolão privado.

A stack escolhida (Next.js 15 + Supabase + Ruby/Sinatra) provou-se adequada ao longo de todo o ciclo: o Supabase Realtime eliminou a necessidade de polling para placares e ranking; a lógica de pontuação server-side permaneceu auditável via trigger Postgres espelhado em `lib/scoring.ts`; o App Router do Next.js separou claramente rotas públicas e protegidas via middleware; e o modelo de dados absorveu a extensão para multi-tenancy (`group_id`) sem reescrever a lógica de negócio core.

O pipeline de cinco agentes (Gerente de Produto, Analista de Sistema, Programador, Revisor, Explorador) entregou as 6 funcionalidades centrais previstas em `CLAUDE.md` (auth, game-navigation, predictions, live-scores, scoring, ranking) e, em seguida, 13 rodadas de correções e melhorias identificadas durante o uso real: a regra de goleada passou a exigir 4+ gols do vencedor tanto no palpite quanto no placar real; códigos de times passaram a exibir as 3 letras corretamente; nomes longos de times e estádios passaram a ser truncados em vez de quebrar o layout; a exibição/atualização de placares `live` via Realtime foi corrigida e os hooks (`useGameRealtime`, `useScoreRealtime`) passaram a carregar o estado inicial via fetch no mount; uma regra de privacidade temporal passou a ocultar palpites de terceiros antes do início do jogo; uma página educativa (`/como-pontuar`) passou a explicar as regras de pontuação com exemplo concreto; e `game-participants-view` consolidou, em cada card de jogo, o palpite e a pontuação de todos os participantes.

A feature `live-scoring` fechou a lacuna entre placar em andamento e pontuação: durante um jogo `live`, a pontuação parcial/provisória de cada participante passou a ser calculada 100% client-side (reaproveitando `calculateScore()` de `lib/scoring.ts`, sem nova tabela e sem escrita em `scores`), exibida com indicador visual distinto e somada à pontuação oficial no ranking geral via `useLivePointsByUser`.

A penúltima entrega, `grupos`, foi o maior retrofit estrutural do projeto: introduziu multi-tenancy completo sobre um sistema já em produção com 19 features e usuários reais, sem regressão. Sete migrations SQL (schema de `groups`/`group_members`, backfill idempotente para o grupo "Bolão da Ingrisia ABJ" com "Hamon" como admin, RLS escopada por grupo, trigger de pontuação reescrito preservando 100% das regras vigentes, e `get_ranking(p_group_id)`) sustentam cinco endpoints novos/modificados e todo o frontend de grupos (`/grupos`, `/grupos/novo`, `/grupos/[id]`, `/convite/[token]`, `GroupSwitcher`). A constraint `UNIQUE(user_id, game_id)` de `predictions` foi substituída por `UNIQUE(user_id, game_id, group_id)`, permitindo que o mesmo usuário tenha palpites independentes para o mesmo jogo em grupos diferentes. A revisão identificou duas observações não-bloqueantes (uma policy legada redundante removida sem impacto; a view `ranking_view`, não usada por código de aplicação, ficou sem escopo de grupo) registradas para limpeza futura.

Por fim, `espn-sync` substituiu o dataset placeholder de jogos por sincronização automática via ESPN Scoreboard API: um endpoint `POST /api/admin/sync-games` com autenticação dupla (admin + cron) faz UPSERT idempotente por `espn_id`, mapeia status/placar/times/rodadas para o formato e idioma do produto, e tolera falhas parciais por evento sem abortar o sync. Diferente das demais, essa feature foi implementada diretamente na main sem passar pelo fluxo formal Analista → Programador → Revisor (sem spec inicial nem branch dedicada com merge `--no-ff`), e por isso é registrada aqui retroativamente no roadmap para manter a documentação fiel ao estado real do sistema; o mecanismo de sincronização evoluiu em commits subsequentes (migração do cron Vercel para Supabase Edge Function + `pg_cron`, correção de constraint `espn_id`, ajustes de mapeamento de status e polling de fallback).

Com isso, as 6 funcionalidades centrais do `CLAUDE.md` e todas as extensões identificadas ao longo do desenvolvimento (15 correções/melhorias, 1 retrofit estrutural de multi-tenancy e 1 integração de dados externos) estão implementadas, revisadas e mergeadas na main.

## Próximos passos sugeridos

- **Dados oficiais dos jogos:** a sincronização ESPN (`espn-sync`) já resolve a fonte de dados real; resta validar a cobertura completa do calendário oficial da Copa 2026 conforme a FIFA divulgar mata-mata e confirmar que `TEAM_NAME_MAP`/`ROUND_MAP` cobrem todos os 48 times e todas as fases
- **Regularizar `espn-sync` no pipeline:** como foi implementada fora do fluxo padrão, vale uma revisão formal pelo Revisor (mesmo que retroativa) para auditar segurança do endpoint admin, tratamento de erros e a migração do cron para `pg_cron`, deixando o histórico consistente com as demais features
- **Limpeza pós-`grupos`:** remover a policy RLS legada redundante identificada na revisão e decidir o destino da view `ranking_view` (escopar por `group_id` ou remover, já que não é referenciada por código de aplicação)
- **Painel de administração:** criar rota protegida `/admin/games` para ajustes manuais de placar/status como fallback ao sync automático; o endpoint `PATCH /api/admin/games/[id]` já existe e está autenticado via `X-Admin-Secret`
- **Notificações push:** alertar participantes quando faltam 30 minutos para o deadline de um jogo sem palpite; explorado superficialmente mas não implementado por dependência de infraestrutura de push
- **Histórico de pontuação parcial:** persistir snapshots da pontuação parcial calculada durante jogos `live` (`live-scoring`) para permitir auditoria/replay de como placar e pontuação evoluíram durante a partida
- **Testes automatizados:** `lib/scoring.ts` e o trigger Postgres continuam sem suite automatizada (validação ad hoc via `npx tsx` em cada revisão); adicionar Jest (TS) e RSpec/minitest (Ruby) reduz risco de regressão, especialmente após o retrofit de `group_id` no cálculo de pontuação
- **Testes end-to-end:** Playwright cobrindo login → criar/entrar em grupo → palpite → pontuação → ranking, incluindo a transição live → finished sem "pulo" de pontos, agora multiplicado por múltiplos grupos
- **Histórico de palpites por rodada:** agrupar `/meus-palpites` por rodada (Grupo A, Oitavas, etc.) em vez de lista plana
- **Aproveitamento máximo real:** refinar o cálculo de pontos máximos teóricos por regras exatas em vez de estimativa, e expor no ranking
- **Performance do cálculo client-side:** monitorar o custo de recalcular pontuação parcial e `rank_position` no cliente por grupo, caso algum bolão cresça além do uso atual de "pequeno grupo de amigos"
- **Convites com expiração/revogação:** o link de convite de grupo hoje é reutilizável e permanente; considerar expiração ou botão de "revogar/gerar novo link" se algum grupo precisar encerrar a entrada de novos membros
- **Deploy de produção:** configurar variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`, `CRON_SECRET`) no Vercel e executar todas as migrations (incluindo as de `grupos` e `espn-sync`) no Supabase de produção antes de abrir o bolão aos participantes
