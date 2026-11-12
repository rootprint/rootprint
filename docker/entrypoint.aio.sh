#!/usr/bin/env bash
set -eu

pg_bin=/usr/lib/postgresql/17/bin
pgdata=/data/postgres

if [ ! -s "$pgdata/PG_VERSION" ]; then
	install -d -o postgres -g postgres -m 700 "$pgdata"
	setpriv --reuid=postgres --regid=postgres --init-groups \
		"$pg_bin/initdb" -D "$pgdata" -U rootprint --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
fi
install -d -o bun -g bun "$QW_DATA_DIR"

echo "Rootprint is starting at $ORIGIN"
echo "ORIGIN must match the address in your browser. Using another one? Re-run with -e ORIGIN=http://<host>:<port>"
mountpoint -q /data || echo "WARNING: /data is not a volume, so its data is lost with this container. Add -v rootprint:/data to keep it."

setpriv --reuid=postgres --regid=postgres --init-groups "$pg_bin/postgres" -D "$pgdata" \
	-c listen_addresses=127.0.0.1 -c unix_socket_directories= -c 'log_line_prefix=postgres %m [%p] ' &
pg=$!
setpriv --reuid=bun --regid=bun --init-groups quickwit run &
qw=$!
setpriv --reuid=bun --regid=bun --init-groups bun run apps/api/dist/app.js &
api=$!

stop() {
	kill -TERM "$api" 2>/dev/null
	wait "$api"
	# Together, not in turn: Quickwit's graceful shutdown alone takes about Docker's whole 10s stop
	# timeout, and Postgres must not be SIGKILLed waiting behind it.
	kill -TERM "$qw" 2>/dev/null
	kill -INT "$pg" 2>/dev/null
	wait "$qw" "$pg"
}

set +e
trap 'stop; exit 0' TERM INT
wait -n
status=$?
# A child died. Ignore stop signals so a `docker stop` during shutdown can't report exit 0.
trap '' TERM INT
stop
exit "$status"
