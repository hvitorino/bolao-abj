# Bot WhatsApp — Operação

Bot do Bolão ABJ integrado ao WhatsApp via Evolution API. Responde aos comandos
`!ajuda`, `!ranking`, `!hoje`, `!palpites`, `!reseta` e `!chupa`, com placares ao vivo da ESPN.
Qualquer outra mensagem começando com `!` recebe "Sei não, carai!!!".

## Arquitetura

```
WhatsApp ──▶ Evolution API (Docker, porta 8080)
                 │  webhook MESSAGES_UPSERT
                 ▼
   cloudflared quick tunnel (URL pública, muda a cada restart)
                 │
                 ▼
   Next.js produção (porta 3000) ──▶ app/api/whatsapp/webhook/route.ts
                 │
                 └──▶ resposta enviada de volta via Evolution API
```

| Componente | Gerenciado por | Permanência |
|---|---|---|
| Evolution API + Postgres | Docker Compose (`docker-compose.yml`) | `restart: unless-stopped`; Docker Desktop nos itens de login |
| Next.js (build de produção, porta 3000) | launchd `com.bolao.next` | `KeepAlive` — reinicia se cair |
| Tunnel cloudflared (métricas fixas em `127.0.0.1:20241`) | launchd `com.bolao.cloudflared` | `KeepAlive` — reinicia se cair |
| Watchdog (`scripts/bot-watchdog.sh`) | launchd `com.bolao.watchdog` | Roda a cada 120s |

Os plists ficam em `~/Library/LaunchAgents/com.bolao.*.plist`.

**O watchdog** testa o webhook de ponta a ponta através do tunnel a cada 2 minutos.
Se o tunnel morreu (acontece — a Cloudflare derruba quick tunnels com o processo
local ainda vivo), ele reinicia o cloudflared e atualiza a URL do webhook na
Evolution API automaticamente. Nenhuma intervenção manual é necessária.

## Iniciar

Normalmente não é preciso — tudo sobe sozinho no login. Para subir manualmente:

```bash
docker compose up -d
for p in ~/Library/LaunchAgents/com.bolao.*.plist; do
  launchctl bootstrap gui/$UID "$p"
done
```

A sessão do WhatsApp persiste no volume Docker (`evolution_instances`) — não é
preciso escanear QR code de novo. Se a instância desconectar de vez, acesse o
manager em `http://localhost:8080/manager` (API key: `bolao-whatsapp-key`,
instância: `bolao`) e reconecte via QR code.

## Parar

```bash
launchctl bootout gui/$UID/com.bolao.next \
  gui/$UID/com.bolao.cloudflared \
  gui/$UID/com.bolao.watchdog
docker compose down
```

`bootout` remove os serviços até o próximo `bootstrap` — eles **não** voltam
sozinhos no reboot. Para parar só temporariamente (volta no reboot), use
`launchctl kill SIGTERM gui/$UID/com.bolao.next` etc.

## Atualizar o código do bot

O serviço roda o **build de produção**, não `npm run dev`. Mudou algo em
`app/api/whatsapp/webhook/route.ts` ou `lib/espn.ts`?

```bash
npm run build
launchctl kickstart -k gui/$UID/com.bolao.next
```

Para desenvolver, rode `npm run dev` normalmente — o Next usa a porta 3001
automaticamente, já que a 3000 está ocupada pelo serviço.

## Adicionar novos comandos

Todo o bot vive em `app/api/whatsapp/webhook/route.ts`. Três edições:

1. **Função do comando** (seção `── Comandos ──`): função `async` que retorna a
   string da resposta. Formatação WhatsApp: `*negrito*`, `_itálico_`. Helpers
   disponíveis: `bdfFetch` (API bolaodefutebol), `fetchEspnScores` +
   `overlayEspnScore` (placar ao vivo ESPN), `friendlyName` (user_id → nome),
   `todayBRT`/`toBrtTime` (fuso BRT), `pts` (pontuação crua do BDF → pontos).
2. **Roteador**: novo `else if (text === '!meucomando') reply = await cmdMeuComando()`
   na cadeia de `if` do `POST`. `text` já chega trim + lowercase; erros na função
   caem no `try/catch` que responde "❌ Erro ao buscar dados".
3. **`cmdAjuda`**: adicionar a linha do comando novo.

Publicar: `npm run build && launchctl kickstart -k gui/$UID/com.bolao.next`.

Testar sem passar pelo WhatsApp (a resposta chega no WhatsApp do JID informado —
use o seu próprio número, não o do grupo):

```bash
curl -s -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.upsert","data":{"key":{"remoteJid":"SEU_JID","fromMe":false,"id":"t"},"message":{"conversation":"!meucomando"},"messageType":"conversation"}}'
```

## Diagnóstico

Logs em `~/Library/Logs/bolao-bot/`:

| Arquivo | Conteúdo |
|---|---|
| `watchdog.log` | **Comece por aqui** — reinícios de tunnel e atualizações de webhook |
| `next.log` | stdout/stderr do Next.js |
| `cloudflared.log` | stdout/stderr do tunnel |

Checagens úteis:

```bash
# Serviços launchd carregados (segunda coluna 0 = ok)
launchctl list | grep com.bolao

# URL atual do tunnel
curl -s http://127.0.0.1:20241/quicktunnel

# Webhook configurado na Evolution API (deve bater com a URL do tunnel)
curl -s http://localhost:8080/webhook/find/bolao -H "apikey: bolao-whatsapp-key"

# Teste de ponta a ponta (esperado: 200)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://$(curl -s http://127.0.0.1:20241/quicktunnel | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p')/api/whatsapp/webhook" \
  -H "Content-Type: application/json" -d '{"event":"ping"}'

# Instância do WhatsApp conectada? (esperado: "connectionStatus":"open")
curl -s http://localhost:8080/instance/fetchInstances -H "apikey: bolao-whatsapp-key"
```

Se o bot não responde e os comandos acima estão todos ok, verifique se a
instância está `open` (último comando) — sessão desconectada exige novo QR code.

**Sessão zumbi (envia mas não recebe):** a instância pode reportar `open` e
enviar mensagens normalmente, mas parar de RECEBER (acontece após restart do
container da Evolution). Sintoma: nenhum webhook chega e nenhuma mensagem nova
aparece no banco. Verificar as últimas mensagens persistidas:

```bash
docker exec bolao-abj-postgres-1 psql -U evolution -d evolution -t -c \
  "SELECT to_timestamp(\"messageTimestamp\") AT TIME ZONE 'America/Fortaleza',
          \"key\"->>'remoteJid', left(coalesce(message->>'conversation',''),30)
   FROM \"Message\" ORDER BY \"messageTimestamp\" DESC LIMIT 5;"
```

Se o grupo está ativo mas nada novo aparece, reinicie só a conexão da instância
(não o container):

```bash
curl -s -X POST http://localhost:8080/instance/restart/bolao -H "apikey: bolao-whatsapp-key"
```

As mensagens perdidas durante a surdez chegam depois do reconnect (o WhatsApp
reenvia o backlog) e o bot responde comandos atrasados — pode gerar respostas
duplicadas no grupo.

O handler do Next.js loga todo evento recebido em
`~/Library/Logs/bolao-bot/next.log` (linhas `[whatsapp/webhook] upsert`) — para
acompanhar ao vivo: `tail -f ~/Library/Logs/bolao-bot/next.log | grep whatsapp`.

## Gotchas conhecidos

- **Tunnel morre silenciosamente**: o processo cloudflared continua vivo e o
  endpoint `/quicktunnel` segue reportando o hostname, mas o DNS para de
  resolver. Sintoma: `curl` via tunnel falha (exit 6) enquanto
  `localhost:3000` responde 200. O watchdog resolve sozinho em até 2 minutos.
- **URL do tunnel muda a cada restart** do cloudflared — por isso o webhook
  precisa ser ressincronizado (o watchdog faz isso).
- **Notificador de gols foi removido** (commit `7c89acb`) — o bot é só
  comandos; não há nenhum script extra para manter rodando.
