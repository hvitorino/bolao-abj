# Spec: Live Scores

**Slug:** live-scores
**Data:** 2026-06-13
**Status:** spec

---

## Objetivo

Exibir placares atualizados em tempo real durante os jogos, usando Supabase Realtime para propagar atualizações da tabela `games` a todos os clientes conectados instantaneamente, sem necessidade de refresh de página. Quando o status ou placar de um jogo muda no banco, todos os usuários conectados devem ver a atualização em menos de 2 segundos.

---

## Histórias de Usuário

- Como participante do bolão, quero ver o placar de um jogo ao vivo atualizar automaticamente na tela sem precisar recarregar a página, para acompanhar a partida em tempo real.
- Como participante do bolão, quero ver o badge "██ AO VIVO ██" piscando nos jogos em andamento, para identificar rapidamente quais partidas estão acontecendo agora.
- Como administrador, quero poder atualizar o placar e status de um jogo via endpoint seguro, para que os placares reflitam o que está acontecendo em campo.
- Como participante, quero ver o placar em destaque amarelo (`color-accent`) nos jogos ao vivo e encerrados, para distinguir facilmente jogos com resultado de jogos pendentes.

---

## Modelo de Dados

### Tabelas novas ou modificadas

Nenhuma tabela nova. A tabela `games` já existe com os campos necessários:

```sql
games (
  id uuid PK,
  home_team text,
  away_team text,
  home_team_code char(3),
  away_team_code char(3),
  match_date timestamptz,
  home_score int,        -- null para jogos pending
  away_score int,        -- null para jogos pending
  status text,           -- 'pending' | 'live' | 'finished'
  round text,
  venue text,
  created_at timestamptz
)
```

### Migrations necessárias

Nenhuma migration SQL adicional. Apenas configuração do Supabase Realtime:

```sql
-- Habilitar replication na tabela games (executar no Supabase SQL Editor):
ALTER TABLE games REPLICA IDENTITY FULL;

-- Adicionar tabela games à publicação realtime (se ainda não estiver):
ALTER PUBLICATION supabase_realtime ADD TABLE games;
```

> **Importante:** `REPLICA IDENTITY FULL` é necessário para que o Supabase Realtime envie os valores antigos E novos no evento UPDATE, permitindo ao cliente saber quais campos mudaram.

---

## Backend — Endpoints Ruby/Sinatra

### PATCH /api/admin/games/[id]

**Arquivo:** `api/admin/games/[id].rb`

**Autenticação:** header `X-Admin-Secret` com valor da variável de ambiente `ADMIN_SECRET`. Não usa JWT de usuário — é um endpoint exclusivo para operação administrativa.

**Body (JSON):**
```json
{
  "home_score": 2,
  "away_score": 1,
  "status": "live"
}
```

Todos os campos são opcionais individualmente, mas pelo menos um deve estar presente.

**Validações:**
- `X-Admin-Secret` header deve bater com `ENV['ADMIN_SECRET']` — retornar 401 se inválido ou ausente
- `id` da URL deve ser UUID válido (regex: `/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i`)
- `home_score` e `away_score`, se presentes, devem ser inteiros `>= 0`
- `status`, se presente, deve ser um de: `'pending'`, `'live'`, `'finished'`
- Jogo deve existir no banco — retornar 404 se não encontrado
- Pelo menos um campo válido deve estar no body — retornar 422 se body vazio ou sem campos válidos

**Resposta de sucesso (200):**
```json
{
  "id": "uuid-do-jogo",
  "home_score": 2,
  "away_score": 1,
  "status": "live",
  "updated_at": "2026-06-13T18:00:00Z"
}
```

**Erros possíveis:**
- 401: `{ "error": "Não autorizado" }` — ADMIN_SECRET ausente ou inválido
- 404: `{ "error": "Jogo não encontrado" }` — id não existe no banco
- 422: `{ "error": "Nenhum campo válido para atualizar" }` — body vazio ou campos inválidos
- 422: `{ "error": "status inválido" }` — status fora do enum permitido
- 422: `{ "error": "home_score deve ser inteiro não negativo" }` — score inválido
- 500: `{ "error": "Erro interno" }` — falha no Supabase

**Mecanismo de propagação Realtime:**
O endpoint faz um simples `PATCH` via Supabase REST API com `service_role`. O Supabase detecta o UPDATE via WAL (Write-Ahead Log) e publica o evento no canal Realtime automaticamente. Não há lógica adicional de notificação no endpoint.

**Exemplo de chamada cURL:**
```bash
curl -X PATCH https://<dominio>/api/admin/games/<id> \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  -d '{"home_score": 2, "away_score": 0, "status": "live"}'
```

---

## Frontend — Componentes React

### useGameRealtime (hook)

**Arquivo:** `lib/hooks/useGameRealtime.ts`

**Assinatura:**
```typescript
function useGameRealtime(gameId: string, initialGame: Game): Game
```

**Comportamento:**
- Recebe o `gameId` e o estado inicial do jogo (vindo do Server Component)
- Mantém `gameState` em `useState<Game>(initialGame)`
- No `useEffect`, cria uma subscription Supabase Realtime para o canal `game-${gameId}`:
  ```typescript
  supabase
    .channel(`game-${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        setGameState(payload.new as Game)
      }
    )
    .subscribe()
  ```
- No cleanup do `useEffect`, remove o canal: `supabase.removeChannel(channel)`
- Retorna o `gameState` atualizado

**Dependências:** `@supabase/supabase-js` (browser client de `lib/supabase/client.ts`)

**Importante:** O hook deve criar a subscription apenas uma vez (array de dependências vazio no useEffect principal, ou apenas `[gameId]`). Evitar recriação desnecessária do canal.

### GameCard (modificado)

**Arquivo:** `components/games/GameCard.tsx` (já existe como Client Component)

**Mudanças a fazer:**
1. Importar `useGameRealtime` de `@/lib/hooks/useGameRealtime`
2. Dentro do componente, antes das derivações de estado (`isLive`, `isFinished`, etc.), chamar o hook:
   ```typescript
   const liveGame = useGameRealtime(game.id, game)
   ```
3. Substituir todas as referências a `game` pelas referências a `liveGame` no JSX (os dados renderizados devem refletir o estado em tempo real)
4. A prop `game` continua existindo como antes — apenas usada como `initialGame` para o hook

**Props (sem mudança na interface):**
```typescript
interface GameCardProps {
  game: Game
  prediction?: Prediction | null
}
```

**Estados visíveis:**
- `liveGame.status === 'live'`: borda `color-live`, badge "██ AO VIVO ██" com classe `blink`
- `liveGame.status === 'finished'`: status "ENCERRADO" em `color-muted`
- `liveGame.status === 'pending'`: "PENDENTE · HH:MM BRT" em `color-muted`
- `liveGame.home_score !== null && liveGame.away_score !== null`: placar em `color-accent`, tamanho 28px bold
- Placar ausente: "- × -" em `color-muted`

---

## Regras de Negócio

1. **Propagação automática:** Basta fazer o UPDATE na tabela `games` via qualquer cliente com permissão (service_role). O Supabase Realtime detecta via WAL e notifica todos os clientes subscritos. Não há polling.

2. **Latência alvo:** < 2 segundos desde o UPDATE no banco até a atualização na tela do usuário.

3. **Graceful degradation:** Se a subscription Realtime falhar (rede, quota, etc.), o card continua exibindo o último estado conhecido (o `initialGame` ou a última atualização recebida). Não deve exibir erro ao usuário.

4. **ADMIN_SECRET:** Deve ser uma string segura (>= 32 caracteres recomendado), armazenada como variável de ambiente `ADMIN_SECRET` no Vercel. Nunca exposta no frontend (`NEXT_PUBLIC_*` é proibido para este secret).

5. **Status transitions válidas (documentação — não enforçado no backend):**
   - `pending` → `live` (jogo começa)
   - `live` → `finished` (jogo termina)
   - Qualquer transição é aceita pelo endpoint (simplicidade operacional)

6. **Scores nulos para jogos pending:** O endpoint pode receber scores mesmo para um jogo `pending` (pré-placar). O banco aceita valores nulos ou inteiros. A UI exibe "- × -" quando ambos são nulos.

---

## Proteção de Rotas

Nenhuma rota nova no frontend. O `GameCard` já está em rotas protegidas pelo middleware existente (`app/(dashboard)/layout.tsx`).

O endpoint admin (`/api/admin/games/[id]`) usa `ADMIN_SECRET` header — não usa JWT de usuário. Não há rota Next.js pública para este endpoint.

---

## Integração Supabase Realtime

- **Tabela a observar:** `games`
- **Evento:** `UPDATE` (quando admin atualiza placar ou status)
- **Canal:** `game-${gameId}` — um canal por jogo, no `GameCard` individual
- **Filtro:** `id=eq.${gameId}` — cada card subscreve apenas ao seu jogo
- **O que fazer ao receber o evento:** `setGameState(payload.new as Game)` — substituir o estado local pelo novo objeto completo do jogo
- **Cleanup:** `supabase.removeChannel(channel)` no retorno do `useEffect`

### Configuração necessária no Supabase

Antes do deploy, executar no SQL Editor do Supabase:

```sql
-- Habilitar REPLICA IDENTITY FULL para enviar dados completos no evento UPDATE
ALTER TABLE games REPLICA IDENTITY FULL;

-- Garantir que games está na publicação realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE games;
  END IF;
END $$;
```

---

## Critérios de Aceite

- [ ] Quando `home_score`, `away_score` ou `status` de um jogo muda no banco, o `GameCard` correspondente atualiza em < 2s sem reload de página
- [ ] Badge "██ AO VIVO ██" aparece e pisca (CSS `blink`) quando `status === 'live'`
- [ ] Placar de jogos `live` e `finished` é exibido em `color-accent` (#FFDF00)
- [ ] A subscription Realtime é limpa corretamente ao desmontar o `GameCard` (sem memory leak)
- [ ] Endpoint `PATCH /api/admin/games/[id]` retorna 401 se `X-Admin-Secret` ausente ou inválido
- [ ] Endpoint retorna 404 se jogo não existe
- [ ] Endpoint retorna 200 com dados atualizados se válido
- [ ] `ADMIN_SECRET` nunca é exposto no frontend nem nos logs de resposta
- [ ] Múltiplos `GameCard` na mesma página cada um subscreve ao seu canal individual (não há canal compartilhado)
- [ ] Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot)
- [ ] Funciona em mobile (coluna única)
- [ ] Hook `useGameRealtime` está em `lib/hooks/useGameRealtime.ts`
