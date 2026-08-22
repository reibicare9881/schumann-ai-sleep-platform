#!/bin/sh
# Brings up clamd (with its signature database) before the API starts
# accepting traffic, so the first requests after a deploy don't hit
# "scanner unreachable" instead of an actual scan result.
set -e

echo "clamav: fetching initial signature database..."
freshclam --config-file=/etc/clamav/freshclam.conf --quiet || echo "clamav: initial freshclam failed once, clamd will still try to start"

echo "clamav: starting background updater..."
freshclam --config-file=/etc/clamav/freshclam.conf -d --quiet &

# Without an explicit --config-file, clamd silently falls back to a
# compiled-in default path (not /etc/clamav/clamd.conf on this image) and
# then fails trying to create a local socket dir it has no permission for —
# even though this config only enables the TCP socket.
echo "clamav: starting clamd..."
clamd --config-file=/etc/clamav/clamd.conf &

echo "clamav: waiting for clamd to accept connections on 127.0.0.1:${CLAMAV_PORT:-3310}..."
python3 - "${CLAMAV_PORT:-3310}" <<'PY'
import socket
import sys
import time

port = int(sys.argv[1])
for _ in range(120):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            break
    except OSError:
        time.sleep(1)
else:
    sys.exit("clamav: clamd did not become ready in time")
PY

echo "clamav: ready. starting API."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
