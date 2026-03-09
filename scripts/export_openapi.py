"""Export OpenAPI schema from the FastAPI app."""

import json
from pathlib import Path

from cryo_wiring_app.api import create_app
from cryo_wiring_app.repo import DataRepo

# Create a dummy repo for schema generation
dummy_repo = DataRepo(local_path=Path("/tmp/dummy"))
dummy_repo._repo = None  # noqa: SLF001
dummy_repo.local_path = Path("/tmp/dummy")

app = create_app(dummy_repo)

schema = app.openapi()
out = Path(__file__).parent.parent / "frontend" / "openapi.json"
out.write_text(json.dumps(schema, indent=2))
print(f"Wrote {out}")
