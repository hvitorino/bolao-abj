# Fix 1: Correção — Exibição dos Códigos de Times

**Slug:** fix-team-code-display
**Data:** 2026-06-14
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Comentário enganoso na migration 004
**Arquivo:** `supabase/migrations/20260614000004_fix_team_code_padding.sql` (linhas 8, 20 e 21)
**Severidade:** menor
**Descrição:** O comentário do arquivo diz em três lugares "converter char(3) para varchar(3)", mas o `ALTER TABLE` implementa `varchar(10)`. Um DBA lendo apenas os comentários vai entender que as colunas têm máximo de 3 chars, o que não é verdade. O changelog explica a escolha de `varchar(10)`, mas o arquivo SQL em si é internamente inconsistente.
**Correção esperada:** Substituir as três ocorrências de "varchar(3)" nos comentários da migration por "varchar(10)" para que a documentação interna do arquivo reflita o que o código faz.

### Problema 2: Ausência de CHECK CONSTRAINT após mudança para varchar(10)
**Arquivo:** `supabase/migrations/20260614000004_fix_team_code_padding.sql` (linhas 22-24)
**Severidade:** importante
**Descrição:** A mudança de `char(3)` para `varchar(10)` remove a limitação implícita de comprimento que o tipo `char` fornecia. Sem uma `CHECK` constraint explícita, o banco aceita silenciosamente qualquer string de até 10 chars nas colunas `home_team_code` e `away_team_code`. A camada de aplicação (`getTeamCode`) garante 3 chars somente na ingestão via ESPN sync; dados inseridos por seed, por outras rotas ou diretamente via SQL Admin não são protegidos. A regra de negócio (CLAUDE.md: "Códigos de time devem ter sempre exatamente 3 caracteres maiúsculos") deve ser reforçada na camada de banco.
**Correção esperada:** Adicionar ao final do `ALTER TABLE` da migration 004 (ou em uma migration separada 004a/006) as seguintes constraints:
```sql
ALTER TABLE games
  ADD CONSTRAINT games_home_team_code_length CHECK (length(trim(home_team_code)) = 3),
  ADD CONSTRAINT games_away_team_code_length CHECK (length(trim(away_team_code)) = 3);
```
**Nota:** A constraint deve usar `length(trim(...)) = 3` (e não `length(...) = 3`) para ser compatível com os dados após o trim feito na migration 004, e para tolerar espaços acidentais sem rejeitar registros válidos que eventualmente ainda tenham padding residual em outros ambientes.

---

## Itens OK (não precisam ser revisados novamente)

- Função `getTeamCode` em `app/api/admin/sync-games/route.ts`: implementação correta, fallback funcional, `padEnd(3, 'X')` como salvaguarda final
- Constante `TEAM_CODE_FALLBACK`: mapa suficiente para os casos cobertos pela spec; expansão futura é responsabilidade de quem fizer o sync
- Migration 004 — lógica de trim + ALTER TYPE: correto, resolve o padding residual do `char(3)`
- Migration 005 — regex `'^[12][A-L]$'` cobre todos os 12 grupos da Copa 2026 (A–L) e o caso `SF`; lógica de CASE WHEN está correta
- Nenhum componente frontend foi alterado: conforme a spec
- Commits em português com prefixo correto (`fix`, `chore`)
- Branch `feature/fix-team-code-display` correta
- Diagnóstico documentado no changelog (hipóteses A, B, C verificadas e documentadas)
