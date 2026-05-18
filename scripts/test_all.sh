#!/bin/bash
# Run the full Folio test suite
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "🧪 Running Folio test suite..."
echo ""

echo "=== Unit tests (no Ollama needed) ==="
python -m pytest tests/test_retrieve.py tests/test_narrate.py tests/test_api.py tests/test_vision.py::TestParseResponse -v
echo ""

echo "=== Demo mode replay (no Ollama needed) ==="
FOLIO_DEMO_MODE=1 python -m pytest tests/test_headless.py -v
echo ""

if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "=== Integration tests (Ollama detected) ==="
    python -m pytest tests/ -v -m integration
else
    echo "⚠️  Ollama not running. Skipping integration tests."
    echo "   Start with: ollama serve"
fi

echo ""
echo "✅ All tests complete!"
