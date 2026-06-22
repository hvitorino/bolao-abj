# Changelog: Navegação para o Próximo Jogo na Análise

**Slug:** next-game-navigation
**Branch:** feature/next-game-navigation
**Data:** 2026-06-22
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/NextGameLink.tsx` — Client Component que renderiza um `<Link href="/jogos/[nextGameId]/analise">` estilizado como botão de texto. Texto: `PRÓXIMO JOGO ►`. Fonte JetBrains Mono 12px bold uppercase, cor `var(--color-primary)`, sem sublinhado, sem background, sem borda. Recebe `nextGameId: string` como prop.

- `app/(dashboard)/jogos/[gameId]/analise/page.tsx` — Duas alterações:
  1. Query de próximo jogo adicionada ao `Promise.all` existente: `.from('games').select('id').gt('match_date', game.match_date).order('match_date', { ascending: true }).limit(1).maybeSingle()`. Resultado em `nextGame`.
  2. Seção "Botão de voltar" substituída por faixa de navegação com `display: flex; justify-content: space-between; align-items: center`. `BackButton` à esquerda; `<NextGameLink nextGameId={nextGame.id} />` à direita, renderizado apenas quando `nextGame?.id` é truthy.

### Backend (Ruby/Sinatra)
Nenhuma alteração. Feature é puramente de navegação via Server Component.

### Banco de Dados
Nenhuma alteração. Sem migrations, sem novos endpoints, sem alterações de schema.

---

## Decisões técnicas

- **Query no `Promise.all` existente**: a query do próximo jogo foi adicionada ao bloco `Promise.all` que já agrupa as 6 queries paralelas, sem custo adicional de latência — todas as queries disparam em paralelo.
- **`maybeSingle()` em vez de `.single()`**: retorna `null` (não erro) quando não há jogo posterior, eliminando a necessidade de tratamento de erro explícito.
- **Guarda `nextGame?.id`**: o componente só é montado na árvore quando há próximo jogo; não há estado "desabilitado" visível — conforme spec.
- **`NextGameLink` como Client Component**: necessário para que o `<Link>` do Next.js habilite prefetch automático no cliente ao hover, melhorando a percepção de velocidade na navegação sequencial de jogos.
- **Sem hover state adicional no `NextGameLink`**: consistente com `BackButton.tsx`, que também não tem hover state.

---

## Pontos de atenção para o Revisor

- Verificar que a query `.gt('match_date', game.match_date)` funciona corretamente com o tipo `timestamptz` do Supabase — o operador `gt` deve comparar por valor de tempo ISO 8601.
- Confirmar que em mobile (coluna única) os dois elementos da faixa de navegação ficam na mesma linha horizontal sem overflow — o `flex` com `justify-content: space-between` deve funcionar corretamente em telas estreitas pois os textos são curtos.
- Quando `nextGame` é `null` (último jogo), `BackButton` permanece alinhado à esquerda dentro do flex container com `justify-content: space-between` — o lado direito fica vazio sem quebra de layout.
- Os erros de lint reportados são pré-existentes em `HistoryPanel.tsx` e outros arquivos e não foram introduzidos por esta feature.

---

## Commits realizados

```
9ecc9cc feat(next-game-navigation): adiciona query de próximo jogo e faixa de navegação na AnalisePage
93e08c5 feat(next-game-navigation): cria componente NextGameLink com link para próximo jogo na análise
45092a7 chore(next-game-navigation): adiciona plano de implementação
```
