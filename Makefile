.PHONY: dev test test-unit test-integration test-headless backend frontend setup

# Run both backend and frontend
dev:
	@bash scripts/run_local.sh

# Backend only
backend:
	cd . && uvicorn folio.api:app --host 0.0.0.0 --port 8000 --reload

# Frontend only
frontend:
	cd web && pnpm dev

# Install everything
setup:
	pip install -e ".[dev]"
	cd web && pnpm install
	ollama pull gemma4:e4b

# Run all tests
test:
	python -m pytest tests/ -v

# Unit tests only (no Ollama needed, fast)
test-unit:
	python -m pytest tests/test_retrieve.py tests/test_narrate.py tests/test_api.py tests/test_vision.py::TestParseResponse tests/test_ask.py::TestCitationExtraction -v

# Integration tests (needs Ollama running)
test-integration:
	python -m pytest tests/ -v -m integration

# Headless replay tests (uses cached, no Ollama)
test-headless:
	FOLIO_DEMO_MODE=1 python -m pytest tests/test_headless.py -v

# Build frontend
build:
	cd web && pnpm build

# Docker
docker:
	docker compose up --build
