#!/bin/bash
# Run Folio locally — backend + frontend
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Folio locally..."
echo "   Backend: http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""

# Check ollama
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⚠️  Ollama not running. Starting..."
    ollama serve &
    sleep 2
fi

# Backend
cd "$PROJECT_DIR"
echo "Starting FastAPI backend..."
uvicorn folio.api:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Frontend
cd "$PROJECT_DIR/web"
echo "Starting Next.js frontend..."
pnpm dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both services running. Press Ctrl+C to stop."
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
