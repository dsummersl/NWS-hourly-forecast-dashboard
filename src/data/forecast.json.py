#!/usr/bin/env python3
"""
Data loader: NWS/NDFD hourly point forecast -> forecast.json on stdout.

Location comes from NWS_LAT / NWS_LON (defaults: 36.01, -79.227 — the point the
forecast.weather.gov graphical page in the README was built for).

Note: Observable Framework caches loader output under src/.observablehq/cache. After
changing NWS_LAT/NWS_LON, run `npm run clean` so the loader re-runs.
"""

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent.parent / "scripts"  # src/data -> src -> root -> scripts
sys.path.insert(0, str(SCRIPTS))

from nws import build  # noqa: E402

LAT = float(os.environ.get("NWS_LAT", 36.01))
LON = float(os.environ.get("NWS_LON", -79.227))
HOURS = int(os.environ.get("NWS_HOURS", 168))


def main() -> None:
    data = build(LAT, LON, HOURS)
    temps = data["series"].get("temperature") or []
    if not any(v is not None for v in temps):
        raise RuntimeError(f"NWS returned no temperature grid for {LAT},{LON}")
    json.dump(data, sys.stdout)


if __name__ == "__main__":
    main()
