# Fix 2: game-navigation

**Slug:** game-navigation
**Data:** 2026-06-13
**Rodada de revisão:** 2

---

## Problemas Encontrados

### Problema 1: Seed de jogos usa alegação de fonte oficial sem base verificável
**Arquivo:** `db/seeds/seed_games.rb` (linhas 17-180)
**Severidade:** crítico
**Descrição:** O arquivo declara "Jogos reais da Copa do Mundo 2026" e "Fonte: calendário oficial FIFA 2026", mas o dataset não é rastreável a uma fonte oficial verificável e contém confrontos internamente inconsistentes para um calendário real. Exemplo objetivo: a Albânia aparece em `Canadá x Albânia` (`2026-06-12T00:00:00Z`), `Argentina x Albânia` (`2026-06-13T01:00:00Z`) e `Itália x Albânia` (`2026-06-15T20:00:00Z`), o que invalida o seed como calendário autêntico da Copa 2026. Como a feature `/jogos` depende desses dados para representar a competição, a implementação hoje mistura interface correta com conteúdo factual incorreto.
**Correção esperada:** Substituir o array `GAMES` por dados consistentes e rastreáveis a uma fonte verificável da Copa do Mundo 2026, documentando no próprio arquivo e no changelog qual foi a fonte usada. Validar coerência mínima antes de fechar a correção (times não podem aparecer em múltiplos jogos incompatíveis, grupos/rodadas precisam fazer sentido, datas/sedes precisam ser consistentes). Se não for possível obter uma fonte confiável com segurança, não inventar confrontos: converter explicitamente o seed para dataset fictício/placeholder e remover qualquer alegação de oficialidade ou de "jogos reais".

### Problema 2: Changelog da feature descreve o seed como calendário real da Copa 2026
**Arquivo:** `.pipeline/game-navigation-changelog.md` (linhas 34 e 60)
**Severidade:** importante
**Descrição:** O changelog afirma que o script insere "15 jogos reais da Copa 2026", mas o próprio documento admite que os horários são aproximações. Com o seed atual contendo confrontos não confiáveis, o texto do changelog registra como fato algo que não foi validado e induz o próximo agente/revisor ao erro.
**Correção esperada:** Atualizar o changelog para refletir exatamente a natureza do dataset após a correção do seed: ou informar a fonte verificável usada para jogos reais, ou declarar de forma inequívoca que os dados são fictícios/placeholder até existir calendário confiável. Não usar as expressões "real", "oficial" ou equivalentes sem citar a origem verificável.

### Problema 3: CHANGELOG raiz propaga a alegação incorreta sobre os jogos seedados
**Arquivo:** `CHANGELOG.md` (linha 81)
**Severidade:** importante
**Descrição:** A entrada da feature registra "15 jogos reais da Copa 2026 em 6 dias", propagando para o histórico principal do projeto uma informação que não está sustentada pelo seed atual. Isso dificulta auditoria futura e mascara o problema de dados.
**Correção esperada:** Ajustar a entrada do `CHANGELOG.md` para ficar alinhada com a correção aplicada no seed: mencionar fonte verificável quando houver, ou explicitar que o dataset é provisório/fictício. O histórico principal não pode manter afirmação de oficialidade não comprovada.

---

## Itens OK (não precisam ser revisados novamente)

- Migration `db/migrations/20260613_create_games.sql`: estrutura da tabela `games`, índices e RLS seguem a spec.
- Endpoint `app/api/games/route.ts`: autenticação e validação de data continuam corretas para o escopo da feature.
- Componentes `GameCard`, `GameList` e `DayNavigator`: layout, responsividade e correções do Fix 1 podem ser mantidos; a revisão atual é apenas sobre a confiabilidade do calendário seedado.
