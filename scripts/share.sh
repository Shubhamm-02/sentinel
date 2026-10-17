#!/usr/bin/env bash
# Shares the local app over a public HTTPS link (for recording the demo from another machine).
# Everything runs in the background, so closing this terminal doesn't stop it.
#   scripts/share.sh          start, keep the Mac awake for 6 hours
#   scripts/share.sh 8        same, for 8 hours
#   scripts/share.sh stop     stop the app, the link and the keep-awake
set -euo pipefail
cd "$(dirname "$0")/.."
LOGS=.sandbox/logs
mkdir -p "$LOGS"

stop_all() {
  pkill -f "scripts/dev.mjs" 2>/dev/null || true
  pkill -f "src/server.ts" 2>/dev/null || true
  pkill -f "src/mcp/(inbox|payments)-server.ts" 2>/dev/null || true
  pkill -f "cloudflared tunnel --no-autoupdate --url http://localhost:3000" 2>/dev/null || true
  pkill -f "caffeinate -dimsu" 2>/dev/null || true
}

if [ "${1:-}" = "stop" ]; then
  stop_all
  echo "Stopped. The public link no longer works."
  exit 0
fi

HOURS="${1:-6}"
command -v cloudflared >/dev/null || { echo "cloudflared is missing: brew install cloudflared"; exit 1; }

stop_all
sleep 1

echo "Starting the app…"
nohup npm run dev > "$LOGS/dev.log" 2>&1 &
for _ in $(seq 1 30); do curl -s -o /dev/null http://localhost:3000/api/info && break; sleep 1; done
curl -s -o /dev/null http://localhost:3000/api/info || { echo "The app didn't start. See $LOGS/dev.log"; exit 1; }

echo "Opening the public link…"
: > "$LOGS/tunnel.log"
nohup cloudflared tunnel --no-autoupdate --url http://localhost:3000 > "$LOGS/tunnel.log" 2>&1 &
URL=""
for _ in $(seq 1 60); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOGS/tunnel.log" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "The tunnel didn't start. See $LOGS/tunnel.log"; exit 1; }

# A new link takes a few seconds to go live. Check it through Cloudflare's DNS: this Mac may have
# cached "not found" from looking the name up too early, which other computers won't have.
HOST=${URL#https://}
LIVE=no
for _ in $(seq 1 30); do
  IP=$(dig +short "$HOST" @1.1.1.1 | head -1)
  if [ -n "$IP" ] && [ "$(curl -s -m 10 --resolve "$HOST:443:$IP" -o /dev/null -w '%{http_code}' "$URL/api/info")" = "200" ]; then
    LIVE=yes
    break
  fi
  sleep 2
done
[ "$LIVE" = yes ] || echo "Warning: the link isn't answering yet. Give it a minute; see $LOGS/tunnel.log if it never does."

nohup caffeinate -dimsu -t $((HOURS * 3600)) > /dev/null 2>&1 &

echo
echo "  Live for ${HOURS} hours:  $URL"
echo
echo "  Keep the Mac plugged in with the lid open. Closing the lid still puts it to sleep."
echo "  Stop early with:  scripts/share.sh stop"
