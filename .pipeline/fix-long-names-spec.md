# Spec: Correção — Nomes Longos nos Cards de Jogo

**Slug:** fix-long-names
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Corrigir o layout do componente `GameCard` para que nenhum texto quebre para uma segunda linha. Nomes de times (exibidos abaixo dos códigos de 3 letras) e nomes de estádio (exibidos no footer) devem ser truncados com reticências ("...") quando o conteúdo ultrapassar a largura disponível. O layout deve permanecer em uma única linha e consistente independente do comprimento do nome.

---

## Histórias de Usuário

- Como participante do bolão, quero que os cards de jogo mantenham layout compacto de uma linha, para que a listagem de jogos seja densa e escaneável como no estilo Elifoot.
- Como participante do bolão, quero que nomes longos como "COSTA DO MARFIM" não quebrem o grid dos cards, para que todos os cards tenham altura uniforme.

---

## Modelo de Dados

Nenhuma alteração de banco de dados necessária. Esta é uma correção exclusivamente de frontend/CSS.

---

## Backend — Endpoints Ruby/Sinatra

Nenhuma alteração necessária. Esta feature é puramente de frontend.

---

## Frontend — Componentes React

### GameCard

**Arquivo:** `components/games/GameCard.tsx`

Esta é a única mudança de código necessária. O bug ocorre em dois elementos dentro do componente:

#### 1. Nome do time da casa (linha ~172–181)

**Problema:** A `<div>` do nome do time não tem `overflow: hidden`, `textOverflow: 'ellipsis'` nem `whiteSpace: 'nowrap'`. Em grid `1fr auto 1fr`, a coluna tem largura relativa, e nomes longos como "COSTA DO MARFIM" ultrapassam o espaço e quebram em múltiplas linhas.

**Correção:** Adicionar as três propriedades CSS de truncamento na div do nome do time da casa:

```tsx
// Antes (linhas ~173–181):
<div
  style={{
    fontSize: '11px',
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    marginTop: '0.25rem',
    letterSpacing: '0.05em',
  }}
>
  {liveGame.home_team}
</div>

// Depois:
<div
  style={{
    fontSize: '11px',
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    marginTop: '0.25rem',
    letterSpacing: '0.05em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }}
>
  {liveGame.home_team}
</div>
```

#### 2. Nome do time visitante (linha ~211–220)

**Problema:** Mesmo problema que o time da casa — div sem overflow truncado.

**Correção:** Adicionar as mesmas três propriedades CSS na div do nome do time visitante:

```tsx
// Antes (linhas ~212–220):
<div
  style={{
    fontSize: '11px',
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    marginTop: '0.25rem',
    letterSpacing: '0.05em',
  }}
>
  {liveGame.away_team}
</div>

// Depois:
<div
  style={{
    fontSize: '11px',
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    marginTop: '0.25rem',
    letterSpacing: '0.05em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }}
>
  {liveGame.away_team}
</div>
```

#### 3. Nome do estádio/venue (linha ~354–368)

**Observação:** O venue já tem `overflow: 'hidden'`, `textOverflow: 'ellipsis'` e `whiteSpace: 'nowrap'`, mas está dentro de um footer com `flexWrap: 'wrap'`. O `flexWrap: 'wrap'` pode causar overflow indesejado do container pai em casos extremos. Verificar e, se necessário, garantir que o span do venue não quebre o layout do footer.

**Ação:** Confirmar que o `maxWidth: '160px'` aplicado ao venue é suficiente para todos os cenários. Se o footer em telas menores ainda puder quebrar, garantir que o container pai (`display: 'flex', flexWrap: 'wrap'`) não permita que o venue "empurre" o layout. Pode ser necessário adicionar `minWidth: 0` ao span para que o flex item respeite o truncamento.

#### 4. Corpo do card — garantia do grid (linha ~148–157)

**Contexto:** O corpo do card usa `gridTemplateColumns: '1fr auto 1fr'`. Para que `overflow: hidden` e `textOverflow: ellipsis` funcionem corretamente dentro de elementos `1fr` de um grid CSS, a célula do grid precisa ter `minWidth: 0` — caso contrário, o browser pode expandir a coluna além do `1fr` para acomodar o conteúdo.

**Correção:** Adicionar `minWidth: 0` nas duas divs dos times (time da casa e time visitante) para garantir que as colunas `1fr` respeitem o truncamento:

```tsx
// Time da casa — adicionar minWidth: 0
<div style={{ textAlign: 'center', minWidth: 0 }}>

// Time visitante — adicionar minWidth: 0
<div style={{ textAlign: 'center', minWidth: 0 }}>
```

**Props:** nenhuma alteração de interface necessária.

**Estados:** nenhuma alteração de estados necessária.

**Supabase Realtime:** sem alteração.

---

## Regras de Negócio

Nenhuma regra de negócio nova. Esta correção é puramente visual/CSS:

1. Todo texto no card de jogo deve caber em uma única linha.
2. Quando o texto ultrapassar o espaço disponível, deve ser truncado com "..." (CSS `text-overflow: ellipsis`).
3. O estilo visual (fonte, cor, tamanho) dos textos não muda — apenas adiciona-se as propriedades de truncamento.
4. O `title` HTML não é necessário — o código de 3 letras já identifica o time de forma inequívoca, e o nome completo é texto secundário.

---

## Proteção de Rotas

Sem alteração. A rota `/jogos` já é protegida pela feature `game-navigation`.

---

## Integração Supabase Realtime

Sem alteração. O comportamento Realtime do `GameCard` não é afetado.

---

## Critérios de Aceite

- [ ] "COSTA DO MARFIM" (e qualquer outro nome longo) aparece em uma única linha abaixo do código "CIV", truncado com "..." se necessário
- [ ] O nome do time visitante também respeita a mesma regra de truncamento
- [ ] O nome do estádio no footer continua em uma única linha sem overflow
- [ ] Todos os cards na listagem `/jogos` têm a mesma altura (layout não varia conforme tamanho do nome)
- [ ] Em mobile (320px–375px de largura), os nomes aparecem truncados e não quebram para segunda linha
- [ ] Os códigos de 3 letras (ex: "BRA", "CIV") continuam sendo exibidos completos e sem truncamento
- [ ] O placar central continua centralizado e não é afetado pelo truncamento dos nomes
- [ ] Design segue DESIGN.md: fonte monospace, uppercase, dense first, sem alteração na paleta de cores
- [ ] Nenhum outro componente é alterado — a correção se limita ao `components/games/GameCard.tsx`
- [ ] Branch criada: `feature/fix-long-names`
