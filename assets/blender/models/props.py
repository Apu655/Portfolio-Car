"""Physical props, one root node each (`prop_<kind>`), centered on their collider so the runtime can clone them.

Sizes must match PROP_SPECS in src/world/physics/props.ts.
"""

import math

from lib import kit


def build(layout):
    m = {
        "orange": kit.mat("cone_orange", "#ee6a2f", roughness=0.55, clearcoat=0.3),
        "white": kit.mat("cone_white", "#f4f1ea", roughness=0.5),
        "black": kit.mat("prop_black", "#26282d", roughness=0.8),
        "wood": kit.mat("crate_wood", "#b98652", roughness=0.75),
        "wood_dark": kit.mat("crate_wood_dark", "#8a5f37", roughness=0.8),
        "barrel": kit.mat("barrel_teal", "#2f7f86", roughness=0.4, metallic=0.5, clearcoat=0.5),
        "steel": kit.mat("steel", "#9aa1a9", roughness=0.35, metallic=0.9),
        "sign": kit.mat("sign_face", "#f2efe4", roughness=0.4),
        "sign_red": kit.mat("sign_red", "#c8433a", roughness=0.45),
        "iron": kit.mat("cast_iron", "#2e3238", roughness=0.5, metallic=0.6),
        "brick": kit.mat("brick", "#b35a3e", roughness=0.9),
    }

    # Traffic cone: 0.75 tall, origin at mid-height.
    cone = [
        kit.box("cone_base", 0.46, 0.06, 0.46, 0, -0.375, 0, m["black"], bevel=0.03),
        kit.cylinder("cone_body", 0.19, 0.66, 0, -0.32, 0, m["orange"], vertices=20, top_radius=0.035),
        kit.cylinder("cone_band1", 0.155, 0.1, 0, -0.12, 0, m["white"], vertices=20, top_radius=0.135),
        kit.cylinder("cone_band2", 0.105, 0.08, 0, 0.08, 0, m["white"], vertices=20, top_radius=0.09),
    ]
    kit.join(cone, "prop_cone")

    # Wooden crate: 1 m cube with slats and corner posts.
    crate = [kit.box("crate_core", 0.92, 0.92, 0.92, 0, -0.46, 0, m["wood_dark"])]
    for face in range(4):
        rot = face * math.pi / 2
        for k in range(3):
            y = -0.4 + k * 0.3
            dx, dz = math.sin(rot) * 0.47, math.cos(rot) * 0.47
            crate.append(kit.box(f"slat{face}_{k}", 0.96, 0.22, 0.05, dx, y, dz, m["wood"], bevel=0.015, rot=rot))
    for sx in (-1, 1):
        for sz in (-1, 1):
            crate.append(kit.box(f"post{sx}{sz}", 0.1, 1.0, 0.1, sx * 0.46, -0.5, sz * 0.46, m["wood_dark"], bevel=0.02))
    kit.join(crate, "prop_crate")

    # Barrel: radius 0.35, 1 m tall, painted steel with hoops.
    barrel = [kit.cylinder("barrel_body", 0.35, 1.0, 0, -0.5, 0, m["barrel"], vertices=24, bevel=0.03)]
    for y in (-0.3, 0.3):
        barrel.append(kit.torus(f"hoop{y}", 0.352, 0.025, 0, y, 0, m["steel"], major_segments=24, minor_segments=6))
    kit.join(barrel, "prop_barrel")

    # Street sign: post with a round face, 2.6 m tall overall, origin at mid-height.
    sign = [
        kit.cylinder("sign_post", 0.05, 2.5, 0, -1.3, 0, m["steel"], vertices=10),
        kit.box("sign_foot", 0.5, 0.08, 0.5, 0, -1.3, 0, m["iron"], bevel=0.02),
        kit.cylinder("sign_face", 0.38, 0.05, 0, 0.9, 0.1, m["sign"], vertices=28, axis="z"),
        kit.torus("sign_ring", 0.36, 0.045, 0, 0.9, 0.13, m["sign_red"], axis="z", major_segments=28, minor_segments=6),
    ]
    kit.join(sign, "prop_sign")

    # Park bench: 1.8 wide, 0.9 tall, 0.6 deep; wooden slats on cast-iron legs.
    bench = []
    for k in range(3):
        bench.append(kit.box(f"seat{k}", 1.8, 0.05, 0.14, 0, -0.03, -0.18 + k * 0.17, m["wood"], bevel=0.015))
    for k in range(2):
        b = kit.box(f"back{k}", 1.8, 0.12, 0.04, 0, 0.12 + k * 0.17, 0.27, m["wood"], bevel=0.015)
        bench.append(b)
    for sx in (-0.75, 0.75):
        bench.append(kit.box(f"leg{sx}", 0.06, 0.45, 0.55, sx, -0.45, 0, m["iron"], bevel=0.015))
        bench.append(kit.box(f"armrest{sx}", 0.07, 0.05, 0.5, sx, 0.08, 0, m["iron"], bevel=0.015))
        bench.append(kit.box(f"backleg{sx}", 0.05, 0.5, 0.05, sx, -0.05, 0.28, m["iron"]))
    kit.join(bench, "prop_bench")

    # Brick: 0.6 x 0.3 x 0.4, softly bevelled.
    kit.box("prop_brick", 0.58, 0.29, 0.39, 0, -0.145, 0, m["brick"], bevel=0.035)
