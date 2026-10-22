#!/bin/sh
# A transient package-mirror failure must not prevent the browser checks running.
set -eu
case "${1:-}" in chromium|webkit) ;; *) echo 'Expected chromium or webkit.' >&2; exit 2 ;; esac
for attempt in 1 2 3; do
  if npx playwright install --with-deps "$1"; then exit 0; fi
  if [ "$attempt" -lt 3 ]; then
    echo "Browser installation failed; retrying the same command ($attempt/3)." >&2
    sleep 5
  fi
done
echo 'Browser installation failed after three attempts.' >&2
exit 1
