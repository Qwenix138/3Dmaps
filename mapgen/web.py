from __future__ import annotations

import argparse
import os
import re
import sys
import threading
import time
import traceback
import uuid
import webbrowser
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, abort, jsonify, render_template, request, send_from_directory, url_for

from . import __version__
from .config import BBox, GenerationOptions
from .errors import MapgenError
from .pipeline import generate

ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = Path.home() / "3Dmaps" if getattr(sys, "frozen", False) else ROOT
OUTPUT_ROOT = Path(os.environ.get("MAPGEN_OUTPUT", DATA_ROOT / "output")).resolve()
CACHE_ROOT = Path(os.environ.get("MAPGEN_CACHE", DATA_ROOT / "cache")).resolve()

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
jobs: dict[str, "Job"] = {}
jobs_lock = threading.Lock()


@dataclass
class Job:
    id: str
    status: str = "queued"
    progress: float = 0.0
    message: str = "В очереди"
    error: str | None = None
    result: dict[str, Any] | None = None
    out_dir: Path | None = None
    options: GenerationOptions | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    finished_at: str | None = None


def _slug(value: str) -> str:
    value = re.sub(r"[^\w.-]+", "-", value.strip(), flags=re.UNICODE).strip("-._")
    return value[:80] or "zone"


def _job_dir(name: str) -> Path:
    stamp = time.strftime("%Y%m%d-%H%M%S")
    path = OUTPUT_ROOT / f"{stamp}-{uuid.uuid4().hex[:6]}-{_slug(name)}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _run_job(job: Job) -> None:
    assert job.options is not None
    job.status = "running"

    def progress(value: float, message: str) -> None:
        job.progress = max(0.0, min(1.0, value))
        job.message = message

    try:
        result = generate(job.options, progress=progress)
        job.result = result
        job.out_dir = Path(result["out_dir"])
        job.status = "done"
        job.progress = 1.0
        job.message = "Готово"
    except Exception as exc:
        job.status = "error"
        job.error = str(exc)
        job.message = "Ошибка"
        traceback.print_exc()
    finally:
        job.finished_at = datetime.now(timezone.utc).isoformat()


def _url_for_file(job: Job, path: Path) -> str:
    return url_for("download_file", job_id=job.id, filename=path.name)


def _serialize_job(job: Job) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": job.id,
        "status": job.status,
        "progress": round(job.progress, 4),
        "message": job.message,
        "error": job.error,
        "created_at": job.created_at,
        "finished_at": job.finished_at,
    }
    if job.status == "done" and job.out_dir is not None:
        files = []
        for path in sorted(job.out_dir.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(job.out_dir)
            files.append(
                {
                    "name": relative.as_posix(),
                    "url": url_for(
                        "download_file",
                        job_id=job.id,
                        filename=relative.as_posix(),
                    ),
                    "size": path.stat().st_size,
                }
            )
        payload["files"] = files
        payload["view_url"] = url_for("viewer", job_id=job.id)
        payload["obj_url"] = _url_for_file(job, job.out_dir / f"{job.options.name}.obj") if job.options else None
        payload["glb_url"] = _url_for_file(job, job.out_dir / f"{job.options.name}.glb") if job.options else None
        payload["meta_url"] = _url_for_file(job, job.out_dir / "meta.json")
        payload["meta"] = job.result.get("meta") if job.result else None
    return payload


@app.get("/")
def index():
    return render_template("index.html", version=__version__)


@app.get("/health")
def health():
    return jsonify({"ok": True, "version": __version__})


@app.post("/api/generate")
def api_generate():
    payload = request.get_json(silent=True) or {}
    try:
        bbox_values = payload.get("bbox")
        if not isinstance(bbox_values, (list, tuple)) or len(bbox_values) != 4:
            raise MapgenError("Не передана зона bbox")
        bbox = BBox(*(float(v) for v in bbox_values))
        bbox.validate()
        name = _slug(str(payload.get("name") or "zone"))
        options = GenerationOptions(
            bbox=bbox,
            out_dir=Path("/tmp"),
            name=name,
            terrain_spacing=float(payload.get("terrain_spacing", 30)),
            terrain_height_scale=float(payload.get("height_scale", 1.0)),
            terrain_smoothing=int(payload.get("smoothing", 0)),
            texture_size=int(payload.get("texture_size", 4096)),
            buildings=bool(payload.get("buildings", True)),
            roads=bool(payload.get("roads", True)),
            railways=bool(payload.get("railways", True)),
            labels=bool(payload.get("labels", True)),
            satellite=bool(payload.get("satellite", True)),
            satellite_source=str(payload.get("satellite_source", "eox")),
            satellite_layer=str(payload.get("satellite_layer", "s2cloudless-2025_3857")),
            simplify_m=float(payload.get("simplify", 0.35)),
            osm_source=str(payload.get("osm_source", "auto")),
            cache_dir=CACHE_ROOT,
        )
        options.out_dir = _job_dir(name)
        options.validate()
        job = Job(id=uuid.uuid4().hex[:12], options=options, out_dir=options.out_dir)
        with jobs_lock:
            jobs[job.id] = job
        thread = threading.Thread(target=_run_job, args=(job,), daemon=True)
        thread.start()
        return jsonify({"job_id": job.id, "status": job.status}), 202
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.get("/api/jobs/<job_id>")
def api_job(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        abort(404)
    return jsonify(_serialize_job(job))


@app.get("/files/<job_id>/<path:filename>")
def download_file(job_id: str, filename: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None or job.out_dir is None:
        abort(404)
    target = (job.out_dir / filename).resolve()
    try:
        target.relative_to(job.out_dir.resolve())
    except ValueError:
        abort(404)
    if not target.is_file():
        abort(404)
    return send_from_directory(job.out_dir, filename, as_attachment=False)


@app.get("/view/<job_id>")
def viewer(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        abort(404)
    if job.status != "done" or job.out_dir is None:
        return render_template("viewer.html", glb_url=None, job=job, version=__version__)
    glb = job.out_dir / f"{job.options.name}.glb"
    if not glb.exists():
        abort(404)
    return render_template(
        "viewer.html",
        glb_url=url_for("download_file", job_id=job.id, filename=glb.name),
        job=job,
        version=__version__,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Локальный веб-интерфейс 3Dmaps")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--open", action="store_true")
    args = parser.parse_args(argv)
    if args.open:
        threading.Timer(1.0, lambda: webbrowser.open(f"http://127.0.0.1:{args.port}")).start()
    print(f"3Dmaps UI: http://127.0.0.1:{args.port}")
    app.run(host=args.host, port=args.port, debug=False, threaded=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
