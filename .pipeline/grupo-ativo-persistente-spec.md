# Spec: Seleção Persistente de Grupo Ativo

**Slug:** grupo-ativo-persistente
**Data:** 2026-06-16
**Status:** spec

---

## Objetivo

Fazer a seleção do "grupo ativo" ocorrer **exclusivamente** na área/aba "Grupos" e persistir em todas as páginas do dashboard (Jogos, Ranking, Palpites e demais) até que o usuário a altere ativamente de novo, ali na área de Grupos — eliminando a regressão atual em que clicar em outra aba do menu (`NavLinks`) perde o `?group=` da URL e força `resolveActiveGroup()` a recalcular para o primeiro grupo por `joined_at ASC`.

O mecanismo de persistência passa a ser um **cookie** (não httpOnly, escrito por um Route Handler dedicado), lido por `resolveActiveGroup()` e por `app/(dashboard)/layout.tsx`. O `?group=` na URL deixa de ser a fonte de verdade da navegação cotidiana, mas continua funcionando como **override pontual** (deep link), sem quebrar links salvos/compartilhados que já incluem o parâmetro.

A troca de grupo passa a ser uma ação explícita feita dentro de `/grupos` (lista) ou `/grupos/[id]` (detalhes) — não mais um dropdown solto no header desconectado da navegação. O `GroupSwitcher` atual no header é **removido**.

---

## Histórias de Usuário

- Como usuário com múltiplos grupos, quero escolher meu grupo ativo na tela "Grupos", para que todas as outras telas do dashboard passem a refletir aquele grupo sem que eu precise selecioná-lo de novo em cada uma.
- Como usuário, quero que o grupo ativo permaneça o mesmo ao navegar entre Jogos, Ranking e Palpites pelo menu, para não perder contexto nem ver dados de um grupo diferente por engano.
- Como usuário, quero que o grupo ativo continue o mesmo depois de recarregar a página ou fechar e abrir o navegador, para não ter que reconfigurar minha navegação a cada sessão.
- Como usuário, quero que o grupo ativo só mude quando eu de fato escolher outro, explicitamente, na tela de Grupos — nunca como efeito colateral de eu simplesmente navegar entre abas.
- Como usuário que recebeu um link direto para um grupo específico (ex: `/jogos?group=<id>`), quero que esse link funcione e mostre aquele grupo mesmo que ele não seja meu grupo ativo salvo, para que links compartilhados continuem confiáveis.
- Como usuário sem nenhum grupo, quero continuar sendo redirecionado para `/grupos` ao acessar qualquer página do dashboard, exatamente como hoje.

---

## Modelo de Dados

Esta feature **não introduz nem altera nenhuma tabela** do Supabase. Não há migration SQL nesta feature.

O único "estado persistente" novo é um **cookie HTTP** no navegador do usuário (não armazenado no banco):

| Nome do cookie | Valor | Atributos |
|---|---|---|
| `bolao_active_group` | `group_id` (uuid, string) | `Path=/`, `SameSite=Lax`, `Secure` (em produção, condicional a HTTPS), `Max-Age=31536000` (1 ano), **sem `HttpOnly`** (ver justificativa abaixo) |

**Por que não `HttpOnly`:** o cookie só guarda um `group_id` (um UUID que o próprio usuário já vê e manipula livremente na URL como `?group=`) — não é um dado sensível como um token de sessão. Não-`HttpOnly` simplifica eventuais leituras client-side futuras (não há necessidade nesta feature, mas não há motivo de segurança para restringir). A validação de que o `group_id` lido do cookie corresponde a um grupo do qual o usuário é de fato membro **sempre** acontece no servidor (em `resolveActiveGroup()`), então um valor de cookie adulterado manualmente pelo usuário no DevTools não representa risco de acesso indevido — na pior hipótese, ele veria o fallback para o primeiro grupo (ver "Cookie inválido/órfão" nas Regras de Negócio).

**Por que cookie e não localStorage:** `resolveActiveGroup()` e `DashboardLayout` são Server Components / funções server-side que precisam ler o grupo ativo durante o render no servidor, antes de qualquer JavaScript client-side executar. `localStorage` não é acessível em Server Components nem em Route Handlers — exigiria um primeiro render "vazio"/client-only para depois ler o valor e redirecionar, gerando flash de conteúdo incorreto (mostraria o grupo errado por um instante) ou exigiria envolver todo o dashboard em um Client Component, contrariando a arquitetura Server Component já estabelecida pela feature `grupos`. Cookie é lido nativamente em todo request HTTP (via `next/headers` `cookies()`), de forma síncrona em relação à navegação, sem flash e sem reestruturar a árvore de componentes existente.

**Por que não estado server-side em tabela própria:** persistir "grupo ativo do usuário" como coluna em `profiles` (ex: `profiles.active_group_id`) foi considerado e descartado para esta feature — exigiria uma migration, uma policy de RLS adicional, e um endpoint de escrita, para resolver exatamente o mesmo problema que um cookie resolve sem nenhuma mudança de schema. Cookie é proporcional ao escopo do problema (preferência de navegação efêmera, não um dado de domínio do bolão) and reduz a superfície de mudança. Caso uma necessidade futura legítima apareça (ex: "ver de outro dispositivo qual era meu último grupo ativo"), isso pode ser revisitado — fora de escopo aqui.

---

## Mecanismo de Resolução do Grupo Ativo (núcleo da feature)

### Nova ordem de prioridade em `resolveActiveGroup()`

A função `resolveActiveGroup(supabase, userId, groupParam, pathname, extraParams, cookieGroupId)` passa a receber um **sexto parâmetro opcional**, `cookieGroupId: string | undefined`, lido pelo chamador (cada `page.tsx`) a partir do cookie `bolao_active_group`. A nova ordem de resolução é:

1. **`groupParam` (query `?group=`) tem prioridade absoluta sobre o cookie quando presente.** Isso preserva deep links (notificação, link compartilhado, favorito salvo) — se alguém abre `/jogos?group=X`, a página deve mostrar o grupo X mesmo que o cookie aponte para outro grupo Y, **desde que o usuário seja membro de X** (senão cai no comportamento de erro já existente, ver abaixo). Esse comportamento já existe hoje (era o único modo) e não muda.

2. **Se `groupParam` ausente, mas `cookieGroupId` presente e válido (usuário é membro daquele grupo):** usa o `cookieGroupId` como grupo ativo. **Não redireciona** para anexar `?group=` na URL (diferença importante em relação ao comportamento anterior) — a página renderiza diretamente com esse `groupId`, mantendo a URL "limpa" (sem `?group=`) para que a navegação pelo menu (`NavLinks`, que aponta para paths nus) continue funcionando exatamente como persistência implícita: cada página relê o cookie e resolve o mesmo grupo, sem depender da URL carregar o parâmetro.

3. **Se `groupParam` ausente E `cookieGroupId` ausente, ou `cookieGroupId` presente mas inválido (usuário não é mais membro daquele grupo — ex: saiu do grupo, ou cookie corrompido/adulterado):** cai no fallback já existente — busca o primeiro grupo do usuário por `joined_at ASC`. Nesse fallback, a função:
   - Se o usuário tem ao menos um grupo: define esse grupo como ativo **e grava o cookie** `bolao_active_group` apontando para ele (auto-cura: a próxima navegação já usa o cookie corrigido, sem precisar repetir o fallback). Como `resolveActiveGroup()` roda dentro de Server Components (que não podem escrever cookies de forma garantida, ver `lib/supabase/server.ts` — `setAll` já é um no-op silencioso em Server Components), a escrita do cookie de auto-cura é feita de forma "best effort" através do mesmo padrão (`cookies().set(...)` dentro de um `try/catch`, igual ao já existente para os cookies de sessão do Supabase) — se falhar silenciosamente, a próxima navegação simplesmente repete o fallback sem causar erro, apenas sem ainda ter "curado" o cookie.
   - Se o usuário não tem nenhum grupo: `redirect('/grupos')`, exatamente como hoje.

4. **Se `groupParam` presente mas o usuário não é membro daquele grupo:** continua retornando `{ error: 'forbidden' }`, exatamente como hoje — **sem** fallback automático para o cookie ou para o primeiro grupo. Mantém o comportamento atual de exibir o estado de erro em vez de mascarar com outro grupo.

### Por que `groupParam` ainda vence o cookie

Se o cookie vencesse o `groupParam`, um deep link compartilhado (`/jogos?group=X`) seria ignorado sempre que o usuário já tivesse um cookie de outro grupo — quebrando o caso de uso de link direto mencionado no contexto do PM. Dar prioridade ao `groupParam` quando presente resolve isso sem ambiguidade: query param explícito = intenção explícita de navegação para aquele grupo específico; ausência de query param = "continue de onde eu estava".

### Resumo em pseudocódigo

```
function resolveActiveGroup(supabase, userId, groupParam, pathname, extraParams, cookieGroupId):
  if groupParam is present:
    membership = checkMembership(groupParam, userId)
    if not membership:
      return { error: 'forbidden' }
    return { groupId: groupParam, groupName: membership.groupName }
    # nota: não regrava cookie aqui — gravar cookie é responsabilidade exclusiva
    # do Route Handler de troca de grupo ativo (ver seção Backend), nunca de uma
    # leitura via deep link. Isso preserva a regra "só muda na área de Grupos".

  if cookieGroupId is present:
    membership = checkMembership(cookieGroupId, userId)
    if membership:
      return { groupId: cookieGroupId, groupName: membership.groupName }
    # cookie órfão/inválido — cai para o fallback abaixo, sem erro visível ao usuário

  # fallback: nem groupParam nem cookie válido
  firstGroup = firstGroupByJoinedAt(userId)
  if not firstGroup:
    redirect('/grupos')
  best_effort_set_cookie('bolao_active_group', firstGroup.id)
  return { groupId: firstGroup.id, groupName: firstGroup.name }
```

### Ponto crítico: deep link via `?group=` NÃO altera o cookie

Para cumprir rigorosamente o critério "a seleção só muda quando o usuário a altera ativamente na área de Grupos", abrir um link `/jogos?group=X` **não** grava `X` como novo grupo ativo no cookie. Isso é intencional: ler um deep link é uma visualização pontual, não uma troca de preferência permanente. Se o usuário quiser que `X` passe a ser seu grupo ativo persistente, precisa ir até `/grupos` e ativá-lo explicitamente ali (ver seção Frontend). Esse comportamento deve ficar destacado no plano do Programador para não ser "corrigido" por engano como se fosse um bug.

---

## Backend — Endpoints Next.js (Route Handlers TypeScript)

Seguindo o padrão real do projeto (`app/api/groups/**/route.ts`, autenticação via Bearer JWT validado com `anonClient.auth.getUser(jwt)`, sem Server Actions no projeto — ver `app/api/groups/route.ts` como referência de auth). Como o objetivo é **escrever um cookie de resposta HTTP**, e cookies só podem ser escritos de forma garantida em Route Handlers (`NextResponse`) ou Server Actions (não usadas neste projeto), a troca de grupo ativo é implementada como um novo Route Handler.

### POST /api/groups/active

**Autenticação:** requerida (Bearer JWT, mesmo padrão de `app/api/groups/route.ts`)
**Body (JSON):**
```json
{ "group_id": "uuid" }
```
**Validação:**
- `group_id`: string presente e formato UUID. Caso contrário, 422 (`invalid_params`).
- Usuário deve ser membro de `group_id` (`service_client.from('group_members').select('id').eq('group_id', groupId).eq('user_id', user.id).maybeSingle()`). Caso contrário, 403 (`forbidden`).

**Lógica:**
1. Autentica o usuário (idêntico a `authenticate(request)` já usado nos demais endpoints de `app/api/groups/**`).
2. Valida `group_id` (formato + membership).
3. Monta a resposta de sucesso com `NextResponse.json(...)` e grava o cookie via `response.cookies.set('bolao_active_group', group_id, { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 })`.
4. Retorna a resposta com o cookie já anexado.

**Resposta de sucesso (200):**
```json
{ "group_id": "uuid", "group_name": "string" }
```
**Erros possíveis:**
- 401: não autenticado
- 422: `group_id` ausente ou não é um UUID válido
- 403: usuário não é membro do grupo informado

**Nota de implementação:** este endpoint é chamado **exclusivamente** pelos componentes client-side descritos na seção Frontend (`AtivarGrupoButton` em `/grupos` e `/grupos/[id]`) — nenhuma outra superfície do produto deve chamá-lo, para preservar a regra de negócio "o grupo ativo só muda na área de Grupos".

---

## Frontend — Componentes React

### Remoção: `app/(dashboard)/group-switcher.tsx` (`GroupSwitcher`)

O componente é **removido por completo**, junto com sua renderização em `app/(dashboard)/layout.tsx`. Justificativa: o `GroupSwitcher` no header é precisamente a UX que a spec do PM pede para eliminar como "fonte de troca" — ele hoje só atualiza `?group=` da página atual (que se perde ao clicar em outro item do menu), e mantê-lo coexistindo com o novo mecanismo de cookie criaria duas fontes de verdade conflitantes (o usuário troca pelo header, a URL muda, mas o cookie não — gerando comportamento inconsistente ao navegar). Não há requisito de manter um atalho secundário; a spec do PM permite explicitamente remover.

### `app/(dashboard)/layout.tsx` (modificado)

- Deixa de importar e renderizar `GroupSwitcher`.
- Continua buscando a lista de grupos do usuário (`group_members` join `groups`) — **mas agora apenas para decidir se exibe o nome do grupo ativo como label estático (não interativo) no header**, e para o caso de lista vazia (CTA "CRIAR/ENTRAR EM UM GRUPO" já existente, sem alteração).
- Lê o cookie `bolao_active_group` via `cookies()` do `next/headers` (já importado indiretamente por `lib/supabase/server.ts`, mas o layout faz sua própria leitura direta: `const activeGroupId = (await cookies()).get('bolao_active_group')?.value`).
- Resolve o nome do grupo ativo a partir da lista já buscada (`groups.find(g => g.id === activeGroupId)`); se não encontrado (cookie órfão) ou ausente, usa `groups[0]` (primeiro por `joined_at`, já que a query já vem ordenada) como melhor esforço apenas para fins de **exibição** no header — esta exibição é estritamente informativa e não escreve cookie nem redireciona (a função `resolveActiveGroup()` em cada página é a única responsável por decidir e persistir o grupo ativo real; o header é só um espelho de leitura).
- Renderiza um elemento estático (não um `<select>`, não clicável) mostrando o nome do grupo ativo, ex: `GRUPO: BOLÃO DA INGRISIA ABJ`, estilizado com os mesmos tokens usados antes no `GroupSwitcher` (monospace, `color-muted` ou `color-text`, uppercase, `font-size: 12px`) — substitui visualmente o dropdown por um indicador somente-leitura. Não é obrigatório ser um link clicável para `/grupos`, mas é recomendado (`<Link href="/grupos">`) para dar ao usuário um caminho óbvio de "para trocar, vá em Grupos" sem precisar de texto explicativo adicional.
- Se a lista de grupos do usuário estiver vazia, mantém o comportamento já existente (CTA "CRIAR/ENTRAR EM UM GRUPO" em vez do indicador de grupo ativo).

### `app/(dashboard)/nav-links.tsx` (sem alteração de comportamento de propagação de `?group=`)

`NavLinks` **continua linkando para paths "nus"** (`/jogos`, `/ranking`, `/meus-palpites`, `/grupos`, `/como-pontuar`), sem nenhuma lógica de preservar `?group=` na navegação. Isso é intencional e é exatamente o que o cookie resolve: como cada página agora lê o cookie via `resolveActiveGroup()` quando `?group=` está ausente, não é mais necessário (nem desejável) que `NavLinks` propague o parâmetro — propagar `?group=` no menu reintroduziria a possibilidade de uma URL "presa" em um grupo antigo depois que o usuário já trocou de grupo ativo em outra aba/sessão. **Nenhuma mudança de código é necessária em `nav-links.tsx`.**

### `app/(dashboard)/grupos/page.tsx` (modificado)

Passa a ser a **fonte de verdade da troca de grupo ativo**. Mudanças:

1. Lê o cookie `bolao_active_group` (Server Component, via `cookies()` de `next/headers`) para saber qual grupo está atualmente ativo.
2. Cada item da lista de grupos passa a exibir:
   - Se aquele grupo é o ativo (`group.id === activeGroupId` lido do cookie, com fallback ao primeiro grupo se o cookie estiver ausente/órfão — mesma lógica de "melhor esforço" do layout): um indicador visual de destaque, ex: seta `►` em `color-accent` à esquerda do nome (consistente com o padrão de "líder" em `color-accent` já usado no Ranking — ver DESIGN.md) e/ou um badge `ATIVO` em `color-accent`.
   - Se não é o grupo ativo: um botão/link "ATIVAR" (estilo `Button` secundário ou link sublinhado, `color-primary`) ao lado do badge de role (`ADMIN`/`MEMBRO`) já existente.
3. O botão "ATIVAR" é o novo componente client-side `AtivarGrupoButton` (ver abaixo) — ao clicar, chama `POST /api/groups/active`, e em sucesso recarrega a página atual (`router.refresh()`) para refletir o novo grupo ativo no destaque da lista e no header.
4. O link de cada item da lista continua levando para `/grupos/[id]` (detalhes) como hoje — o botão "ATIVAR" é um elemento adicional dentro da linha, não substitui a navegação para detalhes. Para não conflitar com o `<Link>` que envolve a linha inteira hoje (ver `app/(dashboard)/grupos/page.tsx` atual, onde cada `<Link>` envolve toda a linha), a estrutura precisa ser ajustada: a linha deixa de ser um único `<Link>` clicável em toda a área e passa a ter o nome do grupo como link para `/grupos/[id]`, com o botão "ATIVAR" como elemento de interação independente (não aninhado dentro do `<a>`) — ver estrutura de layout abaixo.

**Layout textual (estado com 2 grupos, o segundo ativo):**
```
┌──────────────────────────────────────────────────────┐
│  MEUS GRUPOS                                          │
│  ─────────────────────────────────────────────────── │
│    BOLÃO DA INGRISIA ABJ    ADMIN   [ATIVAR]          │
│  ► BOLÃO DO TRABALHO        MEMBRO  ATIVO             │
│  ─────────────────────────────────────────────────── │
│  [ + CRIAR NOVO GRUPO ]                                │
└──────────────────────────────────────────────────────┘
```

### `AtivarGrupoButton.tsx` (novo)

**Arquivo:** `components/bolao/AtivarGrupoButton.tsx`
**Diretiva:** `'use client'`
**Props:**
```ts
interface AtivarGrupoButtonProps {
  groupId: string
  groupName: string
}
```
**Estados:** idle | loading | error
**Comportamento:**
- Renderiza um botão "ATIVAR" (estilo `Button` secundário, `color-primary` como borda/texto, fundo transparente — para não competir visualmente com o CTA principal "CRIAR NOVO GRUPO").
- Ao clicar: estado `loading` (texto muda para "ATIVANDO..."), obtém o JWT da sessão atual (`supabase.auth.getSession()`, mesmo padrão já usado por outros componentes client-side do projeto, ex: `InviteUserSearch`/`CreateGroupForm` — confirmar padrão exato lendo um desses componentes antes de implementar), chama `POST /api/groups/active` com `Authorization: Bearer <jwt>` e `{ group_id: groupId }`.
- Em sucesso (200): chama `router.refresh()` (Next.js App Router — revalida os Server Components da página atual sem reload completo) para que a lista em `/grupos` e o header em `layout.tsx` releiam o cookie recém-gravado e exibam o novo estado "ativo" imediatamente.
- Em erro (403/422/500): exibe mensagem inline em `color-error` abaixo do botão ("Não foi possível ativar este grupo — tente novamente."), sem navegação, mantendo o botão "ATIVAR" disponível para nova tentativa.

### `app/(dashboard)/grupos/[id]/page.tsx` (modificado)

Adiciona, no cabeçalho do card de detalhes do grupo (ao lado do badge `ADMIN`/`MEMBRO` já existente), o mesmo mecanismo de ativação:
- Se este grupo (`id` da rota) já é o grupo ativo (comparado contra o cookie lido server-side): exibe um badge somente-leitura `GRUPO ATIVO` em `color-accent`, sem botão.
- Se não é o grupo ativo: exibe o mesmo componente `AtivarGrupoButton` (`groupId={id}`, `groupName={group.name}`), permitindo ativar o grupo diretamente da tela de detalhes — não é necessário voltar para a lista em `/grupos` para ativar um grupo específico que o usuário já abriu.

**Layout textual (visão quando o grupo aberto NÃO é o ativo):**
```
┌──────────────────────────────────────────────────────┐
│  BOLÃO DO TRABALHO                  MEMBRO  [ATIVAR]  │
│  ─────────────────────────────────────────────────── │
│  ...                                                   │
```

**Layout textual (visão quando o grupo aberto JÁ é o ativo):**
```
┌──────────────────────────────────────────────────────┐
│  BOLÃO DO TRABALHO            MEMBRO   GRUPO ATIVO    │
│  ─────────────────────────────────────────────────── │
│  ...                                                   │
```

### Páginas inalteradas na sua estrutura externa (apenas no parâmetro extra de `resolveActiveGroup`)

`app/(dashboard)/jogos/page.tsx`, `app/(dashboard)/ranking/page.tsx`, `app/(dashboard)/meus-palpites/page.tsx`: nenhuma mudança visual ou de query — continuam chamando `resolveActiveGroup(supabase, user.id, params.group, pathname, extraParams)`, mas agora passando o sexto argumento `cookieGroupId` lido localmente:

```ts
const cookieStore = await cookies()
const cookieGroupId = cookieStore.get('bolao_active_group')?.value

const activeGroup = await resolveActiveGroup(
  supabase,
  user.id,
  params.group,
  '/jogos', // ou '/ranking', '/meus-palpites'
  { date: dateParam }, // já existente apenas em jogos
  cookieGroupId
)
```

Essa é a única mudança necessária nessas três páginas — toda a lógica de exibição de jogos/ranking/palpites já filtrada por `activeGroupId` permanece exatamente igual.

---

## Regras de Negócio

1. **Fonte de verdade da troca:** o grupo ativo só é alterado através de uma chamada bem-sucedida a `POST /api/groups/active`, disparada exclusivamente pelo componente `AtivarGrupoButton`, presente apenas em `/grupos` e `/grupos/[id]`. Nenhuma outra ação do usuário (navegar pelo menu, abrir um deep link com `?group=`, recarregar a página) grava ou altera o cookie `bolao_active_group` — com a única exceção do mecanismo de auto-cura descrito no item 3.

2. **Prioridade de resolução:** `?group=` na URL (se o usuário for membro) > cookie `bolao_active_group` (se o usuário for membro) > primeiro grupo do usuário por `joined_at ASC` (com gravação best-effort do cookie, auto-cura) > redirect para `/grupos` se o usuário não tiver nenhum grupo.

3. **Cookie órfão/inválido (auto-cura silenciosa):** se o cookie aponta para um `group_id` do qual o usuário não é (mais) membro — por ter saído do grupo ou por adulteração manual — `resolveActiveGroup()` **não** retorna `{ error: 'forbidden' }` neste caso (esse erro é reservado exclusivamente para quando o `groupParam` da URL é inválido, ou seja, uma tentativa explícita e visível de acessar um grupo específico). Em vez disso, o cookie inválido é silenciosamente ignorado e o fluxo cai no fallback do primeiro grupo, regravando o cookie com um valor válido. O usuário não vê nenhuma mensagem de erro nesse caso — a experiência é a mesma de quem nunca teve cookie.

4. **Deep link não persiste:** acessar `/jogos?group=X` exibe o grupo X durante aquela navegação (se o usuário for membro), mas **não** sobrescreve o cookie `bolao_active_group`. Se o usuário navegar em seguida para `/ranking` (sem `?group=` no link do menu), verá novamente o grupo do cookie (que pode ser diferente de X), não o grupo X do deep link. Esse comportamento é a aplicação direta da regra "só muda na área de Grupos" — um deep link é uma visualização avulsa, não uma preferência.

5. **`?group=` inválido continua sendo erro visível:** se `groupParam` está presente na URL mas o usuário não é membro daquele grupo, a página renderiza o estado de erro "VOCÊ NÃO PARTICIPA DESTE GRUPO" (`{ error: 'forbidden' }`), exatamente como hoje — esse comportamento não muda.

6. **Idempotência da ativação:** chamar `POST /api/groups/active` com um `group_id` que já é o grupo ativo é uma operação válida e idempotente (regrava o mesmo valor do cookie, renovando o `Max-Age`) — não é tratada como erro nem precisa de tratamento especial no backend.

7. **Migração suave para usuários com `?group=` salvo (favoritos):** nenhuma ação de migração de dados é necessária. Um usuário que tenha um link favoritado como `/jogos?group=X` continua funcionando exatamente como hoje (prioridade 1 da resolução) — o comportamento só muda para navegações **sem** `?group=` explícito (cliques no menu), que é justamente o caso que tinha a regressão.

8. **Sem mudança nas regras de pontuação, deadline, RLS ou isolamento por grupo:** esta feature não altera nenhuma regra de negócio de `predictions`, `scores`, `RLS` ou cálculo de pontuação herdadas da feature `grupos` — é estritamente uma mudança de **como o `group_id` ativo é descoberto e lembrado** pelo frontend/Server Components, não de **o que é feito** com esse `group_id` depois de resolvido.

---

## Proteção de Rotas

- Nenhuma rota nova é criada. `/grupos`, `/grupos/[id]`, `/jogos`, `/ranking`, `/meus-palpites` continuam protegidas exatamente como hoje (dentro do grupo `(dashboard)`, que já redireciona para `/login` se não autenticado).
- **Endpoint novo:** `POST /api/groups/active` — requer Bearer JWT (igual aos demais endpoints de `app/api/groups/**`), e adicionalmente valida que o usuário é membro do `group_id` informado antes de gravar o cookie (403 caso contrário).
- O cookie `bolao_active_group` não concede nenhum acesso por si só — ele é apenas uma "lembrança de preferência"; toda leitura de dados de grupo (`predictions`, `scores`, `group_members`, `groups`) continua protegida por RLS e pelas checagens explícitas já existentes em `resolveActiveGroup()` e nos demais Route Handlers, que sempre revalidam membership no momento da leitura, independentemente do que o cookie diz.

---

## Integração Supabase Realtime

Esta feature **não introduz nem altera nenhuma integração Realtime**. Os canais já existentes (`ranking-scores-${groupId}`, `live-points-games-${groupId}`, `game-${gameId}`) continuam recebendo o `groupId` já resolvido por `resolveActiveGroup()` em cada página — a fonte de onde esse `groupId` veio (URL vs. cookie) é transparente para os hooks de Realtime, que não precisam de nenhuma alteração.

---

## Casos de Borda

| Cenário | Comportamento esperado |
|---|---|
| Usuário sem nenhum grupo acessa `/jogos` | Redireciona para `/grupos` (sem cookie gravado) — comportamento já existente, sem alteração. |
| Usuário com 1 grupo acessa `/jogos` (primeira vez, sem cookie) | Resolve para esse único grupo via fallback, grava cookie best-effort. Nenhum redirect de URL ocorre (diferente do comportamento anterior à feature, que fazia `redirect()` para anexar `?group=`). |
| Usuário com cookie válido navega entre Jogos → Ranking → Palpites pelo menu | Mesmo grupo em todas as três telas, sem nenhum redirect, sem `?group=` aparecer na URL. |
| Usuário ativa o grupo B em `/grupos`, depois navega para `/jogos` pelo menu | `/jogos` mostra o grupo B (cookie já atualizado pelo clique em "ATIVAR"). |
| Usuário abre um link salvo `/ranking?group=A` enquanto seu cookie aponta para B | `/ranking` mostra o grupo A (prioridade do `groupParam`); cookie permanece B; ao navegar para `/jogos` pelo menu em seguida, volta a mostrar B. |
| Usuário sai do grupo que está no cookie (fora do escopo desta feature implementar "saída de grupo", mas o cookie pode ficar órfão por outro motivo, ex: dado de teste removido manualmente) | `resolveActiveGroup()` ignora o cookie órfão silenciosamente, cai no fallback do primeiro grupo, regrava o cookie — sem erro visível ao usuário. |
| Usuário sem JavaScript habilitado (caso extremo) | O `AtivarGrupoButton` não funciona (depende de `fetch` client-side) — fora de escopo cobrir progressive enhancement nesta feature; consistente com o restante do app, que já depende de JS para todas as ações de escrita (criar grupo, enviar palpite, etc). |
| `POST /api/groups/active` retorna 403 (usuário deixou de ser membro entre o carregamento da página e o clique) | `AtivarGrupoButton` exibe mensagem de erro inline; cookie não é alterado; usuário permanece no grupo ativo anterior. |

---

## Critérios de Aceite

- [ ] A troca de grupo ativo só é possível através de um botão "ATIVAR" em `/grupos` (lista) e em `/grupos/[id]` (detalhes) — não existe mais nenhum seletor de grupo no header.
- [ ] Após ativar um grupo em `/grupos`, navegar pelo menu (`NavLinks`) para `/jogos`, `/ranking` e `/meus-palpites` exibe consistentemente o mesmo grupo em todas, sem precisar de `?group=` na URL.
- [ ] Navegar entre abas do menu e voltar para uma aba já visitada não troca o grupo ativo sozinho (não há regressão para o primeiro grupo por `joined_at ASC` apenas por causa da navegação).
- [ ] Recarregar a página (F5) em qualquer tela do dashboard mantém o mesmo grupo ativo (persistência via cookie sobrevive a reload).
- [ ] Fechar e reabrir o navegador (nova sessão de navegação, mesma sessão autenticada do Supabase) mantém o grupo ativo definido anteriormente, dentro do `Max-Age` do cookie (1 ano).
- [ ] Um link direto `/jogos?group=<id>` continua funcionando e exibindo o grupo informado, mesmo que seja diferente do grupo ativo salvo no cookie — sem alterar o cookie.
- [ ] Usuário sem nenhum grupo continua sendo redirecionado para `/grupos` ao acessar `/jogos`, `/ranking` ou `/meus-palpites`.
- [ ] `?group=<id>` de um grupo do qual o usuário não é membro continua retornando o estado de erro "VOCÊ NÃO PARTICIPA DESTE GRUPO" (`{ error: 'forbidden' }`), sem fallback silencioso.
- [ ] Um cookie `bolao_active_group` apontando para um grupo do qual o usuário não é mais membro não gera erro visível — o sistema cai no fallback do primeiro grupo e regrava o cookie silenciosamente.
- [ ] `POST /api/groups/active` exige autenticação (401 se ausente) e membership do `group_id` informado (403 se não-membro), e grava o cookie corretamente em caso de sucesso (200).
- [ ] Nenhuma regressão nas regras de pontuação, RLS ou isolamento por grupo herdadas da feature `grupos`.
- [ ] Design segue DESIGN.md rigorosamente nos elementos novos/alterados (`AtivarGrupoButton`, badge `ATIVO`/`GRUPO ATIVO`, indicador de grupo ativo no header): paleta verde/amarelo/azul, fonte monospace, sem ícones decorativos (usar `►` como já padronizado no Ranking), sem sombras, bordas simples.
- [ ] Funciona em mobile (coluna única) — o botão "ATIVAR" e o badge de status não quebram o layout das linhas de `/grupos` e `/grupos/[id]` em telas estreitas.
- [ ] `npm run lint` e `npm run build` executados com sucesso após todas as mudanças.
- [ ] Interface 100% em português brasileiro nos elementos novos.
