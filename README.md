# cryowire-app

Web UI for browsing and editing dilution refrigerator wiring configurations.

Built with FastAPI + Next.js on top of [cryowire](https://github.com/cryowire/core).

## For Users

### 1. Create your data repository

Go to [cryowire/template](https://github.com/cryowire/template) and click **"Use this template"** to create your own data repository on GitHub.

### 2. Customize templates

In your new repository, edit the files to match your lab:

| File | What to customize |
|---|---|
| `components.yaml` | Register the RF/microwave parts in your lab |
| `templates/control_module.yaml` | Default control line wiring |
| `templates/readout_send_module.yaml` | Default readout send wiring |
| `templates/readout_return_module.yaml` | Default readout return wiring |

Delete the sample data (`your-cryo/` directory) and push.

### 3. Launch the app

```bash
git clone https://github.com/cryowire/app.git
cd app
cp .env.example .env
```

Edit `.env` with your repository URL and GitHub token:

```bash
REPO_URL=https://github.com/<your-user>/<your-repo>.git
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The token is required for the app to push changes back to your repository.
Generate one at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

```bash
make up
```

Open http://localhost:3000 and start managing your wiring configurations.

### 4. Daily workflow

- **New cooldown** — Click "New Cooldown" in the UI. Creates `<cryo>/<YYYY>/cdNNN/` automatically
- **Edit wiring** — Click any line to modify components per stage
- **View diagrams** — Wiring diagrams and summary tables update in real-time
- **Git sync** — All changes are committed and pushed to your GitHub repository automatically

## Related Repositories

| Repository | Description |
|---|---|
| [cryowire/spec](https://github.com/cryowire/spec) | YAML format specification & schemas |
| [cryowire/core](https://github.com/cryowire/core) | Python library (models, validation, diagram, builder) |
| [cryowire/cli](https://github.com/cryowire/cli) | CLI tool |
| [cryowire/template](https://github.com/cryowire/template) | Data repository template |

---

## For Developers

### Docker Compose

```bash
# Production (built images, named volume)
make up

# Development (hot-reload, local ./data mount)
make seed       # Populate sample data (first time only)
make up-dev

# Stop
make down
```

### Local Development (no Docker)

```bash
make setup      # Install Python + Node dependencies
make seed       # Populate sample data
make backend    # Terminal 1: API server on :8000
make frontend   # Terminal 2: Next.js dev server on :3000
```

### OpenAPI / API Client

```bash
make api-schema   # Export schema + regenerate frontend client (Orval)
```

### Project Structure

```
app/
├── src/cryowire_app/        # FastAPI backend
│   ├── api.py                  # REST API endpoints
│   ├── cli.py                  # CLI entry point (cryowire-app)
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
