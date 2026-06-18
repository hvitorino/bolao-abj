# Fix 1: Palpite para Todos os Grupos

**Slug:** predict-all-groups
**Data:** 2026-06-18
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Botões do PropagatePrompt não empilham em telas < 360px

**Arquivo:** `components/bolao/PropagatePrompt.tsx` (linhas 216–260, bloco de botões no estado `idle`)
**Severidade:** menor
**Descrição:** O critério de aceite da spec exige que os botões "ESTE GRUPO" e "TODOS OS GRUPOS" sejam empilhados verticalmente em telas com largura < 360px. A implementação usa `flex: '1 1 120px'` com `flexWrap: 'wrap'`, o que resulta em empilhamento apenas quando o container interno tem menos de ~248px (120px + 8px de gap + 120px). Em dispositivos com tela de 360px — largura mínima comum de mobile Android — os botões ficam lado a lado, contrariando o critério. O changelog menciona "< ~260px" como ponto de atenção, confirmando o desvio.

**Correção esperada:** Substituir `flex: '1 1 120px'` por `flex: '1 1 140px'` nos dois botões. Com `flexWrap: 'wrap'`, dois botões de 140px + 8px de gap = 288px de conteúdo. Num container de ~336px (360px de tela menos 24px de padding externo típico do GameCard), eles ficam lado a lado. Porém para garantir o empilhamento em < 360px, a solução mais segura é usar `flex: '1 1 calc(50% - 4px)'` com `minWidth: '120px'`. Isso faz cada botão ocupar metade do container disponível, e quando o container for menor que 240px os botões empilham. Alternativamente, adicionar `@media (max-width: 359px)` via uma classe CSS global ou trocar para um container com `flexDirection: column` em telas estreitas via inline style condicional.

A solução mais simples e sem CSS global: mudar o `flex-basis` para um valor que force o empilhamento no breakpoint correto. Com `flex: '1 1 45%'` e `minWidth: '120px'`, cada botão ocupa ~45% do container. Em qualquer tela onde o container seja menor que ~267px (abaixo de ~360px de viewport contando paddings externos), os botões empilham. Isso cobre o critério da spec.

---

## Itens OK (não precisam ser revisados novamente)

- Endpoint `POST /api/predictions/broadcast`: autenticação JWT, validação de params, verificação de deadline global, busca de group_members, loop de UPSERT por grupo — tudo correto e seguro.
- Resposta do endpoint: `{ updated_count: N, results: [...] }` com `status: 'saved' | 'deadline_expired'` por grupo — conforme spec.
- Erros HTTP: 401, 404, 422 (deadline_expired), 422 (invalid_params), 500 — todos implementados conforme spec.
- UPSERT com `onConflict: 'user_id,game_id,group_id'` — idempotente e correto.
- PropagatePrompt: estados `idle`, `loading`, `done`, `error` — implementados conforme spec.
- Auto-fechamento: `done` chama `onChooseAll()` após 2s; `error` chama `onChooseSingle()` após 2s — correto.
- PredictionForm: estado `propagating` adicionado; modo edição preservado sem prompt; regressão zero nas props externas.
- Condição de exibição do PredictionDisplay: `(status === 'idle' || status === 'success')` cobre todos os casos corretos.
- Design: JetBrains Mono, `color-surface`, `color-border`, `color-win`, `color-accent`, `color-muted`, `color-primary`, `color-error` — todos usados corretamente. Sem border-radius, sem ícones SVG.
- Emojis de bandeira via `getTeamFlag` — padrão já estabelecido no `PredictionForm` original e aceito pelo projeto.
- Segurança: sem SQL injection (queries parametrizadas via Supabase client), sem XSS, sem credenciais hardcoded, sem bypass de autenticação.
- `npm run lint`: 2 erros e 5 warnings pré-existentes, nenhum introduzido por esta feature.
- `npm run build`: passa conforme changelog.
- Commits em português com prefixos corretos (`feat`, `chore`).
- Branch correta: `feature/predict-all-groups`.
