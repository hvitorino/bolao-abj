# Executar Migration Supabase — Bolão da Copa

## Overview

Migrations ficam em `supabase/migrations/*.sql`. Ao invocar esta skill, execute imediatamente o push via Supabase CLI — não apenas mostre o comando.

## Pré-requisitos

Antes de executar, verifique:

```bash
supabase --version
```

Se o CLI não estiver instalado, informe o usuário e pare.

## Execução

Rode o seguinte comando via Bash:

```bash
supabase db push <<< "Y"
```

O CLI detecta as migrations pendentes, lista-as e aplica ao banco remoto. O `<<< "Y"` confirma automaticamente.

## Verificar migrations pendentes (opcional)

```bash
supabase migration list
```

## Armadilha comum: mudança de tipo de retorno em funções

PostgreSQL não aceita `CREATE OR REPLACE FUNCTION` quando o tipo de retorno muda. A migration deve dropar a função antes de recriar:

```sql
DROP FUNCTION IF EXISTS minha_funcao(uuid);

CREATE OR REPLACE FUNCTION minha_funcao(p_group_id uuid)
RETURNS TABLE ( ... )
...
```

## Verificar se foi aplicada

```bash
supabase db query "SELECT proname FROM pg_proc WHERE proname = '<nome_da_funcao>'"
```
