# Spec: Cache LocalStorage e Visual Aprimorado do Recap

**Slug:** recap-cache-visual
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Eliminar o delay perceptível no Daily Recap cacheando os dados do `useDailyRecap` no localStorage — exibição instantânea a partir da segunda abertura do bottom sheet — e aumentar o apelo visual do `RecapFooterButton` e do `RecapBottomSheet`, tornando o CTA do rodapé claramente chamativo e a hierarquia visual do bottom sheet mais estruturada.

---

## Histórias de Usuário

- Como participante do bolão, quero que o resumo de ontem apareça instantaneamente ao clicar no botão do rodapé pela segunda vez, sem esperar o carregamento dos dados do Supabase.
- Como participante do bolão, quero que o botão fixo no rodapé chame mais atenção visualmente, para eu não perder o resumo do dia.
- Como participante do bolão, quero que o conteúdo do bottom sheet tenha hierarquia visual clara — badges se destacando, ranking legível e cabeçalho imponente.

---

## Modelo de Dados

### Tabelas novas ou modificadas

Nenhuma. Feature 100% client-side — sem alterações de schema, migrations ou endpoints.

### Chaves do localStorage

| Chave | Formato | Conteúdo | Validade |
|-------|---------|----------|---------|
| `bolao_recap_YYYY-MM-DD` | string `'shown'` | Controla se o modal foi visto hoje (já existente — não alterar) | Expira naturalmente pela chave do dia seguinte |
| `bolao_recap_data_YYYY-MM-DD` | JSON serializado de `DailyRecapData` | Cache dos dados do recap do dia | Expira naturalmente pela chave do dia seguinte |

A data usada nas chaves é a **data atual em BRT** (UTC-3), formato `YYYY-MM-DD`. Ambas as chaves usam a data de hoje (não de ontem) — a chave muda quando a data BRT muda, invalidando automaticamente o cache.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo ou modificado.

---

## Frontend — Componentes React

### 1. `useDailyRecap` — Cache localStorage

**Arquivo:** `lib/hooks/useDailyRecap.ts`

**Mudança:** Adicionar lógica de cache no localStorage dentro da função `load()` do hook.

**Chave de cache:**
```typescript
function getRecapCacheKey(): string {
  const nowUTC = new Date()
  const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const yyyy = nowBRT.getUTCFullYear()
  const mm = String(nowBRT.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(nowBRT.getUTCDate()).padStart(2, '0')
  return `bolao_recap_data_${yyyy}-${mm}-${dd}`
}
```

**Fluxo de cache — ao iniciar `load()`:**

```
1. Computar cacheKey via getRecapCacheKey()
2. Tentar ler localStorage.getItem(cacheKey)
3. Se existir:
   a. Parsear JSON → DailyRecapData
   b. Se parse bem-sucedido:
      - Chamar setData(cached), setHasData(true), setLoading(false) IMEDIATAMENTE
      - Em background (sem bloquear): executar os fetches do Supabase normalmente
      - Ao receber resultado do background fetch:
        - Se cancelado: ignorar
        - Se gamesRaw.length === 0: NÃO sobrescrever o cache nem o state (cache do dia permanece)
        - Se sucesso: salvar novo cache, atualizar setData com dados frescos
      - NÃO chamar setLoading(true) quando há cache (loading já foi resetado para false)
   c. Se parse falhar (JSON corrompido): tratar como cache miss (seguir para passo 4)
4. Se não existir (cache miss):
   a. Executar o fetch original normalmente (setLoading(true) → fetch → setLoading(false))
   b. Ao obter resultado com gamesRaw.length > 0:
      - Salvar no localStorage: localStorage.setItem(cacheKey, JSON.stringify(recap))
   c. Se gamesRaw.length === 0: não salvar cache (dados inexistentes não devem ser cacheados)
```

**Tratamento de erro no parse do JSON:**
```typescript
try {
  const parsed = JSON.parse(raw) as DailyRecapData
  // usar parsed
} catch {
  // cache miss — continuar com fetch normal
}
```

**Comportamento do estado `loading`:**
- Com cache hit: `loading` começa `false` imediatamente — o componente exibe o conteúdo instantaneamente. O fetch em background não altera `loading`.
- Sem cache: comportamento atual preservado (`loading` começa `true`, vai para `false` após fetch).

**Compatibilidade com `RecapController`:** O `RecapController` já depende de `loading === false && hasData === true` para acionar a abertura automática. Com cache, `loading` passa para `false` mais cedo; isso deve funcionar corretamente porque o `decidedRef.current` do `RecapController` evita que o efeito de abertura automática seja disparado duas vezes.

**Sem alterações em:**
- Assinatura pública do hook: `{ data, loading, hasData }` — idêntica.
- Lógica de cálculo de badges, rankings, `getBRTDayBounds`, `getYesterdayLabelBRT`.
- Chave `bolao_recap_YYYY-MM-DD` (controle de "já viu hoje") — pertence ao `RecapController`, não ao hook.

---

### 2. `RecapFooterButton` — Visual Aprimorado

**Arquivo:** `components/bolao/RecapFooterButton.tsx`

**Objetivo:** Tornar o botão visivelmente chamativo — fundo colorido, texto de alto contraste, indicador de novidade animado.

**Mudanças de estilo:**

**Container do botão fixo (wrapper `div`):**
- `backgroundColor`: mudar de `var(--color-surface)` para `var(--color-primary)` — fundo verde Brasil.
- `borderTop`: mudar para `2px solid var(--color-accent)` — borda amarela mais espessa.

**Botão `<button>`:**
- `color`: mudar de `var(--color-muted)` para `var(--color-bg)` — texto preto sobre verde, máximo contraste.
- `backgroundColor`: mudar de `var(--color-surface)` para `transparent` — herda o verde do container.
- `border`: mudar de `1px solid var(--color-border)` para `none` — sem borda no botão em si.
- `fontSize`: aumentar de `12px` para `13px`.
- `padding`: manter `0.625rem 1rem`.

**Indicador de novidade (ponto animado):**
Adicionar um `<span>` interno antes do texto `► RESUMO DE ONTEM`:

```tsx
<span
  style={{
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-accent)',
    marginRight: '0.5rem',
    verticalAlign: 'middle',
    animation: 'blink 1s step-end infinite',
  }}
/>
```

A animação `blink` já existe em `app/globals.css` (usada pelo badge AO VIVO). Reutilizar sem criar nova keyframe.

**Hover:** mudar target do hover — em vez de alterar `color` e `borderColor` no botão, aplicar no container: escurecer `backgroundColor` do container com `var(--color-border)` ou `#007a2e` (verde ligeiramente mais escuro). Como o componente usa inline styles, aplicar via `onMouseEnter`/`onMouseLeave` no elemento `div` container.

**Texto:** manter `► RESUMO DE ONTEM`.

---

### 3. `RecapBottomSheet` — Hierarquia Visual Aprimorada

**Arquivo:** `components/bolao/RecapBottomSheet.tsx`

**Objetivo:** Cabeçalho mais proeminente, badges com mais ênfase, ranking mais legível.

#### 3.1 Cabeçalho

**Antes:** título `RESUMO DO DIA — DD/MM/YYYY` em `color-accent`, `14px bold`.

**Depois:**
- Adicionar uma faixa de cabeçalho com `backgroundColor: 'var(--color-primary)'` ocupando toda a largura do painel (compensar o padding lateral com `margin: -1.25rem -1.5rem 0` e adicionar `padding: 1rem 1.5rem`).
- Título em `color-accent`, `15px bold`, uppercase, `letterSpacing: '0.12em'`.
- Subtítulo com a mensagem lúdica (`OPENING_MSG`) imediatamente abaixo do título, `12px`, `color: 'rgba(240,244,248,0.7)'` (branco levemente opaco sobre o verde).
- Botão fechar (✕) posicionado no canto direito do cabeçalho, sobre o fundo verde: `color: 'rgba(240,244,248,0.7)'`, hover `color: 'var(--color-accent)'`.

```
┌────────────────────────────────────────────────────────┐
│  (fundo color-primary)                                 │
│  RESUMO DO DIA — 18/06/2026                        ✕   │
│  Ontem foi épico. Veja quem se deu bem...              │
└────────────────────────────────────────────────────────┘
```

O `<p style={S.openingMsg}>{OPENING_MSG}</p>` abaixo do cabeçalho original **deve ser removido** — a mensagem migra para dentro do cabeçalho colorido.

#### 3.2 Handle visual

Mover o handle (barra cinza de arrasto) para **antes** do cabeçalho colorido — deve aparecer acima do fundo verde, sobre `var(--color-surface)`.

```
[ handle ]
┌────────────────────────────────────────────────────────┐
│  (fundo color-primary)                                 │
│  RESUMO DO DIA — 18/06/2026                        ✕   │
│  Ontem foi épico...                                    │
└────────────────────────────────────────────────────────┘
```

#### 3.3 Seção de jogos

Sem mudanças no conteúdo. Ajuste visual: adicionar `paddingTop: '0.5rem'` nos itens para aumentar levemente a respiração. Manter o label `JOGOS DE ONTEM` em `color-muted`.

#### 3.4 Seção de ranking

**Label `RANKING DO DIA`:** mudar `color` de `var(--color-muted)` para `var(--color-text)` — tornar mais legível.

**Linha do líder (#1):**
- Toda a linha com `backgroundColor: 'rgba(255, 223, 0, 0.08)'` — leve destaque amarelo.
- Pontos do líder: `fontSize: '15px'`, `fontWeight: 'bold'`, `color: 'var(--color-accent)'`.

**Linha do usuário atual:**
- Se `isCurrentUser && isLeader`: combinar os dois estilos (amarelo prevalece para cor de texto).
- Se `isCurrentUser && !isLeader`: `backgroundColor: 'rgba(0, 156, 59, 0.08)'` — leve destaque verde.

**Separador de header da tabela:**
- Adicionar `borderBottom: '1px solid var(--color-border)'` nos `<th>` — separar cabeçalho do corpo da tabela.

#### 3.5 Seção de badges (DESTAQUES)

**Label `DESTAQUES`:** mudar `color` de `var(--color-muted)` para `var(--color-text)`.

**Cada badge (`badgeBlock`):**
- Adicionar `borderLeft: '2px solid var(--color-primary)'` e `paddingLeft: '0.75rem'` — marcador lateral verde.
- `marginBottom`: aumentar de `0.75rem` para `1rem`.
- `badgeLabel`: aumentar `fontSize` de `11px` para `12px`; mudar `color` de `var(--color-accent)` para `var(--color-primary)` — verde para o rótulo do tipo de badge.
- `badgeRecipient`: aumentar `fontSize` de `13px` para `15px`; `fontWeight: 'bold'`; `color: 'var(--color-accent)'` — nome do premiado em amarelo grande.
- `badgeDesc`: manter `12px`, `color-muted`.

**Exemplo visual de badge:**
```
│▌ CRAQUE DO DIA                                         │
│  FULANO                                                │
│  Fulano dominou o dia com 15 pontos. Respeito.         │
```
(onde `▌` representa o `borderLeft` verde)

#### 3.6 Botão fechar (rodapé)

Sem mudanças. Manter `background: var(--color-primary)`, `color: var(--color-bg)`.

---

## Regras de Negócio

1. **Cache é por (groupId + data BRT atual).** A chave inclui apenas a data, não o `groupId`. Como a feature sempre exibe dados do mesmo grupo ativo da sessão e o `useDailyRecap` recebe `groupId`, o cache é suficientemente específico para o caso de uso (usuário único por navegador). Se o usuário mudar de grupo ativo entre dois acessos no mesmo dia, o cache pode exibir dados do grupo anterior até a sincronização em background terminar — aceitável.

2. **Cache não é salvo se não há jogos.** `localStorage.setItem` só é chamado quando `gamesRaw.length > 0` e a montagem do objeto `DailyRecapData` foi bem-sucedida.

3. **Background sync não gera flash de loading.** Quando há cache, `loading` permanece `false` durante todo o ciclo de vida do background sync. O state `data` é atualizado silenciosamente ao final do background sync via `setData(freshRecap)`.

4. **Abertura automática com cache:** O `RecapController` usa `decidedRef.current` para garantir que a abertura automática ocorra no máximo uma vez por mount. Com cache, `loading` passa para `false` imediatamente — o `useEffect` do `RecapController` será disparado mais cedo, mas o `decidedRef` previne re-execução. Comportamento preservado.

5. **O botão de fechar do bottom sheet (`onClose`) seta `forceOpen = false` no `RecapController`.** Isso não afeta o cache. O cache é para dados — a chave de "já viu hoje" (`bolao_recap_YYYY-MM-DD`) continua gerenciada pelo `RecapController`, sem interação com o novo sistema de cache de dados.

---

## Proteção de Rotas

Nenhuma rota nova. Os componentes existem dentro de `(dashboard)` que já requer autenticação.

---

## Integração Supabase Realtime

Nenhuma. Feature 100% client-side com localStorage.

---

## Critérios de Aceite

- [ ] `lib/hooks/useDailyRecap.ts`: na segunda abertura do bottom sheet (ou reload), `loading` começa em `false` e `data` é populado instantaneamente do cache.
- [ ] A chave de cache segue o padrão `bolao_recap_data_YYYY-MM-DD` (data BRT atual).
- [ ] O cache só é salvo quando há jogos finalizados no dia anterior (`gamesRaw.length > 0`).
- [ ] Após exibir o cache, um fetch em background atualiza os dados silenciosamente sem alterar `loading`.
- [ ] A chave `bolao_recap_YYYY-MM-DD` ("já viu hoje") não é alterada — o `RecapController` continua gerenciando-a independentemente.
- [ ] No dia seguinte, a chave antiga não é usada — o cache é invalidado naturalmente.
- [ ] `RecapFooterButton`: fundo verde (`var(--color-primary)`), borda superior amarela (`2px solid var(--color-accent)`), texto preto sobre verde (`color: var(--color-bg)`), ponto animado (blink) em amarelo antes do texto.
- [ ] `RecapFooterButton`: o hover é aplicado no container e não reverte o estilo base do texto para `color-muted`.
- [ ] `RecapBottomSheet`: cabeçalho tem faixa de fundo `var(--color-primary)` com título e mensagem lúdica integrados.
- [ ] `RecapBottomSheet`: a mensagem lúdica não aparece mais fora do cabeçalho (removida do corpo).
- [ ] `RecapBottomSheet`: handle de arrasto renderiza acima da faixa do cabeçalho.
- [ ] `RecapBottomSheet`: label `RANKING DO DIA` em `color-text`; linha do líder com leve fundo amarelo; linha do usuário atual com leve fundo verde.
- [ ] `RecapBottomSheet`: badges com `borderLeft` verde, nome do premiado em `color-accent` (amarelo), `15px bold`.
- [ ] Visual segue DESIGN.md: fonte JetBrains Mono, sem border-radius excessivo, sem ícones decorativos, estilo denso.
- [ ] `npm run build` e `npm run lint` passam sem erros novos introduzidos por esta feature.
