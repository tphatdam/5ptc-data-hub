#!/bin/sh
set -eu

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

log_event "server_starting" "started"
exec node dist/main
