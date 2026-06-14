# Spec: Ajuste Mobile do Ranking

**Slug:** ranking-mobile-fit
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Ajustar o ranking para caber inteiramente na viewport de um celular padrão (375x667px) sem scroll vertical, preservando as informações essenciais de posição, nome do participante e pontuação total. A coluna APROVEIT. pode ser omitida em mobile (exibida apenas em `md:` e acima).

---

## Histórias de Usuário

- Como participante do bolão, quero ver o ranking completo sem precisar rolar a tela no celular para acompanhar minha posição de forma rápida.
- Como participante, quero que meu nome e pontuação estejam sempre visíveis mesmo em telas pequenas.

---

## Modelo de Dados

Nenhuma alteração no banco de dados. Esta feature é exclusivamente de layout/UI.

### Migrations necessárias

Nenhuma.

---

## Backend — Endpoints Ruby/Sinatra

Nenhuma alteração de endpoint. O `GET /api/ranking` já retorna os dados necessários.

---

## Frontend — Componentes React

### Análise do problema atual

O layout atual em 375x667px não cabe na viewport por acúmulo de alturas:

| Elemento | Altura estimada |
|----------|----------------|
| Header do dashboard (padding 0.75rem + conteúdo) | ~68px (quebra em duas linhas no mobile) |
| `<main>` padding-top (1.5rem) | ~24px |
| Título "RANKING GERAL" + separador + subtítulo | ~52px |
| Gap entre título e tabela (1.25rem) | ~20px |
| Cabeçalho interno da RankingTable | ~42px |
| `<thead>` da tabela | ~34px |
| Cada linha do ranking (padding 0.5rem + font 14px) | ~36px/linha |
| Rodapé da RankingTable | ~36px |

Com 10 participantes: 68 + 24 + 52 + 20 + 42 + 34 + (10 × 36) + 36 = **636px** — excede 667px com pouca margem, e com 12+ participantes estoura com folga.

### Solução

Três ajustes combinados, sem nenhuma alteração no servidor:

1. **Remover o bloco de título da `ranking/page.tsx`** — o cabeçalho interno da `RankingTable` já exibe `"RANKING — BOLÃO DO CARTOLA ABJ"`, tornando o título da page.tsx redundante. Remover o `<div>` com o `<h1>` e o subtítulo economiza ~52px + gap 20px = 72px.

2. **Reduzir padding das linhas em mobile** — trocar `padding: '0.5rem 0.75rem'` por `padding: '0.35rem 0.5rem'` nas células de `RankingRow`. Reduz cada linha de ~36px para ~28px, economizando ~8px × N linhas.

3. **Ocultar coluna APROVEIT. em mobile** — a coluna ocupa `minWidth: 5rem` e não é essencial para a leitura rápida do ranking. Ocultar com `display: none` em mobile e `display: table-cell` a partir de `md:` (768px). O `<th>` correspondente também deve ser ocultado.

### Cálculo pós-ajuste (375x667px, 12 participantes)

| Elemento | Altura estimada |
|----------|----------------|
| Header do dashboard | ~68px |
| `<main>` padding-top | ~24px |
| Gap (removido título, gap não existe mais) | ~0px |
| Cabeçalho interno da RankingTable | ~42px |
| `<thead>` da tabela | ~30px |
| Cada linha (padding reduzido) | ~28px/linha |
| Rodapé da RankingTable | ~30px |

Com 12 participantes: 68 + 24 + 42 + 30 + (12 × 28) + 30 = **530px** — cabe em 667px com ~137px de margem.

---

### RankingPage (`app/(dashboard)/ranking/page.tsx`)

**Arquivo:** `app/(dashboard)/ranking/page.tsx`

**Alteração:** Remover o bloco `<div>` que contém o `<h1>` "RANKING GERAL", o separador `borderBottom` e o `<p>` "Classificação ao vivo · atualiza em tempo real". O wrapper externo `<div>` com `maxWidth: 800px` e `gap: 1.25rem` também deve ser simplificado — substituir por um `<div>` sem gap (ou `gap: 0`) já que só restará o `<RankingTable />`. Manter o `maxWidth: 800px` e `margin: 0 auto` para centralização em desktop.

**Antes (a remover):**
```tsx
<div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
  <div>
    <h1>RANKING GERAL</h1>
    <div style={{ borderBottom: '1px solid var(--color-border)', ... }} />
    <p>Classificação ao vivo · atualiza em tempo real</p>
  </div>
  <RankingTable currentUserId={user.id} />
</div>
```

**Depois:**
```tsx
<div style={{ maxWidth: '800px', margin: '0 auto' }}>
  <RankingTable currentUserId={user.id} />
</div>
```

---

### RankingTable (`components/bolao/RankingTable.tsx`)

**Arquivo:** `components/bolao/RankingTable.tsx`

**Alteração 1 — ocultar `<th>` APROVEIT. em mobile:**

O `<th>` da coluna APROVEIT. deve receber a classe Tailwind `hidden md:table-cell` para ser ocultado em mobile e visível a partir de `md:` (768px). Como o componente usa `style` inline, usar a prop `className` para este caso específico.

```tsx
<th
  className="hidden md:table-cell"
  style={{
    padding: '0.35rem 0.5rem',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--color-muted)',
    fontWeight: 'normal',
  }}
>
  APROVEIT.
</th>
```

**Alteração 2 — reduzir padding do `<thead>`:**

Trocar `padding: '0.5rem 0.75rem'` por `padding: '0.35rem 0.5rem'` em todos os `<th>` do thead.

**Alteração 3 — remover `overflowX: 'auto'`:**

Com a remoção da coluna APROVEIT. em mobile, o overflow horizontal deixa de ser necessário em mobile. Manter o wrapper `<div>` sem `overflowX: 'auto'` — se em algum cenário de desktop a tabela extravazar, o `maxWidth: 800px` da page já contém o layout.

---

### RankingRow (`components/bolao/RankingRow.tsx`)

**Arquivo:** `components/bolao/RankingRow.tsx`

**Alteração 1 — ocultar `<td>` APROVEIT. em mobile:**

O `<td>` de aproveitamento deve receber `className="hidden md:table-cell"` assim como o `<th>` correspondente.

```tsx
<td
  className="hidden md:table-cell"
  style={{
    padding: '0.35rem 0.5rem',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    fontSize: '13px',
    color: isLeader ? 'var(--color-accent)' : aprovColor,
  }}
>
  {entry.aproveitamento}%
</td>
```

**Alteração 2 — reduzir padding de todas as células:**

Trocar `padding: '0.5rem 0.75rem'` por `padding: '0.35rem 0.5rem'` em todos os `<td>` da linha (posição, participante, pontos).

**Alteração 3 — reduzir font-size do nome do participante em mobile:**

A célula PARTICIPANTE usa `fontSize: '14px'`. Em mobile, reduzir para `12px` para permitir nomes mais longos sem truncamento prematuro. Manter `maxWidth: 200px` com `overflow: hidden` e `textOverflow: 'ellipsis'`.

Usar inline style com media query não é possível em React. A solução é adicionar `className="ranking-name-cell"` e definir a regra no `globals.css`:

```css
/* globals.css — adicionar ao final */
.ranking-name-cell {
  font-size: 12px;
}
@media (min-width: 768px) {
  .ranking-name-cell {
    font-size: 14px;
  }
}
```

**Props e interface:** nenhuma alteração na interface `RankingRowProps` — apenas estilos.

---

### Estados dos componentes

| Estado | Comportamento |
|--------|--------------|
| loading | Inalterado — "CARREGANDO RANKING..." |
| error | Inalterado — "✗ mensagem" em color-error |
| empty | Inalterado — "NENHUM PARTICIPANTE NO RANKING AINDA" |
| populated | Tabela com 3 colunas visíveis em mobile, 4 em desktop |

---

## Regras de Negócio

Nenhuma regra de negócio nova. Esta feature é puramente de apresentação.

- A coluna APROVEIT. permanece acessível em tablets e desktops (`md:` e acima, ≥768px).
- O campo `aproveitamento` continua sendo calculado e retornado pelo endpoint Ruby normalmente.
- Nenhuma lógica de pontuação é alterada.

---

## Proteção de Rotas

Inalterada. A página `/ranking` continua exigindo autenticação via `supabase.auth.getUser()` na Server Component, com redirect para `/login` se não autenticado.

---

## Integração Supabase Realtime

Inalterada. O hook `useRankingRealtime` continua observando a tabela `scores` no canal `ranking-scores` e refazendo o fetch ao detectar mudanças. Nenhuma alteração neste arquivo.

---

## Critérios de Aceite

- [ ] A página `/ranking` cabe inteiramente em 375x667px sem scroll vertical com até 12 participantes
- [ ] As informações de posição (#), nome do participante e pontuação total são visíveis em mobile
- [ ] A coluna APROVEIT. está oculta em mobile (viewport < 768px) e visível em desktop (≥768px)
- [ ] O título "RANKING GERAL" e o subtítulo foram removidos da page.tsx (o cabeçalho da RankingTable já os substitui)
- [ ] O padding das linhas da tabela foi reduzido para `0.35rem 0.5rem` em todos os `<td>` e `<th>`
- [ ] O font-size do nome do participante é 12px em mobile e 14px em desktop
- [ ] O indicador `● AO VIVO` continua visível no cabeçalho da RankingTable
- [ ] O rodapé com `► LÍDER`, `■ VOCÊ` e contagem de participantes continua visível
- [ ] O líder continua destacado em `color-accent` com prefixo `► `
- [ ] O usuário atual continua destacado em `color-primary` com sufixo `(VOCÊ)`
- [ ] Em desktop (≥768px), o layout permanece idêntico ao atual, com 4 colunas
- [ ] Design segue DESIGN.md: fonte JetBrains Mono, dark only, sem ícones decorativos, bordas simples, sem sombras
- [ ] Nenhuma alteração no banco de dados, endpoints Ruby ou hook useRankingRealtime
