"""Send a Python script to Blender's official MCP socket bridge."""

from __future__ import annotations

import argparse
import json
import socket
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("script", type=Path)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9876)
    parser.add_argument("--timeout", type=float, default=120.0)
    args = parser.parse_args()

    payload = {
        "type": "execute",
        "code": args.script.read_text(encoding="utf-8"),
        "strict_json": True,
    }

    with socket.create_connection((args.host, args.port), timeout=args.timeout) as client:
        client.settimeout(args.timeout)
        client.sendall(json.dumps(payload).encode("utf-8") + b"\0")
        response = bytearray()
        while b"\0" not in response:
            chunk = client.recv(64 * 1024)
            if not chunk:
                raise RuntimeError("Blender MCP closed the connection before responding")
            response.extend(chunk)

    parsed = json.loads(response[: response.index(b"\0")])
    print(json.dumps(parsed, indent=2))
    if parsed.get("status") != "ok":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
