# Plano de Implementação: Correção — Nomes Longos nos Cards de Jogo

**Slug:** fix-long-names
**Branch:** feature/fix-long-names
**Data:** 2026-06-14
**Spec:** .pipeline/fix-long-names-spec.md

## Tarefas

- [ ] 1. Adicionar `minWidth: 0` na div do time da casa (linha ~159) para que a coluna `1fr` respeite o truncamento
- [ ] 2. Adicionar `overflow: hidden`, `textOverflow: 'ellipsis'` e `whiteSpace: 'nowrap'` na div do nome do time da casa (linha ~171)
- [ ] 3. Adicionar `minWidth: 0` na div do time visitante (linha ~199) para que a coluna `1fr` respeite o truncamento
- [ ] 4. Adicionar `overflow: hidden`, `textOverflow: 'ellipsis'` e `whiteSpace: 'nowrap'` na div do nome do time visitante (linha ~211)
- [ ] 5. Verificar o span do venue no footer e, se necessário, adicionar `minWidth: 0` para garantir que o flex item respeite o truncamento
