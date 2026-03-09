"""Git repository manager for cryo-wiring data."""

from __future__ import annotations

import logging
import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from git import GitCommandError, InvalidGitRepositoryError, Repo

logger = logging.getLogger(__name__)


def _find_env_path() -> Path:
    """Return the .env file path (project root, i.e. cwd)."""
    return Path.cwd() / ".env"


def _load_dotenv(env_path: Path) -> dict[str, str]:
    """Parse a .env file into a dict. Ignores comments and blank lines."""
    result: dict[str, str] = {}
    if not env_path.exists():
        return result
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        # Strip optional quotes
        value = value.strip().strip("\"'")
        result[key.strip()] = value
    return result


def _save_dotenv(env_path: Path, updates: dict[str, str]) -> None:
    """Update or create a .env file, preserving existing entries."""
    existing = _load_dotenv(env_path)
    existing.update(updates)
    lines = [f"{k}={v}" for k, v in existing.items()]
    env_path.write_text("\n".join(lines) + "\n")
    logger.info("Saved config to %s", env_path)


@dataclass
class SyncStatus:
    """Result of a commit_and_push operation."""
    committed: bool = False
    pushed: bool = False
    push_error: str = ""
    has_unpushed: bool = False


class DataRepo:
    """Manages a local clone of a cryo-wiring data repository."""

    def __init__(self, local_path: Path, remote_url: str | None = None) -> None:
        self.local_path = local_path.resolve()
        self.remote_url = remote_url
        self._repo: Repo | None = None
        self._ready = False

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def repo(self) -> Repo:
        if self._repo is None:
            raise RuntimeError("Repository not initialized. Call setup() first.")
        return self._repo

    # ── Setup & clone ─────────────────────────────────────────────────────

    def setup(self) -> Path:
        """Clone or open the data repository. Returns the working directory path.

        If no remote_url was provided, tries to load REPO_URL from .env.
        """
        if not self.remote_url:
            self._load_from_env()

        if self.remote_url:
            if self.local_path.exists():
                try:
                    self._repo = Repo(self.local_path)
                    self._configure_git_user()
                    logger.info("Opened existing repo: %s", self.local_path)
                    self.pull()
                except InvalidGitRepositoryError:
                    raise RuntimeError(
                        f"{self.local_path} exists but is not a git repository. "
                        "Remove it or use a different --data-dir."
                    )
            else:
                logger.info("Cloning %s -> %s", self.remote_url, self.local_path)
                self._repo = Repo.clone_from(self.remote_url, self.local_path)
                self._configure_git_user()
            self._save_to_env()
        else:
            # Local-only mode: use existing directory as-is
            if not self.local_path.exists():
                raise RuntimeError(f"Data directory not found: {self.local_path}")
            try:
                self._repo = Repo(self.local_path)
                self._configure_git_user()
            except InvalidGitRepositoryError:
                self._repo = None
                logger.info("Using non-git directory: %s", self.local_path)

        self._ready = True
        return self.local_path

    def clone_from_url(self, url: str, display_url: str | None = None) -> Path:
        """Clone a new repository, replacing any existing data."""
        if self.local_path.exists():
            for child in self.local_path.iterdir():
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()
        logger.info("Cloning %s -> %s", display_url or url, self.local_path)
        self._repo = Repo.clone_from(url, self.local_path)
        self._configure_git_user()
        self.remote_url = display_url or url
        self._ready = True
        self._save_to_env()
        return self.local_path

    # ── Git user config ────────────────────────────────────────────────────

    def _configure_git_user(self) -> None:
        """Set git user.name and user.email if not already configured."""
        if self._repo is None:
            return
        config = self._repo.config_writer()
        try:
            try:
                config.get_value("user", "name")
            except Exception:
                config.set_value("user", "name", "cryo-wiring-app")
            try:
                config.get_value("user", "email")
            except Exception:
                config.set_value("user", "email", "cryo-wiring-app@localhost")
        finally:
            config.release()

    # ── .env persistence ──────────────────────────────────────────────────

    def _load_from_env(self) -> None:
        """Load REPO_URL from .env file."""
        env_path = _find_env_path()
        env = _load_dotenv(env_path)
        url = env.get("REPO_URL")
        if url:
            self.remote_url = url
            logger.info("Loaded REPO_URL from %s: %s", env_path, url)

    def _save_to_env(self) -> None:
        """Save REPO_URL to .env file."""
        if not self.remote_url:
            return
        env_path = _find_env_path()
        _save_dotenv(env_path, {"REPO_URL": self.remote_url})

    # ── Git operations ────────────────────────────────────────────────────

    def pull(self) -> None:
        """Pull latest changes from remote."""
        if self._repo is None or self.remote_url is None:
            return
        try:
            origin = self._repo.remotes.origin
            origin.pull()
            logger.info("Pulled latest changes")
        except GitCommandError as e:
            logger.warning("Failed to pull: %s", e)

    def commit_and_push(self, message: str, paths: list[Path] | None = None) -> SyncStatus:
        """Stage changes, commit, and push. Returns SyncStatus with details."""
        status = SyncStatus()

        if self._repo is None:
            return status

        if paths:
            for p in paths:
                rel = p.relative_to(self.local_path)
                self._repo.index.add([str(rel)])
        else:
            self._repo.git.add(A=True)

        if not self._repo.is_dirty(index=True):
            logger.info("No changes to commit")
            return status

        self._repo.index.commit(message)
        status.committed = True
        logger.info("Committed: %s", message)

        if self.remote_url:
            # Pull --rebase before push to handle concurrent edits
            try:
                self._repo.git.pull("--rebase", "origin", self._repo.active_branch.name)
            except GitCommandError as e:
                logger.warning("Failed to pull --rebase before push: %s", e)
                status.push_error = f"Rebase failed: {e}"
                status.has_unpushed = True
                return status

            try:
                self._repo.remotes.origin.push()
                status.pushed = True
                logger.info("Pushed to remote")
            except GitCommandError as e:
                logger.warning("Failed to push: %s", e)
                status.push_error = str(e)
                status.has_unpushed = True

        return status

    def get_sync_info(self) -> dict:
        """Return current sync status for the UI."""
        info: dict = {
            "has_git": self._repo is not None,
            "has_remote": self.remote_url is not None,
            "unpushed_commits": 0,
            "branch": "",
        }
        if self._repo is None:
            return info
        try:
            info["branch"] = self._repo.active_branch.name
        except Exception:
            info["branch"] = "detached"

        if self.remote_url:
            try:
                branch = self._repo.active_branch.name
                ahead = list(self._repo.iter_commits(f"origin/{branch}..{branch}"))
                info["unpushed_commits"] = len(ahead)
            except Exception:
                pass
        return info
