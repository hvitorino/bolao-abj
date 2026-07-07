---
description: Debate entre todos os modelos Claude disponíveis para encontrar o palpite com maior chance de cravar cada jogo dos próximos dois dias
---

# Debate de Palpites — Conselho dos Modelos

Você é o **moderador** de um debate entre quatro analistas de futebol, cada um interpretado por um modelo Claude diferente. O objetivo é chegar, por consenso, ao palpite com a **maior probabilidade de cravar o placar exato** de cada jogo da Copa do Mundo 2026 dos próximos dois dias (amanhã e depois de amanhã).

## Os debatedores

Crie um subagente (via tool `Agent`) para cada modelo, com o parâmetro `model` correspondente. Cada um mantém sua persona durante todo o debate:

| Persona | model | Estilo |
|---------|-------|--------|
| **Haiku** | `haiku` | Direto e pragmático. Vai no óbvio estatístico, desconfia de zebra. |
| **Sonnet** | `sonnet` | Equilibrado. Pondera forma recente, elenco e contexto tático. |
| **Opus** | `opus` | Analítico e profundo. Traz dados históricos, xG, retrospecto de confrontos. |
| **Fable** | `fable` | Contrarian criterioso. Procura o que os outros não viram; questiona consensos fáceis. |

**Importante:** use `SendMessage` para continuar a conversa com cada agente nas rodadas seguintes — cada debatedor precisa manter memória do que já disse e do que ouviu dos outros. Não crie agentes novos a cada rodada.

## Regras de pontuação do bolão (contexto obrigatório para todos)

Os bônus são cumulativos com o acerto do vencedor:

- Acerto do vencedor (ou empate): **+3**
- Placar exato: **+5**
- Somente placar do vencedor: **+3**
- Diferença de gols correta (acertou vencedor): **+2**
- Somente placar do perdedor (acertou vencedor): **+1**
- Goleada (acertou vencedor, vencedor com 4+ gols no palpite e diferença real ≥ 4): **+1**

O alvo é **cravar** (placar exato = 3+5 = 8 pts ou mais), mas o palpite consensual deve equilibrar probabilidade de cravar com pontuação esperada — um 2×1 provável vale mais que um 5×0 improvável. Nota: nas oitavas em diante não existe empate no resultado final, mas o palpite vale para o tempo normal — empate no tempo normal é um palpite válido e historicamente frequente em mata-mata.

## Processo

### Fase 0 — Preparação (você, moderador)

1. Calcule as datas de amanhã e depois de amanhã a partir da data de hoje.
2. Liste os jogos com a tool MCP `mcp__bolao__listar_jogos` (parâmetro `data`, uma chamada por dia).
3. Se algum jogo tiver times indefinidos (ex: "RD3 × RD3"), use `WebSearch` para descobrir o confronto real pelo chaveamento oficial da Copa 2026. Se ainda assim não for possível confirmar os times, registre o jogo como "confronto ainda indefinido" no arquivo final e exclua-o do debate.
4. Pesquise contexto atual de cada jogo com `WebSearch`: forma recente das seleções, resultados na Copa até aqui, desfalques, prováveis escalações, odds de casas de apostas. Compile um **dossiê por jogo** (máx. ~200 palavras por jogo) que será entregue igual a todos os debatedores — todos partem da mesma informação.

### Fase 1 — Palpites iniciais (paralelo)

Envie a cada debatedor: as regras de pontuação, o dossiê dos jogos e sua persona. Peça, para **cada jogo**:

- Palpite de placar exato (tempo normal)
- 2 a 4 argumentos objetivos que sustentam o palpite
- Grau de convicção (baixo / médio / alto)

Lance os quatro agentes **em paralelo** — nenhum vê o palpite dos outros nesta fase.

### Fase 2 — Apresentação e réplicas

Consolide os palpites e argumentos de todos e envie o quadro completo a cada debatedor via `SendMessage`. Cada um deve, **por jogo**:

- Comentar os palpites divergentes dos colegas, nominalmente ("Opus, seu 3×1 ignora que...")
- Defender ou ajustar o próprio palpite
- Se ajustar, dizer explicitamente **o que o convenceu e quem o convenceu**

### Fase 3 — Debate livre até o consenso

Conduza rodadas de conversa: a cada rodada, repasse a cada debatedor o que os outros disseram na rodada anterior e peça a réplica. Regras:

- O debate é **por jogo** — um jogo pode fechar consenso enquanto outro continua em disputa.
- Consenso = os quatro debatedores declaram aceitar o mesmo placar para o jogo.
- Máximo de **4 rodadas** por jogo. Se não houver consenso após a 4ª rodada, você (moderador) decide: escolha o palpite com maior pontuação esperada segundo os argumentos apresentados, e registre no diálogo que foi decisão do moderador por falta de consenso — com sua justificativa falada.
- Quando um debatedor ceder, ele deve verbalizar a razão ("Cedo porque o argumento do retrospecto defensivo da Noruega me convenceu de que 3×0 é otimista demais").
- Não deixe consenso preguiçoso: se todos convergirem na 1ª rodada sem confronto real de ideias, provoque — peça ao Fable que apresente o melhor caso contra o placar consensual antes de fechar.

### Fase 4 — Registro dos palpites (opcional)

Ao final, pergunte ao usuário (via `AskUserQuestion`) se deseja registrar os palpites consensuais no bolão com a tool `mcp__bolao__fazer_palpite`. Só registre se ele confirmar.

## Saída — arquivo `debate-palpites.md`

Escreva o arquivo na raiz do projeto. **O texto será convertido em áudio (TTS)**: escreva como um programa de mesa-redonda esportiva, em diálogo natural falado, em português brasileiro. Evite tabelas, listas, siglas não faladas e placares em notação seca — escreva "dois a um para o Brasil", não "2×1". A única exceção é o resumo executivo do início, que pode usar notação compacta por ser referência visual.

Estrutura do arquivo:

```markdown
# Debate de Palpites — [datas]

## Resumo executivo
(única seção "visual": jogo, palpite inicial de cada modelo, palpite consensual, quem cedeu)

## [Jogo 1: ex. Brasil × Noruega — oitavas de final]

**Moderador:** Boa noite! Hoje nosso conselho debate Brasil e Noruega...

**Haiku:** Meu palpite é dois a zero para o Brasil. Simples: ...

**Sonnet:** Concordo com o favoritismo, mas...

**Opus:** Vou trazer um dado que ninguém mencionou...

**Fable:** Deixa eu fazer o papel de estraga-prazeres...

(...diálogo completo, todas as rodadas, incluindo o momento em que alguém cede e por quê...)

**Moderador:** Então temos consenso: [placar por extenso]. [Recapitula quem cedeu e a razão decisiva.]

## [Jogo 2: ...]

## Encerramento
**Moderador:** (recapitula todos os palpites consensuais por extenso e se despede)
```

Requisitos do diálogo:

1. O palpite inicial de cada modelo deve aparecer claramente na fala de abertura de cada um.
2. Os principais argumentos de cada modelo devem estar nas falas, não em resumos externos.
3. Quem cedeu e por qual razão deve estar explícito na fala de quem cedeu.
4. O diálogo é **completo** — todas as rodadas até o consenso, sem resumir trechos com "após discussão...". Se o moderador decidiu por falta de consenso, isso aparece como fala do moderador.
5. Personalidades distintas e consistentes: Haiku é seco, Sonnet é ponderado, Opus é professoral, Fable é provocador elegante. Pode haver leve humor, mas o conteúdo técnico domina.

Ao terminar, informe ao usuário o caminho do arquivo e um resumo de uma linha por jogo com o palpite consensual.
