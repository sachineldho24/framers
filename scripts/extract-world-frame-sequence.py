#!/usr/bin/env python3
"""Extract the Framers Lab /world scroll-scrub frame sequence from the approved master.

The cinematic /world route scrubs a canvas image sequence (not MP4 currentTime), so
this script samples the approved master video into two tiers of WebP frames plus a
manifest the renderer reads.

Source of truth
---------------
- Master: public/world/vid/framers-v2.mp4 (1920x1080, 30 fps, 1687 frames, 56.2333 s).
- Sample at 15 fps -> take every 2nd source frame (indices 0, 2, 4, ...), which
  preserves both the first and the last source frame and yields exactly 844 frames.
- Desktop tier: 1920x1080 WebP, quality ~90 (visually lossless).
- Mobile tier:   960x540  WebP, quality ~86.
- Output: public/world/frames/{desktop,mobile}/frame-0000.webp ... frame-0843.webp
          public/world/frames/manifest.json

Design
------
- Idempotent: a frame already on disk with a non-zero size is skipped, so a crash or a
  re-run never repays for finished work. Pass --force to rebuild.
- Never writes to, moves, or deletes the source master.
- Reports total and average compressed size per tier at the end.

Usage
-----
    python scripts/extract-world-frame-sequence.py
    python scripts/extract-world-frame-sequence.py --force
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import cv2
except ImportError:  # pragma: no cover - environment guard
    sys.exit("OpenCV (cv2) is required: pip install opencv-python")


# --- Fixed contract (mirrors src/components/scroll-world/content.ts) ---------------
REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "public" / "world" / "vid" / "framers-v2.mp4"
FRAMES_ROOT = REPO_ROOT / "public" / "world" / "frames"

TARGET_FPS = 15
EXPECTED_FRAME_COUNT = 844
FILENAME_PATTERN = "frame-####.webp"

TIERS = {
    "desktop": {"width": 1920, "height": 1080, "quality": 90},
    "mobile": {"width": 960, "height": 540, "quality": 86},
}


def frame_name(index: int) -> str:
    return FILENAME_PATTERN.replace("####", f"{index:04d}")


def sampled_source_indices(source_frame_count: int, source_fps: float) -> list[int]:
    """Source frame indices to keep, sampled down to TARGET_FPS.

    step = round(source_fps / TARGET_FPS). For the approved 30 fps master that is 2, so
    we keep frames 0, 2, 4, ... The last source frame is force-included so the sequence
    ends exactly on the master's final frame (no truncated tail).
    """
    step = max(1, round(source_fps / TARGET_FPS))
    indices = list(range(0, source_frame_count, step))
    last = source_frame_count - 1
    if indices and indices[-1] != last:
        indices.append(last)
    return indices


def write_frame(path: Path, image, width: int, height: int, quality: int) -> int:
    """Resize (if needed) and encode one frame as WebP. Returns bytes written."""
    h, w = image.shape[:2]
    if (w, h) != (width, height):
        # INTER_AREA is the correct filter for downscaling (mobile tier).
        interp = cv2.INTER_AREA if width < w else cv2.INTER_LANCZOS4
        image = cv2.resize(image, (width, height), interpolation=interp)

    ok, buffer = cv2.imencode(
        ".webp", image, [int(cv2.IMWRITE_WEBP_QUALITY), quality]
    )
    if not ok:
        raise RuntimeError(f"failed to encode {path}")
    path.write_bytes(buffer.tobytes())
    return buffer.size


def extract(force: bool) -> None:
    if not SOURCE.exists():
        sys.exit(f"source master not found: {SOURCE}")

    capture = cv2.VideoCapture(str(SOURCE))
    if not capture.isOpened():
        sys.exit(f"could not open source master: {SOURCE}")

    source_fps = capture.get(cv2.CAP_PROP_FPS)
    source_frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    keep = sampled_source_indices(source_frame_count, source_fps)

    print(
        f"Source: {SOURCE.name}  {source_frame_count} frames @ {source_fps:g} fps\n"
        f"Sampling to {TARGET_FPS} fps -> {len(keep)} frames per tier "
        f"(expected {EXPECTED_FRAME_COUNT})"
    )
    if len(keep) != EXPECTED_FRAME_COUNT:
        print(
            f"  WARNING: sampled {len(keep)} frames, contract expects "
            f"{EXPECTED_FRAME_COUNT}. Check source properties.",
            file=sys.stderr,
        )

    for tier in TIERS:
        (FRAMES_ROOT / tier).mkdir(parents=True, exist_ok=True)

    tier_bytes = {tier: 0 for tier in TIERS}
    tier_written = {tier: 0 for tier in TIERS}
    tier_skipped = {tier: 0 for tier in TIERS}

    for out_index, source_index in enumerate(keep):
        # Only decode a source frame if at least one tier still needs it.
        targets = []
        for tier, spec in TIERS.items():
            path = FRAMES_ROOT / tier / frame_name(out_index)
            if not force and path.exists() and path.stat().st_size > 0:
                tier_skipped[tier] += 1
                tier_bytes[tier] += path.stat().st_size
            else:
                targets.append((tier, spec, path))

        if not targets:
            continue

        capture.set(cv2.CAP_PROP_POS_FRAMES, source_index)
        ok, image = capture.read()
        if not ok or image is None:
            print(
                f"  WARNING: could not read source frame {source_index} "
                f"(output {out_index}); skipping",
                file=sys.stderr,
            )
            continue

        for tier, spec, path in targets:
            written = write_frame(
                path, image, spec["width"], spec["height"], spec["quality"]
            )
            tier_bytes[tier] += written
            tier_written[tier] += 1

        if out_index % 100 == 0:
            print(f"  ... frame {out_index}/{len(keep) - 1}")

    capture.release()

    manifest = {
        "source": SOURCE.name,
        "sourceFrameCount": source_frame_count,
        "sourceFps": round(source_fps, 6),
        "fps": TARGET_FPS,
        "frameCount": len(keep),
        "duration": round(source_frame_count / source_fps, 6) if source_fps else None,
        "pattern": FILENAME_PATTERN,
        "tiers": {
            tier: {
                "width": spec["width"],
                "height": spec["height"],
                "quality": spec["quality"],
            }
            for tier, spec in TIERS.items()
        },
    }
    manifest_path = FRAMES_ROOT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print("\nDone.")
    for tier in TIERS:
        total = tier_bytes[tier]
        count = tier_written[tier] + tier_skipped[tier]
        avg = total / count if count else 0
        print(
            f"  {tier:8s}: {count} frames  "
            f"({tier_written[tier]} written, {tier_skipped[tier]} skipped)  "
            f"total {total / 1_048_576:.1f} MiB  avg {avg / 1024:.1f} KiB/frame"
        )
    print(f"  manifest: {manifest_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="re-encode every frame even if it already exists on disk",
    )
    extract(parser.parse_args().force)
