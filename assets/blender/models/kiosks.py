"""Signpost kiosks (Research, Projects, Education, Contact) and the five section gates, in district coordinates.

Each kiosk: a limestone plinth, brass frame, a glowing accent panel and an icon. Runtime contract: nodes
`kiosk_<section>` and `gate_<section>`; materials `kiosk_glow_<section>` and `gate_lantern` glow brighter at night.
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

    # Section gates: limestone pillars on the sidewalks, a navy frame with brass trim carrying two screens and a
    # header sign (the screens and header faces are drawn at runtime), and two lanterns. Built around the origin
    # in the gate's own frame, then parented to a root rotated to face the camera's side of the road.
    f = layout["GATE_FRAME"]
    navy = kit.mat("gate_frame", "#1b2233", roughness=0.5)
    lantern = kit.mat("gate_lantern", "#fff1d0", roughness=0.3, emission="#ffcf7a", strength=0.2)
    for g in layout["SECTION_GATES"]:
        root = kit.group(f"gate_{g['section']}", g["center"][0], 0, g["center"][1], g["rotationY"])
        half = g["halfSpan"]
        ph = f["pillarHalf"] * 2
        beam_w = 2 * half
        beam_h = f["beamTop"] - f["beamBottom"]
        sc, hd = f["screen"], f["header"]
        parts = []
        for side in (-1, 1):
            x = side * half
            parts.append(kit.box(f"pillar{side}", ph, f["pillarHeight"], ph, x, 0, 0, stone, bevel=0.15))
            parts.append(kit.box(f"pillar_cap{side}", ph + 0.4, 0.45, ph + 0.4, x, f["pillarHeight"], 0, brass, bevel=0.1))
            parts.append(kit.box(f"pillar_band{side}", ph + 0.12, 0.3, ph + 0.12, x, f["beamBottom"] - 0.6, 0, brass, bevel=0.05))
            parts.append(kit.cylinder(f"chain{side}", 0.03, 0.9, x - side * 1.3, f["beamBottom"] - 0.9, 0.2, brass, vertices=6))
            parts.append(kit.sphere(f"lantern{side}", 0.3, x - side * 1.3, f["beamBottom"] - 1.1, 0.2, lantern))
        # The beam frame behind the two screens, with brass rails top and bottom and a divider between screens.
        parts.append(kit.box("beam", beam_w, beam_h, 0.5, 0, f["beamBottom"], 0, navy, bevel=0.08))
        parts.append(kit.box("rail_top", beam_w + 0.3, 0.22, 0.62, 0, f["beamTop"] - 0.11, 0, brass, bevel=0.05))
        parts.append(kit.box("rail_bottom", beam_w + 0.3, 0.22, 0.62, 0, f["beamBottom"] - 0.11, 0, brass, bevel=0.05))
        parts.append(kit.box("divider", 0.18, beam_h - 0.2, 0.56, 0, f["beamBottom"] + 0.1, 0, brass, bevel=0.04))
        # The header frame above the beam.
        header_bottom = hd["centerY"] - hd["height"] / 2
        parts.append(kit.box("header_frame", hd["width"] + 0.5, hd["height"] + 0.4, 0.4, 0, header_bottom - 0.2, 0, navy, bevel=0.08))
        parts.append(kit.box("header_trim", hd["width"] + 0.7, 0.16, 0.5, 0, header_bottom + hd["height"] + 0.2, 0, brass, bevel=0.04))
        for side in (-1, 1):
            parts.append(kit.box(f"header_strut{side}", 0.2, header_bottom - f["beamTop"] + 0.2, 0.2, side * (hd["width"] / 2 - 0.4), f["beamTop"], 0, brass))
        mesh = kit.join(parts, f"gate_{g['section']}_frame")
        kit.parent(mesh, root, keep_transform=False)
