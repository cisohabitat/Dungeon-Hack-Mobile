#!/bin/sh
# A transient package-mirror failure must not prevent the browser checks running.
set -eu
case "${1:-}" in chromium|webkit) ;; *) echo 'Expected chromium or webkit.' >&2; exit 2 ;; esac
# The hosted runner's Azure mirror can stall on font/codec downloads. Keep
# Ubuntu's signed repositories, using its canonical HTTPS archive instead.
if [ "${GITHUB_ACTIONS:-}" = true ] && [ -f /etc/apt/apt-mirrors.txt ]; then
  sudo sed -i \
    -e 's|http://azure\.archive\.ubuntu\.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' \
    -e 's|https://azure\.archive\.ubuntu\.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' \
    /etc/apt/apt-mirrors.txt
fi
for attempt in 1 2 3; do
  if npx playwright install --with-deps "$1"; then exit 0; fi
  if [ "$attempt" -lt 3 ]; then
    echo "Browser installation failed; retrying the same command ($attempt/3)." >&2
    sleep 5
  fi
done
echo 'Browser installation failed after three attempts.' >&2
exit 1
