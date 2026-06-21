# Changelog: Correção — Estatísticas e Troféus na Aba de Perfil

**Slug:** fix-perfil-stats-trophies
**Branch:** feature/fix-perfil-stats-trophies
**Data:** 2026-06-21
**Status:** aprovado

---

## O que foi implementado

### Backend (Next.js Route Handlers)

- `app/api/profile/performance/route.ts` — extrai `active_predictions_made` da função RPC `get_profile_stats` e usa esse valor como denominador de `winner_rate`, `exact_rate` e `avg_points` (antes usava `predictions_made` que inclui jogos `pending`). Inclui `active_predictions_made` no JSON de resposta.

- `app/api/profile/stats/route.ts` — mesma correção de denominador: extrai `active_predictions_made` e usa no cálculo das três taxas. Inclui `active_predictions_made` no JSON de resposta.

### Frontend (Next.js/React)

- `components/bolao/perfil/PerformancePanel.tsx` — adicionado campo `active_predictions_made: number` à interface `PerformanceData`. Condição `hasData` passou de `predictions_made > 0` para `active_predictions_made > 0`. Frações exibidas ao lado das barras (ex: `7/20`) agora usam `active_predictions_made` no denominador.

- `components/bolao/perfil/TrophiesPanel.tsx` — refatoração completa da renderização:
  - Removidos: `useState` para `expandedId`, função `toggle`, componente interno `TrophyRow`, separação em três listas (`unlocked`/`locked`/`secret`), grid de 2 colunas para desbloqueados, separador entre seções e toda lógica de colapso/expansão
  - Adicionado: grid vertical único (`gridTemplateColumns: 1fr`) com todos os troféus na ordem retornada pela API
  - Troféus `secret` tratados exatamente como `locked`: exibem nome real e descrição real (sem `🔒 ???`)
  - Descrição (`TROPHY_CRITERIA[trophy.id]`) sempre visível sem nenhum clique
  - Troféus desbloqueados: ✓ em `color-win`, nome uppercase bold, data de desbloqueio alinhada à direita em `color-win`
  - Troféus não-desbloqueados: ✗ em `color-muted`, nome uppercase, barra de progresso à direita quando `progress !== null && progress_max`
  - Sem `cursor: pointer` — todos os itens com `cursor: default`
  - Padding `0.5rem 1rem` por item (era `0.4rem`)
  - Header mantém contador `unlocked.length / trophies.length`

### Banco de Dados

- Migration `supabase/migrations/20260622000005_fix_profile_stats_active_denominator.sql` — recria `get_profile_stats` via `CREATE OR REPLACE` adicionando o campo de retorno `active_predictions_made bigint`. A CTE `active_user_predictions` conta palpites em jogos com `status IN ('finished', 'live')`. O campo `predictions_made` existente é mantido (conta todos os palpites, útil como métrica de engajamento).

---

## Decisões técnicas

**Denominador `activePredictionsMade` vs `predictionsMade`:** jogos `pending` não têm resultado conhecido; incluí-los no denominador divide a taxa por um número inflado artificialmente, mascarando a performance real. Jogos `live` são incluídos no denominador porque podem ter pontuações parciais já calculadas — excluí-los durante o dia de jogo criaria inconsistência.

**Migration idempotente:** `CREATE OR REPLACE FUNCTION` não cria nova migration sobre a existente — é segura para reexecução e não edita arquivos de migration já aplicados.

**Troféus secretos na camada de exibição:** a eliminação do conceito `secret` é apenas visual. O backend continua retornando `status: 'secret'`; o frontend simplesmente não diferencia mais `secret` de `locked`. Nenhuma mudança em `/api/profile/trophies` ou na lógica de avaliação de troféus.

**`TROPHY_HINTS` removido:** o dicionário `TROPHY_HINTS` foi removido porque a nova spec exige `TROPHY_CRITERIA` (descrição completa) sempre visível. `TROPHY_HINTS` era um fallback incompleto que só aparecia inline na barra de progresso dos troféus `locked` — não tem mais utilidade.

---

## Pontos de atenção para o Revisor

1. Verificar que a migration `20260622000005` pode ser aplicada sem erro sobre a versão atual da função `get_profile_stats` em produção (a função anterior não retornava `active_predictions_made`, então a assinatura muda — Route Handlers precisam da nova versão do RPC para não lançar erro de coluna desconhecida).
2. Confirmar que `PerformancePanel` não usa `predictions_made` em nenhum outro lugar (apenas `active_predictions_made` nas frações e `hasData`).
3. Confirmar que a ordem dos troféus no grid único é determinística — a API `/api/profile/trophies` retorna na ordem da implementação e essa ordem é preservada na renderização.
4. Verificar mobile: grid coluna única, descrição em 11px legível em telas estreitas.
5. `npm run lint` e `npm run build` — ambos passam sem erros novos introduzidos por esta feature.

---

## Commits realizados

```
f7346e6 feat(fix-perfil-stats-trophies): refatora TrophiesPanel — grid único, descrição sempre visível, secret tratado como locked
8a48915 feat(fix-perfil-stats-trophies): atualiza PerformancePanel para usar active_predictions_made
71f817d feat(fix-perfil-stats-trophies): corrige denominador das taxas em /api/profile/stats
52b2e7b feat(fix-perfil-stats-trophies): corrige denominador das taxas em /api/profile/performance
49f4471 feat(fix-perfil-stats-trophies): adiciona migration com active_predictions_made em get_profile_stats
eae297a chore(fix-perfil-stats-trophies): adiciona plano de implementação
```
