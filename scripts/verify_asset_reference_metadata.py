from __future__ import annotations

import csv
import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
META = ROOT / "asset_reference_pack" / "00_manifest"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def rows(name: str) -> list[dict[str, str]]:
    with (META / name).open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def scalar(value: str) -> str | None:
    value = value.strip().strip('"')
    return None if value in {"null", "~", ""} else value


def read_approval_record() -> dict:
    result: dict = {"immutable_sources": [], "approval_renders": []}
    section: str | None = None
    current: dict | None = None
    for raw_line in (META / "approval_record.yaml").read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == "immutable_sources:":
            section = "immutable_sources"
            current = None
        elif stripped == "approval_renders:":
            section = "approval_renders"
            current = None
        elif stripped.endswith(":") and not stripped.startswith("-"):
            section = None
            current = None
        elif stripped.startswith("- path:") and section:
            current = {"path": scalar(stripped.split(":", 1)[1])}
            result[section].append(current)
        elif stripped.startswith("sha256:") and current is not None:
            current["sha256"] = scalar(stripped.split(":", 1)[1])
        elif section is None and ":" in stripped:
            key, value = stripped.split(":", 1)
            result[key] = scalar(value)
    return result


assets = rows("manifest.csv")
renders = rows("render_manifest.csv")
cameras = rows("camera_matrix.csv")
placements = rows("placement_instances.csv")
dimensions = rows("production_dimensions.csv")
audit = rows("scene_object_audit.csv")
approval = read_approval_record()

asset_ids = {row["asset_id"] for row in assets}
require(len(assets) == len(asset_ids) == 27, "Expected 27 unique asset families")
require({row["asset_id"] for row in dimensions} == asset_ids, "Production dimensions do not match asset manifest")

active = [row for row in renders if row["active"].lower() == "true"]
inactive = [row for row in renders if row["active"].lower() != "true"]
require(len(active) == 226, f"Expected 226 active outputs, found {len(active)}")
require(len({row["output_relpath"] for row in active}) == 226, "Duplicate active output paths")
require(len({row["shot_id"] for row in active}) == 226, "Duplicate active shot IDs")
require(all(row["output_relpath"].startswith("archive/") for row in inactive), "Inactive outputs must live under archive/")
require(sum(row["shot_group"] == "context" for row in active) == 24, "Context count mismatch")
require(sum(row["shot_group"] == "hero_frame" for row in active) == 43, "Hero-frame count mismatch")
require(sum(row["shot_group"] == "isolated_asset" for row in active) == 150, "Isolated-asset count mismatch")
require(sum(row["shot_group"] == "scale_reference" for row in active) == 9, "Scale-reference count mismatch")

require(len(cameras) == 24, "Expected 24 context cameras")
context_camera_names = {row["camera_name"] for row in cameras}
require(
    {row["camera_rig"] for row in active if row["shot_group"] == "context"} == context_camera_names,
    "Render manifest context cameras do not match camera matrix",
)

require(len(placements) == 34, "Expected 34 placement instances")
require(all(row["asset_id"] in asset_ids for row in placements), "Placement references an unknown asset")
require({row["asset_id"] for row in placements} == asset_ids, "Every asset needs at least one placement")

audit_names = {row["object_name"] for row in audit}
modular_names = {row["object_name"] for row in audit if row["source_role"] == "modular_asset"}
require(len(audit) == len(audit_names) == 211, "Scene object audit must contain 211 unique objects")
require(
    not {row["source_role"] for row in audit} - {
        "modular_asset", "authoritative_architecture", "lighting", "helper_camera"
    },
    "Scene object audit contains an unclassified role",
)

manifest_names: dict[str, set[str]] = {}
for row in assets:
    manifest_names[row["asset_id"]] = {
        name.strip() for name in row["blender_object_names"].split(";") if name.strip()
    }

covered: set[str] = set()
for row in placements:
    selector = row["source_selector"]
    if selector.startswith("manifest_objects:"):
        covered |= manifest_names[selector.split(":", 1)[1]]
    elif selector.startswith("name_startswith:"):
        prefix = selector.split(":", 1)[1]
        covered |= {name for name in audit_names if name.startswith(prefix)}
    elif selector.startswith("object:"):
        covered.add(selector.split(":", 1)[1])
    elif selector.startswith("objects:"):
        covered |= {name.strip() for name in selector.split(":", 1)[1].split(";") if name.strip()}
    else:
        raise RuntimeError(f"Unknown placement selector: {selector}")
require(
    covered == modular_names,
    f"Modular coverage mismatch; missing={sorted(modular_names-covered)}, extra={sorted(covered-modular_names)}",
)

recorded_files = approval["immutable_sources"] + approval["approval_renders"]
require(len(recorded_files) == 5, "Approval record must bind three scenes and two renders")
recorded_hashes: dict[str, str] = {}
for item in recorded_files:
    path = (META / item["path"]).resolve()
    expected = str(item["sha256"]).upper()
    require(path.is_file(), f"Approval-bound file missing: {path}")
    require(sha256(path) == expected, f"Approval-bound hash changed: {path.name}")
    recorded_hashes[path.name] = expected

authority_hash = recorded_hashes["framers_gallery_ribbon_v02_1_entry_lookdev.blend"]
require(
    all(row["authority_source_sha256"] == authority_hash for row in active),
    "Active render rows are not bound to the approved authority source",
)

gate = approval.get("gate_status")
require(approval.get("preserve_set_source") == "scene_object_audit.csv", "Approval record must bind the preserve set to scene_object_audit.csv")
require(approval.get("preserve_in_blender_objects_locked_and_compared") == "true", "Approval record must lock and compare every preserve-in-Blender object")
child_statuses = {
    "assets": {row["status"] for row in assets},
    "renders": {row["status"] for row in active},
    "cameras": {row["status"] for row in cameras},
    "placements": {row["status"] for row in placements},
}
if gate == "APPROVED_FOR_REFERENCE_RENDERING":
    require(approval.get("approved_by") is not None, "Approved gate requires approved_by")
    require(approval.get("approved_at_iso8601") is not None, "Approved gate requires approved_at_iso8601")
    pending_reference = all(statuses == {"approved_pending_reference_scene"} for statuses in child_statuses.values())
    ready_to_render = all(statuses == {"ready_to_render"} for statuses in child_statuses.values())
    require(pending_reference or ready_to_render, "Approved gate has blocked or mixed child metadata")
    if pending_reference:
        require(all(not row["render_scene_revision"] and not row["render_scene_sha256"] for row in active), "Pending-reference rows cannot claim render-scene provenance")
    else:
        revisions = {row["render_scene_revision"] for row in active}
        render_hashes = {row["render_scene_sha256"].upper() for row in active}
        require(len(revisions) == 1 and "" not in revisions, "Ready rows require one reference-scene revision")
        require(len(render_hashes) == 1 and "" not in render_hashes, "Ready rows require one reference-scene hash")
        render_hash = next(iter(render_hashes))
        require(len(render_hash) == 64 and all(character in "0123456789ABCDEF" for character in render_hash), "Invalid reference-scene SHA-256")
        reference_path = ROOT / f"{next(iter(revisions))}.blend"
        require(reference_path.is_file(), f"Reference scene missing: {reference_path}")
        require(sha256(reference_path) == render_hash, "Reference-scene provenance hash mismatch")
    require("APPROVED_FOR_REFERENCE_RENDERING" in (ROOT / "asset_reference_pack" / "README.md").read_text(encoding="utf-8"), "README gate status drift")
elif gate == "BLOCKED_PENDING_V02_1_APPROVAL":
    require(approval.get("approved_by") is None and approval.get("approved_at_iso8601") is None, "Pending gate cannot name an approver or time")
    require(all(not ({"ready_to_render", "approved_pending_reference_scene"} & statuses) for statuses in child_statuses.values()), "Pending gate has prematurely approved child metadata")
    require(all(not row["render_scene_revision"] and not row["render_scene_sha256"] for row in active), "Pending gate cannot claim render-scene provenance")
else:
    raise RuntimeError(f"Unknown gate status: {gate}")

print(
    f"Asset reference metadata verified ({gate}): 226 active outputs, 27 assets, "
    "34 placements, 24 context cameras, 211 classified scene objects, immutable hashes intact."
)
