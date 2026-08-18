#!/bin/sh
# Pxxl start script — handles all PORT injection patterns
# Pxxl may pass PORT as env var or as argument

# Default to 3000 if PORT not set
export PORT="${PORT:-3000}"

echo "Starting Next.js on 0.0.0.0:$PORT"
exec node_modules/.bin/next start -p "$PORT" -H 0.0.0.0
