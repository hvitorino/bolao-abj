# Design: Proposta de Workflow de Desenvolvimento com IA

**Data:** 2026-07-03
**Contexto:** Proposta de apresentação para time de engenharia (3 back, 2 front, 1 PM, 1 EM)
**Output:** Deck de slides (9 slides)

---

## Contexto e Problema

O time já usa IA de forma individual e ad-hoc (Cursor, Claude), sem padrão compartilhado. Isso gera três dores centrais:

1. **Reuniões longas de refinamento** — spec técnica ainda é feita manualmente
2. **Excesso de documentação** — gerada por humanos, raramente atualizada
3. **Memória de decisões** — "por que escolhemos X?" não tem resposta rápida

**Ferramentas atuais:** Jira, GitLab, Confluence, Slack, Obsidian

**Gap de conhecimento no time:** muitos não entendem que a IA não aprende entre sessões, que documentação vira token e que excesso de contexto degrada a qualidade das respostas. Cada fase da proposta inclui uma explicação desse gap antes de apresentar a solução.

---

## Estrutura da Apresentação (9 slides)

### Slide 1 — Abertura
**Título:** "De ferramenta individual a vantagem competitiva do time"

- O time já usa IA, mas de forma isolada e sem padrão
- Isso cria assimetria: quem sabe usa, quem não sabe fica para trás
- Esta proposta define um workflow compartilhado, da ideia ao deploy
- Meta: reduzir lead time de feature em 40% sem aumentar headcount

---

### Slide 2 — Fundação: o que a IA não é
**Título:** "Antes de começar: o que a IA não resolve sozinha"

- **"A IA aprende com o tempo"** → não aprende; cada conversa começa do zero
- **"Jogar toda a documentação resolve"** → documentação vira token; excesso degrada a resposta
- **"Mais contexto = melhor resultado"** → contexto precisa ser cirúrgico, não exaustivo
- **Consequência prática:** o workflow precisa de estrutura humana para que a IA seja efetiva

---

### Slide 3 — Fase 1: O Problema
**Título:** "Código gerado com Cursor ainda exige muito do dev"

- Dev escreve ticket → interpreta a spec sozinho → codifica → abre PR → espera review
- A IA ajuda a escrever código, mas não entende o ticket nem revisa o resultado
- Review humano é feito sobre código não validado: encontra bugs que a IA poderia ter pego
- **Gap de IA aqui:** o Cursor é reativo — responde ao que o dev digita, não ao que o ticket pede

---

### Slide 4 — Fase 1: A Solução
**Título:** "Fase 1 (Mês 1): Do ticket Jira ao PR revisado por agentes"

```
Jira Ticket
     ↓
[Agente Analista]    →  Spec técnica + critérios de aceitação
     ↓
[Agente Programador] →  Código implementado + testes unitários
     ↓
[Agente Revisor]     →  Code review: bugs, padrões, cobertura
     ↓
Desenvolvedor humano →  Revisão final de contexto e negócio → Merge
```

- O dev não larga o volante — aprova, ajusta e mergeia
- A IA elimina o trabalho mecânico; o humano aplica julgamento
- **Critério de sucesso:** PR pronto para revisão humana em menos de 2h após abertura do ticket

---

### Slide 5 — Fase 2: O Problema
**Título:** "O pipeline para na porta do merge"

- Deploy ainda é manual ou semi-automatizado
- Testes de integração e E2E ficam de fora do ciclo dos agentes
- Confluence e Jira não são atualizados automaticamente após o merge
- **Gap de IA aqui:** o pipeline cobre o código, mas o ciclo de entrega continua dependendo de ação humana além do review

---

### Slide 6 — Fase 2: A Solução
**Título:** "Fase 2 (Mês 2): Pipeline estendido até o deploy"

```
[Agente Analista]     → Spec
[Agente Programador]  → Código + testes unitários
[Agente QA]           → Testes de integração + relatório
[Agente Revisor]      → Code review
          ↓
   Revisão humana     → Merge
          ↓
[Agente Deploy]       → Deploy em staging automatizado
[Agente Documentador] → Confluence + Jira atualizados
```

- Ticket fechado, código no ar e doc atualizada sem nenhuma ação manual pós-merge
- **Critério de sucesso:** lead time do ticket ao deploy em staging abaixo de 4h

---

### Slide 7 — Fase 3: O Problema
**Título:** "A memória que o time não tem"

- "Por que escolhemos essa arquitetura?" — ninguém lembra
- Obsidian e Confluence existem, mas ninguém consulta antes de decidir
- Novos membros gastam semanas para ganhar contexto
- **Gap de IA aqui:** agentes sem memória persistente repetem erros e ignoram restrições passadas

---

### Slide 8 — Fase 3: A Solução
**Título:** "Fase 3 (Mês 3): Knowledge Graph como memória do time"

- Obsidian vira fonte de verdade de ADRs (Architecture Decision Records)
- Pipeline de ingestão: Jira + GitLab + Confluence → índice vetorial consultável pela IA
- Qualquer agente do pipeline consulta o grafo antes de gerar output
- **Resultado:** a IA responde "por que X?" com base em decisões reais, não em suposições
- **Critério de sucesso:** novo dev onboardado em 2 dias com auxílio do knowledge graph

---

### Slide 9 — Fechamento
**Título:** "Roadmap e próximos passos"

```
Mês 1              Mês 2              Mês 3
────────           ────────           ────────
Ticket → PR    →   Pipeline       →   Knowledge
por agentes        até o deploy        Graph ativo
```

- **Próxima ação concreta:** escolher 1 feature no backlog e rodar a Fase 1 como piloto na próxima sprint
- KPIs: tempo de refinamento, lead time ticket → deploy, tempo de onboarding

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Progressão entre fases | 3 fases de 1 mês cada | Time pequeno; ciclos curtos permitem validar antes de expandir |
| Humano no loop | Revisão final obrigatória antes do merge | Confiança e responsabilidade ainda são humanas |
| Gap educacional | Um slide de problema por fase | Endereça resistência cultural sem criar seção separada de "treinamento" |
| Máx. slides por subtema | 2 (problema + solução) | Audiência técnica; sem excesso de slides conceituais |
| Knowledge Graph no mês 3 | Após pipeline estabelecido | Grafo sem pipeline ativo não tem dado suficiente para ser útil |
