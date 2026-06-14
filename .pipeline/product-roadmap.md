# Product Roadmap — Bolão do Cartola ABJ

Criado em: 2026-06-13

## Status Geral
- Total: 10 features
- Concluídas: 10
- Em progresso: 0
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

### 9. ranking-mobile-fit — Ajuste Mobile do Ranking — concluída
**Objetivo:** Ajustar o ranking para caber inteiramente na viewport de um celular padrão (375x667px) sem scroll vertical, preservando as informações essenciais de posição, nome e pontuação.
**Critérios de sucesso:**
- Ranking visível inteiramente na viewport de 375x667px sem scroll vertical
- Informações essenciais preservadas: posicao, nome do participante, pontuacao total
- Design responsivo seguindo DESIGN.md: dense first, tabular, mobile first, dark only, sem icones decorativos, bordas simples, sem sombras
**Dependências:** auth, game-navigation, predictions, scoring, ranking, fix-ranking-visibility
