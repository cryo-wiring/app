# cryo-wiring-app

Web UI for browsing and editing dilution refrigerator wiring configurations.

## Local Development

```bash
# Setup
make setup

# Run (in separate terminals)
make backend    # API server on http://localhost:8000
make frontend   # Next.js dev server on http://localhost:3000
```

Open http://localhost:3000. The `data/` directory contains sample data with the same structure as [cryo-wiring/template](https://github.com/cryo-wiring/template).

To reset development data, copy from the template repository:

```bash
rm -rf data/
cp -r ../template/ data/
```

You can also connect any GitHub repository from the web UI.

## Docker Compose

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

Data is persisted in the `cryo-data` Docker volume. On first launch, open the UI and enter a repository URL (e.g. `https://github.com/cryo-wiring/template.git`) to get started.

To pre-configure a repository, set the `REPO_URL` environment variable:

```bash
REPO_URL=https://github.com/cryo-wiring/template.git docker compose up --build
```

Or uncomment the `REPO_URL` line in `docker-compose.yml`.

## OpenAPI / API Client

To regenerate the frontend API client from the FastAPI schema:

```bash
make api-schema
```
