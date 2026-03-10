.PHONY: setup seed dev backend frontend api-schema up up-dev up-tunnel up-dev-tunnel down

# ── Local (no Docker) ────────────────────────────────────

# Install dependencies
setup:
	pip install -e .
	cd frontend && npm install

# Populate data/ with sample seed data (safe: skips if data/ already exists)
seed:
	@if [ -d data ]; then echo "data/ already exists — remove it first to re-seed"; exit 1; fi
	cp -r seed data
	@echo "Seed data copied to data/"

# Start both backend API and frontend dev server (run in separate terminals)
dev:
	@echo "Run in separate terminals:"
	@echo "  make backend"
	@echo "  make frontend"

# Start backend API server using local data/ directory
backend:
	cryowire-app --data-dir ./data

# Start frontend dev server
frontend:
	cd frontend && npm run dev

# Export OpenAPI schema and regenerate frontend API client
api-schema:
	python scripts/export_openapi.py
	cd frontend && npm run generate-api

# ── Docker Compose ───────────────────────────────────────

# Start production stack (built images, named volume)
up:
	docker compose -f compose.yaml up --build -d

# Start development stack (hot-reload, local ./data mount)
up-dev:
	docker compose -f compose.dev.yaml up --build

# Start production stack with Cloudflare Tunnel
up-tunnel:
	docker compose -f compose.yaml --profile tunnel up --build -d

# Start development stack with Cloudflare Tunnel
up-dev-tunnel:
	docker compose -f compose.dev.yaml --profile tunnel up --build

# Stop running stack
down:
	docker compose -f compose.yaml -f compose.dev.yaml down
