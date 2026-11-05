"""Cogs, the gadget cat (U4 of the walking character plan): an original slate-grey chibi cat about 0.8 m tall,
standing on two legs, with a cream muzzle and belly, tall pointed ears, brass goggles pushed up on its forehead and
a mustard backpack. A little gadget, a glowing bulb on a stalk, pops up out of the backpack when it shows off. No
collar, bell or pouch, and not blue: it is not a look-alike of any existing character.

Runtime contract:
- `cat` stands on the origin and faces local -Z.
- Joints the runtime turns about local X: `cat_head` (at the neck), `cat_arm_l` / `cat_arm_r` (at each
  shoulder), `cat_leg_l` / `cat_leg_r` (at each hip) and `cat_tail` (at its root, swung about local Y).
- `cat_gadget` sits inside the backpack; the runtime raises it along local Y (0 to 0.4 m) when it shows off.
- Material `cat_gadget_glow` glows (brighter at night); the rest are plain `cat_*` colors for the toon look.
"""

import math

from lib import kit
from models.landmarks import _bake, _hang, _joint

NECK_Y = 0.42


def build(layout):
    fur = kit.mat("cat_fur", "#6f7783", roughness=0.75)
    cream = kit.mat("cat_cream", "#f3e8d4", roughness=0.75)
    pink = kit.mat("cat_pink", "#e7a3a0", roughness=0.6)
    eye = kit.mat("cat_eye", "#1a1411", roughness=0.3)
    shine = kit.mat("cat_shine", "#ffffff", roughness=0.2)
    brass = kit.mat("cat_brass", "#c39545", roughness=0.35, metallic=0.6)
    lens = kit.mat("cat_lens", "#4fb8b0", roughness=0.15)
    pack = kit.mat("cat_pack", "#d9a23a", roughness=0.65)
    strap = kit.mat("cat_strap", "#5a3d26", roughness=0.7)
    glow = kit.mat("cat_gadget_glow", "#c6ff8a", roughness=0.3, emission="#9dff5c", strength=1.0)

    root = kit.group("cat")

    body = [
        kit.sphere("torso", 0.16, 0, 0.3, 0, fur, segments=22, rings=14, scale=(1, 1.15, 0.9)),
        kit.sphere("chest", 0.11, 0, 0.29, -0.08, cream, segments=16, rings=10, scale=(1, 1.2, 0.6)),
        kit.box("pack", 0.24, 0.24, 0.12, 0, 0.2, 0.17, pack, bevel=0.04),
        kit.box("pack_flap", 0.25, 0.06, 0.13, 0, 0.4, 0.17, strap, bevel=0.02),
    ]
    for side in (-1, 1):
        body.append(kit.box(f"strap{side}", 0.035, 0.26, 0.3, side * 0.09, 0.18, 0.02, strap, bevel=0.01))
    _hang(_bake(body, "cat_body"), root)

    neck = (0.0, NECK_Y, 0.0)
    head = [
        kit.sphere("head", 0.22, 0, 0.6, 0, fur, segments=26, rings=16, scale=(1.12, 0.95, 0.95)),
        kit.sphere("muzzle", 0.1, 0, 0.53, -0.16, cream, segments=16, rings=10, scale=(1.3, 0.8, 0.6)),
        kit.sphere("nose", 0.022, 0, 0.57, -0.215, pink, segments=10, rings=6, scale=(1.3, 0.8, 0.8)),
        # Goggles pushed up on the forehead: two lenses on a short brass bridge.
        kit.box("goggle_bridge", 0.07, 0.02, 0.025, 0, 0.735, -0.2, brass, bevel=0.006),
    ]
    for side in (-1, 1):
        x = side * 0.085
        head += [
            kit.sphere(f"eye{side}", 0.04, x, 0.6, -0.195, eye, segments=14, rings=10, scale=(0.9, 1.2, 0.45)),
            kit.sphere(f"shine{side}", 0.012, x + 0.01, 0.618, -0.212, shine, segments=8, rings=6),
            kit.torus(f"goggle{side}", 0.045, 0.014, x, 0.735, -0.19, brass, axis="z", major_segments=20, minor_segments=8),
            kit.cylinder(f"lens{side}", 0.04, 0.02, x, 0.735, -0.19, lens, vertices=16, axis="z"),
            # Tall pointed ears, tipped outward.
            kit.cylinder(f"ear{side}", 0.075, 0.17, side * 0.14, 0.74, 0.02, fur, vertices=4, top_radius=0.005, rot=math.pi / 4),
            kit.cylinder(f"ear_in{side}", 0.045, 0.11, side * 0.14, 0.76, -0.02, pink, vertices=4, top_radius=0.004, rot=math.pi / 4),
        ]
        for k, dy in enumerate((-0.01, 0.015)):  # whiskers
            head.append(kit.box(f"whisker{side}{k}", 0.12, 0.006, 0.006, side * 0.17, 0.53 + dy, -0.17, eye))
    _hang(_bake(head, "cat_head_mesh"), _joint("cat_head", root, neck), neck)

    for side, tag in ((-1, "l"), (1, "r")):
        shoulder = (side * 0.15, 0.37, 0.0)
        arm = [
            kit.cylinder(f"arm{side}", 0.045, 0.16, side * 0.17, 0.2, 0, fur, vertices=12),
            kit.sphere(f"paw{side}", 0.05, side * 0.17, 0.19, 0, cream, segments=12, rings=8),
        ]
        _hang(_bake(arm, f"cat_arm_{tag}_mesh"), _joint(f"cat_arm_{tag}", root, shoulder), shoulder)

        hip = (side * 0.07, 0.17, 0.0)
        leg = [
            kit.cylinder(f"leg{side}", 0.05, 0.13, side * 0.07, 0.04, 0, fur, vertices=12),
            kit.sphere(f"foot{side}", 0.06, side * 0.07, 0.03, -0.03, cream, segments=12, rings=8, scale=(1, 0.6, 1.4)),
        ]
        _hang(_bake(leg, f"cat_leg_{tag}_mesh"), _joint(f"cat_leg_{tag}", root, hip), hip)

    tail_root = (0.0, 0.16, 0.12)
    tail = []
    for k in range(5):  # a tail curling up behind
        t = k / 4
        tail.append(kit.sphere(f"tail{k}", 0.045 - 0.006 * k, 0, 0.14 + 0.32 * t * t, 0.16 + 0.14 * math.sin(t * 2.2), fur, segments=12, rings=8))
    _hang(_bake(tail, "cat_tail_mesh"), _joint("cat_tail", root, tail_root), tail_root)

    gadget_at = (0.0, 0.3, 0.17)
    gadget = [
        kit.cylinder("gadget_stalk", 0.012, 0.16, 0, 0.18, 0.17, brass, vertices=8),
        kit.sphere("gadget_bulb", 0.06, 0, 0.36, 0.17, glow, segments=12, rings=8),
        kit.torus("gadget_ring", 0.05, 0.01, 0, 0.33, 0.17, brass, axis="y", major_segments=16, minor_segments=6),
    ]
    _hang(_bake(gadget, "cat_gadget_mesh"), _joint("cat_gadget", root, gadget_at), gadget_at)
