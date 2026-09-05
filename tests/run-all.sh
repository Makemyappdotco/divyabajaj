#!/bin/bash
# Every suite against a FRESH harness.
#
# These are integration tests against a stateful stub. Sharing one process
# between suites is how a suite ends up passing only because an earlier one
# happened to book a slot for it.
#
#   bash tests/run-all.sh
#
# Needs the harness at /tmp/bookpreview (see HARNESS below).

set -u
HARNESS="${HARNESS:-/tmp/bookpreview}"
export BOOK_TEST_PORT="${BOOK_TEST_PORT:-4409}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

# The harness is started from inside its own directory, so its cmdline reads
# "node server.js" - NOT the full path. Matching on the path found nothing,
# every stop() silently did nothing, and the fix each time was to bump the port
# and leave another orphan behind. Six of them had piled up.
stop() {
  for p in $(ls /proc | grep -E '^[0-9]+$'); do
    [ -r "/proc/$p/cmdline" ] || continue
    tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null | grep -q 'node server\.js' && kill -9 "$p" 2>/dev/null
  done 2>/dev/null
  sleep 1
  # Prove the port is actually free rather than assuming the kill worked.
  for _ in $(seq 1 10); do
    curl -sf "http://127.0.0.1:${BOOK_TEST_PORT}/api/pricing" > /dev/null || return 0
    sleep 0.5
  done
  echo "port ${BOOK_TEST_PORT} is still answering after stop()"
  return 1
}

start() {
  ( cd "$HARNESS" && setsid nohup node server.js > out.log 2>&1 < /dev/null & )
  for _ in $(seq 1 20); do
    curl -sf "http://127.0.0.1:${BOOK_TEST_PORT}/api/pricing" > /dev/null && return 0
    sleep 0.4
  done
  echo "harness did not come up on ${BOOK_TEST_PORT}"
  return 1
}

run() {
  echo ""
  echo "=== $1"
  node "$REPO/tests/$1" 2>&1 | tail -3
  [ "${PIPESTATUS[0]}" -eq 0 ] || FAILED=1
}

# Pure unit suites: no harness needed.
run availability.test.js
run pricing.test.js

# Integration suites: fresh harness each.
for suite in schedule-api.test.js booking-api.test.js payment-api.test.js pricing-e2e.test.js paid-report.test.js; do
  stop; start || exit 1
  run "$suite"
done
stop

echo ""
[ "$FAILED" -eq 0 ] && echo "ALL SUITES PASSED" || echo "SOME SUITES FAILED"
exit "$FAILED"
