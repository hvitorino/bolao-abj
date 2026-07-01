# Plano de Implementação: Correção do Chaveamento (Cruzamentos + Layout Simétrico)

**Slug:** fix-chaveamento
**Branch:** feature/fix-chaveamento
**Data:** 2026-07-01
**Spec:** .pipeline/fix-chaveamento-spec.md

## Tarefas

- [ ] 1. Criar migration `supabase/migrations/20260701000000_fix_bracket_slot_pairings.sql` com UPDATEs idempotentes corrigindo `next_slot_label` dos 10 slots R32 incorretos e `source_home`/`source_away` dos 7 slots R16 incorretos
- [ ] 2. Adicionar prop `reversed?: boolean` no `BracketConnector` e inverter coordenadas x do SVG quando `true`
- [ ] 3. Criar componente `BracketColumnRight` como espelho de `BracketColumn` (card à esquerda, conector reversed, filhos à direita)
- [ ] 4. Criar componente `SymmetricBracket` que identifica `sf01`/`sf02` como filhos do `finalRoot` e renderiza chave esquerda | FINAL+3RD centro | chave direita espelhada
- [ ] 5. Substituir `FinalAnd3rdColumn` por `SymmetricBracket` no render do componente público `BracketTree`, mantendo fallbacks
