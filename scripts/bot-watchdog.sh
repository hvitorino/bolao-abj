#!/bin/bash
# Watchdog do bot WhatsApp — roda a cada 2 min via launchd (com.bolao.watchdog).
#
# O webhook da Evolution aponta direto para o Next no host
# (http://host.docker.internal:3000) — URL fixa, sem depender do tunnel.
# O quick tunnel do cloudflared serve apenas a página pública e pode morrer
# no lado da Cloudflare com o processo local ainda vivo. Este script:
#   1. Garante que o webhook da Evolution aponta para a URL fixa do host
#   2. Testa o webhook de ponta a ponta (host -> Next)
#   3. Testa a página pública através do tunnel; se falhar, reinicia o cloudflared
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
WEBHOOK_URL="http://host.docker.internal:3000/api/whatsapp/webhook"
LOG_DIR="$HOME/Library/Logs/bolao-bot"
LOG_FILE="$LOG_DIR/watchdog.log"

mkdir -p "$LOG_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

tunnel_hostname() {
  curl -s --max-time 5 "$METRICS_URL" | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p'
}

# ── 1. Webhook da Evolution deve apontar para a URL fixa do host ─────────────

configured=$(curl -s --max-time 5 "$EVOLUTION_URL/webhook/find/$INSTANCE" \
  -H "apikey: $EVOLUTION_KEY" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')

if [ "$configured" != "$WEBHOOK_URL" ]; then
  curl -sf -o /dev/null --max-time 10 -X POST \
    "$EVOLUTION_URL/webhook/set/$INSTANCE" \
    -H "apikey: $EVOLUTION_KEY" -H "Content-Type: application/json" \
    -d "{\"webhook\":{\"enabled\":true,\"url\":\"$WEBHOOK_URL\",\"events\":[\"MESSAGES_UPSERT\"],\"webhookByEvents\":false,\"webhookBase64\":false}}" \
    && log "webhook corrigido: ${configured:-vazio} -> $WEBHOOK_URL" \
    || log "ERRO ao corrigir webhook para $WEBHOOK_URL"
fi

# ── 2. Next respondendo na porta 3000 ────────────────────────────────────────

if ! curl -sf -o /dev/null --max-time 15 -X POST \
  "http://localhost:3000/api/whatsapp/webhook" \
  -H "Content-Type: application/json" -d '{"event":"watchdog"}'; then
  log "Next sem resposta na porta 3000 — reiniciando com.bolao.next"
  launchctl kickstart -k "gui/$(id -u)/com.bolao.next"
fi

# ── 3. Tunnel (somente página pública) ───────────────────────────────────────

tunnel_ok() {
  # Sonda a raiz (307 -> login): confirma que o tunnel resolve e o Next responde,
  # sem depender de nenhuma página específica.
  curl -sf -o /dev/null --max-time 15 "https://$1/"
}

hostname=$(tunnel_hostname)

if [ -z "$hostname" ] || ! tunnel_ok "$hostname"; then
  log "tunnel sem resposta (hostname='${hostname:-vazio}') — reiniciando cloudflared"
  launchctl kickstart -k "gui/$(id -u)/com.bolao.cloudflared"
  for _ in $(seq 1 20); do
    sleep 3
    hostname=$(tunnel_hostname)
    [ -n "$hostname" ] && tunnel_ok "$hostname" && break
  done
  if [ -z "$hostname" ] || ! tunnel_ok "$hostname"; then
    log "ERRO: tunnel continua fora do ar após reinício (página pública indisponível)"
    exit 1
  fi
  log "tunnel de volta: $hostname"
fi
