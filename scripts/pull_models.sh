#!/bin/bash
# Pull required Ollama models for Folio
set -e

echo "📦 Pulling Gemma 4 models for Folio..."

# Default model (required)
echo "Pulling gemma4:e4b (~9 GB)..."
ollama pull gemma4:e4b

# Optional: smaller model for stretch goals
echo "Pulling gemma4:e2b (~7 GB)..."
ollama pull gemma4:e2b

echo "✅ Models ready. Run 'ollama list' to verify."
