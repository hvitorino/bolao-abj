# Spec: Página "Como Pontuar"

**Slug:** como-pontuar
**Data:** 2026-06-15
**Status:** spec

---

## Objetivo

Criar uma página estática no dashboard (`/como-pontuar`) que explica de forma clara e visual como as pontuações dos palpites são calculadas. A página é puramente informativa — sem chamadas de API, sem estado dinâmico, sem Realtime — e deve ser visualmente consistente com o estilo Elifoot do projeto.

---

## Histórias de Usuário

- Como participante do bolão, quero entender como os pontos são calculados para poder planejar meus palpites com mais estratégia
- Como participante novo, quero ver exemplos concretos de cálculo para entender o sistema antes de fazer meu primeiro palpite
- Como participante, quero acessar as regras a qualquer momento durante o torneio por um link fixo na navegação

---

## Modelo de Dados

### Nenhuma tabela nova ou modificada

Esta feature é inteiramente estática. Não requer migrations, não lê do banco de dados, não tem endpoints de backend.

---

## Backend — Endpoints Ruby/Sinatra

Nenhum endpoint necessário. A página é um Server Component Next.js sem chamadas de API.

---

## Frontend — Componentes React

### Estrutura de Arquivos

```
app/
  (dashboard)/
    como-pontuar/
      page.tsx              ← página principal (Server Component)
    nav-links.tsx           ← MODIFICAR: adicionar link "REGRAS"
components/
  bolao/
    ScoringRulesTable.tsx   ← tabela de regras de pontuação
    ScoringExample.tsx      ← card de exemplo concreto de cálculo
```

---

### `app/(dashboard)/como-pontuar/page.tsx`

**Tipo:** Server Component (sem `'use client'`)
**Autenticação:** protegida pelo `DashboardLayout` em `app/(dashboard)/layout.tsx` — nenhuma verificação adicional necessária
**Props:** nenhuma
**Exporta:** `export default function ComoPontuarPage()`

**Estrutura de conteúdo (de cima para baixo):**

1. Header da página com título `COMO PONTUAR` e subtítulo `BOLÃO DO CARTOLA ABJ · COPA 2026`
2. Bloco de aviso/introdução: os bônus são cumulativos com o acerto do vencedor
3. Componente `<ScoringRulesTable />` — tabela de todos os eventos e pontos
4. Seção de exemplos com título `EXEMPLOS DE CÁLCULO` contendo três instâncias de `<ScoringExample />`
5. Bloco de regras especiais: empate e cumulatividade
6. Rodapé informativo com link de volta para `/jogos`

**Metadata:**

```typescript
export const metadata = {
  title: 'Como Pontuar — Bolão do Cartola ABJ',
}
```

---

### `components/bolao/ScoringRulesTable.tsx`

**Tipo:** Client ou Server Component (preferir Server Component — sem interatividade)
**Props:** nenhuma

**Comportamento:** Renderiza uma tabela HTML com todos os eventos de pontuação. Cada linha tem: símbolo ASCII, descrição do evento, pontuação em destaque (`color-accent`).

**Layout da tabela (referência visual):**

```
┌──────────────────────────────────────────────────────┐
│  TABELA DE PONTUAÇÃO                                 │
├─────────────────────────────────────────┬────────────┤
│  EVENTO                                 │  PONTOS    │
├─────────────────────────────────────────┼────────────┤
│  ► Acerto do vencedor                   │    +3      │
│    Placar exato                         │    +5      │
│    Somente placar do vencedor           │    +3      │
│    Diferença de gols correta            │    +2      │
│    Somente placar do perdedor           │    +1      │
│    Goleada (vencedor ≥4 gols, Δ ≥4)    │    +1      │
├─────────────────────────────────────────┼────────────┤
│  MÁXIMO POSSÍVEL POR JOGO               │   +14      │
└─────────────────────────────────────────┴────────────┘
```

**Dados da tabela (constante inline no componente):**

```typescript
const SCORING_RULES = [
  {
    event: 'Acerto do vencedor',
    points: 3,
    note: 'base obrigatória para bônus cumulativos',
    highlight: true,
  },
  {
    event: 'Placar exato',
    points: 5,
    note: 'requer acerto do vencedor',
    highlight: false,
  },
  {
    event: 'Somente placar do vencedor',
    points: 3,
    note: 'acertou o placar do time que ganhou',
    highlight: false,
  },
  {
    event: 'Diferença de gols correta',
    points: 2,
    note: 'requer acerto do vencedor',
    highlight: false,
  },
  {
    event: 'Somente placar do perdedor',
    points: 1,
    note: 'independente de acertar o vencedor',
    highlight: false,
  },
  {
    event: 'Goleada',
    points: 1,
    note: 'vencedor no palpite fez 4+ gols E diferença real ≥ 4 gols',
    highlight: false,
  },
]
```

**Estilo:**
- Tabela com `border-collapse: collapse`, borda `1px solid var(--color-border)`
- Header da tabela: bg `var(--color-secondary)`, texto uppercase, `color-text`
- Linha "Acerto do vencedor": marcada com `►` em `color-primary`, pois é o requisito base
- Coluna de pontos: alinhada à direita, fonte bold, `color-accent`
- Linha de total "MÁXIMO POSSÍVEL": separada por borda, texto em `color-muted` com pontos em `color-accent`
- `color-muted` para a coluna de observações/notas

---

### `components/bolao/ScoringExample.tsx`

**Tipo:** Server Component
**Props:**

```typescript
interface ScoringExampleProps {
  title: string           // ex: "EXEMPLO 1 — PLACAR EXATO"
  homeTeam: string        // ex: "BRA"
  awayTeam: string        // ex: "ARG"
  homeScore: number       // placar real
  awayScore: number
  predHome: number        // palpite do usuário
  predAway: number
  breakdown: Array<{
    label: string         // ex: "Acertou o vencedor"
    points: number
    hit: boolean          // true = ✓, false = ✗
  }>
  total: number
}
```

**Layout (referência visual — seguir exatamente o componente "Pontuação por Jogo" do DESIGN.md):**

```
┌──────────────────────────────────────────────────────┐
│  EXEMPLO 1 — PLACAR EXATO                            │
│  ─────────────────────────────────────────────────── │
│  BRA 3×1 ARG  ·  SEU PALPITE: 3×1                   │
│  ─────────────────────────────────────────────────── │
│  ✓ Acertou o vencedor        +3                      │
│  ✓ Placar exato              +5                      │
│  ✗ Diferença de gols         +0                      │
│  ✗ Placar do perdedor        +0                      │
│  ─────────────────────────────────────────────────── │
│  TOTAL                        8 pontos               │
└──────────────────────────────────────────────────────┘
```

**Estilo:**
- Container: `border: 1px solid var(--color-border)`, bg `var(--color-surface)`, padding `1rem`
- Título: uppercase, bold, `color-primary`, `letter-spacing: 0.1em`
- Linha de placares: `color-accent` para os números, `color-muted` para os separadores
- `✓` em `color-win` (#00d26a); `✗` em `color-muted`
- Linha de total: bold, `color-text`; pontos do total em `color-accent`
- Separadores: `border-top: 1px solid var(--color-border)`, sem padding extra

---

## Três Exemplos Concretos de Cálculo

Os três exemplos abaixo devem ser instanciados no `page.tsx` via `<ScoringExample />`:

### Exemplo 1 — Placar Exato (pontuação máxima sem goleada)

- Jogo real: BRA 3×1 ARG
- Palpite: BRA 3×1 ARG
- Breakdown:
  - ✓ Acertou o vencedor: +3
  - ✓ Placar exato: +5
- **Total: +8 pontos**
- Nota: placar exato já engloba "somente placar do vencedor" e "diferença de gols" — não cumulam

### Exemplo 2 — Acerto Parcial (vencedor certo, placar errado)

- Jogo real: BRA 2×0 MEX
- Palpite: BRA 1×0 MEX
- Breakdown:
  - ✓ Acertou o vencedor: +3
  - ✓ Diferença de gols correta: +2 (diferença real = 2, diferença no palpite = 1 — NÃO bate; usar diferença = 2 no palpite para exemplificar)
  
**Ajuste para tornar exemplo mais claro — usar palpite BRA 2×0 MEX (placar exato não; mas diferença sim):**

- Jogo real: BRA 3×1 MEX (diferença = 2)
- Palpite: BRA 2×0 MEX (diferença = 2, vencedor correto, placar errado)
- Breakdown:
  - ✓ Acertou o vencedor: +3
  - ✗ Placar exato: +0
  - ✓ Diferença de gols correta: +2
  - ✓ Somente placar do perdedor: +1 (MEX 0 no palpite, MEX 1 no jogo real — NÃO bate)

**Versão final do Exemplo 2 (limpa e pedagógica):**

- Jogo real: BRA 2×0 MEX
- Palpite: BRA 1×0 MEX
- Breakdown:
  - ✓ Acertou o vencedor: +3
  - ✗ Placar exato: +0
  - ✗ Diferença de gols correta: +0 (diferença real = 2, palpite = 1)
  - ✓ Somente placar do perdedor: +1 (palpite perdedor = 0, real = 0 — bate)
- **Total: +4 pontos**

### Exemplo 3 — Empate Exato

- Jogo real: ALE 1×1 FRA
- Palpite: ALE 1×1 FRA
- Breakdown:
  - ✓ Acertou o empate (vale como acerto do vencedor): +3
  - ✓ Placar exato no empate: +5
- **Total: +8 pontos**
- Nota pedagógica: "Empate conta como acerto do vencedor. Placar exato no empate aplica +5 normalmente."

---

## Seção de Regras Especiais

Após os exemplos, exibir dois blocos informativos adicionais em cards com borda `color-border`:

### Bloco 1 — Cumulatividade

```
┌──────────────────────────────────────────────────────┐
│  ► BÔNUS SÃO CUMULATIVOS                             │
│  ─────────────────────────────────────────────────── │
│  Todos os bônus somam com o acerto do vencedor.      │
│  Exceto: placar exato já inclui "placar do           │
│  vencedor" e "diferença de gols" — estes não         │
│  se acumulam com o placar exato.                     │
└──────────────────────────────────────────────────────┘
```

### Bloco 2 — Regra de Empate

```
┌──────────────────────────────────────────────────────┐
│  ► EMPATE                                            │
│  ─────────────────────────────────────────────────── │
│  Acertar o empate conta como acerto do vencedor      │
│  (+3 pts). Se o placar for exato, aplica-se          │
│  também o bônus de placar exato (+5 pts).            │
└──────────────────────────────────────────────────────┘
```

**Estilo dos blocos:**
- Mesma borda e bg de `ScoringExample`
- Título com `►` em `color-primary`
- Texto do corpo em `color-text`, 14px

---

## Integração com Navegação

### Arquivo a modificar: `app/(dashboard)/nav-links.tsx`

Adicionar o item `{ href: '/como-pontuar', label: 'REGRAS' }` ao array `NAV_ITEMS`:

```typescript
const NAV_ITEMS = [
  { href: '/jogos', label: 'JOGOS' },
  { href: '/ranking', label: 'RANKING' },
  { href: '/meus-palpites', label: 'PALPITES' },
  { href: '/como-pontuar', label: 'REGRAS' },  // ADICIONAR
]
```

O comportamento de `isActive` já cobre a nova rota sem alterações adicionais (usa `pathname === href`).

---

## Proteção de Rotas

A rota `/como-pontuar` fica dentro do grupo `(dashboard)` que já possui o `DashboardLayout` com verificação de autenticação via `supabase.auth.getUser()` e `redirect('/login')`. Nenhuma proteção adicional necessária.

---

## Integração Supabase Realtime

Não aplicável. A página é inteiramente estática.

---

## Regras de Negócio

As regras abaixo devem ser refletidas fielmente na página, extraídas de `CLAUDE.md`:

```
Acerto do vencedor:            +3 pts  (base para bônus)
Placar exato:                  +5 pts  (requer acerto do vencedor)
Somente placar do vencedor:    +3 pts  (requer acerto do vencedor)
Diferença de gols correta:     +2 pts  (requer acerto do vencedor)
Somente placar do perdedor:    +1 pt   (independente)
Goleada:                       +1 pt   (acertou vencedor E palpite_vencedor >= 4 E diferença_real >= 4)

Empate: conta como acerto do vencedor (+3). Placar exato no empate aplica +5 adicional.
Máximo teórico por jogo: 3 + 5 + 3 + 2 + 1 + 1 = 15 pts
  (mas placar exato e "somente placar do vencedor" são mutuamente exclusivos na prática —
   o máximo real alcançável é 14 pts: 3 + 5 + 2 + 1 + 1 + goleada... verificar)
```

**Nota para o Programador:** O máximo correto por jogo deve ser calculado com cuidado. "Placar exato" e "somente placar do vencedor" não são mutuamente exclusivos na lógica do `scoring.ts` (placar exato não impede somente placar do vencedor em implementações onde são cheques independentes). Verificar `lib/scoring.ts` antes de exibir o valor "MÁXIMO POSSÍVEL". Se a lógica atual permitir acumulação, exibir o máximo real; se não, ajustar. Em caso de dúvida, omitir a linha de máximo e deixar apenas as regras individuais.

---

## Design — Especificações Detalhadas

### Layout da Página

```
[HEADER DO DASHBOARD — já existente]

┌─ main padding: 1.5rem ──────────────────────────────┐
│                                                      │
│  COMO PONTUAR                          [título H1]  │
│  BOLÃO DO CARTOLA ABJ · COPA 2026     [subtítulo]   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  TABELA DE PONTUAÇÃO  (ScoringRulesTable)    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  EXEMPLOS DE CÁLCULO                  [título H2]   │
│                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ Exemplo 1  │ │ Exemplo 2  │ │ Exemplo 3  │       │
│  │ (ScoringE) │ │ (ScoringE) │ │ (ScoringE) │       │
│  └────────────┘ └────────────┘ └────────────┘       │
│                                                      │
│  REGRAS ESPECIAIS                     [título H2]   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  ► BÔNUS SÃO CUMULATIVOS                     │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  ► EMPATE                                    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ← VOLTAR PARA JOGOS              [link/rodapé]     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Grid dos exemplos:**
- Mobile (< md): coluna única, um exemplo por linha
- md+: 3 colunas (`display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem`)

### Tokens de cor a usar

| Elemento | Token |
|----------|-------|
| H1, H2 títulos | `color-primary` |
| Subtítulo | `color-muted` |
| Pontos na tabela | `color-accent` |
| Símbolo `►` em regras especiais | `color-primary` |
| Ícone `✓` em exemplos | `color-win` |
| Ícone `✗` em exemplos | `color-muted` |
| Corpo de texto | `color-text` |
| Notas/observações | `color-muted` |
| Total dos exemplos | `color-accent` |
| Bordas de cards | `color-border` |
| Background de cards | `color-surface` |
| Header de tabela | `color-secondary` (bg) |

### Tipografia

Toda a página usa `fontFamily: "'JetBrains Mono', 'Courier New', monospace"` sem exceção.

- H1 (`COMO PONTUAR`): `fontSize: '18px'`, `fontWeight: 'bold'`, `textTransform: 'uppercase'`, `letterSpacing: '0.1em'`, `color: 'var(--color-primary)'`
- H2 (seções): `fontSize: '14px'`, `fontWeight: 'bold'`, `textTransform: 'uppercase'`, `letterSpacing: '0.1em'`, `color: 'var(--color-primary)'`
- Corpo: `fontSize: '14px'`, `fontWeight: 'normal'`
- Labels/notas: `fontSize: '12px'`, `color: 'var(--color-muted)'`

---

## Critérios de Aceite

- [ ] Rota `/como-pontuar` existe e retorna 200 para usuários autenticados
- [ ] Usuário não autenticado é redirecionado para `/login` ao acessar `/como-pontuar`
- [ ] Link "REGRAS" aparece na navegação do dashboard em todas as páginas protegidas
- [ ] Link "REGRAS" fica destacado (cor `color-primary`, `border-bottom`) quando a rota ativa é `/como-pontuar`
- [ ] Tabela de pontuação exibe todos os 6 eventos com pontos corretos conforme `CLAUDE.md`
- [ ] Exemplo 1 (BRA 3×1 ARG, palpite 3×1) exibe total de +8 pts com breakdown correto
- [ ] Exemplo 2 (BRA 2×0 MEX, palpite BRA 1×0 MEX) exibe total de +4 pts com breakdown correto
- [ ] Exemplo 3 (ALE 1×1 FRA, palpite 1×1) exibe total de +8 pts com nota sobre empate
- [ ] Bloco "BÔNUS SÃO CUMULATIVOS" presente e explica a regra de acumulação
- [ ] Bloco "EMPATE" presente e explica que empate conta como acerto do vencedor (+3) e que placar exato no empate aplica +5
- [ ] Toda a página usa fonte JetBrains Mono (monospace)
- [ ] Cores seguem a paleta de DESIGN.md (verde, amarelo, azul, fundo escuro)
- [ ] Sem ícones decorativos SVG — apenas símbolos ASCII (`►`, `✓`, `✗`)
- [ ] Sem sombras nos cards — apenas bordas `1px solid var(--color-border)`
- [ ] Layout responsivo: coluna única em mobile, 3 colunas nos exemplos em `md+`
- [ ] Página funciona corretamente em mobile (375px de largura)
- [ ] Nenhuma chamada de API ou fetch — página é puramente estática
