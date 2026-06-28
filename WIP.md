# WIP — Auto-refresh de Token bolaodefutebol.com

## Objetivo

Eliminar a necessidade de atualizar manualmente o JWT do bolaodefutebol.com (válido ~8h) antes de cada dia de jogos. A ideia é armazenar o `refresh_token` do SuperTokens junto com o access token, e fazer o refresh automaticamente nas rotinas cloud quando necessário.

---

## Evidência capturada (Proxyman, 2026-06-28 09:45 UTC)

### Request
```
POST https://bolaodefutebol.com/auth/session/refresh
rid: session
fdi-version: 1.16,1.17,1.18,1.19,2.0,3.0,3.1,4.0,4.1
st-auth-mode: header
authorization: Bearer rZ0ECyepTMUk+8bLuoHFSY5Yx/Jt5fz+0B1yGsKSrLqBzUxvODZNsSwjM7djVOrw8ZHbDHPpP3C1GL944cuVf8KauvCTH8AZbP0TTz8Acw7DmXEwJlghWyvd3qbooqHps1wB1xwsmI6cEpS34Jahcmvdj9wsG5+qO6LmDjAEjN84unZRuZNi6+20MJKo3GMptDow2Ol6/7r2ARmcY3cSi3EA4oHXn/Z8ylia4oRsXKoo9YyCa4Vnq3Y8v6/CrXzbiy5QXd8VlDfLF9e22BsRZSepkAnOd+lNASeySKwAwEbr08smKqoZd/vfULmLhOhaLOLuo+bYPAeHyXzpXoxRIe+pktTjApUF+/rlMsipNZJNRz5Hvpso+J3Z5cnW64k0mTXihk2i148Ui4C4.1caae4285605a37e0dab06bd9d9f10edc07041cb0dc64379fdfb8352f7a08b57.V2
Content-Length: 0
```

### Response (200 OK)
```
St-Access-Token: eyJraWQiOiJkLTE3ODIyNTgwNDYwMjMiLCJ0eXAiOiJKV1QiLCJ2ZXJzaW9uIjoiNCIsImFsZyI6IlJTMjU2In0.eyJpYXQiOjE3ODI2Mzk5MDAsImV4cCI6MTc4MjY2ODcwMCwic3ViIjoiOTQ1Y2U3NTAtMjk3MS00ODRlLWJhNmEtODdiYmY3OTM3OWExIiwidElkIjoicHVibGljIiwic2Vzc2lvbkhhbmRsZSI6IjY3ZTljZjM4LTg5ODktNDE4Zi04MzZiLTVkNzRmMjFiYmUxMCIsInJlZnJlc2hUb2tlbkhhc2gxIjoiYjZlMGY3Y2YzOTU1Y2I3NWRmNDY1YzA1MTU5MWI2OGYyYzlmOTNiZGMzN2FmMWRlYzM4Njk1YWIyNWVmNjdkOSIsInBhcmVudFJlZnJlc2hUb2tlbkhhc2gxIjoiNDNkMTI4MjEwYjVmMjhmNDU5ZjBlMDMyZDNhOTIwZDIwZWQwNzE5OTIxMzg0MGJlNjU1ZTMxNjgzYjVlYjVjMiIsImFudGlDc3JmVG9rZW4iOm51bGwsImlzcyI6Imh0dHBzOi8vYm9sYW9kZWZ1dGVib2wuY29tL2F1dGgiLCJzdC1ldiI6eyJ0IjoxNzgyNDM4Mjc0OTI3LCJ2Ijp0cnVlfX0.fjxYQMw3-WvVq4zsxR89DV6o34lWXg-QS7jqRqd9KRLlG3Bp1k1oJVnZQX2mv8e-tFD0ZhgbIH-gbVpSSkv5L3OsLNnFJrm05TKcprDfwGcAM7gfOhMW7ZD_D5uoquZAEXrgfLiGWbuB3rmeRTzw8aeQear0rujcBklEA5kTtQA837tCw81vns2WJUap6DwXU0JrqkNEC_3WEN5w3Q_3qPSg5TZYaqEu4ateT5wMR-JO9RwTRzPmTKdwejTRncQ6pCpa3f5W6hEwtKNCx7Iaza2EfdDmKKPGebvMQ2UJw0jIU__bPDpWJ2eKw89_13VHeTOzyIzLOLN_-j0POz5iZA
St-Refresh-Token: m9UM16hKxk5k6Vhl+YMsONZVPrxio+2WspWKc+zUJzQrN94JI3OuJp3+RIu0cbSBOCH+VZTErZncVfcQU4uiqbyaLARYqqiL2aSInk+Iokx1nB4sVvBZyy+/xg7xR6104HjzZRgFr3YHs5YL63mFlCR9WAl1jHkN7nP8euzc74BGAkFlkPXhzYblsMQndVifAvZrOt9SQbA/Yub5irpL1lEsOzq6bELprAM5h9FZNF7TynGPO6J0j8vVteSsHDRZWg65i053fYArAN7+BqC5z0QIMsJiD65xh3TR/+Ossm3tGnNkndVEUiXMCuW1lTrN/6CTHAiyT8asEBvByoXazO5UAjcCYG6MPl4+M1r6f/WyZpl9/8LisrLKQfYmkkN2p4hfTPUps5ihngqj.dbdbea6ce1fe35288792e71b6aea0e81d88f595f81a0df41d8ec2a2cf1e3d21a.V2
Body: null
```

**JWT payload decodificado (access token):**
```json
{
  "iat": 1782639900,
  "exp": 1782668700,
  "sub": "945ce750-2971-484e-ba6a-87bbf79379a1",
  "tId": "public",
  "sessionHandle": "67e9cf38-8989-418f-836b-5d74f21bbe10"
}
```
> `iat` = 09:45 UTC | `exp` = 17:45 UTC — validade de 8h confirmada.

---

## Plano de implementação

### 1. Migration — adicionar coluna `refresh_token`

**Arquivo:** `supabase/migrations/20260628000001_integration_tokens_add_refresh.sql`

```sql
ALTER TABLE integration_tokens
  ADD COLUMN IF NOT EXISTS refresh_token TEXT;
```

### 2. Bootstrap — guardar tokens no Supabase

Executar no **SQL Editor do Dashboard** (service_role) imediatamente após capturar tokens frescos no Proxyman:

```sql
INSERT INTO integration_tokens (id, token, refresh_token, notes)
VALUES (
  'bolaodefutebol',
  '<St-Access-Token>',
  '<St-Refresh-Token>',
  'Tokens bolaodefutebol.com — auto-refresh via SuperTokens /auth/session/refresh'
)
ON CONFLICT (id) DO UPDATE
  SET token         = EXCLUDED.token,
      refresh_token = EXCLUDED.refresh_token,
      notes         = EXCLUDED.notes,
      updated_at    = now();
```

> **Timing crítico**: SuperTokens faz token rotation. Se o app mobile fizer outro refresh antes de salvar no DB, o token capturado fica inválido. Guardar imediatamente após a captura.

### 3. Lógica de auto-refresh nas rotinas cloud

Bloco a incluir no início de cada rotina (antes de buscar palpites):

```bash
# Buscar tokens do Supabase
RECORD=$(curl -s "https://<projeto>.supabase.co/rest/v1/integration_tokens?id=eq.bolaodefutebol&select=token,refresh_token" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

ACCESS_TOKEN=$(echo "$RECORD" | jq -r '.[0].token')
REFRESH_TOKEN=$(echo "$RECORD" | jq -r '.[0].refresh_token')

# Decodificar JWT e verificar validade
PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d. -f2 | base64 --decode 2>/dev/null)
EXP=$(echo "$PAYLOAD" | jq -r '.exp')
NOW=$(date +%s)

# Refresh se expirar em menos de 10 minutos
if [ $((EXP - NOW)) -lt 600 ]; then
  REFRESH_RESP=$(curl -si -X POST https://bolaodefutebol.com/auth/session/refresh \
    -H "rid: session" \
    -H "fdi-version: 4.1" \
    -H "st-auth-mode: header" \
    -H "authorization: Bearer $REFRESH_TOKEN" \
    -H "Content-Length: 0")

  NEW_ACCESS=$(echo "$REFRESH_RESP" | grep -i "St-Access-Token:" | awk '{print $2}' | tr -d '\r')
  NEW_REFRESH=$(echo "$REFRESH_RESP" | grep -i "St-Refresh-Token:" | awk '{print $2}' | tr -d '\r')

  curl -s -X PATCH "https://<projeto>.supabase.co/rest/v1/integration_tokens?id=eq.bolaodefutebol" \
    -H "apikey: $SUPABASE_SERVICE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$NEW_ACCESS\",\"refresh_token\":\"$NEW_REFRESH\",\"updated_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

  ACCESS_TOKEN=$NEW_ACCESS
fi

# Usar ACCESS_TOKEN para buscar palpites...
```

### 4. Atualizar CARTOLAABJ.md

Substituir a seção "Atualização do Token JWT" para documentar o novo fluxo automático e o procedure de bootstrap.

---

## Arquivos a modificar/criar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260628000001_integration_tokens_add_refresh.sql` | Criar |
| `CARTOLAABJ.md` | Atualizar seção de token |
| Rotinas em claude.ai/code/routines | Atualizar manualmente |

---

## Verificação pós-implementação

```sql
SELECT id, notes, updated_at,
       LEFT(token, 40)         AS access_start,
       LEFT(refresh_token, 40) AS refresh_start
FROM integration_tokens
WHERE id = 'bolaodefutebol';
```

Após a primeira rotina rodar: `updated_at` deve ser recente e `refresh_start` deve ser diferente do valor inserido no bootstrap.

---

## Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| App mobile faz refresh antes do bootstrap | Refresh token inválido | Capturar e salvar imediatamente |
| Logout do app / invalidação server-side | Refresh token inválido | Nova captura Proxyman (raro) |
| Duas rotinas simultâneas | Race condition no refresh | Segunda rotina falha no refresh mas usa token já atualizado |
