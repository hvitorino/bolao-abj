---
name: pipeline
description: Use when the user requests any feature, improvement, bug fix, or new functionality for the Bolão da Copa project. Triggers the full multi-agent development pipeline (PM → Analyst → Developer → Reviewer) instead of implementing directly.
---

# Pipeline de Desenvolvimento — Bolão da Copa

## Overview

Toda implementação passa pelo pipeline de 4 agentes. Nunca implemente diretamente — sempre dispare o fluxo abaixo.

## Fluxo

```
Usuário pede algo
      ↓
Gerente de Produto   → escreve/atualiza product-roadmap.md
      ↓
Analista de Sistema  → escreve <slug>-spec.md
      ↓
Programador          → cria branch, escreve plan + changelog, implementa
      ↓
Revisor              → aprova (merge) ou solicita fix (loop com Programador)
      ↓
Gerente de Produto   → atualiza roadmap, delega próxima feature
```

## Como iniciar

Invoque o **Gerente de Produto** via Agent tool com `subagent_type: "gerente-de-produto"`:

```
Feature solicitada pelo usuário:
- Objetivo: <o que o usuário quer em 1-2 frases>
- Contexto adicional: <qualquer detalhe relevante da conversa>
- Critérios de sucesso sugeridos:
  - <critério mensurável 1>
  - <critério mensurável 2>

Execute o pipeline completo a partir desta feature.
```

O pipeline é autônomo: cada agente invoca o próximo até o merge na main.

## Regras

- **Nunca implemente diretamente** — sempre dispare o Gerente de Produto
- Para bugs: trate como feature de correção (slug `fix-<descricao>`)
- Para múltiplas features: o PM prioriza e executa uma por vez
- Features sem slug definido: o PM escolhe um slug baseado no objetivo
- O pipeline só termina quando o Revisor faz merge e notifica o PM

## Red Flags — PARE, use o pipeline

| Tentação | Realidade |
|----------|-----------|
| "É uma mudança pequena, faço direto" | Toda mudança merece spec + revisão |
| "O usuário quer rapidez" | O pipeline é rápido — agentes rodam em paralelo |
| "Já sei o que implementar" | Sem spec, sem controle de qualidade |
| "Não precisa de branch para isso" | Sempre precisa — é convenção do projeto |
