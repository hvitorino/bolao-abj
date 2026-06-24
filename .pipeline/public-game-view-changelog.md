# Changelog: Página Pública de Jogo

**Slug:** public-game-view
**Branch:** feature/public-game-view
**Data:** 2026-06-24
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `app/jogos/[gameId]/publico/page.tsx` — Server Component assíncrono da página pública. Busca dados do jogo, perfis, palpites (com visibilidade condicional por status) e scores via `createServiceClient()`. Monta `ParticipantEntry[]` e renderiza header público + `PublicGameClient`. Inclui `generateMetadata` para SEO e `export const revalidate = 0`.

- `components/bolao/PublicGameClient.tsx` — Client Component pai que centraliza o estado do jogo via `useGameRealtime`. Distribui `liveGame` como prop para `PublicScoreCard` e `PublicParticipantsList`, evitando múltiplas subscriptions ao mesmo canal Supabase Realtime.

- `components/bolao/PublicScoreCard.tsx` — Exibe placar dos times com bandeiras (`getTeamFlag`), badge de status (■ AO VIVO / □ ENCERRADO / PENDENTE), rodada, data/horário BRT e venue. Recebe `liveGame` já atualizado pelo hook; sem subscription própria de Realtime.

- `components/bolao/PublicParticipantsList.tsx` — Tabela pública PARTICIPANTE | PALPITE | PTS (ou PTS* ao vivo). Lógica de visibilidade idêntica ao `GameParticipantsList`: OCULTO/PENDENTE em jogos `pending`, palpites reais em `live`/`finished`. Calcula pontuação provisória no cliente via `calculateLiveScore()` para jogos ao vivo. Subscreve ao canal `public-scores-${gameId}` para atualização de scores em tempo real (jogos encerrados). Sem accordion de breakdown nem destaque de usuário atual.

- `components/games/GameCard.tsx` (modificado) — Adicionado estado `copied` e handler `handleCopyLink` que copia `${origin}/jogos/${gameId}/publico` para a área de transferência. Botão utilitário com feedback visual: texto `⎘ COPIAR LINK` (color-muted) muda para `✓ COPIADO!` (color-win) por 2 segundos.

### Banco de Dados

- `supabase/migrations/20260624000010_public_read_games_scores.sql` — Adiciona políticas de leitura para o role `anon` nas tabelas `games` e `scores`. Necessário para que o Supabase Realtime funcione na página pública, onde o cliente usa anon key sem sessão autenticada. A migration é idempotente (`DROP POLICY IF EXISTS` antes do `CREATE POLICY`).

---

## Decisões técnicas

**Sem middleware a ajustar:** o projeto não tem `middleware.ts`. A rota `app/jogos/[gameId]/publico/page.tsx` fica fora do route group `(dashboard)`, portanto é pública por padrão — o `DashboardLayout` com verificação de autenticação não é aplicado.

**select('*') no jogo:** a query principal usa `select('*')` para retornar todos os campos do tipo `Game` (incluindo `espn_id` e `created_at`), evitando erro de TypeScript por campos ausentes.

**Participantes globais (sem grupo):** a página pública não tem contexto de grupo ativo. Lista todos os perfis do sistema via `profiles` e cruza com palpites do jogo. Participantes com palpite são listados primeiro; depois vêm os sem palpite, ambos em ordem alfabética.

**Fallback silencioso no copy link:** `handleCopyLink` usa try/catch e não exibe erro em contextos não-seguros (sem HTTPS). Em produção (Vercel) nunca ocorre — comportamento silencioso é adequado.

**Pontuação ao vivo via props, não hook próprio:** `PublicParticipantsList` recebe `liveHomeScore`/`liveAwayScore` do `PublicGameClient` (que tem o único `useGameRealtime`), calculando `calculateLiveScore()` localmente. Isso evita subscription duplicada ao canal `game-${gameId}`.

---

## Pontos de atenção para o Revisor

- Verificar se a visibilidade de palpites em jogos `pending` está correta: `prediction` é `null` no `ParticipantEntry` mas `hasPrediction` reflete existência real via service_role.
- Confirmar que o botão de copiar link no GameCard não quebra layout em 375px (mobile first) — está posicionado como elemento independente abaixo da barra verde, com `width: 100%`.
- Verificar se o Realtime de scores em `PublicParticipantsList` recebe eventos corretamente com anon key (tabela `scores` tem `REPLICA IDENTITY FULL` por feature anterior).
- Confirmar que `notFound()` do Next.js é chamado corretamente para `gameId` inexistente.
- A página não tem TabBar nem SidePanelContainer — header público minimalista apenas com "BOLÃO DA COPA" e badge "VISUALIZAÇÃO PÚBLICA".

---

## Commits realizados

```
5a1be35 fix(public-game-view): corrige prefer-const no page.tsx
ca7c398 feat(public-game-view): adiciona botão copiar link da página pública no GameCard
ed80a93 feat(public-game-view): cria PublicParticipantsList com Realtime de scores e pontuação ao vivo
4e26d1a feat(public-game-view): cria PublicScoreCard com placar ao vivo e badge de status
71fd5fb feat(public-game-view): cria PublicGameClient com estado compartilhado de jogo via Realtime
676fedb feat(public-game-view): cria Server Component da página pública de jogo
01bd15e chore(public-game-view): adiciona plano de implementação
```

---

## Correções Fix 1

### Problema corrigido

**Realtime bloqueado para anon key:** as tabelas `games` e `scores` só tinham políticas RLS para `authenticated`. Clientes anônimos (página pública) não recebiam eventos Realtime nem conseguiam fazer o fetch inicial em `useGameRealtime`.

### O que foi feito

- Criada `supabase/migrations/20260624000010_public_read_games_scores.sql` com `CREATE POLICY "Anon pode ler jogos" ON games FOR SELECT TO anon USING (true)` e equivalente em `scores`, precedidas de `DROP POLICY IF EXISTS` para idempotência.
