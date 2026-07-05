#!/bin/bash
# Watchdog do bot WhatsApp — roda a cada 2 min via launchd (com.bolao.watchdog).
#
# O quick tunnel do cloudflared pode morrer no lado da Cloudflare com o
# processo local ainda vivo (o hostname para de resolver). Este script:
#   1. Testa o webhook de ponta a ponta através do tunnel
#   2. Se falhar, reinicia o serviço do cloudflared (nova URL)
#   3. Sincroniza o webhook da Evolution API com a URL atual do tunnel
#
# Serviços relacionados (~/Library/LaunchAgents/):
#   com.bolao.next        — next start na porta 3000 (KeepAlive)
#   com.bolao.cloudflared — quick tunnel com métricas fixas na 20241 (KeepAlive)
#   com.bolao.watchdog    — este script (StartInterval 120s)
#
# Desativar tudo:  launchctl bootout gui/$UID/com.bolao.next \
#                    gui/$UID/com.bolao.cloudflared gui/$UID/com.bolao.watchdog
#                  docker compose down
# Reativar:        for p in ~/Library/LaunchAgents/com.bolao.*.plist; do
#                    launchctl bootstrap gui/$UID "$p"; done
#                  docker compose up -d

set -u

METRICS_URL="http://127.0.0.1:20241/quicktunnel"
EVOLUTION_URL="http://localhost:8080"
EVOLUTION_KEY="bolao-whatsapp-key"
INSTANCE="bolao"
LOG_DIR="$HOME/Library/Logs/bolao-bot"
LOG_FILE="$LOG_DIR/watchdog.log"

mkdir -p "$LOG_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

tunnel_hostname() {
  curl -s --max-time 5 "$METRICS_URL" | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p'
}

webhook_ok() {
  curl -sf -o /dev/null --max-time 15 -X POST \
    "https://$1/api/whatsapp/webhook" \
    -H "Content-Type: application/json" -d '{"event":"watchdog"}'
}

hostname=$(tunnel_hostname)

if [ -z "$hostname" ] || ! webhook_ok "$hostname"; then
  log "tunnel sem resposta (hostname='${hostname:-vazio}') — reiniciando cloudflared"
  launchctl kickstart -k "gui/$(id -u)/com.bolao.cloudflared"
  for _ in $(seq 1 20); do
    sleep 3
    hostname=$(tunnel_hostname)
    [ -n "$hostname" ] && webhook_ok "$hostname" && break
  done
  if [ -z "$hostname" ] || ! webhook_ok "$hostname"; then
    log "ERRO: tunnel continua fora do ar após reinício"
    exit 1
  fi
  log "tunnel de volta: $hostname"
fi

desired="https://$hostname/api/whatsapp/webhook"
configured=$(curl -s --max-time 5 "$EVOLUTION_URL/webhook/find/$INSTANCE" \
  -H "apikey: $EVOLUTION_KEY" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')

if [ "$configured" != "$desired" ]; then
  curl -sf -o /dev/null --max-time 10 -X POST \
    "$EVOLUTION_URL/webhook/set/$INSTANCE" \
    -H "apikey: $EVOLUTION_KEY" -H "Content-Type: application/json" \
    -d "{\"webhook\":{\"enabled\":true,\"url\":\"$desired\",\"events\":[\"MESSAGES_UPSERT\"],\"webhookByEvents\":false,\"webhookBase64\":false}}" \
    && log "webhook atualizado: $configured -> $desired" \
    || log "ERRO ao atualizar webhook para $desired"
fi
