# Executar Migration Supabase — Bolão da Copa

## Overview

Migrations ficam em `supabase/migrations/*.sql`. Execução via `supabase db push`, que detecta automaticamente as migrations pendentes e as aplica ao banco remoto.

## Pré-requisitos

- Supabase CLI instalado (`supabase --version`)
- Projeto linkado (`supabase link` já executado — `supabase/config.toml` presente)

## Como executar

```bash
# Aplica todas as migrations pendentes no banco remoto
supabase db push <<< "Y"
```

O CLI lista as migrations que serão aplicadas e pede confirmação. O `<<< "Y"` confirma automaticamente.

## Armadilha comum: mudança de tipo de retorno em funções

PostgreSQL não aceita `CREATE OR REPLACE FUNCTION` quando o tipo de retorno muda (ex: adicionar coluna ao `RETURNS TABLE`). Nesses casos, a migration deve dropar a função antes de recriar:

```sql
DROP FUNCTION IF EXISTS minha_funcao(uuid);

CREATE OR REPLACE FUNCTION minha_funcao(p_group_id uuid)
RETURNS TABLE ( ... )
...
```

## Verificar migrations pendentes

```bash
supabase migration list
```

## Verificar se foi aplicada

```bash
supabase db query "SELECT proname, pronargs FROM pg_proc WHERE proname = '<nome_da_funcao>'"
```
