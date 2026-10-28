#!/bin/sh
# Keep a passing retry's evidence, including when another test step follows.
set -u
label=${1:?Supply a distinct test-step label}
shift
case "$label" in ''|*[!a-zA-Z0-9-]*) echo 'Invalid test-step label' >&2; exit 2;; esac
mkdir -p ci-diagnostics
node tools/browser-diagnostics.cjs > "ci-diagnostics/$label-before.json"
status=0
CI=1 DEBUG="${DEBUG:+$DEBUG,}pw:browser" \
  PLAYWRIGHT_JSON_OUTPUT_NAME="$PWD/ci-diagnostics/$label-results.json" \
  npx playwright test "$@" --output="$PWD/test-results/$label" \
  2> "ci-diagnostics/$label-browser.log" || status=$?
node tools/browser-diagnostics.cjs > "ci-diagnostics/$label-after.json"
if [ "$status" -ne 0 ]; then
  tail -n 100 "ci-diagnostics/$label-browser.log"
fi
echo "Browser step $label exited $status; diagnostics retained in ci-diagnostics/ and test-results/$label/."
exit "$status"
