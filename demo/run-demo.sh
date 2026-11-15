#!/usr/bin/env bash
# One-command end-to-end demo: start the server, buy a report, show the result.
# Prereq: buyer wallet funded with test USDC (see README.md "Funding").
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-8787}"
echo "== starting server on :$PORT =="
node src/server.js > demo/server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
sleep 2
echo "== health =="
curl -s "http://127.0.0.1:$PORT/health" | head -c 600; echo
echo "== catalog =="
curl -s "http://127.0.0.1:$PORT/" | head -c 400; echo
echo "== buy AAPL report (402 -> sign -> report) =="
node src/client.js AAPL
echo "== portfolio (profit -> tokenized stocks) =="
curl -s "http://127.0.0.1:$PORT/portfolio"
echo
echo "== demo done (server log: demo/server.log) =="
