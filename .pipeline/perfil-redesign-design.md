# Redesign da aba PERFIL — Documento de Design

> Brainstorm validado com o usuário em 2026-06-21. Este documento descreve **o quê** e **por quê**; a spec técnica detalhada (campos, contratos, migrações) é responsabilidade do Analista de Sistema no pipeline.

## Contexto

A aba de perfil atual (`app/(dashboard)/perfil/page.tsx` + `components/bolao/ProfileStats.tsx`) é uma lista monoespaçada e seca de 6 linhas de estatística (palpites feitos, % vencedor, % placar exato, média de pontos, sequência atual, melhor sequência). Funcional, mas sem hierarquia, sem vida e sem narrativa — "parece um relatório, não um perfil".

**Escopo:** somente o próprio perfil do usuário (não há visualização de perfil de terceiros).

**Direção escolhida:** perfil pessoal rico combinando três camadas — desempenho vivo + conquistas + histórico — com a **campanha (posição/pontos) como herói** no topo. Estrutura **"Painel de vestiário" (A) com feed cronológico no histórico (C)**: painéis empilhados em rolagem única, fiel ao "dense first" do Elifoot, sem abas internas.

## Linguagem visual

Segue o `DESIGN.md` rigorosamente: estética Elifoot — denso, tabular, monospace (`JetBrains Mono`), símbolos ASCII (`✓ ✗ ► ● ○ ██ ▲ ▼ 🔒`), cores da bandeira via tokens CSS, sem ícones SVG decorativos, sem sombras, dark only. Container `maxWidth: 600px` (já existente).

## Estrutura geral

Quatro painéis empilhados verticalmente:

1. SUA CAMPANHA (herói)
2. DESEMPENHO
3. TROFÉUS
4. HISTÓRICO (feed cronológico)

---

## Seção 1 — SUA CAMPANHA (herói)

```
┌─ SUA CAMPANHA ──────────────────────────────┐
│                                              │
│        #3        47 PTS                      │
│     posição     no grupo                     │
│                                              │
│  LÍDER  58  (-11)      PRÓXIMO  51  (-4)     │
└─────────────────────────────────────────────┘
```

- `#3` grande (cor conforme posição: `color-accent` no topo, demais conforme o padrão de ranking) e `47 PTS` grande ao lado.
- Linha inferior: distância em pontos para o líder e para o participante imediatamente acima.
- Caso o usuário seja o líder: variação `LÍDER 🟡 · +7 sobre o 2º`.
- Origem dos dados: função de ranking existente.

### Movimento de posição (decisão: opção B — snapshots)

Mostrar "▲2 desde a última rodada" exige histórico de posição, que o banco hoje **não guarda**. Decisão validada: **criar snapshots de posição**.

- Nova tabela para guardar a posição de cada participante por grupo, por rodada.
- Gravação de um snapshot sempre que **fecha uma rodada de jogos** (um dia com jogos encerrados).
- Movimento exibido = posição atual − posição no último snapshot. Rótulo: "▲2 / ▼1 / = desde a última rodada".
- Definição de "rodada" para fins de snapshot: **dia (matchday)** com jogos encerrados. (Confirmar com o Analista se há cadência melhor; este é o default.)

---

## Seção 2 — DESEMPENHO

```
┌─ DESEMPENHO ────────────────────────────────┐
│ ACERTO DE VENCEDOR   68%  ███████░░░  (15/22)│
│ PLACAR EXATO         12%  █░░░░░░░░░  (3/22) │
│ MÉDIA DE PONTOS      3.4 pts/jogo            │
│                      grupo 2.8  ▲ +0.6       │
│ SEQUÊNCIA            ●●●●○  4 atual · 6 melhor│
└─────────────────────────────────────────────┘
```

Evolução em relação ao componente atual:

- **Barras ASCII** (`███░░░`) para as taxas de acerto — leitura visual instantânea. Verde (`color-win`) quando ≥ 50%, muted abaixo.
- **Comparação com a média do grupo** na média de pontos: `grupo 2.8 ▲ +0.6` (verde se acima, vermelho se abaixo). É o que dá significado ao número.
- **Sequência em pílulas** `●●●●○` mostrando atual e melhor na mesma linha.
- Cada taxa exibe a fração de base (`15/22`).

Dado novo necessário: **média de pontos do grupo** (agregação simples). Demais valores já vêm das estatísticas atuais (e do que o componente/route já computa: `winner_rate`, `exact_rate`, `avg_points`, `current_streak`).

---

## Seção 3 — TROFÉUS

```
┌─ TROFÉUS  ·  7 / 15 ────────────────────────┐
│ ✓ ESTREIA          ✓ ABRIU O PLACAR          │
│ ✓ CRAVADA          ✓ REI DA GOLEADA          │
│ ✓ EMBALADO         ✓ CARTOLA   ✓ ZEBREIRO    │
│ ─────────────────────────────────────────────│
│ ✗ PROFETA          3/5 ███░░  placares exatos │
│ ✗ EM CHAMAS        4/5 ████░  sequência       │
│ ✗ ARTILHEIRO      47/100 pts                  │
│ 🔒 ???             troféu secreto             │
└─────────────────────────────────────────────┘
```

Sistema completo de medalhas com **três estados**:

- `✓` **desbloqueado** — verde, listado primeiro.
- `✗` **bloqueado com dica + progresso** — muted, com contagem/barra quando mensurável (`3/5`).
- `🔒 ???` **secreto** — descrição só revelada após desbloqueio.

Interação: tocar/expandir um troféu mostra descrição completa + data de conquista.

### Conjunto de 15 troféus

Todos deriváveis dos dados existentes (`scores.breakdown`, palpites, sequências, snapshots de ranking, média do grupo).

| Troféu | Critério |
|--------|----------|
| ESTREIA | primeiro palpite enviado |
| ABRIU O PLACAR | primeiro acerto de vencedor |
| CRAVADA | primeiro placar exato |
| REI DA GOLEADA | primeiro bônus de goleada |
| EMBALADO | sequência de 3 vencedores |
| EM CHAMAS | sequência de 5 |
| IMPARÁVEL | sequência de 8 |
| PROFETA | 5 placares exatos no total |
| VIDENTE | 25 acertos de vencedor no total |
| ARTILHEIRO | 100 pontos acumulados |
| PERFEITO NA RODADA | acertou o vencedor de **todos** os jogos de um dia |
| FIEL | palpitou em todos os jogos de uma rodada |
| CARTOLA | já ocupou o 1º lugar do grupo (via snapshot) |
| ZEBREIRO | acertou o vencedor num jogo em que a **maioria** do grupo errou |
| PÓDIO | fechou uma rodada no top 3 |

> Nota de naming: "PRIMEIRO SANGUE" foi descartado a pedido do usuário; substituído por **ABRIU O PLACAR**.

---

## Seção 4 — HISTÓRICO (feed cronológico)

```
┌─ HISTÓRICO ─────────────────────────────────┐
│ ▼ 14 JUN                                     │
│   BRA 3×1 ARG   vc 3×1   +8  ✓ CRAVADA       │
│   FRA 0×0 ALE   vc 1×0   +0                  │
│ ▼ 13 JUN                                     │
│   ESP 2×0 POR   vc 2×1   +3                  │
│   ENG 1×1 USA   vc 1×1   +5                  │
└─────────────────────────────────────────────┘
```

- **Agrupado por dia**, do mais recente para o mais antigo — a "narrativa da Copa" descendo a tela.
- Cada linha: resultado real · palpite do usuário (`vc 3×1`) · pontos ganhos · selo do troféu desbloqueado **naquele jogo** (inline, fechando o loop com a Seção 3).
- Cor dos pontos: positivos em `color-win`, `+0` em muted.
- Jogos **encerrados** que o usuário **não palpitou** aparecem **apagados como "furou"** (decisão validada).
- **Paginação:** inicia com os **últimos 20 jogos + botão "ver mais"** (decisão validada) — a Copa tem 104 jogos.

---

## Resumo de dados novos necessários

1. **Tabela de snapshots de posição** por grupo/rodada + rotina de gravação ao fechar cada dia com jogos encerrados.
2. **Média de pontos do grupo** (agregação).
3. **Derivação dos 15 troféus** (estado desbloqueado/progresso/data) a partir de `breakdown`, palpites, sequências, snapshots e média do grupo.
4. **Query do feed** (jogos encerrados do grupo + palpite do usuário + pontos + troféu inline, paginada; incluindo jogos "furados").

## Fora de escopo

- Edição de nome/avatar/identidade (o usuário não priorizou; permanece onde está hoje).
- Perfil de outros participantes.
- Modo claro / qualquer desvio do `DESIGN.md`.

## Próximo passo

Feature grande → segue pelo pipeline do projeto (PM → Analista de Sistema → Programador → Revisor). Este documento é a entrada de design para a spec técnica.
