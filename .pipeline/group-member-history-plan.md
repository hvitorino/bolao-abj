# Plano de Implementação: Palpites e Pontuação ao Adicionar Participante a Grupo

**Slug:** group-member-history
**Branch:** feature/group-member-history
**Data:** 2026-06-19
**Spec:** .pipeline/group-member-history-spec.md

## Tarefas

- [ ] 1. Criar migration `20260619000001_copy_predictions_on_join.sql` com a função `copy_predictions_to_group` (com tratamento de exceção via RAISE WARNING), a função trigger `trigger_copy_predictions_on_join` e o trigger `on_group_member_inserted` na tabela `group_members` (espelhar em `db/migrations/`)
- [ ] 2. Validar que `npm run lint` e `npm run build` passam sem erros novos (nenhuma alteração de código frontend/backend é necessária — feature é inteiramente backend via trigger Postgres)
- [ ] 3. Escrever `.pipeline/group-member-history-changelog.md` documentando a migration criada, decisões técnicas e pontos de atenção
