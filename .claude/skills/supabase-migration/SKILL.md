---
name: supabase-migration
description: Use when the user asks to run, execute, or apply a Supabase migration in the Bolão da Copa project.
---

# Executar Migration Supabase — Bolão da Copa

## Overview

Migrations ficam em `db/migrations/*.sql`. Execução via Supabase CLI (`supabase db execute`) usando a connection string do projeto.

## Pré-requisitos

- Supabase CLI instalado (`supabase --version`)
- `.env.local` com `SUPABASE_DB_URL` **ou** URL + senha do banco disponíveis

## Como executar

```bash
# Verificar conexão antes
supabase db query --db-url "$SUPABASE_DB_URL" -o table "SELECT 1 AS ok"

# Arquivo específico
supabase db query --db-url "$SUPABASE_DB_URL" -o table -f db/migrations/<arquivo>.sql
```

## Onde obter as credenciais

Supabase Dashboard → Settings → Database → **Connection string** (URI format).  
Salve em `.env.local`:
```
SUPABASE_DB_URL=postgresql://postgres:<senha>@<host>:5432/postgres
```

## Verificar se a migration foi aplicada

```bash
supabase db query --db-url "$SUPABASE_DB_URL" -o table \
  "SELECT policyname, cmd FROM pg_policies WHERE tablename = '<tabela>' ORDER BY policyname"
```
