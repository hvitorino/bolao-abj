# Product Roadmap — Bolão da Copa

Criado em: 2026-06-13

## Status Geral
- Total: 56 features
- Concluídas: 55
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

### 15. fix-live-scores-display — Correção: Exibição e Atualização de Placar em Tempo Real — concluída
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

---

### 16. fix-initial-state-load — Correção: Carregamento do Estado Inicial nos Hooks Realtime — concluída
**Objetivo:** Garantir que os hooks de Realtime (useGameRealtime, useScoreRealtime) carreguem o estado inicial via fetch no mount, eliminando a tela vazia que ocorre ao recarregar a página enquanto aguarda o próximo evento Realtime chegar.
**Critérios de sucesso:**
- Ao carregar/recarregar a página, os dados dos jogos (placar, status) são exibidos imediatamente, sem esperar por evento Realtime
- Jogos com status 'live' mostram o placar atual logo no mount
- O Realtime continua funcionando para atualizações subsequentes após o carregamento inicial
**Dependências:** live-scores, live-scores-realtime, fix-live-scores-display

---

### 18. como-pontuar — Página "Como Pontuar" — concluída
**Objetivo:** Criar uma página estática no dashboard explicando de forma clara e visual como as pontuações dos palpites são calculadas, exibindo cada regra com pontos correspondentes e pelo menos um exemplo concreto de cálculo.
**Critérios de sucesso:**
- Nova rota `/como-pontuar` acessível no dashboard (grupo protegido)
- Tabela com todos os eventos de pontuação e pontos correspondentes
- Pelo menos um exemplo concreto de cálculo (ex: Brasil 3×1 Argentina, palpite correto = +8 pts)
- Regra de empate documentada explicitamente
- Regra de cumulatividade dos bônus explicada
- Link de navegação para a página adicionado no layout do dashboard
- Visual consistente com DESIGN.md (monospace, paleta verde/amarelo/azul, estilo Elifoot)
**Dependências:** auth

---

### 17. fix-prediction-visibility — Correção: Visibilidade Temporal dos Palpites — concluída
**Objetivo:** Ajustar a visibilidade dos palpites na tela de jogos para que, antes do início da partida, apenas o próprio usuário autenticado veja seu palpite. Quando o jogo não estiver mais em estado `pending`, os palpites dos demais participantes podem voltar a aparecer normalmente.
**Critérios de sucesso:**
- Em jogos ainda não iniciados, a interface e/ou backend não expõem palpites de outros usuários; apenas o palpite do usuário atual fica visível
- Em jogos iniciados (`live`) ou finalizados (`finished`), a visualização dos palpites dos outros usuários funciona normalmente
- A regra é aplicada de forma consistente nas superfícies relevantes do produto onde palpites são listados/exibidos
- Testes e validações adequados da mudança são realizados dentro do pipeline
- O pipeline só termina após revisão/aprovação e merge, com os artefatos `.pipeline` atualizados
**Dependências:** auth, game-navigation, predictions, game-participants-view

---

### 19. live-scoring — Pontuação em Tempo Real Durante Jogos ao Vivo — concluída
**Objetivo:** Exibir, enquanto um jogo está com status `live`, a pontuação parcial/projetada de cada palpiteiro recalculada em tempo real a cada mudança de placar — aplicando as mesmas regras de `lib/scoring.ts`/`calculate_scores_for_game` ao placar atual (ainda não final) — em vez de só mostrar pontuação após o jogo terminar. Ao finalizar o jogo, a pontuação final oficial (já calculada via trigger) deve prevalecer sem inconsistência com a última pontuação parcial exibida.
**Critérios de sucesso:**
- Durante um jogo `live`, a pontuação de cada palpiteiro recalcula e atualiza na tela automaticamente conforme `home_score`/`away_score` mudam via Realtime, sem reload manual
- A pontuação parcial usa exatamente a mesma lógica cumulativa de `lib/scoring.ts` (vencedor, placar exato, placar do vencedor, diferença de gols, placar do perdedor, goleada) aplicada ao placar parcial atual
- A UI marca claramente que a pontuação exibida durante o jogo `live` é parcial/provisória (ex: indicador "AO VIVO" / "PROVISÓRIO"), distinguindo-a da pontuação final de `scores`
- Ao `games.status` mudar para `finished`, a pontuação final calculada pelo trigger Postgres bate com a última pontuação parcial mostrada para o mesmo placar (mesma lógica, sem "pulo" de pontos inexplicado)
- O cálculo parcial é client-side (reutilizando `calculateScore()` de `lib/scoring.ts` sobre os dados já recebidos via `useGameRealtime`/predictions), sem necessidade de nova tabela ou de persistir parcial em `scores` — `scores` continua reservada à pontuação oficial pós-jogo
- O ranking (`/ranking`) também reflete a pontuação parcial de jogos `live` somada à pontuação oficial de jogos `finished`, e não apenas a pontuação oficial
**Dependências:** auth, game-navigation, predictions, live-scores, live-scores-realtime, scoring, ranking, game-participants-view

---

### 20. grupos — Grupos Privados (Bolões Isolados) — concluída
**Objetivo:** Permitir que usuários criem grupos (bolões) privados e convidem participantes via link reutilizável; cada grupo é totalmente isolado em participantes, palpites, pontuação e ranking, e um mesmo usuário pode participar de múltiplos grupos com palpites independentes por grupo para o mesmo jogo.
**Critérios de sucesso:**
- Usuário autenticado consegue criar um novo grupo e se torna automaticamente seu admin
- Admin consegue obter/copiar um link de convite reutilizável (não é de uso único) para o grupo
- Um usuário (novo ou já existente no sistema) consegue entrar em um grupo através do link de convite e passa a ser participante daquele grupo
- Usuário só visualiza ranking, participantes e palpites de grupos dos quais é membro; nenhum dado de outros grupos fica acessível (via UI ou API/RLS)
- `predictions` passa a ter constraint `UNIQUE(user_id, game_id, group_id)` em vez de `UNIQUE(user_id, game_id)`, permitindo palpites diferentes do mesmo usuário para o mesmo jogo em grupos diferentes
- `scores` passa a ter `group_id`, e todo o cálculo de pontuação/ranking (trigger Postgres + `lib/scoring.ts` + agregação de ranking/live-scoring) é escopado por grupo, sem regressão nas regras de pontuação de `CLAUDE.md`
- Script de migração move todos os usuários e palpites/scores existentes para um novo grupo "Bolão da Ingrisia ABJ", com o usuário "Hamon" definido como admin desse grupo
- Usuário pertencente a múltiplos grupos consegue dar palpites diferentes para o mesmo jogo em grupos diferentes, e cada grupo calcula pontuação/ranking de forma independente e correta
**Dependências:** auth, game-navigation, predictions, live-scores, scoring, ranking, live-scoring

---

### 21. espn-sync — Sincronização Automática de Jogos via ESPN API — concluída
**Objetivo:** Substituir o dataset placeholder de jogos por dados reais sincronizados periodicamente da ESPN Scoreboard API, mantendo `games` (placar, status, rodada, estádio) atualizado automaticamente sem intervenção manual do admin.
**Critérios de sucesso:**
- Endpoint `POST /api/admin/sync-games` busca jogos da ESPN Scoreboard API por intervalo de dias e faz UPSERT idempotente em `games` por `espn_id`
- Autenticação dupla (admin via `X-Admin-Secret` e cron via `Authorization: Bearer <CRON_SECRET>`) com `401` para credenciais inválidas
- Status ESPN mapeado corretamente para `pending`/`live`/`finished`; placar `NULL` enquanto `pending`
- Sincronização periódica automatizada (cron) sem necessidade de acionamento manual
- Falha em evento individual não aborta o sync inteiro (erros parciais reportados, não bloqueantes)
- Times e rodadas traduzidos para português com fallback seguro quando a tradução não existe
**Dependências:** game-navigation
**Observação:** feature implementada fora do fluxo padrão do pipeline (sem spec formal do Analista nem branch `feature/espn-sync` com merge via Revisor) — registrada aqui retroativamente para manter o roadmap fiel ao estado real do sistema em produção. Especificação técnica e changelog ficaram registrados em `.pipeline/espn-sync-spec.md`, `.pipeline/espn-sync-plan.md` e `.pipeline/espn-sync-changelog.md`, e passou por correções subsequentes (commits `1a0bd3c`, `78c68d8`, `2fc8ba5`, `853e927`) já incorporadas à main.

---

### 22. convites-nominais — Convites Nominais para Grupos — concluída
**Objetivo:** Permitir que o admin de um grupo convide ativamente uma pessoa específica (em vez de depender só de compartilhar manualmente o link reutilizável), criando um convite nominal rastreável que o destinatário vê e pode aceitar/recusar dentro do produto.

**Decisão de escopo (análise do PM):** a feature `grupos` (item 20, já concluída) entregou criação de grupo e convite via **link reutilizável anônimo** — qualquer pessoa com o link entra, sem rastro de quem foi convidado nem confirmação de quem ainda não respondeu. A spec original de `grupos` listou explicitamente como fora de escopo: "Convite por e-mail/notificação push (o convite é só o link reutilizável copiável)". A solicitação do usuário ("enviar convites") aponta para esse gap real: hoje não existe nenhuma forma de convidar uma pessoa específica nem de ver/gerenciar convites pendentes.

Avaliado o contexto do projeto (bolão pequeno entre amigos, sem provedor de e-mail configurado — `package.json` não tem `resend`/`nodemailer`/`sendgrid` nem qualquer SDK de envio de e-mail, e não há variável de ambiente de SMTP/API key documentada), envio de e-mail real foi descartado como desproporcional para esta entrega: exigiria contratar/configurar um provedor externo e verificar domínio, o que está fora do que o projeto tem hoje. O escopo desta feature é um **convite nominal dentro do produto**: o admin escolhe um usuário já cadastrado (por nome, ou e-mail se aplicável) e cria um convite endereçado a ele; o convite aparece como pendente para o admin (visibilidade de quem foi convidado e quem ainda não aceitou) e para o convidado (notificação dentro do app, ex: lista "convites pendentes" visível ao logar). Convite por link reutilizável continua existindo em paralelo (não é removido) — esta feature adiciona um segundo mecanismo, mais direcionado, sem substituir o primeiro.

Envio por e-mail real fica registrado como sugestão futura (ver `product-final-report.md` quando atualizado).

**Critérios de sucesso:**
- Admin de um grupo consegue criar um convite nominal endereçado a um usuário específico já cadastrado no sistema (buscável por nome ou e-mail), sem precisar compartilhar link manualmente
- O convite nominal fica em estado "pendente" e é visível ao admin na tela do grupo (quem foi convidado, quando, status)
- O usuário convidado vê o convite pendente dentro do produto (ex: notificação/lista ao acessar `/grupos` ou dashboard) e consegue aceitar (entra no grupo como `member`) ou recusar
- Convidar um usuário que já é membro do grupo, ou repetir o convite para a mesma pessoa enquanto pendente, é tratado de forma idempotente/com mensagem clara (sem duplicar convites nem erro confuso)
- Mecanismo de convite por link reutilizável (feature `grupos`) continua funcionando sem regressão
- Isolamento por grupo é preservado: convite nominal só é visível/gerenciável por quem é admin do grupo em questão; usuário só vê convites endereçados a ele mesmo

**Dependências:** grupos
**Observação de conclusão:** aprovada sem rodada de fix em 2026-06-16; merge `feature/convites-nominais` na main confirmado (commit `39275f2`). Migration `group_invites` com RLS, índice único parcial para idempotência, funções `is_group_admin`/`search_users_to_invite` (SECURITY DEFINER, sem expor e-mail de terceiros). Endpoints novos com autenticação Bearer JWT + autorização explícita. Zero diff nos arquivos do fluxo de link reutilizável (`groups.invite_token`, `/convite/[token]`, `resolve-invite`, `join`). `npm run lint` e `npm run build` limpos. Polimento futuro não-bloqueante identificado: `PendingInvitesList` não refaz fetch automático ao receber `409` (convite já respondido em outra aba) — apenas exibe erro inline.

---

### 23. grupo-ativo-persistente — Seleção Persistente de Grupo Ativo — concluída
**Objetivo:** Fazer a seleção do "grupo ativo" ocorrer exclusivamente na área/aba "Grupos" e persistir em todas as páginas do dashboard (Jogos, Ranking, Palpites) até que o usuário a altere ativamente de novo, ali na área de Grupos — corrigindo a perda de seleção hoje causada por `NavLinks` apontar para paths "nus" sem preservar `?group=`.

**Contexto do problema (levantamento do PM):** hoje o grupo ativo é resolvido só via query param `?group=<id>` (`lib/active-group.ts`/`resolveActiveGroup()`); sem o param, o sistema sempre cai no primeiro grupo por `joined_at ASC`. Não há persistência em cookie/localStorage/sessão. O `GroupSwitcher` (`app/(dashboard)/group-switcher.tsx`) aparece no header em todas as páginas do dashboard (renderizado em `app/(dashboard)/layout.tsx`), não só em Grupos, e ao trocar grupo só atualiza o `?group=` da página atual. `NavLinks` (`app/(dashboard)/nav-links.tsx`) linka para `/jogos`, `/ranking`, `/meus-palpites`, `/grupos`, `/como-pontuar` sem preservar `?group=` — ao clicar em outra aba, a seleção se perde e a página recalcula para o primeiro grupo. A página `/grupos` hoje não tem nenhum seletor de grupo ativo.

**Critérios de sucesso:**
- O usuário escolhe/troca o grupo ativo na área "Grupos" (não mais a única forma de troca ser um dropdown solto no header desconectado da navegação — cabe ao Analista decidir se o `GroupSwitcher` do header é removido, mantido como atalho secundário, ou redirecionado para a lógica central, desde que a fonte de verdade da troca seja a área de Grupos)
- A seleção persiste ao navegar entre Jogos, Ranking e Palpites (e demais páginas do dashboard) sem regressão para o primeiro grupo por `joined_at ASC` e sem depender de o usuário manter `?group=` manualmente na URL
- A seleção só muda quando o usuário a altera ativamente na área de Grupos
- A persistência sobrevive a reload de página (mecanismo — cookie, localStorage, ou estado server-side — a critério do Analista, desde que atenda ao requisito)
- Mantém compatibilidade com o fluxo existente para usuários sem grupo (redirect para `/grupos`) e com o membership check (`error: 'forbidden'`) de `resolveActiveGroup()`
**Dependências:** grupos
**Observação de conclusão:** aprovada sem rodada de fix em 2026-06-16. O dropdown `GroupSwitcher` no header foi substituído por um cookie HTTP (`bolao_active_group`) que persiste o grupo ativo entre navegações no menu, reloads (F5) e sessões do navegador; deep links (`?group=`) continuam funcionando como override pontual sem persistir. A troca de grupo ativo passou a ocorrer explicitamente em `/grupos` ou `/grupos/[id]` via novo componente `AtivarGrupoButton`, que chama o novo endpoint `POST /api/groups/active`. `npm run lint` e `npm run build` passaram sem erros. Nenhuma migration nova; nenhuma alteração em RLS, regras de pontuação ou Realtime.

---

### 24. exemplos-por-regra — Exemplo Dedicado por Regra de Pontuação — concluída
**Objetivo:** Na página `/como-pontuar`, garantir que cada uma das 6 regras listadas em `ScoringRulesTable` tenha um exemplo de cálculo concreto e isolado demonstrando especificamente aquela regra, em vez de depender apenas de exemplos compostos genéricos.
**Critérios de sucesso:**
- Cada uma das 6 regras da tabela (acerto do vencedor, placar exato, somente placar do vencedor, diferença de gols correta, somente placar do perdedor, goleada) tem um exemplo de cálculo visível na página demonstrando especificamente aquela regra isolada (ou o mínimo de regras combinadas necessário para isolá-la sem confundir com outra)
- Os exemplos deixam claro o vínculo com a regra correspondente da tabela (rótulo, ordem ou agrupamento visual que ligue exemplo à linha da tabela)
- Nenhuma regressão nos exemplos/conteúdo já existentes que continuem válidos (empate, cumulatividade) — podem ser reaproveitados/ajustados dentro do novo conjunto
- Cálculos exibidos são matematicamente corretos conforme `lib/scoring.ts`, idealmente validados contra a função real
- Layout responsivo e visual seguem DESIGN.md, consistente com `ScoringExample`/`ScoringRulesTable` já existentes
**Dependências:** como-pontuar
**Observação de conclusão:** aprovada e mergeada em 2026-06-16 (commit `2f7e9f7`, `merge(feature/exemplos-por-regra)`). Seis exemplos isolados criados, um por regra, na mesma ordem de `SCORING_RULES`/`ScoringRulesTable`, mais um exemplo complementar de empate em subseção própria. Nova prop opcional `ruleLabel` em `ScoringExample.tsx` faz o vínculo visual exemplo↔regra. Grid responsivo ajustado para breakpoint intermediário (640px/1024px) evitando cards apertados em tablet. Valores validados contra `calculateScore()` real via script ad-hoc (não commitado). `npm run lint` e `npm run build` limpos.

---

### 25. fix-loser-score-rule — Correção da Regra "Somente Placar do Perdedor" — concluída
**Objetivo:** Corrigir a condição de concessão do bônus "Somente placar do perdedor" (+1 pt) para exigir também o acerto do vencedor do jogo — a regra anterior concedia o bônus justamente quando o vencedor era errado, contradizendo a tabela de pontuação do `CLAUDE.md`.
**Critérios de sucesso:**
- `lib/scoring.ts` só concede `loser_score_points` quando `predWinner === realWinner` (mesma estrutura usada por `winner_score_points`/`diff_points`), e o branch de vencedor errado não concede nenhum bônus
- Função Postgres `calculate_scores_for_game` espelha exatamente a mesma condição, via nova migration idempotente que não edita migrations já aplicadas
- Migration recalcula retroativamente os `scores` de jogos `finished` já gravados pela regra antiga
- `CLAUDE.md`, `ScoringRulesTable.tsx` e os exemplos afetados em `/como-pontuar` (EXEMPLO_1, EXEMPLO_5, EXEMPLO_6) refletem a regra corrigida sem regressão nas demais regras de pontuação
- Validação exaustiva (simulação de todos os placares possíveis) confirma exclusividade mútua entre `winner_score`, `diff` e `loser_score`, sem dupla contagem
**Dependências:** scoring
**Observação:** correção pontual de regra de negócio (branch `fix/fix-loser-score-rule`, fora do fluxo `feature/`), análoga a `fix-goleada-scoring` (item 12). Aprovada sem rodada de fix em 2026-06-16. Migration `supabase/migrations/20260616130000_fix_loser_score_rule.sql` criada mas **não aplicada** ao banco de produção — aplicação pendente, a ser feita via skill `supabase-migration` quando solicitada explicitamente. `npm run lint` e `npm run build` limpos.

---

### 26. collapse-game-card — Colapsar/Expandir Card de Jogo com Palpites dos Participantes — concluída
**Objetivo:** Na tela `/jogos`, cada `GameCard` deve carregar colapsado por padrão, ocultando a seção "PALPITES DOS PARTICIPANTES" (`GameParticipantsList`); um controle clicável e acessível via teclado alterna a exibição, com estado de expansão independente por card e sem interromper as subscriptions Realtime já existentes.
**Critérios de sucesso:**
- Card de jogo carrega colapsado por padrão, ocultando `GameParticipantsList`
- Controle (`<button>`) com `aria-expanded`/`aria-controls` alterna expandir/recolher, acessível via teclado (foco nativo, ativação por Enter/Espaço)
- Estado de expansão é local a cada `GameCard` — múltiplos cards podem ficar expandidos simultaneamente sem interferência
- `useGameRealtime`/`useScoreRealtime` permanecem incondicionais e ativos independentemente do estado de colapso (sem regressão de Realtime)
- Nenhuma mudança de schema, migration ou endpoint — feature puramente client-side
**Dependências:** game-navigation, game-participants-view
**Observação de conclusão:** aprovada sem rodada de fix em 2026-06-16; merge `feature/collapse-game-card` na main confirmado (commit `a3fcfa5`). Diff isolado a `components/games/GameCard.tsx`. `npm run lint` e `npm run build` limpos. Pendência não-bloqueante registrada no changelog: validação visual em navegador (toggle em `/jogos`, mobile, e cenário `live` com card expandido) não foi possível no ambiente do pipeline — recomendada verificação manual.

---

### 27. prediction-score-breakdown — Detalhamento da Pontuação no Palpite — concluída
**Objetivo:** Dentro da lista de palpites de um jogo já expandido (`GameParticipantsList`, entregue por `game-participants-view`/`collapse-game-card`), permitir que o usuário clique na linha do palpite de um participante para revelar o breakdown detalhado da pontuação daquele palpite (vencedor, placar exato, placar do vencedor, diferença de gols, placar do perdedor, goleada), lendo diretamente o campo `breakdown jsonb` já existente em `scores`, sem duplicar a lógica de cálculo.
**Critérios de sucesso:**
- Clicar na linha do palpite de um participante (dentro de um jogo já expandido) exibe o breakdown de pontos daquele palpite, com cada componente que contribuiu (>0 pontos) rotulado e visível; se nenhum bônus se aplicou, indicação clara de "0 pontos"
- Clicar novamente na mesma linha fecha o detalhamento (toggle independente por linha, sem afetar outras linhas nem o estado de expansão do card do jogo)
- O detalhamento é fiel ao campo `breakdown` armazenado em `scores` — nenhuma lógica de cálculo de pontuação é duplicada ou reimplementada no frontend
- Jogos/palpites sem `scores` correspondente (sem pontuação calculada ainda) não quebram a UI — a linha não oferece expansão de detalhe, ou mostra estado vazio apropriado
- Layout segue DESIGN.md rigorosamente (monospace, paleta verde/amarelo/azul, dense, sem ícones decorativos)
**Dependências:** game-participants-view, collapse-game-card, scoring
**Observação:** feature pontual solicitada diretamente pelo usuário; PM não deve avançar para outras features do roadmap após a conclusão desta (escopo limitado a esta entrega). Aprovada sem rodada de fix em 2026-06-16; merge `feature/prediction-score-breakdown` na main confirmado. Implementação fiel à spec: leitura pura do campo `breakdown jsonb` já existente em `scores` (sem reimplementar cálculo, sem migration, sem endpoint novo). Novo componente `components/bolao/PredictionBreakdown.tsx`, accordion exclusivo por jogo em `GameParticipantsList.tsx` com acessibilidade via teclado (`role="button"`, `tabIndex`, `Enter`/`Espaço`, `aria-expanded`), tipo `ParticipantEntry` estendido com `breakdown: ScoreBreakdown | null`. `npm run lint` e `npm run build` passaram sem erros.

---

### 28. date-picker-jogos — Seletor de Datas com Jogos — concluída
**Objetivo:** Na aba de jogos, ao clicar na data exibida no `DayNavigator`, abrir um dropdown/picker listando apenas as datas que possuem jogos cadastrados no Supabase, permitindo navegação direta a qualquer data sem precisar clicar seta a seta.
**Critérios de sucesso:**
- Clicar na área de exibição da data abre um dropdown com a lista de datas que possuem jogos (`games.match_date` distintos, convertidos para datas em BRT)
- Apenas datas com pelo menos 1 jogo aparecem na lista (sem datas vazias)
- Selecionar uma data na lista fecha o dropdown e navega diretamente para aquela data (`/jogos?date=YYYY-MM-DD`)
- A data atual (`currentDate`) aparece destacada na lista (ex: `color-accent`)
- O dropdown pode ser fechado sem selecionar nenhuma data (clique fora ou tecla Esc)
- Acessibilidade: navegação por teclado (setas, Enter, Esc) funciona corretamente
- Visual segue DESIGN.md rigorosamente (monospace, paleta verde/amarelo/azul, sem ícones decorativos, dense)
- As setas `◀ ▶` de navegação dia a dia permanecem funcionando (não são removidas)
- Sem nova tabela, migration ou endpoint dedicado — as datas são derivadas de `games.match_date` existente
**Dependências:** game-navigation

---

### 29. date-chips-nav — Navegação por Chips de Data — concluída
**Objetivo:** Substituir completamente o dropdown de seleção de data e as setas de navegação dia a dia (`DayNavigator`) por uma faixa de chips horizontais com scroll, onde cada chip representa uma data com jogos disponíveis; o chip ativo fica destacado em `color-accent` bold e é centralizado automaticamente na viewport ao carregar a página.
**Critérios de sucesso:**
- O `DayNavigator` existente (dropdown + setas `◀ ▶`) é completamente substituído pela faixa de chips horizontais
- Apenas datas com pelo menos 1 jogo aparecem como chips (mesmo critério já usado pelo `date-picker-jogos`)
- O chip da data ativa é exibido em `color-accent` bold; os demais ficam em `color-muted` ou `color-text`
- Ao carregar a página, o chip ativo é automaticamente centralizado na área visível (scroll automático via `scrollIntoView` ou equivalente)
- A faixa suporta scroll horizontal (overflow-x: auto) em mobile sem barra de scroll visível
- Clicar em qualquer chip navega diretamente para `/jogos?date=YYYY-MM-DD` da data correspondente
- Visual: JetBrains Mono, sem bordas arredondadas (`border-radius: 0`), seguindo rigorosamente DESIGN.md (paleta verde/amarelo/azul, monospace, dense, sem ícones decorativos)
- Sem nova tabela, migration ou endpoint dedicado — as datas são derivadas de `games.match_date` existente
- Acessibilidade: chips são elementos `<button>` ou `<a>` com `aria-current="true"` no chip ativo; navegação por teclado funciona corretamente
**Dependências:** game-navigation, date-picker-jogos

---

### 31. remove-member — Remover Participante do Grupo — concluída
**Objetivo:** O admin do grupo pode remover um participante a partir da tela de gerenciamento do grupo. Ao lado de cada membro (exceto o próprio admin), aparece uma ação de remover; após confirmação, o membro é excluído da tabela `group_members` e perde acesso ao grupo imediatamente.
**Critérios de sucesso:**
- Admin vê botão/ícone de remover ao lado de cada membro (não ao lado de si mesmo)
- Ao clicar, aparece confirmação antes de executar a remoção
- Após confirmação, o membro é removido da tabela `group_members` no Supabase
- A lista de participantes atualiza imediatamente após a remoção
- Membros removidos perdem acesso ao grupo
- Não-admin não vê a opção de remover
**Dependências:** grupos, delete-group

---

### 32. prediction-visibility — Distinção entre Palpite Oculto e Pendente — concluída
**Objetivo:** Evoluir a visibilidade dos palpites na tela de jogos para que, em jogos `pending`, terceiros vejam `OCULTO` (cinza) quando o palpite existe mas está protegido por regra de negócio, e `PENDENTE` (vermelho) quando o palpite ainda não foi enviado — distinguindo os dois estados sem revelar o valor do palpite.
**Critérios de sucesso:**
- Em jogos `pending`, terceiros com palpite exibem `OCULTO` em `color-muted` (cinza)
- Em jogos `pending`, terceiros sem palpite exibem `PENDENTE` em `color-error` (vermelho)
- O próprio usuário sempre vê seu palpite real, independentemente do status do jogo
- Em jogos `live` e `finished`, o comportamento original é mantido (palpites visíveis para todos)
- A query service_role seleciona apenas `user_id, game_id` — nenhum valor de palpite de terceiros chega ao cliente em jogos `pending`
- `hasPrediction` populado apenas para membros do grupo ativo (sem vazar dados entre grupos)
- `lib/supabase/service-server.ts` centraliza o cliente service_role sem duplicação
- `npm run lint` e `npm run build` passam sem erros novos
- Decisão arquitetural de uso de service_role documentada com justificativa explícita na spec
**Dependências:** auth, game-navigation, predictions, game-participants-view, fix-prediction-visibility
**Observação de conclusão:** aprovada após uma rodada de fix (fix-1 exigiu apenas documentação — spec formal e justificativa arquitetural; nenhuma mudança de código). Merge `feature/prediction-visibility` na main confirmado (commit `e3a7d29`) em 2026-06-17.

---

### 33. fix-predictions-reveal-on-live — Correção: Revelação de Palpites ao Vivo — concluída
**Objetivo:** Corrigir o bug em que, quando o status de um jogo muda para `live`, os palpites dos demais participantes continuam exibidos como "-" na UI até que o usuário recarregue manualmente a página — a transição de status deveria disparar automaticamente um refetch dos palpites para todos os clientes conectados.
**Critérios de sucesso:**
- Quando o status de um jogo muda para `live` (via Supabase Realtime ou polling), todos os palpites de todos os participantes são carregados e exibidos automaticamente, sem necessidade de reload
- A transição é suave — nenhum flash ou estado intermediário vazio
- Funciona para todos os usuários conectados na página simultaneamente
**Dependências:** auth, game-navigation, predictions, live-scores-realtime, fix-prediction-visibility, prediction-visibility

---

### 30. delete-group — Exclusão de Grupo pelo Admin — concluída
**Objetivo:** Permitir que o admin de um grupo o exclua diretamente pela aba Grupos, deletando em cascata todos os palpites e scores associados, sem afetar os perfis dos participantes.
**Critérios de sucesso:**
- Botão "Excluir grupo" visível apenas para o admin do grupo, na aba Grupos (ex: na página `/grupos/[id]` ou lista de grupos)
- Clicar no botão abre um modal de confirmação explicitando que palpites e scores serão deletados permanentemente e que participantes não serão removidos do sistema
- Confirmação no modal dispara chamada ao Route Handler `DELETE /api/groups/[id]`, autenticado via Bearer JWT com verificação server-side de que o usuário é admin do grupo
- O Route Handler executa `DELETE FROM groups WHERE id = $1` via cliente Supabase com `service_role`; o cascade de `predictions` e `scores` já está garantido no banco (`ON DELETE CASCADE`)
- Após a exclusão com sucesso, o usuário é redirecionado para `/grupos` e o grupo deletado não aparece mais na lista
- Tentativa de excluir grupo por não-admin retorna `403`; grupo inexistente retorna `404`
- A exclusão não afeta `profiles` nem `auth.users` — apenas `groups`, `predictions` e `scores` vinculados ao grupo
**Dependências:** grupos

---

### 35. predict-all-groups — Palpite para Todos os Grupos — concluída
**Objetivo:** Ao criar ou editar um palpite, permitir que o usuário escolha propagar aquele palpite para todos os grupos em que participa (respeitando o deadline de cada grupo), além de poder salvar apenas no grupo atual.
**Critérios de sucesso:**
- Usuário consegue criar/editar palpite normalmente no grupo ativo (comportamento atual preservado)
- Após confirmar um palpite, aparece uma opção clara de aplicar apenas ao grupo atual ou a todos os grupos
- Se escolher "todos os grupos", o palpite é replicado nos demais grupos do usuário onde o prazo ainda não expirou (match_date - now() > 5 minutos e status `pending`)
- Usuário não consegue editar palpites de outros usuários (autorização preservada)
- Feedback claro de quantos grupos foram atualizados (ex: "Palpite salvo em 3 grupos")
**Dependências:** auth, predictions, grupos, grupo-ativo-persistente

---

### 36. fix-predict-edit-propagation — Corrigir Propagação de Palpites no Modo de Edição — concluída
**Objetivo:** Corrigir o bug em que o `PropagatePrompt` não era exibido ao usuário após salvar um palpite em modo de edição (update de palpite existente), de modo que a opção de propagar para outros grupos também apareça nesse fluxo, não apenas na criação.
**Critérios de sucesso:**
- Após salvar um palpite editado (palpite existente atualizado), o `PropagatePrompt` é exibido da mesma forma que após criar um palpite novo
- Fluxo de propagação para todos os grupos funciona corretamente tanto no modo de criação quanto no modo de edição
- Nenhuma regressão no comportamento do `PredictionForm` para criação de palpites
**Dependências:** predict-all-groups
**Observação de conclusão:** aprovada e mergeada na main em 2026-06-18 (commit `ef78749`). Fix pontual isolado em `PredictionForm` para expor `PropagatePrompt` também no caminho de edição.

---

### 34. group-chat — Chat do Grupo — concluída
**Objetivo:** Criar uma funcionalidade de troca de mensagens dentro de cada grupo do bolão, com um chip flutuante fixo no canto inferior direito do dashboard que expande em um painel de chat com histórico em tempo real, contador de não lidas e suporte a envio de mensagens por todos os participantes do grupo.
**Critérios de sucesso:**
- Chip flutuante visível em todas as páginas do dashboard (fixo no canto inferior direito), persistindo entre navegações
- Ao clicar, expande com animação suave mostrando histórico de mensagens do grupo ativo
- Ao minimizar, contrai com animação de volta ao chip
- Mensagens atualizadas em tempo real via Supabase Realtime (canal `group_messages`) sem reload de página
- Contador de não lidas visível no chip quando minimizado e houver mensagens novas desde a última abertura
- Usuário consegue enviar mensagem com Enter ou clique no botão de envio
- Mensagens exibem nome do remetente, hora e conteúdo
- Modelo suporta `group_id` (escopado ao grupo ativo); migração cria tabela `group_messages` com RLS adequada
- Implementação 100% client-side + Supabase (sem endpoint Ruby)
**Dependências:** auth, grupos, grupo-ativo-persistente

---

### 37. mcp-bolao — Servidor MCP Remoto — concluída
**Objetivo:** Expor o Bolão ABJ como um servidor MCP remoto para que participantes autenticados possam consultar jogos, ranking e palpites — e fazer/editar palpites — via qualquer cliente MCP compatível (Claude Desktop, Claude.ai, Cursor, etc.), sem configuração manual de tokens.
**Critérios de sucesso:**
- Servidor MCP acessível em `/api/mcp` com Streamable HTTP transport
- Fluxo OAuth completo funcional com Supabase Auth (discovery, authorize, callback, token)
- 6 tools implementadas: `listar_jogos`, `ver_jogo`, `ver_ranking`, `meus_palpites`, `ver_palpites_jogo`, `fazer_palpite`
- Regras de negócio respeitadas: deadline de 5min, visibilidade de palpites só após início do jogo
- Tabela `mcp_oauth_codes` criada via migration Supabase
- UI de onboarding na tela de perfil/configurações exibindo URL do servidor e instruções de conexão
**Dependências:** auth, game-navigation, predictions, scoring, ranking, grupos, grupo-ativo-persistente

---

### 39. daily-recap-modal — Modal de Resumo Diário — concluída
**Objetivo:** Exibir uma janela modal automaticamente no primeiro acesso do dia, mostrando de forma lúdica e bem-humorada as pontuações e o ranking do dia anterior, com badges/medalhas para os melhores e piores desempenhos.
**Critérios de sucesso:**
- Modal aparece automaticamente no primeiro acesso do dia (controle via localStorage) e não reaparece após fechar
- Modal exibe ranking do dia anterior e pontuações individuais dos jogos daquele dia
- Modal inclui pelo menos 3 badges diferentes (ex: craque do dia, pé-frio do dia, vidente do dia)
- Mensagens têm tom lúdico e bem-humorado em português brasileiro
- Modal pode ser fechado pelo usuário (botão ou clique fora)
- Não aparece se não houver jogos finalizados no dia anterior
- Visual segue DESIGN.md rigorosamente (monospace, paleta verde/amarelo/azul, dense)
**Dependências:** auth, scoring, ranking, grupos, grupo-ativo-persistente

---

### 40. daily-recap-on-demand — Resumo Diário sob Demanda — concluída
**Objetivo:** Permitir que o usuário visualize o resumo do dia anterior a qualquer momento, adicionando um ponto de entrada visível na navegação existente que reabre o DailyRecapModal já existente sob demanda, independentemente de já ter sido visto hoje.
**Critérios de sucesso:**
- Existe um ponto de entrada visível na UI (botão ou link) para abrir o resumo do dia anterior manualmente
- Clicar nesse ponto de entrada abre o DailyRecapModal independentemente de já ter sido visto hoje
- O comportamento automático (aparecer no primeiro acesso) continua funcionando normalmente
- O ponto de entrada fica oculto ou desabilitado se não houver jogos finalizados no dia anterior
**Dependências:** daily-recap-modal

---

### 41. daily-recap-modal-refactor — Refatoração do Daily Recap Modal — concluída
**Objetivo:** Reposicionar o botão de acesso ao resumo do dia anterior como elemento fixo no bottom da tela (substituindo o RecapButton do menu de navegação), e revisar os badges do modal para exibir exatamente 3: Craque do Dia, Mãe Diná (absorvendo dados da artilharia de palpites) e Pé-frio.
**Critérios de sucesso:**
- RecapButton removido do menu de topo (nav-links.tsx)
- Elemento fixo no bottom da tela abre o DailyRecapModal; oculto se não houver jogos finalizados no dia anterior
- Modal exibe exatamente 3 badges: Craque do Dia, Mãe Diná (com dados de acertos e de artilharia), Pé-frio
- Badges Artilheiro do Dia e Apostador do Dia não existem mais
- Layout não quebra em mobile nem desktop
**Dependências:** daily-recap-modal, daily-recap-on-demand

---

### 42. recap-bottom-sheet — Botão Fixo no Rodapé com Bottom Sheet de Resumo — concluída
**Objetivo:** Substituir o RecapFloatingButton (FAB no canto inferior esquerdo) por um botão fixo de largura total no rodapé da tela, que ao ser clicado abre o conteúdo do resumo diário em um bottom sheet com animação suave de slide-up, respeitando safe-area no iOS e seguindo DESIGN.md.
**Critérios de sucesso:**
- FAB (RecapFloatingButton) é removido e substituído por um elemento fixo no rodapé (full-width ou near-full-width)
- Clicar no elemento abre um bottom sheet com animação de slide-up suave
- O bottom sheet exibe o mesmo conteúdo que o DailyRecapModal (ranking, badges: Craque do Dia, Mãe Diná, Pé-frio)
- Bottom sheet fecha com animação de slide-down ao clicar no backdrop ou no botão de fechar
- Comportamento automático do primeiro acesso do dia continua funcionando (abre o bottom sheet diretamente)
- Layout correto em mobile e desktop; safe-area respeitada no iOS
**Dependências:** daily-recap-modal, daily-recap-on-demand, daily-recap-modal-refactor

---

### 43. recap-cache-visual — Cache LocalStorage e Visual Aprimorado do Recap — concluída
**Objetivo:** Eliminar o delay perceptível no Daily Recap cacheando os dados no localStorage (exibição instantânea na segunda abertura) e aumentar o apelo visual do RecapFooterButton e RecapBottomSheet, tornando o CTA mais chamativo e a hierarquia visual do bottom sheet mais clara.
**Critérios de sucesso:**
- Segunda abertura do bottom sheet (e reloads posteriores) exibe conteúdo instantaneamente do cache
- Cache do dia (`bolao_recap_data_YYYY-MM-DD` em BRT) é salvo após o primeiro fetch e usado imediatamente em acessos subsequentes
- Cache é invalidado automaticamente no dia seguinte (chave diferente por data)
- Sincronização em background silenciosa ao usar o cache (sem bloquear a UI)
- A lógica de "já viu hoje" (`bolao_recap_YYYY-MM-DD`) não é quebrada
- RecapFooterButton tem apelo visual maior: CTA claramente de destaque, com mais contraste
- RecapBottomSheet tem hierarquia visual melhorada: cabeçalho destacado, badges em evidência, ranking bem estruturado
- Visual segue DESIGN.md rigorosamente (monospace, paleta verde/amarelo/azul, sem bordas arredondadas excessivas, estilo denso)
- Build e lint passam sem erros
**Dependências:** recap-bottom-sheet, daily-recap-modal, daily-recap-on-demand, daily-recap-modal-refactor

---

### 38. mcp-group-scope — Suporte a Múltiplos Grupos no Servidor MCP — concluída
**Objetivo:** Corrigir o servidor MCP para suportar múltiplos grupos — adicionar tool `listar_grupos` e parâmetro `group_id` (opcional, com fallback para o primeiro grupo do usuário) nas tools `fazer_palpite`, `meus_palpites` e `ver_ranking`.
**Critérios de sucesso:**
- Nova tool `listar_grupos` retorna os grupos do usuário autenticado com id, nome e role
- `fazer_palpite` aceita `group_id` opcional — se omitido usa o primeiro grupo por `joined_at ASC`, se informado valida que o usuário é membro
- `meus_palpites` aceita `group_id` opcional com o mesmo fallback
- `ver_ranking` aceita `group_id` opcional com o mesmo fallback
**Dependências:** mcp-bolao, grupos

---

### 44. recap-game-cards — Cards Visuais de Jogos no Recap — concluída
**Objetivo:** Na seção "JOGOS DE ONTEM" do RecapBottomSheet, substituir a linha de texto simples por cards compactos que exibam bandeiras, nomes abreviados e o placar de cada jogo finalizado, tornando a leitura mais rápida e o visual mais rico.
**Critérios de sucesso:**
- Cada jogo da seção "JOGOS DE ONTEM" é exibido como um card compacto e independente, com o layout: [bandeira + código do time da casa] [placar] [bandeira + código do visitante]
- Bandeiras são obtidas via `getTeamFlag()` já existente em `lib/utils/teamFlag.ts` — sem nova dependência externa
- O layout do card é horizontal e compacto: os dois times ficam nas extremidades e o placar centralizado, lendo facilmente em uma linha
- O nome abreviado do time (home_team_code, away_team_code) aparece abaixo ou ao lado da bandeira, em monospace, uppercase
- Visual segue DESIGN.md rigorosamente: JetBrains Mono, paleta verde/amarelo/azul, dense, sem ícones decorativos além das bandeiras emoji, sem border-radius excessivo, sem sombra
- Nenhuma alteração no hook `useDailyRecap`, no schema do Supabase ou nos endpoints — mudança puramente em `RecapBottomSheet.tsx`
- `npm run lint` e `npm run build` passam sem erros novos
**Dependências:** recap-bottom-sheet, recap-cache-visual

---

### 45. mcp-scoring-rules — Tool MCP: Consultar Regras de Pontuação — concluída
**Objetivo:** Adicionar uma tool no servidor MCP do projeto que expõe as regras de pontuação do bolão de forma estruturada, permitindo que agentes e usuários as consultem programaticamente via qualquer cliente MCP compatível.
**Critérios de sucesso:**
- Uma tool MCP chamada `consultar_regras_pontuacao` está disponível no servidor MCP do projeto (registrada em `lib/mcp/server.ts`)
- A tool retorna as regras de pontuação de forma estruturada: lista de eventos com pontos, regras de cumulatividade, tratamento de empate e pelo menos um exemplo concreto de cálculo
- A tool não requer autenticação ou parâmetros de entrada (é pública no contexto do servidor MCP, mas ainda dentro do fluxo de auth Bearer existente)
- A tool é documentada com descrição e schema Zod corretos seguindo o padrão dos demais tools em `lib/mcp/tools/`
- `npm run lint` e `npm run build` passam sem erros novos
**Dependências:** mcp-bolao

---

### 46. dual-footer-bar — Barra Dupla no Rodapé (Rolou ontem / Tá rolando) — concluída
**Objetivo:** Substituir o `RecapFooterButton` único por uma barra fixada no rodapé com dois botões lado a lado: "Rolou ontem" (reabre o bottom sheet de recap existente, renomeado) e "Tá rolando" (novo bottom sheet com ranking ao vivo dos jogos do dia corrente, atualizado via Supabase Realtime). O chip flutuante de chat permanece inalterado.
**Critérios de sucesso:**
- O `RecapFooterButton` existente é substituído por um componente `DualFooterBar` com dois botões de largura igual, lado a lado, fixados no rodapé em todas as páginas do dashboard
- O botão "Rolou ontem" abre o `RecapBottomSheet` existente com o mesmo comportamento e conteúdo atuais (sem regressão)
- O botão "Tá rolando" abre um novo `LiveTodayBottomSheet` exibindo o ranking de pontos acumulados nos jogos do dia corrente (jogos com `match_date` igual à data atual em BRT), atualizado em tempo real via Supabase Realtime no canal `scores`
- O ranking do "Tá rolando" lista todos os participantes do grupo ativo com: posição, nome e pontuação total dos jogos de hoje (soma das entradas de `scores` para jogos do dia, incluindo pontuação parcial/ao vivo quando aplicável via `live-scoring`)
- Ambos os botões ficam ocultos ou desabilitados individualmente quando não há conteúdo relevante: "Rolou ontem" oculto se não há jogos finalizados ontem; "Tá rolando" oculto se não há jogos hoje
- O chip flutuante de chat (`group-chat`) não é alterado em posição, aparência ou comportamento
- Visual segue DESIGN.md rigorosamente: JetBrains Mono, paleta verde/amarelo/azul, sem border-radius excessivo, dense, sem ícones decorativos além do label de texto
- `npm run lint` e `npm run build` passam sem erros novos
**Dependências:** recap-bottom-sheet, recap-cache-visual, recap-game-cards, live-scoring, group-chat

---

### 47. live-today-games — Jogos do Dia no Bottom Sheet "Tá Rolando" — concluída
**Objetivo:** Exibir os jogos do dia corrente no `LiveTodayBottomSheet`, acima do ranking ao vivo, mostrando times com bandeiras, placar atual e status de cada partida.
**Critérios de sucesso:**
- `useLiveTodayRanking` retorna também a lista de jogos do dia (com campos: `id`, `home_team`, `away_team`, `home_team_code`, `away_team_code`, `home_score`, `away_score`, `status`, `match_date`) além dos `entries` já existentes
- `LiveTodayBottomSheet` exibe uma seção "JOGOS DE HOJE" acima da tabela de ranking, com um card por jogo
- Cada card mostra: bandeira + código do time da casa, placar central (ou `— × —` se `pending`), bandeira + código do time visitante
- Bandeiras obtidas via `getTeamFlag()` de `lib/utils/teamFlag.ts` — sem nova dependência externa
- Status visível em cada card: `● AO VIVO` em `color-live` com animação blink para jogos `live`; `✓ ENCERRADO` em `color-muted` para `finished`; nenhum badge para `pending`
- Atualizações de placar chegam ao componente via Realtime já implementado no hook (sem novo canal)
- Visual segue DESIGN.md rigorosamente: JetBrains Mono, paleta verde/amarelo/azul, dense, sem border-radius excessivo
- `npm run lint` e `npm run build` passam sem erros novos
**Dependências:** dual-footer-bar

---

### 49. password-recovery — Recuperação de Senha por Email — concluída
**Objetivo:** Adicionar o fluxo completo de recuperação de senha ao bolão, integrado ao Supabase Auth. O usuário que esqueceu a senha pode solicitar um link de redefinição informando o e-mail cadastrado; o Supabase envia o e-mail automaticamente; ao clicar no link, o usuário é redirecionado para uma tela dentro do produto onde define a nova senha.
**Critérios de sucesso:**
- Link "Esqueceu a senha?" na tela de login apontando para `/esqueci-senha`
- Tela `/esqueci-senha` com formulário de e-mail, estados de loading/confirmação/erro
- Mensagem de confirmação não revela se o e-mail existe (segurança por padrão)
- Route Handler `/auth/callback` que troca o code PKCE por sessão e redireciona para `/nova-senha`
- Tela `/nova-senha` com validação client-side, verificação de sessão e redirect automático após sucesso
- Open redirect prevenido no callback (parâmetro `next` validado para caminhos internos)
**Dependências:** auth
**Observação de conclusão:** aprovada sem rodada de fix em 2026-06-19; merge `feature/password-recovery` na main confirmado (commit `370246c`). Sem migrations SQL, sem endpoints Ruby — fluxo 100% via Supabase Auth SDK client-side e Route Handler Next.js. Componentes `<Button>` e `<Input>` reutilizados; design Elifoot seguido rigorosamente.

---

### 50. calendar-utc-fix — Corrigir Agrupamento de Jogos no Calendário para Usar UTC — concluída
**Objetivo:** Jogos no início da madrugada em BRT (UTC-3) estão sendo exibidos no dia seguinte ao correto porque o frontend agrupa por data local em vez de data UTC. Corrigir para que o agrupamento e exibição de dias no calendário usem sempre a data em UTC do campo `match_date`.
**Critérios de sucesso:**
- O jogo Turquia x Paraguai aparece no dia 19 no calendário (não no dia 20)
- Todos os jogos são agrupados pela data em UTC do campo `match_date`
- Nenhuma regressão nas demais funcionalidades de navegação de jogos
**Dependências:** game-navigation, date-chips-nav

---

### 48. group-member-history — Palpites e Pontuação ao Adicionar Participante a Grupo — concluída
**Objetivo:** Ao adicionar um participante a um grupo, seus palpites e pontuações já existentes (de qualquer grupo) passam a ser computados automaticamente no novo grupo — sem duplicação de dados, apenas ampliando o escopo de visualização e cálculo.
**Critérios de sucesso:**
- Ao adicionar um usuário a um grupo (via convite nominal ou link reutilizável), seus palpites já existentes na tabela `predictions` aparecem no contexto desse grupo (ranking, palpites por jogo, detalhamento)
- A pontuação do usuário é calculada corretamente no ranking do novo grupo, considerando todos os palpites já feitos, sem necessidade de re-inserir dados
- Nenhum dado é duplicado — os palpites permanecem únicos por usuário/jogo/group_id; apenas o escopo de visualização por grupo é expandido
- O ranking do novo grupo exibe o usuário recém-adicionado com sua pontuação histórica atualizada imediatamente após a entrada
- Regressão zero: usuários já membros de grupos não têm palpites ou pontuações alterados
**Dependências:** auth, predictions, scoring, grupos, convites-nominais

---

### 52. ranking-scouts — Scouts no Ranking — concluída
**Objetivo:** Exibir badges de "scout" ao lado do nome de cada participante no ranking, identificando conquistas/perfis calculados com base nos dados reais de palpites e pontuação — mãe diná (mais placares exatos), manja muito (mais vencedores acertados), cego em tiroteio (mais vencedores errados), sumido (menos palpites, mín. 1) e onde está wally? (nunca palpitou).
**Critérios de sucesso:**
- Cada scout é calculado com base nos dados reais de `predictions` e `scores` do Supabase
- Os badges são exibidos no componente de ranking ao lado do nome do participante
- Participantes sem nenhum palpite recebem apenas "onde está wally?", não "sumido"
- O cálculo dos scouts ocorre de forma eficiente (sem N+1 queries)
- Os badges têm ícones/emojis representativos e tooltip explicativo
- Um participante pode ter mais de um badge simultaneamente
**Dependências:** ranking, ranking-predictions-count

---

### 51. ranking-predictions-count — Total de Palpites no Ranking — concluída
**Objetivo:** Exibir o total de palpites registrados por cada jogador na tela de ranking, como indicador de engajamento complementar à pontuação, com layout responsivo (mobile-first).
**Critérios de sucesso:**
- Cada linha do ranking exibe o total de palpites do jogador (ex: "12 palpites")
- A informação é legível em telas pequenas (mobile-first)
- Não quebra a ordenação atual por pontuação
- Nenhum dado sensível de outros usuários é exposto além do que já é público no ranking
**Dependências:** auth, ranking, predictions, grupos
**Observação de conclusão:** aprovada sem rodada de fix em 2026-06-21; merge `feature/ranking-predictions-count` na main confirmado. Migration `20260621000000_ranking_add_predictions_count.sql` recria `get_ranking()` via `CREATE OR REPLACE` adicionando `predictions_count bigint` via LEFT JOIN com subquery em `predictions`; coluna `PALP.` adicionada ao `RankingTable` (visível em mobile); célula correspondente em `RankingRow` com `color-muted` sem bold. Tipos de retorno da função migrados de `int` para `bigint`. `npm run build` e lint passaram sem erros novos.

---

### 53. ranking-por-rodada — Ranking por Rodada — concluída
**Objetivo:** Na tela de ranking, adicionar um seletor de fase (chips) que filtra a pontuação acumulada apenas nos jogos daquela rodada, respondendo "Quem está mandando nas Oitavas?", sem alterar o ranking geral.
**Critérios de sucesso:**
- Chips de seleção de fase aparecem acima da tabela de ranking
- "Geral" é o padrão selecionado
- Ao selecionar uma fase, o ranking reflete apenas pontos daquela fase
- Fases disponíveis são derivadas dos jogos reais do grupo
**Dependências:** auth, ranking, scoring, grupos

---

### 54. streak-de-acertos — Sequência de Acertos — concluída
**Objetivo:** Exibir no ranking a sequência atual de jogos consecutivos em que o participante acertou pelo menos o vencedor (ex: "5 em sequência"). A sequência reseta quando há erro ou ausência de palpite em jogo encerrado.
**Critérios de sucesso:**
- Streak atual visível no ranking ao lado do nome ou na coluna de pontos
- Streak conta apenas jogos com status `finished` onde o participante fez palpite
- Streak reseta quando o participante erra o vencedor ou não fez palpite num jogo encerrado
**Dependências:** auth, ranking, predictions, scoring, grupos

---

### 56. perfil-redesign — Redesign da Aba de Perfil — em progresso
**Objetivo:** Transformar a aba `/perfil` de uma lista seca de 6 estatísticas em um painel rico com 4 seções empilhadas: SUA CAMPANHA (herói com posição/pontos/movimento), DESEMPENHO (barras ASCII, comparação com média do grupo, sequência em pílulas), TROFÉUS (sistema completo de 15 medalhas com 3 estados) e HISTÓRICO (feed cronológico paginado com palpites e pontos).
**Critérios de sucesso:**
- A aba /perfil exibe as 4 seções conforme os wireframes ASCII do documento de design em `.pipeline/perfil-redesign-design.md`
- O movimento de posição ("▲2 desde a última rodada") usa snapshots gravados ao fechar cada dia de jogos (nova tabela `position_snapshots`)
- O sistema de troféus deriva os 15 troféus listados no doc a partir de dados existentes + snapshots, com 3 estados: desbloqueado, bloqueado com progresso, e secreto
- O feed histórico inicia com os últimos 20 jogos + botão "ver mais", incluindo jogos "furados" (encerrados sem palpite)
- A estética segue DESIGN.md rigorosamente (JetBrains Mono, tokens CSS da bandeira, sem sombras, dark only)
**Dependências:** auth, ranking, predictions, scoring, grupos, perfil-com-estatisticas, streak-de-acertos

---

### 55. perfil-com-estatisticas — Perfil com Estatísticas — concluída
**Objetivo:** Página `/perfil` com histórico de desempenho do participante: taxa de acerto de vencedor, taxa de placares exatos, média de pontos por jogo, sequência atual, melhor sequência histórica, palpites feitos vs jogos disponíveis.
**Critérios de sucesso:**
- Página `/perfil` acessível pelo usuário logado
- Exibe estatísticas pessoais do grupo ativo
- Estilo visual consistente com DESIGN.md (terminal/monospace)
**Dependências:** auth, ranking, predictions, scoring, grupos, streak-de-acertos
