# Modelagem de Chaveamentos — Plano de Implementação

## Resumo

Criar a tabela `bracket_slots` que representa a árvore completa do mata-mata da Copa 2026 (31 slots), adicionar FK `bracket_slot_id` na tabela `games`, seed com os slots oficiais FIFA, e um componente React de visualização do bracket.

## 1. Schema e Migrations

### 1.1 Tabela `bracket_slots`

```sql
CREATE TABLE bracket_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text NOT NULL UNIQUE,       -- "R32-01" ... "R32-16", "R16-01" ... "QF-01" ... "FINAL"
  phase         text NOT NULL,              -- "16 avos de Final" | "Oitavas de Final" | ...
  position      int NOT NULL,               -- ordem (1-16, 1-8, etc.)
  source_home   text,                       -- "1º Grupo A" ou "Venc. R32-01"
  source_away   text,                       -- "Melhor 3º C/D/E/F" ou "Venc. R32-02"
  next_slot_label text,                     -- "R16-01" (NULL para FINAL e 3RD)
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### 1.2 FK em `games`

```sql
ALTER TABLE games ADD COLUMN bracket_slot_id uuid REFERENCES bracket_slots(id);
CREATE UNIQUE INDEX idx_games_bracket_slot ON games(bracket_slot_id) WHERE bracket_slot_id IS NOT NULL;
```

### 1.3 Seed — 31 slots do mata-mata

Um arquivo `20260630000001_seed_bracket_slots.sql` com todos os slots. A estrutura da árvore é:

| Nível | Slots | Labels |
|---|---|---|
| 16 avos | 16 | `R32-01` a `R32-16` |
| Oitavas | 8 | `R16-01` a `R16-08` |
| Quartas | 4 | `QF-01` a `QF-04` |
| Semifinal | 2 | `SF-01`, `SF-02` |
| 3º Lugar | 1 | `3RD` |
| Final | 1 | `FINAL` |

Encadeamento: `R32-01` + `R32-02` → `R16-01`, `R32-03` + `R32-04` → `R16-02`, etc.
`SF-01` + `SF-02` → `FINAL` (vencedores) e `3RD` (perdedores).

Os `source_home`/`source_away` dos slots `R32-*` vêm do chaveamento oficial FIFA (ex: "1º Grupo A", "Melhor 3º C/D/E/F").

### 1.4 Atualizar sync da ESPN

No `app/api/admin/sync-games/route.ts`, após o upsert de cada jogo de mata-mata (`phase != 'Fase de Grupos'`): fazer match do jogo com o `bracket_slot` correto (por data + rótulo de fase) e atualizar `bracket_slot_id`.

### 1.5 TypeScript types

Adicionar `BracketSlot` em `lib/types/game.ts` e adicionar `bracket_slot_id?: string` ao tipo `Game`.

## 2. Componentes (Visualização)

### 2.1 Página `/chaveamento` (nova)

Nova rota `app/(dashboard)/chaveamento/page.tsx`:
- Server component que busca todos os `bracket_slots` + `games` vinculados
- Organiza em estrutura de árvore para o componente de bracket

### 2.2 Componente `BracketTree` (novo)

`components/bolao/BracketTree.tsx`:
- Renderiza árvore horizontal de mata-mata (esquerda → direita)
- Colunas: 16 avos | Oitavas | Quartas | Semis | Final/3º
- Cada slot mostra:
  - Times (quando definidos), placar (quando finished), status (pending/live/finished)
  - Linhas conectando slots filhos ao slot pai
  - `source_home`/`source_away` como placeholder quando time não definido
- Responsivo: scroll horizontal em mobile

## 3. Testes

- Seed: verificar que os 31 slots são criados com labels únicos e encadeamento correto
- Sync: verificar que jogos de mata-mata sincronizados da ESPN são corretamente linkados aos slots
- UI: verificar que o bracket renderiza slots vazios corretamente
- Edge cases: fase de grupos não tem bracket_slot_id (NULL)
- RLS: leitura pública (mesmo padrão de games — authenticated pode ler bracket_slots)

## 4. Premissas

- O chaveamento FIFA é fixo e conhecido; o seed reflete o documento oficial
- Jogos de mata-mata são criados via sync ESPN; o link ao slot é feito por data + round
- Apenas 1 jogo por slot (enforced pela unique index)
- Fase de grupos não participa do bracket (`bracket_slot_id` fica NULL)
- O componente BracketTree não permite edição (MVP de visualização)
