#!/bin/sh
set -eu

PORT="${PORT:-3000}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/health}"
HEALTH_MAX_RETRIES="${HEALTH_MAX_RETRIES:-60}"
HEALTH_RETRY_DELAY_SECONDS="${HEALTH_RETRY_DELAY_SECONDS:-2}"

log_event() {
  event="$1"
  status="$2"
  extra="${3:-}"
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if [ -n "$extra" ]; then
    printf '{"event":"%s","module":"deploy","status":"%s","ts":"%s",%s}\n' "$event" "$status" "$ts" "$extra"
  else
    printf '{"event":"%s","module":"deploy","status":"%s","ts":"%s"}\n' "$event" "$status" "$ts"
  fi
}

log_event "db_preflight_started" "started"
if node dist/cli/db-preflight.js; then
  log_event "db_preflight_completed" "succeeded"
else
  log_event "db_preflight_failed" "failed"
  exit 1
fi

log_event "migration_run_started" "started"
if npm run migration:run:prod; then
  log_event "migration_run_completed" "succeeded"
else
  log_event "migration_run_failed" "failed"
  exit 1
fi

node dist/main &
APP_PID=$!
log_event "server_started" "started" "\"pid\":${APP_PID},\"port\":${PORT}"

cleanup() {
  if [ -n "${APP_PID:-}" ] && kill -0 "$APP_PID" 2>/dev/null; then
    kill -TERM "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM

healthy="false"
attempt=1
while [ "$attempt" -le "$HEALTH_MAX_RETRIES" ]; do
  if node -e "
    const url = process.argv[1];
    fetch(url)
      .then((res) => process.exit(res.ok ? 0 : 1))
      .catch(() => process.exit(1));
  " "$HEALTH_URL"
  then
    healthy="true"
    break
  fi

  attempt=$((attempt + 1))
  sleep "$HEALTH_RETRY_DELAY_SECONDS"
done

if [ "$healthy" = "true" ]; then
  (
    log_event "bootstrap_seed_started" "started"
    if npm run seed:bootstrap:prod; then
      log_event "bootstrap_seed_completed" "succeeded"
    else
      log_event "bootstrap_seed_failed" "failed"
    fi
  ) &
else
  log_event "bootstrap_seed_failed" "failed" "\"error\":\"health_check_timeout\""
fi

wait "$APP_PID"
