# Spec: Navegação para o Próximo Jogo na Análise

**Slug:** next-game-navigation
**Data:** 2026-06-22
**Status:** spec

---

## Objetivo

Na página `/jogos/[gameId]/analise`, adicionar um controle de navegação que leva o usuário diretamente para `/jogos/[nextId]/analise` do próximo jogo em ordem cronológica (`match_date ASC`), sem precisar voltar à listagem. Se não houver jogo posterior, o controle deve estar oculto.

---

## Histórias de Usuário

- Como participante do bolão, quero navegar para a análise do próximo jogo direto da página de análise atual, para não precisar voltar à listagem a cada jogo que quero consultar.
- Como participante do bolão, quero que o controle de navegação desapareça quando estou no último jogo, para não ser induzido a clicar em algo que não existe.

---

## Modelo de Dados

### Nenhuma alteração

Sem novas tabelas, colunas, migrations ou endpoints. A feature usa a tabela `games` já existente com uma query simples de "próximo jogo".

---

## Backend

Nenhum endpoint novo. A busca do próximo jogo ocorre via query Supabase no Server Component da página de análise.

**Query a adicionar na `AnalisePage`:**

```sql
SELECT id
FROM games
WHERE match_date > '<match_date do jogo atual>'
ORDER BY match_date ASC
LIMIT 1
```

Equivalente Supabase JS:
```ts
const { data: nextGame } = await supabase
  .from('games')
  .select('id')
  .gt('match_date', game.match_date)
  .order('match_date', { ascending: true })
  .limit(1)
  .maybeSingle()
```

O resultado (`nextGame?.id`) é passado como prop ao componente de navegação. Se `null`, o controle é omitido.

---

## Frontend — Componentes React

### NextGameLink
**Arquivo:** `components/bolao/NextGameLink.tsx`
**Tipo:** Client Component (usa `<Link>` do Next.js para prefetch automático)

**Props:**
```ts
interface NextGameLinkProps {
  nextGameId: string // id do próximo jogo
}
```

**Comportamento:**
- Renderiza um `<Link href={/jogos/${nextGameId}/analise}>` estilizado como botão de texto
- Texto: `PRÓXIMO JOGO ►`
- Fonte: JetBrains Mono, 12px, bold, uppercase
- Cor: `var(--color-primary)` em estado normal
- Sem borda, sem background, sem sublinhado
- Sem hover state adicional (consistente com `BackButton.tsx`)

**Quando não renderizar:** o componente não existe na árvore — a decisão de ocultar é tomada pela `AnalisePage` (não renderiza `<NextGameLink>` quando `nextGameId` é `null`).

### Alteração em `app/(dashboard)/jogos/[gameId]/analise/page.tsx`

1. Adicionar query de próximo jogo (ver seção Backend acima) ao bloco de queries da `AnalisePage`, em paralelo com as demais usando `Promise.all` ou de forma sequencial após a Query 1.

2. Substituir a seção de "Botão de voltar" atual por uma faixa de navegação com dois elementos lado a lado: `BackButton` à esquerda e `NextGameLink` à direita (quando disponível).

**Layout da faixa de navegação:**

```
← VOLTAR                      PRÓXIMO JOGO ►
```

- Container: `display: flex; justify-content: space-between; align-items: center`
- Se `nextGameId` for `null`, `<BackButton>` permanece alinhado à esquerda e o lado direito fica vazio
- O container ocupa a largura total do layout pai (sem maxWidth extra)

---

## Regras de Negócio

- O próximo jogo é o primeiro jogo com `match_date` **estritamente maior** que o `match_date` do jogo atual, ordenado por `match_date ASC`
- Se dois jogos tiverem exatamente o mesmo `match_date`, o comportamento de qual é "próximo" depende da ordenação secundária do Supabase (por `id` ou `created_at` — não é necessário forçar desempate explícito, pois na prática jogos simultâneos têm timestamps distintos)
- Se `nextGame` for `null` (jogo atual é o último), o controle não é renderizado — não há estado "desabilitado" visível
- A query não filtra por status — jogos `pending`, `live` e `finished` todos são elegíveis como "próximo jogo"
- A query não filtra por grupo — jogos são globais à Copa

---

## Proteção de Rotas

Nenhuma alteração. A rota `/jogos/[gameId]/analise` já é protegida por autenticação e verificação de grupo ativo na `AnalisePage`.

---

## Integração Supabase Realtime

Não aplicável. A feature é estática (Server Component com `revalidate = 60`).

---

## Critérios de Aceite

- [ ] Query de próximo jogo adicionada na `AnalisePage` retorna o id do jogo imediatamente posterior por `match_date ASC`
- [ ] Componente `NextGameLink` criado em `components/bolao/NextGameLink.tsx` renderizando link para `/jogos/[nextGameId]/analise`
- [ ] Texto do link: `PRÓXIMO JOGO ►`, fonte JetBrains Mono 12px bold uppercase, cor `var(--color-primary)`, sem sublinhado
- [ ] Faixa de navegação (`BackButton` + `NextGameLink`) posicionada com `justify-content: space-between` no rodapé da página de análise
- [ ] Quando não há próximo jogo, `NextGameLink` não é renderizado e `BackButton` permanece alinhado à esquerda sem quebra de layout
- [ ] Design segue DESIGN.md: paleta verde/amarelo/azul, JetBrains Mono, sem ícones decorativos, sem border-radius, sem sombras, dark only
- [ ] Funciona em mobile (coluna única — os dois elementos ficam na mesma linha horizontal com flex)
- [ ] Sem migrations, sem novos endpoints Ruby, sem alteração de schema
- [ ] `npm run lint` e `npm run build` passam sem erros novos
