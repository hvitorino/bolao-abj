# Relatório Final — Bolão do Cartola ABJ

Data de conclusão: 2026-06-14

---

## Features Implementadas

1. **auth** — Autenticação — 2026-06-13
2. **game-navigation** — Navegação por Jogos — 2026-06-13
3. **predictions** — Palpites — 2026-06-13
4. **live-scores** — Placares ao Vivo — 2026-06-13
5. **scoring** — Pontuação por Jogo — 2026-06-13
6. **ranking** — Ranking em Tempo Real — 2026-06-13
7. **predictions-edit** — Edição de Palpites — 2026-06-14
8. **fix-ranking-visibility** — Correção: Visibilidade no Ranking — 2026-06-14
9. **ranking-mobile-fit** — Ajuste Mobile do Ranking — 2026-06-14

---

## Resumo do que foi construído

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS 4 + React 19 |
| Backend | Ruby 3.x / Sinatra — Vercel Serverless Functions (`@vercel/ruby`) |
| Banco de Dados | Supabase (PostgreSQL + Realtime + Auth) |
| Design | DESIGN.md — paleta brasileira (verde/amarelo/azul) + estilo Elifoot |

### Tabelas no Banco de Dados

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil de cada usuário (nome, avatar). Criado via trigger `on_auth_user_created`. |
| `games` | Jogos da Copa 2026 com times, placar, status, rodada, sede e horário. |
| `predictions` | Palpites dos participantes com UNIQUE(user_id, game_id). Imutáveis após envio. |
| `scores` | Pontuação calculada por palpite (trigger automático ao encerrar jogo). Breakdown JSON. |

### View e Funções SQL

| Objeto | Descrição |
|--------|-----------|
| `ranking_view` | View que agrega pontos e conta jogos por participante via JOIN scores + profiles. |
| `get_ranking()` | Função RPC SECURITY DEFINER que retorna o ranking completo ignorando RLS de scores. |
| `calculate_scores_for_game(p_game_id)` | Função que faz UPSERT em scores para todos os palpites de um jogo. SECURITY DEFINER. |
| `on_game_finished` | Trigger em `games` que dispara `calculate_scores_for_game` ao status mudar para `finished`. |

### Endpoints Ruby/Sinatra (Vercel Functions)

| Método | Rota | Autenticação | Descrição |
|--------|------|-------------|-----------|
| GET | `/api/games?date=YYYY-MM-DD` | JWT usuário | Lista jogos do dia |
| GET | `/api/predictions?game_id=UUID` | JWT usuário | Lê palpite do usuário para um jogo |
| POST | `/api/predictions` | JWT usuário | Registra palpite com validação de deadline |
| PATCH | `/api/admin/games/[id]` | X-Admin-Secret | Atualiza placar/status (admin) |
| POST | `/api/scores/calculate` | X-Admin-Secret | Recalcula pontuações de um jogo (admin) |
| GET | `/api/ranking` | JWT usuário | Retorna ranking completo com aproveitamento |

### Componentes React

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `GameCard` | `components/games/GameCard.tsx` | Card de jogo com placar, status e área de palpite. Client Component com Realtime. |
| `GameList` | `components/games/GameList.tsx` | Grid responsivo de GameCards agrupado por rodada. |
| `DayNavigator` | `components/games/DayNavigator.tsx` | Navegação por dia com setas ◀ ▶, contadores de jogos e palpites. |
| `PredictionForm` | `components/bolao/PredictionForm.tsx` | Formulário inline de palpite com countdown e deadline automático. |
| `PredictionDisplay` | `components/bolao/PredictionDisplay.tsx` | Exibição de palpite já enviado. |
| `ScoreDisplay` | `components/bolao/ScoreDisplay.tsx` | Breakdown de pontuação por jogo (✓ vencedor, ✓ exato, etc.). |
| `RankingTable` | `components/bolao/RankingTable.tsx` | Tabela de ranking com Realtime e indicador "● AO VIVO". |
| `RankingRow` | `components/bolao/RankingRow.tsx` | Linha do ranking com destaque para líder e usuário atual. |
| `NavLinks` | `app/(dashboard)/nav-links.tsx` | Links de navegação do dashboard com destaque de rota ativa. |
| `Button` | `components/ui/Button.tsx` | Botão reutilizável com variantes primary/secondary/danger. |
| `Input` | `components/ui/Input.tsx` | Input reutilizável com label, erro e estilos monospace. |

### Hooks React

| Hook | Arquivo | Descrição |
|------|---------|-----------|
| `useGameRealtime` | `lib/hooks/useGameRealtime.ts` | Subscription Realtime para tabela `games` (placares ao vivo). |
| `useScoreRealtime` | `lib/hooks/useScoreRealtime.ts` | Subscription Realtime para tabela `scores` (pontuação por jogo). |
| `useRankingRealtime` | `lib/hooks/useRankingRealtime.ts` | Fetch + Subscription Realtime para ranking completo. |

### Rotas Next.js

| Rota | Tipo | Descrição |
|------|------|-----------|
| `/login` | Pública | Formulário de login |
| `/cadastro` | Pública | Formulário de cadastro |
| `/jogos` | Protegida | Jogos do dia com palpites |
| `/meus-palpites` | Protegida | Histórico de palpites e pontuações |
| `/ranking` | Protegida | Ranking geral do bolão |

---

## Ações Manuais Necessárias Antes do Deploy

Estas ações devem ser executadas manualmente no Supabase SQL Editor e no painel do Supabase antes do primeiro deploy em produção.

### 1. Migrations SQL (Supabase SQL Editor)

Executar nesta ordem:

```
db/migrations/20260613_create_games.sql
db/migrations/20260613_create_predictions.sql
db/migrations/20260613_create_scores.sql
db/migrations/20260613_create_ranking_view.sql
```

A migration de `profiles` + trigger `on_auth_user_created` está documentada em `.pipeline/auth-spec.md` e deve ser executada antes de todas as outras.

### 2. Configuração Supabase Realtime

Executar no SQL Editor para habilitar eventos em tempo real:

```sql
-- Tabela games (placares ao vivo)
ALTER TABLE games REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Tabela scores (pontuação e ranking em tempo real)
ALTER TABLE scores REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
```

### 3. Variáveis de Ambiente (Vercel)

Configurar no painel do Vercel (Settings → Environment Variables):

| Variável | Onde obter |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public |
| `SUPABASE_URL` | Mesmo que `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Mesmo que `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (manter privado!) |
| `ADMIN_SECRET` | Gerar uma string segura aleatória (ex: `openssl rand -base64 32`) |

### 4. Configuração Supabase Auth

No painel Supabase → Authentication → Settings:

- **Desativar confirmação de e-mail** ("Enable email confirmations"): `OFF` — para que o cadastro funcione diretamente sem verificação de e-mail.
- **Site URL**: configurar para o domínio do Vercel (ex: `https://bolao-abj.vercel.app`).
- **Redirect URLs**: adicionar o domínio de preview Vercel (ex: `https://bolao-abj-*.vercel.app/**`).

### 5. Seed dos Jogos

Executar o seed script com as credenciais de produção:

```bash
SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<service_key> ruby db/seeds/seed_games.rb
```

**Atenção:** Conferir os horários dos jogos no calendário oficial da FIFA antes de semear em produção. Os horários no seed são aproximações baseadas no calendário publicado.

### 6. RLS Policy para `profiles`

Verificar que a tabela `profiles` tem RLS ativo com políticas adequadas (descrito em `.pipeline/auth-spec.md`):
- SELECT: usuário autenticado pode ler o próprio perfil
- O `get_ranking()` usa SECURITY DEFINER e lê `profiles` sem restrição de RLS

---

## Próximos Passos Sugeridos

### Melhorias funcionais

1. **Número de jogos com palpites no DayNavigator:** Atualmente exibe todos os palpites do usuário. Seria mais útil mostrar também quantos jogos do dia ainda não têm palpite (urgência visual).

3. **Mini-ranking no header do dashboard:** Exibir a posição atual do usuário no ranking diretamente no header (ex: `#3 · 35 pts`) como motivação constante.

4. **Notificações de resultado:** Quando um jogo encerra e a pontuação é calculada, exibir uma notificação toast ao vivo no dashboard com o resultado ("Brasil 3×1 Argentina — você ganhou 8 pts!").

5. **Página de perfil:** Permitir que o usuário edite seu nome exibido no ranking (atualmente usa o nome cadastrado no momento do signup).

### Melhorias técnicas

6. **Idempotência do seed:** Adicionar `ON CONFLICT DO NOTHING` ou verificação de duplicatas no `db/seeds/seed_games.rb` para que o script possa ser executado múltiplas vezes sem criar duplicatas.

7. **Testes automatizados:** Adicionar testes unitários para `lib/scoring.ts` (lógica de pontuação) e testes de integração para os endpoints Ruby (especialmente validação de deadline e cálculo de aproveitamento).

8. **Cache do ranking:** O hook `useRankingRealtime` faz um fetch completo a cada evento de `scores`. Para bolões maiores, seria eficiente implementar cache client-side com `stale-while-revalidate` ou usar React Query/SWR para evitar fetches desnecessários.

9. **Rate limiting no endpoint de ranking:** Proteger `GET /api/ranking` contra abuso com rate limiting básico (ex: máximo 60 req/min por IP) via middleware Vercel ou Edge Config.

10. **Logs estruturados nos endpoints Ruby:** Adicionar logging estruturado (JSON) nos endpoints Ruby para facilitar debugging em produção via Vercel Function Logs.

11. **Variável `SUPABASE_URL` duplicada:** Atualmente `SUPABASE_URL` (usado pelo Ruby) e `NEXT_PUBLIC_SUPABASE_URL` (usado pelo frontend) têm o mesmo valor mas são variáveis separadas. Uma simplificação seria usar apenas `NEXT_PUBLIC_SUPABASE_URL` e lê-la também no Ruby via `ENV['NEXT_PUBLIC_SUPABASE_URL']`.

12. **Posições animadas no ranking:** A spec menciona "posições animadas com transição suave ao atualizar". Isso foi omitido na implementação (complexidade de animação CSS com chaves React). Pode ser adicionado com `transition: all 0.3s ease` nas linhas da tabela e gerenciamento de posição anterior via `useRef`.
