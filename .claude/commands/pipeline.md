---
description: Planeja e implementa uma feature usando o pipeline completo de agentes do projeto (PM → Analista → Programador → Revisor)
argument-hint: Descrição do que deve ser implementado
---

# Pipeline de Desenvolvimento — Bolão ABJ

O usuário solicitou: **$ARGUMENTS**

## Sua tarefa

Invoque o **Gerente de Produto** via Agent tool (`subagent_type: "gerente-de-produto"`) com a mensagem abaixo. Não implemente nada diretamente — deixe o pipeline de agentes fazer o trabalho.

### Mensagem para o Gerente de Produto

```
Feature solicitada pelo usuário:
- Objetivo: $ARGUMENTS
- Contexto adicional: verifique .pipeline/product-roadmap.md para entender o estado atual do projeto
- Critérios de sucesso: a definir pelo PM conforme o objetivo

Execute o pipeline completo: atualize o roadmap, delegue ao Analista de Sistema, que delegará ao Programador, que ao final delegará ao Revisor para merge na main.
```

## Fluxo esperado

```
Você (slash command)
  └→ Gerente de Produto    → atualiza product-roadmap.md
       └→ Analista         → escreve <slug>-spec.md
            └→ Programador → cria branch, implementa, escreve changelog
                 └→ Revisor → revisa e faz merge (ou loop de fixes)
                      └→ Gerente de Produto → atualiza roadmap, próxima feature
```

O pipeline é autônomo após o disparo. Aguarde a conclusão do Gerente de Produto.
