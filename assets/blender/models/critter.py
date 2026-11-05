"""Fizz, the electric critter (U4 of the walking character plan): an original, round yellow-and-cream puffball about
0.6 m tall, with a cream face and belly, small round ears, two antenna stalks ending in glowing cyan bulbs, stubby
arms and feet, and a fluffy round tail with a glowing tip. No pointed ears, cheek patches or zigzag tail: it is
not a look-alike of any existing character.

Runtime contract:
- `critter` stands on the origin and faces local -Z.
- Joints the runtime turns about local X: `critter_foot_l` / `critter_foot_r` (at each hip), `critter_arm_l` /
  `critter_arm_r` (at each shoulder) and `critter_tail` (at its root, swung about local Y as a wag).
- Material `critter_glow` glows (brighter at night); the rest are plain `critter_*` colors for the toon look.
"""

from lib import kit
from models.landmarks import _bake, _hang, _joint


def build(layout):
    fur = kit.mat("critter_fur", "#f2c443", roughness=0.7)
    cream = kit.mat("critter_cream", "#fbefd2", roughness=0.75)
    eye = kit.mat("critter_eye", "#1a1411", roughness=0.3)
    shine = kit.mat("critter_shine", "#ffffff", roughness=0.2)
    nose = kit.mat("critter_nose", "#6b4a2f", roughness=0.5)
    glow = kit.mat("critter_glow", "#7fe9ff", roughness=0.3, emission="#5fe3ff", strength=1.0)

    root = kit.group("critter")

    body = [
        kit.sphere("body", 0.25, 0, 0.3, 0, fur, segments=28, rings=18, scale=(1, 1.08, 0.95)),
        kit.sphere("belly", 0.17, 0, 0.24, -0.1, cream, segments=20, rings=12, scale=(1, 1.05, 0.6)),
        kit.sphere("face", 0.15, 0, 0.36, -0.13, cream, segments=20, rings=12, scale=(1.25, 0.8, 0.55)),
        kit.sphere("nose", 0.022, 0, 0.37, -0.215, nose, segments=10, rings=6, scale=(1.3, 0.8, 0.8)),
    ]
    for side in (-1, 1):
        x = side * 0.085
        body += [
            kit.sphere(f"eye{side}", 0.045, x, 0.43, -0.2, eye, segments=14, rings=10, scale=(0.85, 1.2, 0.5)),
            kit.sphere(f"shine{side}", 0.014, x + 0.012, 0.45, -0.222, shine, segments=8, rings=6),
            # Small round ears, set wide.
            kit.sphere(f"ear{side}", 0.075, side * 0.17, 0.56, 0.02, fur, segments=14, rings=10, scale=(1, 1, 0.5)),
            kit.sphere(f"ear_in{side}", 0.045, side * 0.17, 0.56, -0.012, cream, segments=12, rings=8, scale=(1, 1, 0.3)),
            # Antenna stalks leaning out, each ending in a glowing bulb.
            kit.cylinder(f"stalk{side}", 0.012, 0.17, side * 0.06, 0.56, -0.02, nose, vertices=8),
            kit.sphere(f"bulb{side}", 0.04, side * 0.06, 0.75, -0.02, glow, segments=12, rings=8),
        ]
    _hang(_bake(body, "critter_body"), root)

    for side, tag in ((-1, "l"), (1, "r")):
        hip = (side * 0.11, 0.12, 0.0)
        foot = [kit.sphere(f"foot{side}", 0.07, side * 0.11, 0.04, -0.03, cream, segments=14, rings=10, scale=(1, 0.65, 1.3))]
        _hang(_bake(foot, f"critter_foot_{tag}_mesh"), _joint(f"critter_foot_{tag}", root, hip), hip)

        shoulder = (side * 0.21, 0.32, -0.04)
        arm = [kit.sphere(f"arm{side}", 0.05, side * 0.24, 0.26, -0.05, fur, segments=12, rings=8, scale=(0.8, 1.2, 0.8))]
        _hang(_bake(arm, f"critter_arm_{tag}_mesh"), _joint(f"critter_arm_{tag}", root, shoulder), shoulder)

    tail_root = (0.0, 0.2, 0.22)
    tail = [
        kit.sphere("tail", 0.1, 0, 0.27, 0.32, cream, segments=16, rings=10),
        kit.sphere("tail_tip", 0.045, 0, 0.35, 0.38, glow, segments=12, rings=8),
    ]
    _hang(_bake(tail, "critter_tail_mesh"), _joint("critter_tail", root, tail_root), tail_root)
