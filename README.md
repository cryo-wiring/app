# cryo-wiring-app

Web UI for browsing and editing dilution refrigerator wiring configurations.

Built with FastAPI + Next.js on top of [cryo-wiring-core](https://github.com/cryo-wiring/core).

## Related Repositories

| Repository                                                      | Description                          |
| --------------------------------------------------------------- | ------------------------------------ |
| [cryo-wiring/spec](https://github.com/cryo-wiring/spec)         | YAML format specification & schemas  |
| [cryo-wiring/core](https://github.com/cryo-wiring/core)         | Python library (models, validation, diagram, builder) |
| [cryo-wiring/cli](https://github.com/cryo-wiring/cli)           | CLI tool                             |
| [cryo-wiring/template](https://github.com/cryo-wiring/template) | Data repository template             |

## Quick Start (Docker Compose)

### Production

```bash
make up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

Data is persisted in the `cryo-data` Docker volume. On first launch, open the UI and enter a repository URL (e.g. `https://github.com/cryo-wiring/template.git`) to get started.

To pre-configure a repository:

```bash
REPO_URL=https://github.com/cryo-wiring/template.git make up
```

### Development (hot-reload)

```bash
make up-dev
```

Uses `./data/` as the data directory (bind mount) and enables Next.js hot-reload. To populate initial data:

```bash
make seed    # Copies seed/ → data/
make up-dev
```

### Stop

```bash
make down
```

## Local Development (no Docker)

```bash
# 1. Install dependencies
make setup

# 2. Populate sample data
make seed

# 3. Run (in separate terminals)
make backend    # API server on http://localhost:8000
make frontend   # Next.js dev server on http://localhost:3000
```

Open http://localhost:3000.

## OpenAPI / API Client

To regenerate the frontend API client from the FastAPI schema:

```bash
make api-schema
```

## Project Structure

```
app/
├── src/cryo_wiring_app/        # FastAPI backend
│   ├── api.py                  # REST API endpoints
│   ├── cli.py                  # CLI entry point (cryo-wiring-app)
│   └── repo.py                 # Git data repository manager
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/                # Pages (App Router)
│   │   ├── components/         # React components
│   │   ├── api/                # Generated API client (Orval)
│   │   └── types/              # TypeScript types
│   ├── Dockerfile              # Production multi-stage build
│   └── Dockerfile.dev          # Development (hot-reload)
├── templates/                  # Bundled YAML templates
├── seed/                       # Sample data for local development
├── compose.yaml                # Production Docker Compose
├── compose.dev.yaml            # Development Docker Compose
├── Dockerfile                  # Backend container
└── Makefile                    # Task runner
```
