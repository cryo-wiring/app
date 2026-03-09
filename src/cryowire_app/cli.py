"""CLI for cryowire-app web server."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Optional

import typer

app = typer.Typer(help="Web UI for cryowire configuration manager.")


@app.command()
def serve(
    repo: Annotated[
        Optional[str],
        typer.Option("--repo", help="GitHub repository URL (e.g. https://github.com/user/my-cryo-data.git)"),
    ] = None,
    data_dir: Annotated[
        Path,
        typer.Option("--data-dir", help="Local directory for cloned/data files"),
    ] = Path(os.environ.get("DATA_DIR", "./data")),
    port: Annotated[int, typer.Option(help="Port number")] = int(os.environ.get("PORT", "8000")),
    host: Annotated[str, typer.Option(help="Host address")] = os.environ.get("HOST", "127.0.0.1"),
) -> None:
    """Start the cryowire web UI.

    Examples:

        # Use local data/ directory (default)
        cryowire-app

        # Connect to a GitHub repository (clones on first run, pulls on restart)
        cryowire-app --repo https://github.com/user/cryo-data.git

        # Use a local directory (no git integration)
        cryowire-app --data-dir ./examples

        # Both: clone to a specific directory
        cryowire-app --repo https://github.com/user/cryo-data.git --data-dir ./my-data
    """
    import uvicorn
    from rich.console import Console

    from cryowire_app.api import create_app
    from cryowire_app.repo import DataRepo

    console = Console()

    # Allow REPO_URL env var as fallback
    repo = repo or os.environ.get("REPO_URL")

    data_repo = DataRepo(local_path=data_dir, remote_url=repo)

    if repo:
        console.print(f"[bold blue]Repository:[/] {repo}")
    console.print(f"[bold blue]Data directory:[/] {data_dir.resolve()}")

    try:
        data_repo.setup()
    except RuntimeError as e:
        if repo:
            console.print(f"[bold red]Error:[/] {e}")
            raise typer.Exit(1)
        # No repo and no data dir: start in setup mode
        console.print("[yellow]No data directory found. Starting in setup mode — configure via the web UI.[/]")

    if repo:
        console.print("[green]Repository synced successfully[/]")

    web_app = create_app(data_repo)
    console.print(f"[bold green]Starting web UI:[/] http://{host}:{port}")
    uvicorn.run(web_app, host=host, port=port)


if __name__ == "__main__":
    app()
