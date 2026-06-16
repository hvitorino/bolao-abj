# Spec: Convites Nominais para Grupos

**Slug:** convites-nominais
**Data:** 2026-06-16
**Status:** spec

---

## Objetivo

Permitir que o admin de um grupo convide ativamente uma pessoa específica já cadastrada no sistema, em vez de depender exclusivamente do link reutilizável anônimo entregue pela feature `grupos`. O admin busca o usuário por nome ou e-mail, cria um convite nominal endereçado a ele, e esse convite fica rastreável: visível como "pendente" para o admin (quem foi convidado, quando, status) e visível para o convidado dentro do produto, que pode aceitar (entra como `member`) ou recusar.

Esta feature é **aditiva**: o link de convite reutilizável (`groups.invite_token`, rota `/convite/[token]`, endpoints `resolve-invite`/`join`) continua existindo e funcionando exatamente como hoje. Convites nominais são um segundo mecanismo, mais direcionado, que coexiste com o primeiro.

**Sem envio de e-mail, SMS ou push notification.** O projeto não tem nenhuma dependência de provedor de e-mail nem variável de ambiente de SMTP/API key (`package.json` só lista `@supabase/ssr`, `@supabase/supabase-js`, `next`, `react`, `react-dom`). O convite é 100% dentro do produto: criado por um Route Handler, armazenado em uma tabela, e exibido ao convidado na próxima vez que ele acessar o app. Esta decisão de escopo já foi tomada pelo PM e não deve ser reaberta.

**Fora de escopo nesta feature:**
- Envio de e-mail/SMS/push real (ver acima — decisão já tomada).
- Convidar alguém que ainda não tem conta no sistema (convite "pré-cadastro" por e-mail externo). O admin só pode convidar um usuário que já possui `profile` cadastrado — o convite por link reutilizável já cobre o caso de trazer gente nova para o sistema.
- Cancelar/revogar um convite já enviado pelo admin (o convite pendente permanece até o convidado aceitar ou recusar; não há botão "cancelar convite" nesta entrega).
- Múltiplos admins por grupo, promoção/remoção de membro — inalterado desde `grupos`.
- Qualquer alteração no fluxo de convite por link (`groups.invite_token`, `/convite/[token]`, `resolve-invite`, `join`) além de uma ressalva pontual sobre idempotência cruzada entre os dois mecanismos (ver Regras de Negócio item 6).
- Listagem paginada/busca avançada de usuários — a busca de destinatário é uma busca simples por substring em nome ou e-mail, com limite de resultados, suficiente para o tamanho do grupo de amigos do projeto.

---

## Histórias de Usuário

- Como admin de um grupo, quero buscar um usuário já cadastrado por nome ou e-mail, para encontrar rapidamente a pessoa que quero convidar sem precisar saber o ID dela.
- Como admin de um grupo, quero criar um convite nominal endereçado a um usuário específico, para trazê-lo ativamente para o grupo sem depender de ele receber/usar um link manualmente.
- Como admin de um grupo, quero ver a lista de convites nominais que enviei (quem, quando, status: pendente/aceito/recusado), para acompanhar quem ainda não respondeu.
- Como admin, quero que convidar alguém que já é membro do grupo, ou repetir o convite para a mesma pessoa enquanto o anterior está pendente, não gere duplicidade nem erro confuso — apenas uma mensagem clara explicando a situação.
- Como usuário convidado, quero ver, em algum lugar do produto que eu acesso normalmente, os convites pendentes endereçados a mim, para não depender de avisos externos (WhatsApp, etc.) para saber que fui convidado.
- Como usuário convidado, quero aceitar um convite e entrar automaticamente no grupo como `member`, para participar do bolão sem precisar de um link separado.
- Como usuário convidado, quero poder recusar um convite que não me interessa, para que ele saia da minha lista de pendências sem afetar minha conta.
- Como usuário, quero ter certeza de que só vejo convites endereçados a mim mesmo, e que um admin só vê/gerencia convites do seu próprio grupo, para preservar o isolamento entre bolões.

---

## Modelo de Dados

### Tabela nova: `group_invites`

```sql
group_invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invited_user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by       uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  responded_at     timestamptz
)
```

**Decisões de modelagem:**

- **`invited_user_id` em vez de `invited_email`.** Conforme decisão de escopo, o admin só pode convidar quem já tem `profile` no sistema — não existe fluxo de "convidar por e-mail de alguém que ainda não se cadastrou". Referenciar `profiles(id)` diretamente (FK forte) é mais simples e correto do que guardar um e-mail solto que precisaria ser reconciliado depois com um `user_id` no momento do cadastro. Isso também elimina qualquer necessidade de expor e-mails de terceiros no payload do convite.
- **Sem `UNIQUE(group_id, invited_user_id)` incondicional.** Um índice único parcial é usado em vez disso, para permitir reconvite após recusa (ver abaixo), mas impedir duplicidade enquanto há um convite `pending` ativo:
  ```sql
  CREATE UNIQUE INDEX group_invites_unique_pending
    ON group_invites (group_id, invited_user_id)
    WHERE status = 'pending';
  ```
  Isso garante, no nível do banco, que nunca existem dois convites `pending` simultâneos para o mesmo par `(group_id, invited_user_id)` — a mesma pessoa pode ter sido convidada, recusado, e ser convidada de novo depois (gerando uma nova linha `pending`), mas nunca duas linhas `pending` ao mesmo tempo.
- **Reconvite após recusa é permitido.** Um convite `declined` é um registro histórico, não bloqueia convites futuros. Recusar não impede ser convidado de novo — só evita duplicar o convite *enquanto* ele está pendente.
- **Convite aceito não é apagado.** `status = 'accepted'` permanece como histórico (quem convidou quem, e quando aceitou) — útil para o admin acompanhar a lista mesmo depois que a pessoa já entrou, e barato de manter (nenhuma constraint exige limpeza).
- **Sem coluna de e-mail na tabela.** A busca de destinatário (ver endpoint dedicado abaixo) resolve nome/e-mail para um `profile.id` no momento da criação do convite; depois disso, a tabela só referencia o `id`, nunca re-expõe e-mail.

### Índices

```sql
CREATE INDEX idx_group_invites_group_id ON group_invites(group_id);
CREATE INDEX idx_group_invites_invited_user_id ON group_invites(invited_user_id);
CREATE INDEX idx_group_invites_status ON group_invites(status);
```

### RLS (Row Level Security)

Reaproveita a função `is_group_member(p_group_id uuid, p_user_id uuid)` já criada na feature `grupos` (`SECURITY DEFINER`, em `supabase/migrations/20260615120000_create_groups_and_members.sql`). Para a checagem de "é admin do grupo", criar uma função auxiliar nova seguindo o mesmo padrão:

```sql
CREATE OR REPLACE FUNCTION is_group_admin(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'admin'
  );
$$;
```

`SECURITY DEFINER` pelo mesmo motivo de `is_group_member`: evita recursão de RLS ao consultar `group_members` de dentro de uma policy de outra tabela.

```sql
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

-- SELECT: admin do grupo vê todos os convites daquele grupo; o próprio
-- convidado vê os convites endereçados a ele, em qualquer grupo.
CREATE POLICY "group_invites_select_admin_or_invitee"
  ON group_invites FOR SELECT
  TO authenticated
  USING (
    invited_user_id = auth.uid()
    OR is_group_admin(group_id, auth.uid())
  );

-- INSERT/UPDATE: feitos exclusivamente via Route Handler com service_role
-- (mesma decisão da feature `grupos` para `group_members`) — sem policy de
-- INSERT/UPDATE para `authenticated`, bloqueado por padrão com RLS ativo.
```

Toda escrita (criar convite, aceitar, recusar) passa pelo `service_role` nos Route Handlers, que fazem a validação de autorização explicitamente em código (admin do grupo para criar; o próprio convidado para aceitar/recusar) — mesmo padrão de defesa em profundidade já usado em `grupos` (RLS como linha primária para leitura direta via client Supabase, Route Handler como linha de aplicação para escrita).

### Migrations necessárias

Seguindo a convenção do projeto: arquivos em `supabase/migrations/` com timestamp `YYYYMMDDHHMMSS_descricao.sql`, espelhados em `db/migrations/` com `YYYYMMDD_descricao.sql` (confirmado lendo o estado atual do repositório — ambas as pastas existem e têm migrations equivalentes para todas as features anteriores, incluindo `grupos`).

1. **`20260616120000_create_group_invites.sql`**
   - `CREATE TABLE group_invites (...)` conforme schema acima.
   - Índices: `idx_group_invites_group_id`, `idx_group_invites_invited_user_id`, `idx_group_invites_status`, e o índice único parcial `group_invites_unique_pending`.
   - `ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY`.
   - Função `is_group_admin(p_group_id uuid, p_user_id uuid)`.
   - Policy `group_invites_select_admin_or_invitee`.

   Espelhar em `db/migrations/20260616_create_group_invites.sql`.

Não há migration de backfill/dados nesta feature — `group_invites` nasce vazia, sem necessidade de migrar estado pré-existente (diferente de `grupos`, que precisou mover usuários/predictions/scores já em produção). Não há também alteração em tabelas existentes (`groups`, `group_members`, `predictions`, `scores`, `profiles`) — a feature é puramente aditiva em termos de schema.

---

## Busca de usuário a convidar

### Por que não usar e-mail diretamente de `profiles`

Confirmado lendo `supabase/migrations/20260613000001_create_profiles.sql`: a tabela `profiles` tem apenas `id`, `name`, `avatar_url`, `created_at` — **não tem coluna de e-mail**. O e-mail do usuário existe somente em `auth.users.email`, que não é acessível via client autenticado comum (sem RLS pública sobre `auth.users`, e não deveria ter). Para permitir busca por e-mail sem expor a tabela `auth.users` inteira nem vazar e-mails de terceiros em bulk, esta feature cria uma function `SECURITY DEFINER` que resolve a busca internamente (lendo `auth.users` com privilégio elevado) e retorna apenas os campos seguros de exibição (`id`, `name`) — nunca o e-mail de terceiros no payload de resposta.

### Função `search_users_to_invite`

```sql
CREATE OR REPLACE FUNCTION search_users_to_invite(p_query text, p_exclude_group_id uuid)
RETURNS TABLE (
  id    uuid,
  name  text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.name
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE (
    p.name ILIKE '%' || p_query || '%'
    OR u.email ILIKE '%' || p_query || '%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = p_exclude_group_id AND gm.user_id = p.id
  )
  ORDER BY p.name ASC
  LIMIT 10;
$$;
```

**Decisões:**
- `p_exclude_group_id`: já filtra fora da busca quem **já é membro** do grupo em questão — evita que o admin tente convidar alguém que já está dentro (ver Regras de Negócio para o tratamento de idempotência, que cobre o caso de o admin burlar a UI e chamar o endpoint de criação direto mesmo assim).
- A função não filtra por convites `pending` já existentes — isso é feito na etapa de criação do convite (ver endpoint `POST /api/groups/[id]/invites`), não na busca, porque o admin pode legitimamente querer ver/reconfirmar que já convidou alguém (a UI de resultado de busca pode marcar visualmente "já convidado" — ver Frontend).
- `p_query` com menos de 2 caracteres não deve disparar busca (validado no Route Handler, não na function, para manter a function simples e genérica) — evita queries `ILIKE '%%'` custosas em buscas vazias.
- O e-mail nunca é retornado no `SELECT` da função — apenas usado na cláusula `WHERE` para permitir o match. Isso preserva a regra "nunca expor e-mail de terceiros" mesmo permitindo buscar por e-mail.
- `auth.users` só é acessível porque a function é `SECURITY DEFINER` (roda com privilégios do owner, tipicamente `postgres`/superuser no Supabase) — sem isso, uma query direta do client a `auth.users` seria bloqueada.

Esta função entra na mesma migration `20260616120000_create_group_invites.sql` (não precisa de migration separada, pois não cria/altera tabela, apenas uma function).

### Endpoint de busca

Ver `GET /api/groups/[id]/invites/search-users` na seção Backend.

---

## Backend — Endpoints Next.js (Route Handlers TypeScript)

Confirmado lendo o código atual (`app/api/groups/route.ts`, `app/api/groups/join/route.ts`, `app/api/groups/[id]/route.ts`) que **todos os endpoints ativos do projeto já são Next.js Route Handlers em TypeScript** (`app/api/**/route.ts`), com autenticação via Bearer JWT validado em `anonClient.auth.getUser(jwt)` e escrita via `service_role` (`createClient` com `SUPABASE_SERVICE_ROLE_KEY`). Esta feature segue exatamente o mesmo padrão — não há Ruby/Sinatra ativo no projeto, apesar do que `CLAUDE.md` descreve estruturalmente (mesma nota já registrada na spec de `grupos`).

### GET /api/groups/[id]/invites/search-users?q=\<query\>

**Autenticação:** requerida (Bearer JWT) + autorização: usuário deve ser **admin** do grupo `[id]`.
**Query params:** `q` (string, busca por nome ou e-mail).

**Lógica:**
1. Autentica o usuário. Sem sessão válida → 401.
2. Valida `id` (UUID) e `q` (string não vazia, mínimo 2 caracteres após `trim()`). `q` ausente ou curto → 422.
3. Verifica via `service_client` que o usuário é `admin` de `group_id = id` (`group_members.role = 'admin'`). Se não for membro ou for `member`, 403.
4. Chama a RPC `search_users_to_invite(p_query: q, p_exclude_group_id: id)` via `service_client`.
5. Para cada resultado, marca `already_invited: boolean` consultando se existe um `group_invites` com `status = 'pending'` para aquele `(group_id, invited_user_id)` — uma única query adicional com `IN (...)` sobre os ids retornados (evita N+1).

**Resposta de sucesso (200):**
```json
[
  { "id": "uuid", "name": "Maria Silva", "already_invited": false },
  { "id": "uuid", "name": "João Pedro", "already_invited": true }
]
```
**Erros possíveis:**
- 401: não autenticado
- 403: usuário não é admin deste grupo
- 422: `q` ausente ou menor que 2 caracteres
- 404: grupo não encontrado

---

### POST /api/groups/[id]/invites

**Autenticação:** requerida (Bearer JWT) + autorização: usuário deve ser **admin** do grupo `[id]`.
**Body (JSON):**
```json
{ "invited_user_id": "uuid" }
```

**Lógica:**
1. Autentica o usuário. Sem sessão válida → 401.
2. Valida `id` (UUID do grupo) e `invited_user_id` (UUID presente no body). Ausente/inválido → 422.
3. Verifica que o usuário autenticado é `admin` de `group_id = id` via `service_client`. Se não, 403.
4. Verifica que `invited_user_id` corresponde a um `profile` existente. Se não, 404 (`user_not_found`).
5. Verifica se `invited_user_id` **já é membro** do grupo (`group_members`). Se sim, retorna 200 com `{ status: 'already_member', message: 'Este usuário já participa do grupo.' }` — **não é um erro**, é um caminho de sucesso idempotente que informa a situação claramente, conforme critério de sucesso do PM. Não cria linha em `group_invites`.
6. Verifica se já existe convite `pending` para esse `(group_id, invited_user_id)` via `service_client.from('group_invites').select('id').eq('group_id', id).eq('invited_user_id', invited_user_id).eq('status', 'pending').maybeSingle()`. Se sim, retorna 200 com `{ status: 'already_pending', message: 'Convite já enviado e ainda pendente.', invite: {...} }` — também idempotente, não duplica.
7. Se nenhum dos casos acima, insere `group_invites (group_id, invited_user_id, invited_by, status)` com `status = 'pending'`. O índice único parcial `group_invites_unique_pending` é a garantia de última linha contra corrida de condição (duas requisições simultâneas) — se o `INSERT` falhar com `23505` por essa constraint, o Route Handler trata como o mesmo caso do passo 6 (busca o convite pendente existente e retorna `already_pending`), evitando expor erro de banco como erro genérico 500.
8. Retorna 201 com os dados do convite criado.

**Resposta de sucesso — novo convite (201):**
```json
{
  "status": "created",
  "invite": {
    "id": "uuid",
    "group_id": "uuid",
    "invited_user_id": "uuid",
    "invited_user_name": "Maria Silva",
    "invited_by": "uuid",
    "status": "pending",
    "created_at": "2026-06-16T12:00:00Z"
  }
}
```
**Resposta de sucesso — já é membro (200):**
```json
{ "status": "already_member", "message": "Este usuário já participa do grupo." }
```
**Resposta de sucesso — convite já pendente (200):**
```json
{ "status": "already_pending", "message": "Convite já enviado e ainda pendente.", "invite": { "...": "..." } }
```
**Erros possíveis:**
- 401: não autenticado
- 403: usuário autenticado não é admin deste grupo
- 404: grupo não encontrado, ou `invited_user_id` não corresponde a nenhum profile
- 422: `invited_user_id` ausente ou não-UUID

---

### GET /api/groups/[id]/invites

**Autenticação:** requerida (Bearer JWT) + autorização: usuário deve ser **admin** do grupo `[id]`.
**Query params opcionais:** `status` (`pending` | `accepted` | `declined`) — se ausente, retorna todos.

**Lógica:**
1. Autentica o usuário; verifica que é admin do grupo `id` (mesmo padrão acima). Se não, 403.
2. Busca `group_invites` do grupo, com JOIN em `profiles` para exibir o nome do convidado, ordenado por `created_at DESC` (mais recentes primeiro).

```sql
SELECT gi.id, gi.invited_user_id, p.name AS invited_user_name, gi.status, gi.created_at, gi.responded_at
FROM group_invites gi
JOIN profiles p ON p.id = gi.invited_user_id
WHERE gi.group_id = :groupId
  [AND gi.status = :status]
ORDER BY gi.created_at DESC
```

**Resposta de sucesso (200):**
```json
[
  {
    "id": "uuid",
    "invited_user_id": "uuid",
    "invited_user_name": "Maria Silva",
    "status": "pending",
    "created_at": "2026-06-16T12:00:00Z",
    "responded_at": null
  },
  {
    "id": "uuid",
    "invited_user_id": "uuid",
    "invited_user_name": "João Pedro",
    "status": "declined",
    "created_at": "2026-06-15T09:00:00Z",
    "responded_at": "2026-06-15T10:30:00Z"
  }
]
```
**Erros possíveis:**
- 401: não autenticado
- 403: usuário não é admin deste grupo
- 404: grupo não encontrado

---

### GET /api/invites/pending

**Autenticação:** requerida (Bearer JWT). Sem autorização adicional — sempre retorna apenas convites endereçados ao próprio usuário autenticado.
**Lógica:** retorna todos os convites com `status = 'pending'` endereçados ao usuário logado, com o nome do grupo e de quem convidou.

```sql
SELECT gi.id, gi.group_id, g.name AS group_name, gi.invited_by, p.name AS invited_by_name, gi.created_at
FROM group_invites gi
JOIN groups g ON g.id = gi.group_id
JOIN profiles p ON p.id = gi.invited_by
WHERE gi.invited_user_id = :userId AND gi.status = 'pending'
ORDER BY gi.created_at DESC
```

**Resposta de sucesso (200):**
```json
[
  {
    "id": "uuid",
    "group_id": "uuid",
    "group_name": "Bolão do Trabalho",
    "invited_by": "uuid",
    "invited_by_name": "Hamon",
    "created_at": "2026-06-16T12:00:00Z"
  }
]
```
**Erros possíveis:**
- 401: não autenticado

Este endpoint é consumido pelo layout do dashboard (ver Frontend) para exibir a lista/badge de convites pendentes em qualquer página do app, e também pela página `/grupos`.

---

### POST /api/invites/[id]/accept

**Autenticação:** requerida (Bearer JWT) + autorização: o usuário autenticado deve ser o `invited_user_id` do convite.
**Body:** nenhum.

**Lógica:**
1. Autentica o usuário. Sem sessão → 401.
2. Busca `group_invites` por `id` via `service_client`. Não encontrado → 404.
3. Verifica que `invite.invited_user_id === user.id`. Se não, 403 (`forbidden`, "Este convite não é seu.").
4. Verifica que `invite.status === 'pending'`. Se já `accepted`/`declined`, retorna 409 (`already_responded`, "Este convite já foi respondido.") — não é idempotente como os outros fluxos porque aceitar/recusar é uma ação explícita do usuário que não deveria silenciosamente "funcionar de novo"; a UI deve impedir múltiplos cliques (botão desabilitado após resposta), mas o backend retorna erro claro se acontecer uma corrida (ex.: duas abas abertas).
5. Verifica se o usuário **já é membro** do grupo (caso raro: aceitou via link reutilizável enquanto o convite nominal ficava pendente — ver Regras de Negócio item 6). Se já é membro, apenas atualiza o convite para `accepted` (sem tentar inserir `group_members` de novo, evitando erro de `UNIQUE(group_id, user_id)`), e retorna sucesso normalmente.
6. Caso não seja membro ainda: em uma sequência de operações com `service_client` (sem transação multi-tabela disponível, mesma limitação já documentada em `grupos`):
   - `INSERT INTO group_members (group_id, user_id, role) VALUES (invite.group_id, user.id, 'member')`.
   - `UPDATE group_invites SET status = 'accepted', responded_at = now() WHERE id = invite.id`.
   - **Nota de atomicidade:** se o `UPDATE` do convite falhar após o `INSERT` da membership ter sucesso, o usuário já está no grupo (o que é o resultado desejado do ponto de vista funcional) mas o convite fica com status `pending` desatualizado. Mitigação: logar o erro e retornar 500 mesmo assim (a entrada no grupo já aconteceu e não deve ser desfeita) — uma reconciliação manual futura pode corrigir o status do convite sem risco, pois o usuário já está dentro. Diferente do caso de `POST /api/groups`, aqui não faz sentido fazer rollback do `INSERT` em `group_members` (remover o usuário do grupo que ele acabou de aceitar entrar seria uma surpresa pior do que um convite com status levemente inconsistente).
7. Retorna 200 com os dados do grupo, para o frontend redirecionar.

**Resposta de sucesso (200):**
```json
{ "group_id": "uuid", "group_name": "Bolão do Trabalho", "role": "member" }
```
**Erros possíveis:**
- 401: não autenticado
- 403: convite não pertence ao usuário autenticado
- 404: convite não encontrado
- 409: convite já foi respondido anteriormente (`accepted` ou `declined`)

---

### POST /api/invites/[id]/decline

**Autenticação:** requerida (Bearer JWT) + autorização: o usuário autenticado deve ser o `invited_user_id` do convite.
**Body:** nenhum.

**Lógica:**
1. Autentica o usuário. Sem sessão → 401.
2. Busca `group_invites` por `id`. Não encontrado → 404.
3. Verifica que `invite.invited_user_id === user.id`. Se não, 403.
4. Verifica que `invite.status === 'pending'`. Se já respondido, 409 (mesmo raciocínio do accept).
5. `UPDATE group_invites SET status = 'declined', responded_at = now() WHERE id = invite.id`.
6. Retorna 200.

**Resposta de sucesso (200):**
```json
{ "status": "declined" }
```
**Erros possíveis:**
- 401: não autenticado
- 403: convite não pertence ao usuário autenticado
- 404: convite não encontrado
- 409: convite já foi respondido anteriormente

---

## Frontend — Componentes e Páginas React

### Onde os convites pendentes aparecem

**Decisão de design:** os convites pendentes recebidos pelo usuário aparecem em **dois lugares**, ambos alimentados pelo mesmo endpoint `GET /api/invites/pending`:

1. **Badge no header do dashboard** (`app/(dashboard)/layout.tsx`), ao lado do `GroupSwitcher` — visível em **toda** página do dashboard, não só em `/grupos`, pois o convite pode chegar enquanto o usuário está em `/jogos` ou `/ranking` e não há motivo para esconder essa informação até ele navegar manualmente para `/grupos`. Mostra um contador (ex: `✉ 2 CONVITES`) e linka para `/grupos` (que é onde a lista detalhada vive).
2. **Seção "Convites Recebidos" na página `/grupos`**, acima ou abaixo da lista "Meus Grupos" existente — aqui o usuário vê os detalhes (nome de quem convidou, nome do grupo, data) e os botões ACEITAR/RECUSAR.

Esta combinação resolve o critério de sucesso "o usuário convidado vê o convite pendente dentro do produto (ex: notificação/lista ao acessar `/grupos` ou dashboard)" cobrindo ambas as superfícies citadas como exemplo pelo PM, sem exigir nenhum mecanismo de push: o badge só precisa de um fetch leve no layout (Server Component, executado a cada navegação entre páginas do dashboard — Next.js App Router já busca os dados do layout em cada navegação server-side).

### `app/(dashboard)/layout.tsx` (modificado)

- Além da busca de `groups` já existente, busca a contagem de convites pendentes do usuário: `SELECT count(*) FROM group_invites WHERE invited_user_id = user.id AND status = 'pending'` (via `supabase` server client — RLS já permite, pois a policy `group_invites_select_admin_or_invitee` cobre `invited_user_id = auth.uid()`).
- Se `pendingInvitesCount > 0`, renderiza um badge/link no header, ex:
  ```
  ✉ 2 CONVITES
  ```
  estilizado em `color-accent` (mesma cor de destaque usada no líder do ranking), com `border: 1px solid var(--color-accent)`, levando para `/grupos`.
- Se `pendingInvitesCount === 0`, nada é renderizado nesse espaço (sem badge vazio).

### `components/bolao/PendingInvitesList.tsx` (novo)

**Arquivo:** `components/bolao/PendingInvitesList.tsx`
**Diretiva:** `'use client'`

**Props:**
```ts
interface PendingInvite {
  id: string
  groupId: string
  groupName: string
  invitedByName: string
  createdAt: string // ISO 8601
}

interface PendingInvitesListProps {
  invites: PendingInvite[]
}
```

**Estados:** `idle` (lista renderizada normalmente) | por item: `responding` (botões desabilitados, "..." enquanto aguarda resposta do servidor) | `error` (mensagem inline abaixo do item específico, sem afetar os demais itens da lista).

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  CONVITES RECEBIDOS                                    │
│  ─────────────────────────────────────────────────── │
│  BOLÃO DO TRABALHO                                      │
│  Convidado por HAMON em 16/06/2026                      │
│  [ ✓ ACEITAR ]   [ ✗ RECUSAR ]                          │
│  ─────────────────────────────────────────────────── │
└──────────────────────────────────────────────────────┘
```
- Renderizado apenas se `invites.length > 0` (a seção inteira desaparece quando não há convites pendentes — não exibir "nenhum convite pendente" como estado vazio permanente, para não ocupar espaço desnecessário na tela mais visitada do fluxo de grupos).
- Botão "✓ ACEITAR" (estilo CTA primário, `Button variant="primary"`) → `POST /api/invites/[id]/accept`. Em sucesso, remove o item da lista local (otimista, sem precisar recarregar a página inteira) e usa `router.push('/jogos?group=' + data.group_id)` OU, se o usuário preferir continuar vendo outros convites, apenas remove da lista e mostra uma confirmação inline "✓ Você entrou em BOLÃO DO TRABALHO" por 2 segundos antes do redirect — **decisão: redireciona imediatamente para `/jogos?group=<id>`**, consistente com o comportamento já existente em `JoinGroupButton.tsx` (mesmo padrão usado para entrada via link).
- Botão "✗ RECUSAR" (estilo `variant="secondary"` com cor de erro, ou um terceiro variant se necessário — ver nota de Button abaixo) → `POST /api/invites/[id]/decline`. Em sucesso, remove o item da lista local sem navegação (o usuário permanece em `/grupos`).
- Erro em qualquer ação (`403`/`404`/`409`/erro de rede): mensagem inline em `color-error` abaixo do item correspondente, ex: "✗ Este convite já foi respondido." — o item permanece na lista (não remove em caso de erro) para o usuário ver o que aconteceu; se o erro for `409` especificamente, vale re-fetch da lista para sincronizar (o convite pode ter sido respondido em outra aba).
- **Nota sobre o componente `Button`:** o `Button` atual (`components/ui/Button.tsx`) tem variants `primary` | `secondary` | `danger`. Usar `variant="primary"` para ACEITAR e `variant="danger"` para RECUSAR (reaproveita o variant já existente, sem precisar adicionar um quarto variant).

### `app/(dashboard)/grupos/page.tsx` (modificado)

- Server Component: além da query de `groups` já existente, busca os convites pendentes do usuário via query direta equivalente ao RPC de `GET /api/invites/pending` (mesmo JOIN: `group_invites JOIN groups JOIN profiles`, filtrado por `invited_user_id = user.id AND status = 'pending'`, via `supabase` server client autenticado — RLS já cobre).
- Renderiza `<PendingInvitesList invites={pendingInvites} />` **acima** da seção "MEUS GRUPOS" existente, quando `pendingInvites.length > 0` — convites pendentes são a informação mais urgente/actionable da tela, então ficam no topo.
- Nenhuma mudança na lista "Meus Grupos" e no botão "CRIAR NOVO GRUPO" já existentes.

### `app/(dashboard)/grupos/[id]/page.tsx` (modificado)

Nova seção, visível **somente quando `role === 'admin'`**, abaixo da seção de link de convite já existente e acima (ou abaixo) da lista de participantes:

**Layout (visão admin):**
```
┌──────────────────────────────────────────────────────┐
│  CONVIDAR PARTICIPANTE                                  │
│  ─────────────────────────────────────────────────── │
│  [ Buscar por nome ou e-mail...            ]            │
│  ─────────────────────────────────────────────────── │
│  MARIA SILVA                      [ + CONVIDAR ]        │
│  JOÃO PEDRO                       JÁ CONVIDADO           │
│  ─────────────────────────────────────────────────── │
│  CONVITES ENVIADOS                                       │
│  • MARIA SILVA          PENDENTE     16/06 12:00         │
│  • CARLA SOUZA           ACEITO       15/06 18:30         │
│  • PEDRO ALVES          RECUSADO     14/06 09:00         │
└──────────────────────────────────────────────────────┘
```

- Composto por dois componentes novos client-side: `InviteUserSearch` (busca + botão convidar) e a lista de convites enviados (pode ser renderizada inline no Server Component, já que é só leitura — não precisa de interatividade própria além do que `InviteUserSearch` já dispara).
- A lista "CONVITES ENVIADOS" é buscada no próprio Server Component da página (`GET /api/groups/[id]/invites` equivalente via query direta — admin já está autenticado e a policy de RLS permite, mas como o Server Component usa o client autenticado do usuário, não o `service_role`, a policy `group_invites_select_admin_or_invitee` cobre exatamente esse caso: `is_group_admin(group_id, auth.uid())`).
- Cores de status: `PENDENTE` em `color-muted`, `ACEITO` em `color-win`, `RECUSADO` em `color-error` — consistente com o uso dessas cores em outras telas do projeto (ex: `color-win` para acertos em "Pontuação por Jogo").

### `components/bolao/InviteUserSearch.tsx` (novo)

**Arquivo:** `components/bolao/InviteUserSearch.tsx`
**Diretiva:** `'use client'`

**Props:**
```ts
interface InviteUserSearchProps {
  groupId: string
}
```

**Estados:** `idle` (input vazio ou < 2 caracteres, sem busca disparada) | `searching` (debounce ativo, aguardando resposta) | `results` (lista de candidatos exibida) | `empty` ("Nenhum usuário encontrado.") | `error` (erro de busca).

**Comportamento:**
- Input de texto único, placeholder "BUSCAR POR NOME OU E-MAIL...".
- Debounce de 400ms antes de disparar `GET /api/groups/${groupId}/invites/search-users?q=${query}` — evita um request por tecla digitada.
- Busca não dispara com menos de 2 caracteres (mesma regra do backend, replicada no client para feedback imediato sem round-trip).
- Cada resultado é uma linha com o nome do usuário e:
  - Se `already_invited === false`: botão "+ CONVIDAR" (`Button variant="primary"`, tamanho compacto) → `POST /api/groups/${groupId}/invites` com `{ invited_user_id: result.id }`.
    - Em sucesso com `status: 'created'`: substitui o botão por um indicativo "✓ CONVIDADO" (`color-win`) por 2 segundos, depois remove o item da lista de resultados (ou marca `already_invited: true` localmente, sem novo fetch).
    - Em sucesso com `status: 'already_member'`: exibe mensagem inline "Este usuário já participa do grupo." (`color-muted`) no lugar do botão, sem erro — é um caminho de sucesso informativo.
    - Em sucesso com `status: 'already_pending'`: exibe "Convite já enviado e pendente." (`color-muted`), mesmo tratamento visual de `already_invited: true`.
  - Se `already_invited === true` (vindo já marcado pela busca): exibe "JÁ CONVIDADO" (`color-muted`) em vez do botão, sem necessidade de tentar de novo — mas se o usuário insistir (não há bloqueio de UI contra um clique impossível, já que o botão simplesmente não existe nesse estado), o backend trataria como `already_pending` de qualquer forma.
- Erro de rede/servidor (`403`/`422`/`500`): mensagem em `color-error` abaixo do input, sem remover os resultados já exibidos.

### Componentes/páginas reutilizados sem alteração

- `CopyInviteLink.tsx`, `JoinGroupButton.tsx`, `app/convite/[token]/page.tsx`, `app/api/groups/resolve-invite/route.ts`, `app/api/groups/join/route.ts` — **nenhuma mudança**. O fluxo de link reutilizável continua exatamente como entregue em `grupos`.
- `GroupSwitcher.tsx` — nenhuma mudança funcional; apenas passa a coexistir no header com o novo badge de convites pendentes (ajuste de layout/`flexWrap`, sem mudança de lógica).

### Tipos novos

**Arquivo:** `lib/types/group-invite.ts`
```ts
export type GroupInviteStatus = 'pending' | 'accepted' | 'declined'

export interface GroupInviteSent {
  id: string
  invitedUserId: string
  invitedUserName: string
  status: GroupInviteStatus
  createdAt: string
  respondedAt: string | null
}

export interface PendingInviteReceived {
  id: string
  groupId: string
  groupName: string
  invitedByName: string
  createdAt: string
}

export interface UserSearchResult {
  id: string
  name: string
  alreadyInvited: boolean
}
```

---

## Regras de Negócio

1. **Quem pode convidar:** somente o `admin` de um grupo pode criar convites nominais para aquele grupo. Validado tanto via RLS (a leitura de `group_invites` por um não-admin que não seja o destinatário falha) quanto via checagem explícita no Route Handler (`403` se `role !== 'admin'`).

2. **Quem pode ser convidado:** qualquer usuário com `profile` existente no sistema, **exceto** quem já é membro do grupo (filtrado na busca via `search_users_to_invite`, e tratado de forma idempotente mesmo que o filtro seja contornado — ver regra 4).

3. **Um convite pendente por par (grupo, usuário):** garantido pelo índice único parcial `group_invites_unique_pending`. Nunca existem dois convites `pending` simultâneos para o mesmo destinatário no mesmo grupo.

4. **Idempotência ao convidar:**
   - Convidar quem **já é membro** do grupo → resposta de sucesso `200 { status: 'already_member' }`, sem criar linha em `group_invites`, sem erro.
   - Repetir o convite para quem **já tem convite pendente** → resposta de sucesso `200 { status: 'already_pending' }`, sem duplicar a linha, sem erro.
   - Convidar quem **já recusou antes** (`declined`) ou **já aceitou e depois saiu do grupo** (não há fluxo de saída nesta feature nem em `grupos`, mas o registro `accepted` antigo não bloqueia nada) → permitido, cria um novo convite `pending` normalmente. O histórico antigo (`declined`/`accepted`) não é alterado nem removido; apenas uma nova linha é inserida.

5. **Recusar não é destrutivo nem final:** um convite `declined` permanece como registro histórico (visível na lista "CONVITES ENVIADOS" do admin com o status `RECUSADO`) e **não impede** que o mesmo admin (ou outro, caso existisse múltiplos admins — não é o caso aqui) convide a mesma pessoa de novo no futuro, gerando uma nova linha.

6. **Interação entre convite nominal e link reutilizável:** os dois mecanismos são independentes, mas compartilham o mesmo destino final (`group_members`). Casos de borda:
   - Usuário tem um convite nominal `pending` e entra no grupo via link reutilizável (`POST /api/groups/join`) antes de responder ao convite nominal: a membership é criada normalmente pelo fluxo de `join` (inalterado). O convite nominal `pending` correspondente **fica obsoleto mas não é cancelado automaticamente por esta feature** — ele continuará aparecendo como pendente até que o usuário acesse `/grupos` e clique em ACEITAR ou RECUSAR. Ao clicar ACEITAR nesse estado, o backend (`POST /api/invites/[id]/accept`, passo 5 da lógica) detecta que o usuário já é membro e apenas atualiza o convite para `accepted` sem tentar duplicar a membership — sem erro. Ao clicar RECUSAR, simplesmente marca `declined`, sem efeito sobre a membership já existente (ele continua no grupo; recusar um convite nominal nunca remove alguém de um grupo do qual já é membro). Esse comportamento é aceitável para o tamanho do projeto e evita a complexidade de teria que auto-cancelar convites cruzados — registrado aqui explicitamente para o Programador não tratar como bug.
   - Usuário aceita o convite nominal primeiro, e depois (por engano) tenta usar o link reutilizável do mesmo grupo: o fluxo de `join` já é idempotente (retorna sucesso com `already_member: true`, comportamento inalterado de `grupos`) — nenhuma regressão.

7. **Visibilidade estrita:**
   - Um admin só vê e gerencia (`GET /api/groups/[id]/invites`, `POST /api/groups/[id]/invites`, busca de usuários) convites do(s) grupo(s) em que ele é admin — nunca de outros grupos.
   - Um usuário convidado só vê (`GET /api/invites/pending`) convites endereçados ao seu próprio `user_id` — nunca convites de/para outras pessoas, mesmo dentro do mesmo grupo.
   - Garantido em duas camadas: RLS (`group_invites_select_admin_or_invitee`) para qualquer leitura direta via client Supabase autenticado, e checagem explícita nos Route Handlers que usam `service_role` (que ignora RLS, então a validação de autorização ali é obrigatória em código, não apenas decorativa).

8. **Aceitar/recusar é uma ação única e não-idempotente:** diferente da criação de convite (idempotente por design), responder a um convite já respondido retorna erro `409` explícito — evita que múltiplos cliques ou abas resultem em comportamento ambíguo (ex: aceitar duas vezes não deve gerar dois "ingressos" no grupo nem mascarar uma recusa anterior).

9. **`games`, `predictions`, `scores`, `ranking` — sem nenhuma alteração nesta feature.** Convites nominais afetam exclusivamente `group_members` (no momento da aceitação) e a nova tabela `group_invites`. Nenhuma regra de pontuação, deadline ou cálculo de ranking é tocada.

---

## Proteção de Rotas

- **Rotas existentes, sem mudança de proteção:** `/grupos`, `/grupos/[id]` continuam dentro do grupo `(dashboard)`, protegidas pelo layout existente (`redirect('/login')` se não autenticado).
- **Nenhuma rota nova de página é criada nesta feature** — toda a superfície nova (busca de usuário, lista de convites enviados, lista de convites recebidos) vive dentro das páginas já existentes `/grupos` e `/grupos/[id]`, via novos componentes e seções.
- **Endpoints novos:**
  - `GET /api/groups/[id]/invites/search-users` — requer Bearer JWT + autorização de admin do grupo `[id]`.
  - `POST /api/groups/[id]/invites` — requer Bearer JWT + autorização de admin do grupo `[id]`.
  - `GET /api/groups/[id]/invites` — requer Bearer JWT + autorização de admin do grupo `[id]`.
  - `GET /api/invites/pending` — requer Bearer JWT; sem autorização adicional (sempre escopado ao próprio usuário).
  - `POST /api/invites/[id]/accept` — requer Bearer JWT + autorização: usuário deve ser o destinatário do convite.
  - `POST /api/invites/[id]/decline` — requer Bearer JWT + autorização: usuário deve ser o destinatário do convite.
- **Endpoints existentes, sem alteração:** `POST /api/groups`, `GET /api/groups`, `GET /api/groups/[id]`, `GET /api/groups/resolve-invite`, `POST /api/groups/join`, todos os endpoints de `predictions`/`ranking`.

---

## Integração Supabase Realtime

Esta feature **não introduz nenhum canal Realtime novo**. Justificativa: convites nominais são uma interação de baixa frequência (um admin convida ocasionalmente, um usuário responde ocasionalmente) — diferente de placares/pontuação que mudam durante um jogo ao vivo e justificam Realtime. A lista de convites pendentes é recarregada a cada navegação entre páginas do dashboard (o layout é um Server Component, buscado a cada transição de rota no App Router), o que é suficiente para o caso de uso: se um admin convida alguém enquanto esse alguém está com o app aberto em outra aba, o convite aparece na próxima navegação dessa pessoa, não instantaneamente — comportamento aceitável e consistente com a ausência de Realtime em `groups`/`group_members` desde a feature `grupos` (mesma decisão já tomada e documentada lá).

Se no futuro o produto quiser notificação instantânea de convites, isso ficaria registrado como sugestão para uma feature futura (ex: canal `postgres_changes` em `group_invites` filtrado por `invited_user_id=eq.<user_id>`), fora do escopo desta entrega.

---

## Critérios de Aceite

- [ ] Admin de um grupo consegue buscar um usuário cadastrado por nome ou e-mail via `GET /api/groups/[id]/invites/search-users?q=...`, sem que o e-mail de nenhum usuário seja exposto no payload de resposta.
- [ ] Admin consegue criar um convite nominal via `POST /api/groups/[id]/invites` informando `invited_user_id`; o convite é criado com `status = 'pending'`.
- [ ] Convite nominal pendente aparece na lista "CONVITES ENVIADOS" da tela `/grupos/[id]`, visível somente ao admin daquele grupo, com nome do convidado, data e status.
- [ ] Usuário não-admin de um grupo não consegue criar convites nem visualizar a lista de convites enviados daquele grupo (`403` em ambos os endpoints).
- [ ] Usuário convidado vê o convite pendente em `/grupos` (seção "Convites Recebidos") e no badge do header do dashboard, em qualquer página.
- [ ] Usuário convidado consegue aceitar (`POST /api/invites/[id]/accept`) e passa a constar em `group_members` com `role = 'member'`; o convite passa para `status = 'accepted'`.
- [ ] Usuário convidado consegue recusar (`POST /api/invites/[id]/decline`); o convite passa para `status = 'declined'`, sem nenhuma alteração em `group_members`.
- [ ] Convidar um usuário que já é membro do grupo retorna `200 { status: 'already_member' }`, sem criar nova linha em `group_invites` e sem erro confuso na UI.
- [ ] Repetir o convite para a mesma pessoa enquanto o convite anterior está `pending` retorna `200 { status: 'already_pending' }`, sem duplicar a linha em `group_invites` (validado também no nível do banco pelo índice único parcial `group_invites_unique_pending`).
- [ ] Convidar novamente alguém que já recusou um convite anterior (`declined`) funciona normalmente, criando uma nova linha `pending` — recusar não bloqueia convites futuros.
- [ ] Responder (aceitar ou recusar) um convite já respondido anteriormente retorna `409`, sem efeito colateral duplicado.
- [ ] Usuário só vê (via UI e via API) convites pendentes endereçados a ele mesmo — tentar acessar/responder um convite de outro usuário retorna `403`.
- [ ] Admin só vê/gerencia convites do(s) grupo(s) em que é admin — tentar acessar convites de outro grupo (do qual não é admin) retorna `403`.
- [ ] Mecanismo de convite por link reutilizável (`/convite/[token]`, `resolve-invite`, `join`) continua funcionando sem nenhuma regressão — validado manualmente entrando em um grupo via link após esta feature.
- [ ] Nenhuma alteração de comportamento em `predictions`, `scores`, `ranking`, regras de pontuação ou deadline de palpite.
- [ ] Design segue DESIGN.md rigorosamente: paleta verde/amarelo/azul, fonte monospace (JetBrains Mono), estilo Elifoot denso, dark only, sem ícones decorativos (uso de `✓`, `✗`, `✉`, `+`, `•` como nas demais telas), sem sombras, bordas simples 1px.
- [ ] Funciona em mobile (coluna única) nas seções novas de `/grupos` e `/grupos/[id]`, incluindo o badge de convites pendentes no header (mesmo padrão `flexWrap: wrap` já usado).
- [ ] `npm run lint` e `npm run build` executados com sucesso após todas as mudanças.
- [ ] Interface 100% em português brasileiro em todos os textos novos.
