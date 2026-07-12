#!/bin/zsh
# Double-click to start Vivi. Keeps a tiny local server running and opens the app.
cd "$(dirname "$0")"
PORT=8477
if ! lsof -i :$PORT >/dev/null 2>&1; then
  nohup python3 -m http.server $PORT >/dev/null 2>&1 &
  sleep 1
fi
open "http://localhost:$PORT/index.html"
