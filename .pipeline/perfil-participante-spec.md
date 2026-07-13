# Especificação Técnica — Perfil Público do Participante

**Data:** 2026-07-13
**Feature Slug:** `perfil-participante`
**Objetivo:** Exibir, de forma acessível a todos os membros de um grupo, um retrato do "jeito de apostar" de cada participante — um arquétipo interpretativo denso sustentado por 4 eixos de comportamento e stats objetivas, derivados dos palpites, dos placares reais e do estilo (inferido) dos times.

---

## 1. Visão Geral

Ao clicar no **nome de um participante no ranking**, abre-se uma página pública `/perfil/[userId]` com a leitura daquela pessoa, no recorte do **grupo ativo**. Qualquer membro do grupo pode ver o perfil de qualquer outro membro.

A página mostra (sem foto/avatar):

1. **Cabeçalho interpretativo** — nome do participante + **arquétipo denso**: um nome composto (ex: *"Zebreiro Cascão"*) + um parágrafo de 2–3 frases costurado por templates determinísticos, citando as stats que mais destacam a pessoa.
2. **Os 4 eixos como espectros** — barras no estilo ASCII (`█`/`░`) já usado no projeto, cada uma posicionando o participante entre dois polos.
3. **Stats objetivas** — os números que sustentam cada eixo.

Toda a análise é **determinística** (motor de regras/templates, zero IA), calculada em tempo real a partir do Supabase, sem tabela pré-computada e sem pesquisa externa.

---

## 2. Rota e Integração

### Rota da página
```
GET /perfil/[userId]
```
- `userId` (uuid, param de rota): participante alvo.
- Server component: resolve grupo ativo (mesmo padrão de `/perfil` e `/ranking` via `resolveActiveGroup` + cookie `bolao_active_group`), valida sessão (redirect `/login` se não logado) e valida que **tanto o espectador quanto o alvo pertencem ao grupo ativo**. Se o alvo não for membro do grupo, renderizar estado de erro no mesmo padrão visual da página `/perfil` atual (`✗ PARTICIPANTE NÃO ENCONTRADO NESTE GRUPO`).

### Rota de dados (API)
```
GET /api/profile/style?group_id=<uuid>&user_id=<uuid>
```
- Autenticação por Bearer JWT (mesmo helper `authenticate` de `/api/participants-predictions`).
- Valida UUIDs e que o requisitante é membro do `group_id`.
- Consulta com o **JWT do requisitante** (RLS aplicada) ou, se usar service-role, **restringe explicitamente a jogos `status IN ('live','finished')`** para nunca expor palpites de terceiros em jogos `pending`.
- Retorna o objeto de perfil já calculado (ver §5). Sem paginação.

### Ponto de entrada
- Na `RankingTable` (`components/bolao/RankingTable.tsx`), o **nome de cada linha vira link** para `/perfil/[userId]` (preservando o grupo ativo, como o resto da navegação). O affordance de clicável deve ser **permanente e visível** (não apenas hover) — seguir DESIGN.md e o padrão do projeto para elementos clicáveis em mobile (fundo elevado + indicação visível).
- (Opcional, se trivial) o mesmo link na lista de participantes do grupo, se existir uma lista renderizada além do ranking.

---

## 3. Fonte de Dados e Regras de Visibilidade

- **games**: `home_team(_code)`, `away_team(_code)`, `home_score`, `away_score`, `status`, `match_date`, `round`.
- **predictions**: `user_id`, `game_id`, `home_score`, `away_score` (do grupo).
- **scores** (opcional): pode reusar `points`/`breakdown` quando já calculado; caso contrário derivar da lógica de `lib/scoring.ts`.

**Recorte temporal:** todos os eixos são calculados **apenas sobre jogos `live` ou `finished`** — nunca `pending`. Isso: (a) mantém consistência com a RLS de `predictions`; (b) evita vazar palpites antes do deadline; (c) dá estabilidade à análise.

**Consenso do grupo** (para o eixo Favorito↔Zebreiro): calculado a partir dos palpites de **todos os participantes do grupo** naquele jogo (visíveis sob a mesma regra `live`/`finished`).

---

## 4. Módulo de Cálculo (determinístico)

Criar `lib/participant-profile.ts` — funções **puras**, espelhando o padrão de `lib/scoring.ts`, testáveis isoladamente.

### Entrada
```ts
interface ProfileInput {
  targetUserId: string
  games: GameLite[]            // apenas live/finished do grupo
  targetPredictions: PredLite[]// palpites do alvo
  groupPredictions: PredLite[] // palpites de todos (para consenso)
}
```

### Saída
```ts
interface ParticipantProfile {
  sampleSize: number            // nº de jogos live/finished com palpite do alvo
  axes: Axis[]                  // 4 eixos (ver §5)
  archetype: { name: string; paragraph: string }
  teamStyle?: TeamStyleTable    // ratings inferidos (uso interno / debug)
}

interface Axis {
  key: 'volume' | 'underdog' | 'calibration' | 'style_reader'
  leftLabel: string             // ex: 'Cascão'
  rightLabel: string            // ex: 'Otimista'
  position: number              // 0..1 (0 = polo esquerdo, 1 = polo direito)
  bar: string                   // string ASCII pronta (█/░), largura fixa
  confident: boolean            // false => "amostra pequena"
  stats: { label: string; value: string }[] // números de apoio
}
```

Toda constante de limiar/peso deve ser declarada no topo do módulo como const nomeada e comentada, para calibragem futura.

---

## 5. Definição dos 4 Eixos

Largura da barra: 12 blocos. `position` mapeia para nº de `█`. Cada eixo expõe suas `stats`.

### 5.1 `volume` — **Cascão ◄──► Otimista** (só palpites)
- Métrica base: **média de gols totais palpitados/jogo** do alvo (`home+away`).
- `position` = normalização da média do alvo relativa ao **grupo** (ex: mapear [média_grupo − 1.5, média_grupo + 1.5] → [0,1], com clamp).
- Stats: média de gols/palpite do alvo; média do grupo; % de palpites com 3+ gols totais; % de palpites "travados" (0x0 ou 1x0).
- `confident`: `sampleSize >= MIN_SAMPLE_PRED` (ex: 5).

### 5.2 `underdog` — **Favorito ◄──► Zebreiro** (palpites + consenso + resultado)
- Para cada jogo, "favorito" = time que a **maioria do grupo** apontou como vencedor (ou empate se for a moda). Zebra = alvo palpitou vencedor **diferente do consenso**.
- Métrica: **% de jogos em que o alvo palpitou contra o consenso**.
- `position` cresce com essa taxa.
- Stats: % contra o consenso; nº de vezes que "bancou o azarão e acertou" (palpitou contra consenso e o resultado real bateu com o palpite de vencedor).
- `confident`: `sampleSize >= MIN_SAMPLE_PRED`.

### 5.3 `calibration` — **Impreciso ◄──► Craveiro** (palpites + placar real; só finished)
- Métricas: **erro médio de gols** (média de `|palpite_home − real_home| + |palpite_away − real_away|`); **taxa de placar exato**; taxa de acerto de vencedor.
- `position` cresce quanto **menor** o erro médio (mais craveiro).
- Stat extra qualitativa: se acerta mais em **jogo apertado** (diferença real ≤ 1) vs **goleada** (diferença real ≥ 3) — comparar taxa de acerto de vencedor nos dois baldes.
- Reusar `lib/scoring.ts` para "acerto de vencedor/placar exato" a fim de manter coerência com a pontuação oficial.
- `confident`: `nº de jogos finished com palpite >= MIN_SAMPLE_FINISHED` (ex: 3).

### 5.4 `style_reader` — **Ignora estilo ◄──► Leitor de estilo** (palpites + estilo inferido; só finished)
- Estilo do time **inferido dos placares reais** (ver §6).
- Métrica: **correlação** entre os gols que o alvo atribui a cada time nos seus palpites e a **força ofensiva** inferida desse time (correlação de Pearson ou proxy simples de concordância de ranking). Alta correlação ⇒ "lê bem o estilo" (bota gol em quem ataca).
- `position` cresce com a correlação (clamp de correlações negativas em 0).
- Stats: correlação (ou "concordância %"); 1–2 exemplos textuais (ex: "deu 3 gols pro time mais ofensivo do grupo").
- `confident`: requer `MIN_SAMPLE_FINISHED` jogos **e** pelo menos `MIN_TEAMS_FOR_STYLE` times com jogos finalizados suficientes (ex: 4). Caso contrário, marcar amostra pequena.

---

## 6. Estilo dos Times (inferido)

Função pura `inferTeamStyle(games)` sobre jogos **finished**:
- `offensiveRating[team]` = média de gols marcados pelo time.
- `defensiveRating[team]` = média de gols sofridos.
- Requer mínimo de jogos por time (`MIN_GAMES_PER_TEAM`, ex: 2) para entrar no cálculo; times abaixo disso são ignorados no eixo `style_reader`.
- Sem cadastro manual e sem pesquisa externa. (Pesquisa na internet fica como enriquecimento **futuro** e opcional, sujeito à regra do repositório sobre fonte verificável — fora do escopo desta feature.)

---

## 7. Arquétipo (nome + parágrafo)

- **Nome**: combinação dos **2 eixos dominantes** (os de maior distância do centro `|position − 0.5|` entre os eixos `confident`). Cada polo tem um adjetivo; a matriz produz nomes como:
  - volume→Otimista + underdog→Zebreiro ⇒ **"Zebreiro Otimista"**
  - volume→Cascão + calibration→Craveiro ⇒ **"Craveiro Cascão"**
  - etc. (o Programador define a tabela de adjetivos por polo; usar português, tom leve/divertido.)
- Se nenhum eixo tiver `confident=true` (participante novo, sem jogos resolvidos), usar arquétipo neutro: **"Recém-chegado"** com parágrafo explicando que ainda faltam jogos para traçar o perfil.
- **Parágrafo**: template de 2–3 frases que injeta os valores reais dos 2 eixos dominantes + 1 stat de destaque. Frases pré-escritas por polo, concatenadas deterministicamente. Sem números inventados; só valores calculados.

---

## 8. Componentes (frontend)

Seguir DESIGN.md e a linguagem visual monoespaçada existente (`JetBrains Mono`, barras `█/░`, painéis `color-surface`/`color-border`, cabeçalhos `color-primary`), espelhando o estilo de `components/bolao/perfil/PerformancePanel.tsx`.

### 8.1 Página `app/(dashboard)/perfil/[userId]/page.tsx`
- Server component: valida sessão + grupo + membership do alvo; busca `name` do alvo (profiles/metadata); renderiza container e delega ao dashboard client.

### 8.2 `components/bolao/perfil-participante/ParticipantProfile.tsx` (client)
- Props: `groupId`, `targetUserId`, `targetName`.
- Fetch de `/api/profile/style` com Bearer token (mesmo padrão de `PerfilDashboard`: pega `session.access_token`).
- Estados `loading | error | populated`.

### 8.3 `ArchetypeHeader.tsx`
- Exibe nome do participante, o nome do arquétipo em destaque e o parágrafo interpretativo.

### 8.4 `AxisSpectrum.tsx`
- Renderiza um eixo: `leftLabel ◄ [barra █/░] ► rightLabel`, as stats de apoio abaixo, e um selo "amostra pequena" quando `confident=false`.

### 8.5 Botão de voltar
- Link "← Voltar ao Ranking" preservando o grupo ativo.

---

## 9. Casos de Borda

- **Participante sem palpites em jogos resolvidos**: arquétipo "Recém-chegado"; eixos exibidos com selo "amostra pequena / dados insuficientes".
- **Início do torneio (poucos finished)**: eixos `calibration` e `style_reader` marcados `confident=false`; `volume` e `underdog` já funcionam com palpites em jogos `live`.
- **Alvo = próprio usuário**: perfil funciona normalmente (é a leitura pública de si mesmo).
- **Alvo não é membro do grupo ativo**: estado de erro (§2).
- **Empate no consenso** (§5.2): tratar "vencedor de consenso" como empate; alvo que palpitou não-empate conta como contra o consenso.
- **Divisão por zero / listas vazias**: toda média/normalização com guarda; nunca `NaN` na saída.

---

## 10. Fora de Escopo (YAGNI)

- Foto/avatar do participante.
- Reaproveitar os painéis Campanha/Troféus/Histórico nesta página.
- Geração de texto por IA/LLM.
- Pesquisa na internet para estilo dos times.
- Tabela pré-computada / cache persistente / realtime subscription (a página é uma leitura analítica sob demanda).
- Página-índice "Participantes" separada (entrada é só via ranking/grupo).

---

## 11. Critérios de Aceite

1. Clicar no nome de um participante no ranking abre `/perfil/[userId]` no grupo ativo, com affordance de clicável visível (não só hover).
2. A página exibe cabeçalho com nome + arquétipo composto + parágrafo, os 4 eixos como espectros ASCII, e stats de apoio por eixo.
3. Os 4 eixos são calculados corretamente conforme §5, apenas sobre jogos `live`/`finished`, e nunca expõem palpites de jogos `pending` de terceiros.
4. Eixos com amostra insuficiente exibem o selo "amostra pequena"; participante sem jogos resolvidos recebe arquétipo "Recém-chegado".
5. Estilo dos times é inferido dos placares reais, sem dado manual nem externo.
6. Toda a lógica de cálculo vive em `lib/participant-profile.ts` como funções puras, sem IA, e é coberta por testes unitários.
7. A saída nunca contém `NaN`/`undefined` nas posições/valores dos eixos.
8. Visual coerente com DESIGN.md e com o padrão monoespaçado dos painéis de `/perfil`.

---

## 12. Testes

Unit tests para `lib/participant-profile.ts`:
- Otimista vs Cascão: datasets sintéticos com médias de gols altas/baixas → `position` esperada.
- Zebreiro vs consenso: casos onde o alvo segue e contraria o consenso.
- Calibragem: erro médio e placar exato com placares reais conhecidos; coerência com `lib/scoring.ts`.
- Leitor de estilo: time ofensivo vs defensivo inferido; correlação alta/baixa.
- Bordas: sem palpites, sem jogos finished, empate no consenso, divisão por zero → sem `NaN`, `confident=false`, arquétipo "Recém-chegado".
- Seleção do arquétipo: verificar escolha dos 2 eixos dominantes e o nome composto resultante.
