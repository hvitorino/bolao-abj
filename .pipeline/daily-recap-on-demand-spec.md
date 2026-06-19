# Spec: Resumo Diário sob Demanda

**Slug:** daily-recap-on-demand
**Data:** 2026-06-19
**Status:** spec

---

## Objetivo

Adicionar um ponto de entrada na navegação do dashboard que permite ao usuário reabrir o `DailyRecapModal` manualmente a qualquer momento, independentemente de já ter sido exibido automaticamente hoje. O modal reaproveita o componente existente sem modificação. O ponto de entrada fica oculto quando não há jogos finalizados no dia anterior.

---

## Histórias de Usuário

- Como participante do bolão, quero abrir o resumo do dia anterior a qualquer momento para rever quem marcou pontos e quais foram os resultados.
- Como participante do bolão, quero que o botão para abrir o resumo só apareça quando houver dados do dia anterior, para não clicar em algo vazio.
- Como participante do bolão, quero que o comportamento automático do modal (aparecer no primeiro acesso do dia) continue funcionando normalmente.

---

## Modelo de Dados

Nenhuma tabela nova ou migration necessária. A feature é 100% frontend.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint novo. As queries já existem no hook `useDailyRecap`.

---

## Frontend — Componentes React

### Análise do componente existente

O `DailyRecapModal` atual gerencia seu próprio estado de abertura (`isOpen`) internamente via `useState`. A lógica de abertura automática está num `useEffect` que verifica o `localStorage` e, se o modal já foi exibido hoje, não abre — gravando sempre a chave independentemente de ter dados.

Para suporte sob demanda, o componente precisa ser refatorado para aceitar controle externo do estado de abertura, sem quebrar o comportamento automático.

---

### DailyRecapModal (refatoração)

**Arquivo:** `components/bolao/DailyRecapModal.tsx`

**Interface de props após refatoração:**

```typescript
interface DailyRecapModalProps {
  groupId: string
  currentUserId: string
  forceOpen?: boolean          // quando true, ignora o localStorage e abre imediatamente
  onClose?: () => void         // callback chamado ao fechar — permite o pai redefinir forceOpen
}
```

**Comportamento com `forceOpen`:**

- Quando `forceOpen === true` e `hasData === true` (após loading): abrir o modal imediatamente, ignorando o `localStorage`.
- Quando `forceOpen === false` (ou ausente): comportamento automático original — verificar `localStorage`, abrir apenas no primeiro acesso do dia se `hasData`.
- Ao fechar (via botão FECHAR ou clique no backdrop): chamar `onClose?.()` além de `setIsOpen(false)`.

**Lógica do `useEffect` refatorado (pseudocódigo):**

```
useEffect:
  se loading: return (aguarda dados)
  se decidedRef.current: return (já decidiu nesta montagem)
  decidedRef.current = true

  se forceOpen:
    se hasData: setIsOpen(true) via queueMicrotask
    return  // não gravar localStorage, não verificar chave

  // comportamento automático original
  const key = getRecapKey()
  se localStorage.getItem(key) === 'shown': return
  localStorage.setItem(key, 'shown')
  se hasData: setIsOpen(true) via queueMicrotask

dependências: [loading, hasData, forceOpen]
```

**Atenção:** O `decidedRef` deve ser resetado quando `forceOpen` muda de `false` para `true`, para que a abertura sob demanda funcione mesmo que o efeito já tenha rodado. Usar um segundo `useEffect` que detecta mudanças em `forceOpen` e reseta `decidedRef.current = false` quando `forceOpen` torna-se `true`.

Alternativa mais simples (preferida): em vez de reusar `decidedRef` para forceOpen, usar dois effects separados:

1. Effect de abertura automática (dependências: `[loading, hasData]`, roda uma vez via `decidedRef`).
2. Effect de abertura sob demanda (dependências: `[forceOpen, hasData, loading]`): quando `forceOpen === true && !loading && hasData`, chamar `queueMicrotask(() => setIsOpen(true))`.

---

### RecapButton (componente novo)

**Arquivo:** `components/bolao/RecapButton.tsx`

**Responsabilidade:** Botão client-side que exibe ou oculta a entrada para o resumo diário com base na disponibilidade de dados.

**Props:**

```typescript
interface RecapButtonProps {
  groupId: string
}
```

**Comportamento:**

- Monta `useDailyRecap(groupId)` para verificar se `hasData` é verdadeiro.
- Enquanto `loading === true`: não renderiza nada (`null`).
- Se `loading === false && hasData === false`: não renderiza nada (`null`).
- Se `loading === false && hasData === true`: renderiza o botão/link visível.
- Ao clicar: seta `recapOpen = true` via `useState` local.
- Renderiza `DailyRecapModal` com `forceOpen={recapOpen}` e `onClose={() => setRecapOpen(false)}`.

**Estados:**

| Estado | Renderiza |
|--------|-----------|
| loading | null |
| sem dados | null |
| com dados, fechado | botão visível |
| com dados, aberto | botão visível + modal aberto |

**Design do botão** (seguindo DESIGN.md — Elifoot, monospace, sem border-radius):

```
[ RESUMO DE ONTEM ]
```

- Fonte: `JetBrains Mono`, 11px, uppercase, `letter-spacing: 0.05em`
- Cor do texto: `var(--color-muted)` no estado normal
- Cor do texto em hover: `var(--color-accent)`
- `border-bottom: 2px solid transparent` em normal; `2px solid var(--color-accent)` em hover
- `background: none`, `border: none` (exceto a borda inferior), `cursor: pointer`
- `padding: 0.5rem 0` — alinhado verticalmente com os `NavLinks`
- `transition: color 0.15s ease, border-color 0.15s ease`
- Sem ícone decorativo — apenas o texto

O estilo deve ser idêntico ao padrão dos `NavLinks` existentes, diferenciando apenas que não é um `<Link>` de rota mas sim um `<button>` que dispara abertura de modal.

---

### NavLinks (modificação)

**Arquivo:** `app/(dashboard)/nav-links.tsx`

**Modificação:** Não adicionar o botão diretamente em `NAV_ITEMS` (que são rotas). Em vez disso, renderizar o `RecapButton` após os links de navegação, dentro do mesmo `<nav>`.

**Novo JSX do componente `NavLinks`:**

```tsx
export function NavLinks({ groupId }: { groupId: string }) {
  const pathname = usePathname()
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
      {NAV_ITEMS.map(({ href, label }) => { ... })}
      <RecapButton groupId={groupId} />
    </nav>
  )
}
```

**Props novas:** `groupId: string` — passado pelo `DashboardLayout` onde já existe `activeGroup`.

---

### DashboardLayout (modificação)

**Arquivo:** `app/(dashboard)/layout.tsx`

**Modificação:** Passar `groupId` para `NavLinks`:

```tsx
<NavLinks groupId={activeGroup?.id ?? ''} />
```

O `activeGroup` já existe no layout. Quando não há grupo ativo, `groupId` será string vazia — o `RecapButton` renderizará `null` porque `useDailyRecap('')` retorna `hasData: false`.

---

## Regras de Negócio

1. **O ponto de entrada SÓ aparece se `hasData === true`** — ou seja, há pelo menos um jogo com `status = 'finished'` com `match_date` dentro do dia anterior em BRT. A verificação já está implementada em `useDailyRecap`.

2. **A abertura sob demanda não altera o localStorage** — a chave `bolao_recap_<data>` não é gravada nem lida quando o modal é aberto manualmente (`forceOpen === true`). Isso garante que o comportamento automático do dia seguinte continua funcionando normalmente.

3. **O comportamento automático não muda** — na próxima vez que o usuário carregar a página (sem abrir manualmente), o modal ainda aparecerá se a chave do dia não tiver sido gravada.

4. **`useDailyRecap` é chamado duas vezes** — uma vez pelo `DailyRecapModal` (já existente no layout) e uma vez pelo `RecapButton`. Isso é aceitável dado que o hook não tem efeitos colaterais além de queries de leitura ao Supabase. A duplicação de query é consciente e o custo é negligenciável para um grupo pequeno.

   **Alternativa para evitar duplicação (opcional, não obrigatória):** Mover a instância do `DailyRecapModal` do layout para dentro do `RecapButton`, passando `forceOpen` e gerenciando o estado inteiro lá. Porém isso quebraria o comportamento automático (o modal automático está no layout). Manter as duas instâncias separadas é mais simples e correto.

5. **`RecapButton` não exibe estado de loading** — simplesmente renderiza `null` enquanto carrega, sem spinner ou skeleton, para não introduzir elementos visuais desnecessários na navegação durante o carregamento inicial.

---

## Proteção de Rotas

Nenhuma rota nova. O `RecapButton` e o `DailyRecapModal` estão dentro do `DashboardLayout`, que já protege todas as rotas com verificação de sessão e redirecionamento para `/login`.

---

## Integração Supabase Realtime

Nenhuma. A feature não adiciona canais Realtime. O `useDailyRecap` já usa queries pontuais (não subscriptions).

---

## Critérios de Aceite

- [ ] Existe um botão `[ RESUMO DE ONTEM ]` na barra de navegação do dashboard
- [ ] O botão aparece somente quando há jogos finalizados no dia anterior (verificação via `useDailyRecap.hasData`)
- [ ] O botão não aparece (renderiza `null`) enquanto `useDailyRecap` está carregando
- [ ] Clicar no botão abre o `DailyRecapModal` com os dados do dia anterior
- [ ] O modal aberto manualmente pode ser fechado pelo botão FECHAR e pelo clique no backdrop
- [ ] Após fechar o modal aberto manualmente, o botão continua visível na navegação
- [ ] O comportamento automático do modal (primeiro acesso do dia) continua funcionando normalmente
- [ ] Abrir manualmente NÃO grava nem lê a chave do `localStorage` (`bolao_recap_<data>`)
- [ ] O botão segue o design do DESIGN.md: JetBrains Mono 11px, uppercase, sem border-radius, sem ícones decorativos, transição de cor em hover
- [ ] O botão se alinha visualmente com os demais itens do `NavLinks` (mesma altura, mesmo padding vertical)
- [ ] Em mobile (coluna única), o botão cabe na barra sem quebrar o layout — se necessário, usar `overflow-x: auto` no `<nav>` já existente
- [ ] Não há erros de TypeScript ou lint introduzidos pela feature
- [ ] Design segue DESIGN.md (paleta, tipografia monospace, estilo Elifoot)
