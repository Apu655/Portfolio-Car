"""Build every Career District model into raw .glb files.

    blender --background --python assets/blender/build_all.py -- <layout.json> <out_dir> [model ...]

Each model module exposes build(layout) and is rebuilt in a fresh empty scene. Optimization (meshopt) and the
size budget run afterwards in scripts/build-assets.mjs.
"""

import importlib
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import kit  # noqa: E402

MODELS = ["car", "career_tower", "district", "props", "kiosks", "billboard", "buildings"]


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) < 2:
        raise SystemExit("usage: build_all.py -- <layout.json> <out_dir> [model ...]")
    layout_path, out_dir, *only = argv
    with open(layout_path) as f:
        layout = json.load(f)
    os.makedirs(out_dir, exist_ok=True)
    names = only or MODELS
    for name in names:
        started = time.time()
        kit.reset()
        module = importlib.import_module(f"models.{name}")
        module.build(layout)
        out = os.path.join(out_dir, f"{name}.glb")
        kit.export(out)
        print(f"[assets] {name:14s} {os.path.getsize(out) / 1024:8.1f} KB raw  ({time.time() - started:.1f}s)")


main()
