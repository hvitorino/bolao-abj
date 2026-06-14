# Product Roadmap — Bolão do Cartola ABJ

Criado em: 2026-06-13

## Status Geral
- Total: 15 features
- Concluídas: 14
- Em progresso: 1
- Pendentes: 0

## Features Priorizadas

### 1. auth — Autenticação — concluída
**Objetivo:** Permitir que participantes se cadastrem e façam login no bolão, criando um perfil associado à conta Supabase Auth. Sem autenticação, nenhuma outra feature pode funcionar.
**Critérios de sucesso:**
- Usuário consegue se cadastrar com e-mail e senha e ter um perfil criado na tabela `profiles`
- Usuário consegue fazer login e ser redirecionado para a área protegida
- Usuário não autenticado é redirecionado para `/login` ao tentar acessar rotas protegidas
- Sessão persiste entre recarregamentos de página (Supabase session management)
- Interface em português, fonte monospace, seguindo paleta de DESIGN.md
- Formulários exibem mensagens de erro claras (e-mail já cadastrado, senha inválida, etc.)
**Dependências:** nenhuma

---

### 2. game-navigation — Navegação por Jogos — concluída
**Objetivo:** Exibir todos os jogos da Copa do Mundo 2026 organizados por dia, permitindo ao usuário navegar entre datas e visualizar status, horário e times de cada partida.
**Critérios de sucesso:**
- Jogos exibidos em cards com times, horário, status (`pending` / `live` / `finished`) e rodada
- Navegação por dia com setas `◀ ▶` funcionando corretamente
- Dia atual destacado por padrão ao carregar a página
- Contagem de jogos por dia visível no header da navegação
- Dados dos jogos da Copa 2026 seedados no Supabase (pelo menos fase de grupos)
- Layout segue DESIGN.md: componente "Placar de Jogo", fonte monospace, paleta verde/amarelo/azul
- Rota `/jogos` protegida (requer autenticação)
**Dependências:** auth

---

### 3. predictions — Palpites — concluída
**Objetivo:** Permitir que participantes registrem seu palpite de placar para cada jogo, respeitando o deadline de 5 minutos antes do início da partida.
**Critérios de sucesso:**
- Usuário consegue submeter palpite (home_score, away_score) para qualquer jogo com status `pending`
- Palpite é salvo na tabela `predictions` com UNIQUE(user_id, game_id) — edição permitida antes do deadline
- Inputs bloqueados quando `match_date - now() <= 5 minutos` ou status != `pending`
- Deadline exibido em `color-error` quando faltam ≤ 30 minutos
- Palpite registrado fica visível após o deadline
- Interface segue o componente "Card de Palpite" de DESIGN.md
- Rota `/meus-palpites` protegida e mostra todos os palpites do usuário logado
**Dependências:** auth, game-navigation

---

### 4. live-scores — Placares ao Vivo — concluída
**Objetivo:** Exibir atualizações de placar em tempo real durante os jogos, usando Supabase Realtime para propagar mudanças a todos os clientes conectados sem necessidade de reload.
**Critérios de sucesso:**
- Placar de jogos com status `live` atualiza automaticamente via Supabase Realtime (canal `games`)
- Badge `██ AO VIVO ██` pisca com animação `blink 1s step-end infinite` em `color-live`
- Timestamp de última atualização visível em `color-muted`
- Placares de jogos `finished` exibidos de forma estática em `color-muted`
- Sem necessidade de refresh manual para ver atualizações
- Endpoint/mecanismo de atualização de placares pelo administrador (pode ser via Supabase dashboard ou endpoint protegido)
**Dependências:** auth, game-navigation

---

### 5. scoring — Pontuação — concluída
**Objetivo:** Calcular automaticamente a pontuação de cada palpite ao final de cada jogo, persistindo o resultado na tabela `scores` com o breakdown detalhado dos pontos obtidos.
**Critérios de sucesso:**
- Pontuação calculada corretamente para todos os cenários: acerto de vencedor (+3), placar exato (+5), placar do vencedor (+3), diferença de gols (+2), placar do perdedor (+1), goleada (+1)
- Empate tratado corretamente: acerto de empate = +3 (vencedor); placar exato no empate = +5 adicional
- Cálculo disparado automaticamente quando `games.status` muda para `finished`
- Tabela `scores` populada com `breakdown` em JSON detalhando cada componente
- Pontuação por jogo exibida no estilo "Pontuação por Jogo" de DESIGN.md
- Lógica de pontuação implementada em Ruby (backend) e espelhada em `lib/scoring.ts` (frontend)
**Dependências:** auth, game-navigation, predictions, live-scores

---

### 6. ranking — Ranking — concluída
**Objetivo:** Exibir o ranking geral do bolão com pontuação acumulada de cada participante, atualizado em tempo real via Supabase Realtime.
**Critérios de sucesso:**
- Ranking exibe todos os participantes ordenados por pontos totais (soma de `scores`)
- Percentual de aproveitamento calculado (pontos obtidos / pontos máximos possíveis)
- Líder destacado com seta `►` em `color-accent`
- Usuário logado destacado em `color-primary` e sempre visível (fixado em mobile se fora da viewport)
- Atualização em tempo real via Supabase Realtime (canal `scores`)
- Posições animadas com transição suave ao atualizar
- Layout segue componente "Ranking" de DESIGN.md: tabela densa, uppercase, monospace
- Rota `/ranking` protegida
**Dependências:** auth, game-navigation, predictions, scoring

---

### 7. predictions-edit — Edição de Palpites — concluída
**Objetivo:** Permitir que o usuário edite seu palpite para um jogo enquanto o deadline (5 minutos antes do início) não expirou, substituindo a entrada existente via UPSERT.
**Critérios de sucesso:**
- Usuário com palpite já enviado consegue alterar os valores antes do deadline
- Edição bloqueada quando `match_date - now() <= 5 minutos` ou status != `pending`
- PATCH `/api/predictions` (ou UPSERT no endpoint POST) persiste a atualização com UNIQUE(user_id, game_id)
- Interface exibe estado "palpite enviado — clique para editar" de forma clara
- Após edição, novo palpite substituiu o anterior e é exibido corretamente
- Fluxo revisado em duas rodadas (fix-1 aplicado e reaprovado) e mergeado via --no-ff na main em 2026-06-14
**Dependências:** auth, game-navigation, predictions

---

### 8. fix-ranking-visibility — Correção: Visibilidade no Ranking — concluída
**Objetivo:** Investigar e corrigir o problema que impede o usuário cadastrado de ver sua pontuação no ranking, cobrindo possíveis falhas em RLS do Supabase, cálculo de scores, exibição no frontend ou ausência de dados (predictions/scores).
**Critérios de sucesso:**
- Usuário logado consegue ver sua pontuação no ranking
- Ranking exibe todos os participantes com pontuação calculada corretamente
- Se não houver palpites feitos, o usuário aparece com 0 pontos (ou mensagem explicativa)
- Políticas RLS verificadas e corrigidas se necessário
- Logs/diagnóstico claros sobre a causa raiz documentados no changelog
**Dependências:** auth, game-navigation, predictions, scoring, ranking

---

### 10. live-scores-realtime — Placares em Tempo Real (Realtime) — concluída
**Objetivo:** Implementar atualização automática dos placares na aba de jogos via Supabase Realtime — quando um jogo passa para `live` ou tem `home_score`/`away_score` atualizados, o cliente reflete a mudança sem reload de página; o ranking também se atualiza em tempo real via canal `scores`.
**Critérios de sucesso:**
- Quando `games.status` muda para `live` ou `home_score`/`away_score` são atualizados, o componente de jogos reflete a mudança automaticamente sem reload
- O placar exibido em tempo real usa canal Realtime do Supabase (`supabase.channel`)
- A UI indica visualmente quais jogos estão ao vivo (badge piscante `██ AO VIVO ██` em `color-live`)
- A conexão Realtime é encerrada corretamente ao desmontar o componente (sem memory leaks)
- Os scores/pontuações da tabela `scores` também são atualizados em tempo real no ranking
**Dependências:** auth, game-navigation, live-scores, scoring, ranking

---

### 11. game-participants-view — Palpites e Pontuação dos Participantes por Jogo — concluída
**Objetivo:** Em cada card de jogo na tela `/jogos`, exibir para todos os participantes do bolão qual foi o palpite de cada um e quantos pontos ganhou naquele jogo, permitindo que qualquer participante veja o palpite e a pontuação de todos em cada partida.
**Critérios de sucesso:**
- Em cada card de jogo, a lista de todos os participantes é exibida com seu palpite (ex: "João: 2×1") e sua pontuação naquele jogo (ex: "+8 pts")
- Se o participante não fez palpite, exibe estado adequado (ex: "sem palpite" ou "-")
- Se o jogo está pendente (sem placar), mostra o palpite mas sem pontuação ainda
- Os dados são carregados de forma eficiente (sem N+1 queries) — idealmente uma única query com JOIN entre `predictions`, `scores` e `profiles`
- Layout segue DESIGN.md: fonte monospace, paleta verde/amarelo/azul, sem ícones decorativos
**Dependências:** auth, game-navigation, predictions, scoring

---

### 9. ranking-mobile-fit — Ajuste Mobile do Ranking — concluída
**Objetivo:** Ajustar o ranking para caber inteiramente na viewport de um celular padrão (375x667px) sem scroll vertical, preservando as informações essenciais de posição, nome e pontuação.
**Critérios de sucesso:**
- Ranking visível inteiramente na viewport de 375x667px sem scroll vertical
- Informações essenciais preservadas: posicao, nome do participante, pontuacao total
- Design responsivo seguindo DESIGN.md: dense first, tabular, mobile first, dark only, sem icones decorativos, bordas simples, sem sombras
**Dependências:** auth, game-navigation, predictions, scoring, ranking, fix-ranking-visibility

---

### 13. fix-team-code-display — Correção: Exibição dos Códigos de Times — concluída
**Objetivo:** Corrigir a exibição das abreviações (códigos) dos times nos cards de jogos, onde apenas a primeira letra do código está sendo exibida (ex: "G" em vez de "GER") tanto no card principal quanto no resumo de palpite.
**Critérios de sucesso:**
- Os códigos dos times exibem 3 letras corretamente (ex: "GER", "CUR", "BRA", "ARG")
- Nenhum outro componente que exibe os nomes dos times é afetado
- O fix cobre tanto o card principal quanto o resumo de palpite (ambos visíveis no bug reportado)
**Dependências:** game-navigation, predictions

---

### 12. fix-goleada-scoring — Correção: Regra de Goleada na Pontuação — concluída
**Objetivo:** Corrigir a lógica de pontuação por goleada em TypeScript e Ruby para aplicar o +1 somente quando o vencedor no palpite marcou mais de 3 gols (4+) e a diferença de gols no jogo real é também maior que 3 (4+ de diferença), ao invés da regra atual que usa 3+ gols.
**Critérios de sucesso:**
- `lib/scoring.ts` aplica goleada somente quando: acertou vencedor E palpite do vencedor >= 4 gols E diferença real >= 4 gols
- Lógica Ruby em `api/` espelha exatamente a mesma condição
- Testes automatizados (se existirem) cobrem: palpite 3x0 (nao recebe), palpite 4x0 com diferenca real >= 4 (recebe)
- `CLAUDE.md` atualizado para documentar a regra corrigida com clareza
**Dependências:** scoring

---

### 15. fix-live-scores-display — Correção: Exibição e Atualização de Placar em Tempo Real — em progresso
**Objetivo:** Corrigir a exibição do placar de jogos com status `live` na aba de jogos e garantir que atualizações de placar e pontuação cheguem ao frontend via Supabase Realtime sem necessidade de refresh.
**Critérios de sucesso:**
- O placar de jogos com status `live` (ex: Holanda x Japão) é exibido corretamente na aba `/jogos`
- Atualizações de `home_score`/`away_score` em `games` chegam ao frontend via canal Realtime sem reload
- A pontuação dos participantes na tabela `scores` também é atualizada em tempo real
- O badge `██ AO VIVO ██` aparece e pisca para jogos com status `live`
- Nenhum memory leak: subscription encerrada ao desmontar o componente
**Dependências:** auth, game-navigation, live-scores, live-scores-realtime, scoring, ranking

---

### 14. fix-long-names — Correção: Nomes Longos nos Cards de Jogo — concluída
**Objetivo:** Corrigir o layout dos cards de jogo para que nenhum texto quebre para uma segunda linha — nomes de times e de estádios devem ser truncados com "..." quando necessário.
**Critérios de sucesso:**
- Nomes de times abaixo dos códigos (ex: "COSTA DO MARFIM") aparecem em uma única linha, truncados com "..." se necessário
- Nome do estádio aparece em uma única linha, truncado com "..." se necessário
- Nenhum texto no card de jogo quebra para uma segunda linha
- O layout do card permanece consistente independente do tamanho do nome
**Dependências:** game-navigation
