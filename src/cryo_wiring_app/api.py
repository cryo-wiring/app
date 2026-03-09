"""FastAPI web application for browsing and editing wiring configurations."""

from __future__ import annotations

import copy
import shutil
import tempfile
from datetime import date
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from cryo_wiring_core.bundle import export_cooldown, write_cooldown
from cryo_wiring_core.config import resolve_template_path
from cryo_wiring_core.diagram import generate_diagram
from cryo_wiring_core.layout import CryoLayout
from cryo_wiring_core.loader import (
    default_components_path,
    expand_modules,
    load_components,
    load_yaml,
    resolve_templates_dir,
)
from cryo_wiring_core.models import WiringConfig
from cryo_wiring_core.builder import (
    make_control_lines,
    make_readout_send_lines,
    make_readout_return_lines,
    make_wiring_yaml,
)

from cryo_wiring_app.repo import DataRepo


# ── Response models (used by OpenAPI / Orval) ──────────────────────────────

class YearGroup(BaseModel):
    year: str
    cooldowns: list[str]


class CryoEntry(BaseModel):
    name: str
    years: list[YearGroup]


class ChipInfo(BaseModel):
    name: str
    num_qubits: int


class CooldownMeta(BaseModel):
    cooldown_id: str
    date: str
    cryo: str
    operator: str = ""
    purpose: str = ""
    notes: str = ""


class SummaryLine(BaseModel):
    line_id: str
    qubits: str
    total_atten: float
    total_gain: float
    stages: dict[str, list[str]]


class SummarySection(BaseModel):
    label: str
    lines: list[SummaryLine]


class CooldownDetail(BaseModel):
    metadata: CooldownMeta
    chip: ChipInfo | None = None
    summary: list[SummarySection]


class ComponentDetail(BaseModel):
    type: str
    manufacturer: str = ""
    model: str
    catalog_key: str | None = None
    serial: str = ""
    value_dB: float | None = None
    gain_dB: float | None = None
    filter_type: str | None = None
    amplifier_type: str | None = None


class LineDetail(BaseModel):
    line_id: str
    qubit: str | None = None
    qubits: list[str] | None = None
    stages: dict[str, list[ComponentDetail]]


class LinesResponse(BaseModel):
    control: list[LineDetail]
    readout_send: list[LineDetail]
    readout_return: list[LineDetail]


class SyncResult(BaseModel):
    committed: bool = False
    pushed: bool = False
    push_error: str = ""
    has_unpushed: bool = False


class StatusResponse(BaseModel):
    status: str
    sync: SyncResult | None = None


class CreateResponse(BaseModel):
    status: str
    path: str
    sync: SyncResult | None = None


class SyncInfo(BaseModel):
    has_git: bool
    has_remote: bool
    unpushed_commits: int
    branch: str


class RepoInfo(BaseModel):
    remote_url: str | None
    local_path: str
    has_git: bool
    ready: bool


class RepoSetupRequest(BaseModel):
    repo_url: str
    token: str = ""


class ModuleStage(BaseModel):
    name: str
    components: list[str]


class ModuleTemplate(BaseModel):
    name: str
    file: str
    line_type: str
    stages: list[ModuleStage]


class TemplatesInfo(BaseModel):
    source: str
    modules: list[ModuleTemplate]


# ── Request models ─────────────────────────────────────────────────────────

class NewCooldownRequest(BaseModel):
    cryo: str
    chip_name: str
    num_qubits: int
    cooldown_date: str | None = None
    operator: str = ""
    purpose: str = ""


class NewCooldownForCryoRequest(BaseModel):
    cooldown_id: str = ""
    cooldown_date: str | None = None
    operator: str = ""
    purpose: str = ""


class MetadataUpdate(BaseModel):
    operator: str | None = None
    purpose: str | None = None
    notes: str | None = None


class LineUpdate(BaseModel):
    stages: dict[str, list[str]]


class TemplateUpdate(BaseModel):
    stages: dict[str, list[str]]


class BulkLineUpdate(BaseModel):
    """Apply the same stage changes to multiple lines at once."""
    line_ids: list[str]
    stages: dict[str, list[str]]


# ── Helpers ────────────────────────────────────────────────────────────────

def _find_templates_dir(data_root: Path | None = None) -> Path:
    """Locate the templates directory.

    Resolution order:
    1. ``template_path`` from ``.cryo-wiring.yaml`` in the data repo.
    2. ``<data_root>/templates/`` if it exists.
    3. App-bundled templates.
    4. Core-bundled templates (fallback).
    """
    if data_root:
        tpath = resolve_template_path(search_from=data_root)
        if tpath is not None:
            return tpath
        repo_templates = data_root / "templates"
        if repo_templates.exists():
            return repo_templates
    app_templates = Path(__file__).resolve().parents[2] / "templates"
    if app_templates.exists():
        return app_templates
    return resolve_templates_dir()


def _get_components_path(data_root: Path) -> Path:
    """Return data repo's components.yaml if it exists, otherwise the bundled default."""
    repo_components = data_root / "components.yaml"
    if repo_components.exists():
        return repo_components
    return default_components_path()


def _load_bundle(cooldown_dir: Path) -> dict:
    """Load cooldown.yaml."""
    path = cooldown_dir / "cooldown.yaml"
    if not path.exists():
        raise HTTPException(404, "cooldown.yaml not found")
    return load_yaml(path)


def _configs_from_bundle(data: dict) -> tuple[WiringConfig, WiringConfig, WiringConfig]:
    """Parse WiringConfig objects from resolved cooldown data."""
    return (
        WiringConfig.from_raw(data["control"]),
        WiringConfig.from_raw(data["readout_send"]),
        WiringConfig.from_raw(data["readout_return"]),
    )


def _find_catalog_key(comp: dict, catalog: dict) -> str | None:
    for key, val in catalog.items():
        if val.get("model") == comp.get("model"):
            return key
    return None


def _line_from_bundle(line_data: dict, catalog: dict) -> LineDetail:
    """Convert a resolved line dict from cooldown.yaml to a LineDetail response."""
    stages: dict[str, list[ComponentDetail]] = {}
    for stage_name, comps in line_data.get("stages", {}).items():
        details = []
        for c in comps:
            details.append(ComponentDetail(
                type=c["type"],
                manufacturer=c.get("manufacturer", ""),
                model=c["model"],
                serial=c.get("serial", ""),
                catalog_key=_find_catalog_key(c, catalog),
                value_dB=c.get("value_dB"),
                gain_dB=c.get("gain_dB"),
                filter_type=c.get("filter_type"),
                amplifier_type=c.get("amplifier_type"),
            ))
        stages[stage_name] = details
    return LineDetail(
        line_id=line_data["line_id"],
        qubit=line_data.get("qubit"),
        qubits=line_data.get("qubits"),
        stages=stages,
    )


# ── App factory ────────────────────────────────────────────────────────────

def create_app(data_repo: DataRepo) -> FastAPI:
    app = FastAPI(title="cryo-wiring-app", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    try:
        templates_dir = _find_templates_dir(data_repo.local_path)
    except RuntimeError:
        templates_dir = Path(__file__).resolve().parents[2] / "templates"

    data_root = data_repo.local_path
    layout = CryoLayout(data_root)

    def _regenerate(cooldown_dir: Path) -> None:
        """Regenerate cooldown.yaml from source YAML files."""
        comp_path = _get_components_path(data_root)
        write_cooldown(cooldown_dir, components_path=comp_path)

    # --- Repo info ---

    @app.get("/api/repo", response_model=RepoInfo)
    def get_repo_info():
        return RepoInfo(
            remote_url=data_repo.remote_url,
            local_path=str(data_repo.local_path),
            has_git=data_repo._repo is not None,
            ready=data_repo.ready,
        )

    @app.post("/api/repo/setup", response_model=RepoInfo)
    def setup_repo(req: RepoSetupRequest):
        nonlocal data_root, templates_dir, layout
        clone_url = req.repo_url
        if req.token and clone_url.startswith("https://"):
            clone_url = clone_url.replace("https://", f"https://x-access-token:{req.token}@", 1)
        try:
            data_repo.clone_from_url(clone_url, display_url=req.repo_url)
        except Exception as e:
            raise HTTPException(400, f"Failed to clone repository: {e}")
        data_root = data_repo.local_path
        templates_dir = _find_templates_dir(data_root)
        layout = CryoLayout(data_root)
        return RepoInfo(
            remote_url=data_repo.remote_url,
            local_path=str(data_root),
            has_git=data_repo._repo is not None,
            ready=data_repo.ready,
        )

    @app.post("/api/repo/pull", response_model=StatusResponse)
    def pull_repo():
        data_repo.pull()
        return StatusResponse(status="ok")

    @app.get("/api/repo/sync", response_model=SyncInfo)
    def get_sync_info():
        info = data_repo.get_sync_info()
        return SyncInfo(**info)

    def _to_sync_result(sync_status) -> SyncResult:
        return SyncResult(
            committed=sync_status.committed,
            pushed=sync_status.pushed,
            push_error=sync_status.push_error,
            has_unpushed=sync_status.has_unpushed,
        )

    # --- Read API (all from cooldown.yaml) ---

    @app.get("/api/cryos", response_model=list[CryoEntry])
    def list_cryos():
        entries = layout.list_cryos()
        return [
            CryoEntry(
                name=e.name,
                years=[YearGroup(year=yg.year, cooldowns=yg.cooldowns) for yg in e.years],
            )
            for e in entries
        ]

    @app.get("/api/cryos/{cryo}/{year}/{cooldown}/bundle")
    def get_cooldown_bundle(cryo: str, year: str, cooldown: str):
        """Return the raw cooldown.yaml bundle as JSON."""
        cooldown_dir = layout.cooldown_path(cryo, year, cooldown)
        if not cooldown_dir.exists():
            raise HTTPException(404, "Cooldown not found")
        return _load_bundle(cooldown_dir)

    @app.get("/api/cryos/{cryo}/{year}/{cooldown}", response_model=CooldownDetail)
    def get_cooldown(cryo: str, year: str, cooldown: str):
        cooldown_dir = layout.cooldown_path(cryo, year, cooldown)
        if not cooldown_dir.exists():
            raise HTTPException(404, "Cooldown not found")
        bundle = _load_bundle(cooldown_dir)

        chip = None
        if bundle.get("chip"):
            c = bundle["chip"]
            chip = ChipInfo(name=c["name"], num_qubits=c["num_qubits"])

        summary_sections = []
        for section in bundle.get("summary", {}).get("sections", []):
            summary_sections.append(SummarySection(
                label=section["label"],
                lines=[
                    SummaryLine(
                        line_id=l["line_id"],
                        qubits=l["qubits"],
                        total_atten=l["total_atten"],
                        total_gain=l["total_gain"],
                        stages=l["stage_components"],
                    )
                    for l in section["lines"]
                ],
            ))

        return CooldownDetail(
            metadata=CooldownMeta(**bundle["metadata"]),
            chip=chip,
            summary=summary_sections,
        )

    @app.get("/api/cryos/{cryo}/{year}/{cooldown}/diagram", responses={200: {"content": {"image/svg+xml": {}}}})
    def get_diagram(cryo: str, year: str, cooldown: str):
        cooldown_dir = layout.cooldown_path(cryo, year, cooldown)
        if not cooldown_dir.exists():
            raise HTTPException(404)
        bundle = _load_bundle(cooldown_dir)
        control, readout_send, readout_return = _configs_from_bundle(bundle)
        with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as f:
            tmp = Path(f.name)
        try:
            generate_diagram(control, readout_send, readout_return, output=tmp, representative=True)
            svg = tmp.read_text()
        finally:
            tmp.unlink(missing_ok=True)
        return Response(content=svg, media_type="image/svg+xml")

    @app.get("/api/cryos/{cryo}/{year}/{cooldown}/diagram/full", responses={200: {"content": {"image/svg+xml": {}}}})
    def get_diagram_full(cryo: str, year: str, cooldown: str):
        cooldown_dir = layout.cooldown_path(cryo, year, cooldown)
        if not cooldown_dir.exists():
            raise HTTPException(404)
        bundle = _load_bundle(cooldown_dir)
        control, readout_send, readout_return = _configs_from_bundle(bundle)
        with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as f:
            tmp = Path(f.name)
        try:
            generate_diagram(control, readout_send, readout_return, output=tmp, representative=False)
            svg = tmp.read_text()
        finally:
            tmp.unlink(missing_ok=True)
        return Response(content=svg, media_type="image/svg+xml")

    # --- Component catalog ---

    def _load_catalog() -> dict:
        return load_components(_get_components_path(data_root))

    @app.get("/api/components")
    def get_components():
        return _load_catalog()

    # --- Templates ---

    _MODULE_FILES = [
        ("control_module.yaml", "control"),
        ("readout_send_module.yaml", "readout_send"),
        ("readout_return_module.yaml", "readout_return"),
    ]

    @app.get("/api/templates", response_model=TemplatesInfo)
    def get_templates():
        tdir = templates_dir
        if data_root and tdir.is_relative_to(data_root):
            source = "repository"
        elif "cryo_wiring_core" in str(tdir):
            source = "built-in"
        else:
            source = "app"

        modules: list[ModuleTemplate] = []
        for filename, line_type in _MODULE_FILES:
            tmpl_path = tdir / filename
            if not tmpl_path.exists():
                continue
            data = load_yaml(tmpl_path)
            mod_name = next(iter(data))
            mod_def = data[mod_name]
            stages = []
            for stage_name, comps in mod_def.get("stages", {}).items():
                stages.append(ModuleStage(
                    name=stage_name,
                    components=[c if isinstance(c, str) else c.get("model", "?") for c in (comps or [])],
                ))
            modules.append(ModuleTemplate(
                name=mod_name,
                file=filename,
                line_type=line_type,
                stages=stages,
            ))
        return TemplatesInfo(source=source, modules=modules)

    @app.put("/api/templates/{filename}", response_model=StatusResponse)
    def update_template(filename: str, req: TemplateUpdate):
        valid_files = {f for f, _ in _MODULE_FILES}
        if filename not in valid_files:
            raise HTTPException(400, f"Unknown template: {filename}")
        tmpl_path = templates_dir / filename
        if not tmpl_path.exists():
            raise HTTPException(404, f"Template not found: {filename}")
        data = load_yaml(tmpl_path)
        mod_name = next(iter(data))
        data[mod_name]["stages"] = req.stages
        tmpl_path.write_text(
            yaml.dump(data, default_flow_style=False, allow_unicode=True, sort_keys=False)
        )
        sync = data_repo.commit_and_push(
            f"Update template {filename}",
            paths=[tmpl_path],
        )
        return StatusResponse(status="ok", sync=_to_sync_result(sync))

    # --- Line detail & editing ---

    _FILE_TYPE_MAP = {"control": "control.yaml", "readout_send": "readout_send.yaml", "readout_return": "readout_return.yaml"}

    @app.get("/api/cryos/{cryo}/{year}/{cooldown}/lines", response_model=LinesResponse)
    def get_lines(cryo: str, year: str, cooldown: str):
        cooldown_dir = layout.cooldown_path(cryo, year, cooldown)
        if not cooldown_dir.exists():
            raise HTTPException(404)
        bundle = _load_bundle(cooldown_dir)
        catalog = _load_catalog()
        return LinesResponse(
            control=[_line_from_bundle(l, catalog) for l in bundle["control"]["lines"]],
            readout_send=[_line_from_bundle(l, catalog) for l in bundle["readout_send"]["lines"]],
            readout_return=[_line_from_bundle(l, catalog) for l in bundle["readout_return"]["lines"]],
        )

    @app.put("/api/cryos/{cryo}/{year}/{cooldown}/lines/{file_type}/{line_id}", response_model=StatusResponse)
    def update_line(cryo: str, year: str, cooldown: str, file_type: str, line_id: str, req: LineUpdate):
        if file_type not in _FILE_TYPE_MAP:
            raise HTTPException(400, f"Invalid file_type: {file_type}")
        cooldown_dir = layout.cooldown_path(cryo, year, cooldown)
        yaml_path = cooldown_dir / _FILE_TYPE_MAP[file_type]
        if not yaml_path.exists():
            raise HTTPException(404)
        catalog = _load_catalog()
        raw = load_yaml(yaml_path)
        expanded = expand_modules(raw, catalog)
        target = None
        for line in expanded["lines"]:
            if line["line_id"] == line_id:
                target = line
                break
        if target is None:
            raise HTTPException(404, f"Line {line_id} not found")
        new_stages: dict = {}
        for stage_name, comp_keys in req.stages.items():
            resolved = []
            for key in comp_keys:
                if key in catalog:
                    resolved.append(copy.deepcopy(catalog[key]))
                else:
                    raise HTTPException(400, f"Unknown component: {key}")
            new_stages[stage_name] = resolved
        target["stages"] = new_stages
        yaml_path.write_text(
            yaml.dump(expanded, default_flow_style=False, allow_unicode=True, sort_keys=False)
        )
        _regenerate(cooldown_dir)
        sync = data_repo.commit_and_push(
            f"Update {file_type}/{line_id} in {cryo}/{cooldown}",
            paths=[yaml_path, cooldown_dir / "cooldown.yaml"],
        )
        return StatusResponse(status="ok", sync=_to_sync_result(sync))

    @app.put("/api/cryos/{cryo}/{year}/{cooldown}/lines/{file_type}", response_model=StatusResponse)
    def bulk_update_lines(cryo: str, year: str, cooldown: str, file_type: str, req: BulkLineUpdate):
        """Apply the same stage configuration to multiple lines at once."""
        if file_type not in _FILE_TYPE_MAP:
            raise HTTPException(400, f"Invalid file_type: {file_type}")
        cooldown_dir = layout.cooldown_path(cryo, year, cooldown)
        yaml_path = cooldown_dir / _FILE_TYPE_MAP[file_type]
        if not yaml_path.exists():
            raise HTTPException(404)
        catalog = _load_catalog()
        raw = load_yaml(yaml_path)
        expanded = expand_modules(raw, catalog)

        new_stages: dict = {}
        for stage_name, comp_keys in req.stages.items():
            resolved = []
            for key in comp_keys:
                if key in catalog:
                    resolved.append(copy.deepcopy(catalog[key]))
                else:
                    raise HTTPException(400, f"Unknown component: {key}")
            new_stages[stage_name] = resolved

        updated = []
        for line in expanded["lines"]:
            if line["line_id"] in req.line_ids:
                line["stages"] = copy.deepcopy(new_stages)
                updated.append(line["line_id"])
        missing = set(req.line_ids) - set(updated)
        if missing:
            raise HTTPException(404, f"Lines not found: {', '.join(sorted(missing))}")

        yaml_path.write_text(
            yaml.dump(expanded, default_flow_style=False, allow_unicode=True, sort_keys=False)
        )
        _regenerate(cooldown_dir)
        sync = data_repo.commit_and_push(
            f"Bulk update {len(updated)} lines in {cryo}/{cooldown}/{file_type}",
            paths=[yaml_path, cooldown_dir / "cooldown.yaml"],
        )
        return StatusResponse(status="ok", sync=_to_sync_result(sync))

    # --- Create cooldown ---

    @app.post("/api/cooldowns/new", response_model=CreateResponse)
    def create_cooldown(req: NewCooldownRequest):
        cryo_dir = layout.cryo_path(req.cryo)
        if cryo_dir.exists():
            raise HTTPException(409, f"Cryo already exists: {req.cryo}")
        d = req.cooldown_date or date.today().isoformat()
        year = d[:4]
        cooldown_id = "cd001"
        target = layout.cooldown_path(req.cryo, year, cooldown_id)
        target.mkdir(parents=True)

        # chip.yaml in cooldown dir
        chip_data = {"name": req.chip_name, "num_qubits": req.num_qubits}
        (target / "chip.yaml").write_text(
            yaml.dump(chip_data, default_flow_style=False, allow_unicode=True, sort_keys=False)
        )

        # metadata
        meta_tmpl = (templates_dir / "metadata.yaml").read_text()
        meta_content = (
            meta_tmpl.replace("cdNNN", cooldown_id).replace("YYYY-MM-DD", d).replace("CRYO", req.cryo)
        )
        meta_data = yaml.safe_load(meta_content)
        if req.operator:
            meta_data["operator"] = req.operator
        if req.purpose:
            meta_data["purpose"] = req.purpose
        (target / "metadata.yaml").write_text(
            yaml.dump(meta_data, default_flow_style=False, allow_unicode=True, sort_keys=False)
        )

        # wiring templates
        n = req.num_qubits
        for tmpl_file, make_lines_fn in [
            ("control_module.yaml", lambda name: make_control_lines(n, name)),
            ("readout_send_module.yaml", lambda name: make_readout_send_lines(n, name)),
            ("readout_return_module.yaml", lambda name: make_readout_return_lines(n, name)),
        ]:
            mod_data = load_yaml(templates_dir / tmpl_file)
            mod_name = next(iter(mod_data))
            mod_def = mod_data[mod_name]
            lines = make_lines_fn(mod_name)
            out_name = tmpl_file.replace("_module", "").replace("_standard", "")
            out_data = make_wiring_yaml(mod_def, mod_name, lines)
            (target / out_name).write_text(
                yaml.dump(out_data, default_flow_style=False, allow_unicode=True, sort_keys=False)
            )
        _regenerate(target)
        sync = data_repo.commit_and_push(f"Create {req.cryo}/{year}/{cooldown_id}")
        return CreateResponse(status="ok", path=f"{req.cryo}/{year}/{cooldown_id}", sync=_to_sync_result(sync))

    # --- Add cooldown to existing cryo ---

    def _find_chip_in_cryo(cryo: str) -> dict | None:
        """Find chip.yaml in most recent cooldown of a cryo."""
        cryo_dir = layout.cryo_path(cryo)
        for yr in sorted(cryo_dir.iterdir(), reverse=True):
            if not yr.is_dir() or yr.name.startswith("."):
                continue
            for cd in sorted(yr.iterdir(), reverse=True):
                chip_path = cd / "chip.yaml"
                if cd.is_dir() and chip_path.exists():
                    return load_yaml(chip_path)
        return None

    @app.post("/api/cryos/{cryo}/cooldowns/new", response_model=CreateResponse)
    def add_cooldown(cryo: str, req: NewCooldownForCryoRequest):
        cryo_dir = layout.cryo_path(cryo)
        if not cryo_dir.exists():
            raise HTTPException(404, f"Cryo not found: {cryo}")

        d = req.cooldown_date or date.today().isoformat()
        year = d[:4]
        cooldown_id = req.cooldown_id or layout.next_cooldown_id(cryo, year)
        target = layout.cooldown_path(cryo, year, cooldown_id)
        if target.exists():
            raise HTTPException(409, f"Cooldown already exists: {cryo}/{year}/{cooldown_id}")

        # Read chip info from most recent cooldown
        chip_data = _find_chip_in_cryo(cryo)
        if chip_data is None:
            raise HTTPException(400, f"No chip.yaml found in {cryo}")
        n = chip_data["num_qubits"]

        target.mkdir(parents=True)

        # chip.yaml in cooldown dir
        (target / "chip.yaml").write_text(
            yaml.dump(chip_data, default_flow_style=False, allow_unicode=True, sort_keys=False)
        )

        # metadata
        meta_tmpl = (templates_dir / "metadata.yaml").read_text()
        meta_content = (
            meta_tmpl.replace("cdNNN", cooldown_id).replace("YYYY-MM-DD", d).replace("CRYO", cryo)
        )
        meta_data = yaml.safe_load(meta_content)
        if req.operator:
            meta_data["operator"] = req.operator
        if req.purpose:
            meta_data["purpose"] = req.purpose
        (target / "metadata.yaml").write_text(
            yaml.dump(meta_data, default_flow_style=False, allow_unicode=True, sort_keys=False)
        )

        # wiring templates
        for tmpl_file, make_lines_fn in [
            ("control_module.yaml", lambda name: make_control_lines(n, name)),
            ("readout_send_module.yaml", lambda name: make_readout_send_lines(n, name)),
            ("readout_return_module.yaml", lambda name: make_readout_return_lines(n, name)),
        ]:
            mod_data = load_yaml(templates_dir / tmpl_file)
            mod_name = next(iter(mod_data))
            mod_def = mod_data[mod_name]
            lines = make_lines_fn(mod_name)
            out_name = tmpl_file.replace("_module", "").replace("_standard", "")
            out_data = make_wiring_yaml(mod_def, mod_name, lines)
            (target / out_name).write_text(
                yaml.dump(out_data, default_flow_style=False, allow_unicode=True, sort_keys=False)
            )
        _regenerate(target)
        sync = data_repo.commit_and_push(f"Add {cryo}/{year}/{cooldown_id}")
        return CreateResponse(status="ok", path=f"{cryo}/{year}/{cooldown_id}", sync=_to_sync_result(sync))

    # --- Edit metadata ---

    @app.patch("/api/cryos/{cryo}/{year}/{cooldown}/metadata", response_model=StatusResponse)
    def update_metadata(cryo: str, year: str, cooldown: str, req: MetadataUpdate):
        cooldown_dir = layout.cooldown_path(cryo, year, cooldown)
        meta_path = cooldown_dir / "metadata.yaml"
        if not meta_path.exists():
            raise HTTPException(404)
        data = load_yaml(meta_path)
        if req.operator is not None:
            data["operator"] = req.operator
        if req.purpose is not None:
            data["purpose"] = req.purpose
        if req.notes is not None:
            data["notes"] = req.notes
        meta_path.write_text(
            yaml.dump(data, default_flow_style=False, allow_unicode=True, sort_keys=False)
        )
        _regenerate(cooldown_dir)
        sync = data_repo.commit_and_push(
            f"Update metadata for {cryo}/{cooldown}",
            paths=[meta_path, cooldown_dir / "cooldown.yaml"],
        )
        return StatusResponse(status="ok", sync=_to_sync_result(sync))

    return app
