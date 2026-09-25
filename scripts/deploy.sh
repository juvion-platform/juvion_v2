#!/usr/bin/env bash
#
# deploy.sh — build & restart the Juvion v2 API (backend under pm2) and rebuild
# the admin portal (nginx serves admin-portal/dist in place).
#
# Steps: git pull → workspace install → backend build → pm2 restart → portal build → API health check.
# Fail-fast: any failing step aborts the deploy (the running pm2 process is only touched at the restart step).
#
# Which pm2 process gets restarted is resolved from *this folder's* backend/.env
# PORT — the process actually listening on that port (fallback: the pm2 process
# whose cwd is this repo root or its backend dir). This makes the script
# folder-safe: run it from a QA checkout on a different PORT and it restarts that
# instance, never prod.
#
# The `e2e` workspace is deliberately excluded from the install — a deploy target
# has no business pulling Playwright browsers.
#
# Usage:
#   ./scripts/deploy.sh                              # deploy this repo (auto-detects its pm2 service from PORT)
#   npm run deploy                                   # same, via the root package.json
#   PM2_NAME=juvion-qa-api ./scripts/deploy.sh       # force a specific pm2 process name (skips auto-detect)
#   PORTAL_BUILD_SCRIPT=build:qa ./scripts/deploy.sh # build the portal with --mode qa (.env.qa)
#   HEALTH_URL=http://localhost:3004/api/health ./scripts/deploy.sh   # force the health endpoint

set -euo pipefail

# Repo root = parent of this script's dir, regardless of where it's invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

HEALTH_RETRIES="${HEALTH_RETRIES:-20}"
HEALTH_DELAY="${HEALTH_DELAY:-2}"
# `build` = vite's default production mode (.env.production). Override with
# build:qa on a QA checkout.
PORTAL_BUILD_SCRIPT="${PORTAL_BUILD_SCRIPT:-build}"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m==> %s\033[0m\n' "$*" >&2; exit 1; }

# Read PORT from backend/.env (strip quotes, inline comments, whitespace; last wins).
read_env_port() {
  local envfile="$1" val
  [ -f "$envfile" ] || return 1
  val="$(grep -E '^[[:space:]]*PORT[[:space:]]*=' "$envfile" | tail -n1 \
    | sed -E 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//; s/[[:space:]]*(#.*)?$//; s/^["'\'']//; s/["'\'']$//')"
  [ -n "$val" ] && printf '%s' "$val"
}

# PID currently LISTENing on a TCP port (ss first, lsof fallback).
pid_on_port() {
  local port="$1" pid
  pid="$(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -n1 | cut -d= -f2)"
  [ -z "$pid" ] && pid="$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | head -n1)"
  printf '%s' "$pid"
}

# Parse `pm2 jlist` on stdin into an array, tolerating pm2 being absent, silent,
# or emitting anything that isn't JSON. Never throws, never exits non-zero — a
# parse crash here would abort the whole deploy via set -e with no message.
PM2_JLIST_READER='
  function readList() {
    try {
      const raw = require("fs").readFileSync(0, "utf8").trim();
      const d = JSON.parse(raw || "[]");
      return Array.isArray(d) ? d : [];
    } catch { return []; }
  }
'

# Map a running PID -> its pm2 process name (empty if pm2 doesn't own it).
pm2_name_by_pid() {
  { pm2 jlist 2>/dev/null || true; } | node -e "$PM2_JLIST_READER"'
    const pid = Number(process.argv[1]);
    const m = readList().find(p => p.pid === pid);
    if (m) process.stdout.write(m.name);
  ' "$1"
}

# Map one or more working directories -> the pm2 process name whose cwd matches
# any of them. Juvion's pm2 entry may sit at the repo root or at backend/.
pm2_name_by_cwd() {
  { pm2 jlist 2>/dev/null || true; } | node -e "$PM2_JLIST_READER"'
    const dirs = process.argv.slice(1);
    const m = readList().find(p => p.pm2_env && dirs.some(dir => p.pm2_env.pm_cwd === dir || p.pm2_env.cwd === dir));
    if (m) process.stdout.write(m.name);
  ' "$@"
}

# pm2 must be on PATH before we resolve anything. Without this the missing-pm2
# case dies at 127 with no output at all (set -o pipefail surfaces pm2's status),
# which is a miserable thing to debug from a cron or non-login shell.
command -v pm2 >/dev/null 2>&1 || die "pm2 not found on PATH. Install it (npm i -g pm2) or run this from a shell where pm2 is available."

API_PORT="$(read_env_port "$BACKEND_DIR/.env" || true)"
[ -n "$API_PORT" ] || API_PORT=3003
HEALTH_URL="${HEALTH_URL:-http://localhost:$API_PORT/api/health}"

# Resolve the pm2 target for THIS folder, unless the caller forced PM2_NAME.
if [ -z "${PM2_NAME:-}" ]; then
  port_pid="$(pid_on_port "$API_PORT")"
  if [ -n "$port_pid" ]; then
    PM2_NAME="$(pm2_name_by_pid "$port_pid")"
  fi
  # Fall back to matching the pm2 process by its working directory (covers a
  # currently-stopped service, where nothing is listening on the port yet).
  [ -n "${PM2_NAME:-}" ] || PM2_NAME="$(pm2_name_by_cwd "$ROOT_DIR" "$BACKEND_DIR")"
  [ -n "${PM2_NAME:-}" ] || die "Could not resolve a pm2 process for port $API_PORT (backend/.env) or cwd $ROOT_DIR / $BACKEND_DIR. Set PM2_NAME=<name> explicitly."
fi

cd "$ROOT_DIR"

log "Target: pm2 '$PM2_NAME' · PORT $API_PORT (from backend/.env) · portal '$PORTAL_BUILD_SCRIPT' · health $HEALTH_URL"

log "Pulling latest changes ($(git rev-parse --abbrev-ref HEAD))"
git pull --ff-only

# Workspace-aware install. e2e is excluded on purpose (no Playwright on a deploy target).
log "Installing workspace deps (backend + admin-portal)"
npm install -w backend -w admin-portal --include-workspace-root

log "Backend: npm run build -w backend"
npm run build -w backend

log "Restarting pm2 service: $PM2_NAME"
# --update-env so any changed env vars are picked up on restart.
pm2 restart "$PM2_NAME" --update-env

# vite empties admin-portal/dist before writing, so nginx has a brief 404 window here.
log "Admin portal: npm run $PORTAL_BUILD_SCRIPT -w admin-portal"
npm run "$PORTAL_BUILD_SCRIPT" -w admin-portal

log "Health check: $HEALTH_URL"
attempt=1
while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$code" = "200" ]; then
    log "Health check passed (HTTP $code) after $attempt attempt(s)."
    log "Deploy complete."
    exit 0
  fi
  printf '   attempt %s/%s — got "%s", retrying in %ss...\n' "$attempt" "$HEALTH_RETRIES" "$code" "$HEALTH_DELAY"
  attempt=$((attempt + 1))
  sleep "$HEALTH_DELAY"
done

printf '\n\033[1;31m==> Health check FAILED after %s attempts. Recent pm2 logs:\033[0m\n' "$HEALTH_RETRIES"
pm2 logs "$PM2_NAME" --lines 30 --nostream || true
exit 1
