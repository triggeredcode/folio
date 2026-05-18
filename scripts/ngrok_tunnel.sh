#!/bin/bash
# Expose Folio via ngrok for live demo
set -e

PORT=${1:-3001}

echo "🌐 Starting ngrok tunnel on port $PORT..."
echo "   Make sure both services are running first (scripts/run_local.sh)"
echo ""

ngrok http $PORT --domain=folio-demo.ngrok.io 2>/dev/null || \
ngrok http $PORT
