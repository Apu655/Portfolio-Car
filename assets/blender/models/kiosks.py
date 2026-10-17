"""City gate kiosks (Research, Projects, Education, Contact) and the brass gate arch, in district coordinates.

Each kiosk: a limestone plinth, brass frame, a glowing accent panel and an icon. Runtime contract: nodes
`kiosk_<section>`; materials `kiosk_glow_<section>` glow brighter at night.
"""

import math

from lib import kit


def icon(section, x, y, z, mat):
    """A simple sculpted icon in front of the panel."""
    parts = []
    if section == "research":  # an open book
        for side in (-1, 1):
            p = kit.box(f"book{side}", 0.55, 0.06, 0.7, x + side * 0.29, y, z, mat, bevel=0.02)
            p.rotation_euler[1] = side * 0.25
            parts.append(p)
    elif section == "projects":  # a gear
        parts.append(kit.torus("gear", 0.32, 0.1, x, y, z, mat, axis="z", major_segments=24))
        for k in range(8):
            a = k / 8 * math.pi * 2
            t = kit.box(f"tooth{k}", 0.14, 0.14, 0.12, x + math.cos(a) * 0.46, y + math.sin(a) * 0.46 - 0.07, z, mat)
            t.rotation_euler[1] = -a
            parts.append(t)
    elif section == "education":  # a mortarboard
        board = kit.box("board", 0.9, 0.06, 0.9, x, y + 0.15, z, mat, bevel=0.02)
        board.rotation_euler[2] = math.pi / 4
        parts += [board, kit.cylinder("cap", 0.3, 0.28, x, y - 0.13, z, mat, vertices=16)]
    else:  # an envelope
        parts.append(kit.box("envelope", 1.0, 0.65, 0.06, x, y - 0.32, z, mat, bevel=0.02))
        parts.append(kit.profile_extrude("flap", [(0, 0.33), (0, -0.33), (0.0, 0.0)], 0.08, mat, axis="x", center=(x, y, z + 0.03)))
    return parts


def build(layout):
    stone = kit.mat("kiosk_stone", "#e2d7c4", roughness=0.8)
    brass = kit.mat("kiosk_brass", "#c39545", roughness=0.28, metallic=1.0)
    dark = kit.mat("kiosk_panel", "#1d2433", roughness=0.4)
    z0 = layout["KIOSK_Z"]
    for kiosk in layout["KIOSKS"]:
        section = kiosk["section"]
        x = kiosk["focus"][0]
        glow = kit.mat(f"kiosk_glow_{section}", kiosk["accent"], roughness=0.35, emission=kiosk["accent"], strength=0.6)
        root = kit.group(f"kiosk_{section}", x, 0, z0)
        parts = [
            kit.box("plinth", 3.4, 0.6, 1.6, x, 0, z0, stone, bevel=0.12),
            kit.box("frame", 2.8, 3.6, 0.5, x, 0.6, z0, brass, bevel=0.1),
            kit.box("panel", 2.4, 3.2, 0.12, x, 0.8, z0 + 0.22, dark, bevel=0.04),
            kit.box("glow_band", 2.4, 0.18, 0.08, x, 3.85, z0 + 0.28, glow, bevel=0.02),
            kit.box("glow_band_low", 2.4, 0.12, 0.08, x, 0.95, z0 + 0.28, glow, bevel=0.02),
            kit.cylinder("finial", 0.18, 0.5, x, 4.2, z0, brass, vertices=12, top_radius=0.02),
            kit.sphere("finial_light", 0.22, x, 4.85, z0, glow),
        ]
        parts += icon(section, x, 2.45, z0 + 0.35, glow)
        mesh = kit.join(parts, f"kiosk_{section}_mesh")
        kit.parent(mesh, root)

    # City gate: two limestone pillars on the sidewalks and a brass arch over the road with hanging lanterns.
    g = layout["GATE"]
    gx = g["x"]
    za, zb = g["pillarsZ"]
    gate = []
    for z in (za, zb):
        gate.append(kit.box(f"pillar{z}", 1.6, g["height"], 1.6, gx, 0, z, stone, bevel=0.15))
        gate.append(kit.box(f"pillar_cap{z}", 2.0, 0.5, 2.0, gx, g["height"], z, brass, bevel=0.1))
    span = abs(za - zb)
    mid = (za + zb) / 2
    steps = 16
    for k in range(steps):
        a0, a1 = math.pi * k / steps, math.pi * (k + 1) / steps
        p0 = (mid + math.cos(a0) * span / 2, g["height"] - 0.2 + math.sin(a0) * 2.2)
        p1 = (mid + math.cos(a1) * span / 2, g["height"] - 0.2 + math.sin(a1) * 2.2)
        length = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        seg = kit.box(f"arch{k}", 0.5, 0.5, length + 0.05, gx, (p0[1] + p1[1]) / 2 - 0.25, (p0[0] + p1[0]) / 2, brass)
        seg.rotation_euler[0] = math.atan2(p1[1] - p0[1], -(p1[0] - p0[0]))
        gate.append(seg)
    lantern = kit.mat("gate_lantern", "#fff1d0", roughness=0.3, emission="#ffcf7a", strength=0.2)
    for z in (mid - 3, mid + 3):
        gate.append(kit.cylinder(f"chain{z}", 0.03, 1.2, gx, g["height"] - 0.4, z, brass, vertices=6))
        gate.append(kit.sphere(f"lantern{z}", 0.35, gx, g["height"] - 0.6, z, lantern))
    kit.join(gate, "city_gate")
