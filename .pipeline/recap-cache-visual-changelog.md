# Changelog: Cache LocalStorage e Visual Aprimorado do Recap

**Slug:** recap-cache-visual
**Branch:** feature/recap-cache-visual
**Data:** 2026-06-19
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Ruby/Sinatra)

Nenhuma alteração — feature 100% client-side.

### Frontend (Next.js/React)

- `lib/hooks/useDailyRecap.ts` — Adicionada função `getRecapCacheKey()` que gera chave `bolao_recap_data_YYYY-MM-DD` baseada na data BRT atual. A função `load()` foi refatorada: extrai o fetch do Supabase para `fetchFromSupabase()` reutilizável, implementa cache hit (exibe instantaneamente + background sync silencioso), cache miss (fetch normal com loading indicator), e salva no localStorage somente quando há jogos (`games.length > 0`). A assinatura pública `{ data, loading, hasData }` permanece idêntica.

- `components/bolao/RecapFooterButton.tsx` — Container fixo agora usa `backgroundColor: var(--color-primary)` (verde) e `borderTop: 2px solid var(--color-accent)` (amarelo). Botão com `color: var(--color-bg)` (preto para máximo contraste), `backgroundColor: transparent`, sem borda, `fontSize: 13px`. Ponto animado (`<span>` 7×7px amarelo) com `animation: blink 1s step-end infinite` antes do texto `► RESUMO DE ONTEM`. Hover gerenciado via `useState` no container (`onMouseEnter`/`onMouseLeave`), alterando para `#007a2e` (verde mais escuro) — não reverte cor do texto.

- `components/bolao/RecapBottomSheet.tsx` — Handle de arrasto renderiza antes do cabeçalho colorido. Faixa de cabeçalho com `backgroundColor: var(--color-primary)`, margem negativa compensando o padding do painel (`margin: -1.25rem -1.5rem 0`), título em `color-accent` 15px bold com `letterSpacing: 0.12em`, mensagem lúdica (`OPENING_MSG`) integrada no cabeçalho como subtítulo `rgba(240,244,248,0.7)`. `<p style={S.openingMsg}>` removido do corpo. Botão ✕ no canto direito do cabeçalho com hover amarelo gerenciado via `useState`. Labels `RANKING DO DIA` e `DESTAQUES` em `color-text`. Label `JOGOS DE ONTEM` mantido em `color-muted`. `<th>` com `borderBottom: 1px solid var(--color-border)`. Linha líder com `backgroundColor: rgba(255,223,0,0.08)`; linha usuário atual (não líder) com `rgba(0,156,59,0.08)`. Pontos do líder: 15px bold color-accent. Badges com `borderLeft: 2px solid var(--color-primary)` e `paddingLeft: 0.75rem`; `badgeLabel` em `color-primary` 12px; `badgeRecipient` em `color-accent` 15px bold; `marginBottom: 1rem`.

### Banco de Dados

Nenhuma alteração de schema.

### CSS

- `app/globals.css` — Adicionado `@keyframes blink` (`0%/100% opacity:1`, `50% opacity:0`) reutilizável pelo ponto animado do `RecapFooterButton` e futuramente por outros componentes que precisem do efeito de piscar.

---

## Decisões técnicas

**Extração de `fetchFromSupabase()`:** O fluxo de cache exige executar o fetch do Supabase tanto no background (após cache hit) quanto como path principal (cache miss). Extrair a lógica para uma função interna separada evitou duplicação e manteve cada path de execução limpo.

**Background sync sem `loading`:** A spec exige que o background sync não altere `loading`. Isso é garantido porque após um cache hit, `setLoading(false)` é chamado imediatamente antes de disparar o fetch em background, e o resultado do background atualiza apenas `setData()` — nunca `setLoading`.

**Cancelamento no background sync:** O guard `if (cancelled) return` após o `await fetchFromSupabase()` protege contra race conditions quando o componente é desmontado durante o background sync.

**Hover no container via `useState`:** A spec pede hover no container (não no botão). Como o componente usa inline styles, a transição de cor do container é implementada com `useState(hovered)` e `onMouseEnter`/`onMouseLeave` no `<div>` container, evitando CSS classes.

**`blink` com `step-end`:** Mantém consistência com o badge `AO VIVO` (que usa o mesmo padrão conforme DESIGN.md), embora a keyframe não existisse ainda. A keyframe foi criada como `opacity: 0/1` em vez de `visibility` para compatibilidade universal.

---

## Pontos de atenção para o Revisor

1. **Cache key usa data BRT de hoje, não de ontem** — isso é correto conforme spec (a chave muda quando a data BRT muda, invalidando o cache do dia anterior). O cache armazena dados computados sobre ontem, identificados pela data BRT de hoje.

2. **`fetchFromSupabase()` retorna `null` tanto em erro quanto em `gamesRaw.length === 0`** — o caller distingue os dois casos indiretamente (se `null` após cache miss, exibe sem dados; se `null` após cache hit, mantém o cache exibido). Isso é o comportamento correto conforme spec.

3. **Erros de lint pré-existentes** — `npm run lint` retorna 2 erros em `group-switcher.tsx` e `GroupChatWidget.tsx` que já existiam na main antes desta feature. Esta feature não introduziu novos erros.

4. **`RecapBottomSheet`: `sectionLabel` de "JOGOS DE ONTEM"** — a spec diz para alterar `RANKING DO DIA` e `DESTAQUES` para `color-text`, mas não altera `JOGOS DE ONTEM`. O label de jogos foi mantido em `color-muted` conforme o objeto `S.sectionLabel` original (a spec só especifica mudança nos outros dois). O objeto `S.sectionLabel` foi atualizado para `color-text` e o label de jogos usa um override `{ ...S.sectionLabel, color: 'var(--color-muted)' }`.

5. **Compatibilidade com `RecapController`** — o hook mantém a assinatura pública idêntica; o `RecapController` não precisa ser alterado.

---

## Commits realizados

```
70de048 feat(recap-cache-visual): aprimora hierarquia visual do RecapBottomSheet
76b2bbd feat(recap-cache-visual): atualiza visual do RecapFooterButton — fundo verde, ponto animado
bc34412 feat(recap-cache-visual): implementa cache localStorage em useDailyRecap
87381d8 feat(recap-cache-visual): adiciona keyframe blink em globals.css
230c0c9 chore(recap-cache-visual): adiciona plano de implementação
```
