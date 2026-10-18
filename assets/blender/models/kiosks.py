"""The Contact kiosk and the five section gates, in district coordinates.

The kiosk: a limestone plinth, brass frame, a glowing accent panel and an envelope icon, facing south. Runtime
contract: nodes `kiosk_contact` and `gate_<section>`; materials `kiosk_glow_contact` and `gate_lantern` glow brighter
at night.
"""

from lib import kit


def envelope(x, y, z, mat):
    """A sculpted envelope in front of the panel."""
    return [
        kit.box("envelope", 1.0, 0.65, 0.06, x, y - 0.32, z, mat, bevel=0.02),
        kit.profile_extrude("flap", [(0, 0.33), (0, -0.33), (0.0, 0.0)], 0.08, mat, axis="x", center=(x, y, z + 0.03)),
    ]


def build(layout):
    stone = kit.mat("kiosk_stone", "#e2d7c4", roughness=0.8)
    brass = kit.mat("kiosk_brass", "#c39545", roughness=0.28, metallic=1.0)
    dark = kit.mat("kiosk_panel", "#1d2433", roughness=0.4)
    kiosk = layout["CONTACT_KIOSK"]
    x, z0 = kiosk["position"]
    glow = kit.mat("kiosk_glow_contact", kiosk["accent"], roughness=0.35, emission=kiosk["accent"], strength=0.6)
    root = kit.group("kiosk_contact", x, 0, z0)
    parts = [
        kit.box("plinth", 3.4, 0.6, 1.6, x, 0, z0, stone, bevel=0.12),
        kit.box("frame", 2.8, 3.6, 0.5, x, 0.6, z0, brass, bevel=0.1),
        kit.box("panel", 2.4, 3.2, 0.12, x, 0.8, z0 + 0.22, dark, bevel=0.04),
        kit.box("glow_band", 2.4, 0.18, 0.08, x, 3.85, z0 + 0.28, glow, bevel=0.02),
        kit.box("glow_band_low", 2.4, 0.12, 0.08, x, 0.95, z0 + 0.28, glow, bevel=0.02),
        kit.cylinder("finial", 0.18, 0.5, x, 4.2, z0, brass, vertices=12, top_radius=0.02),
        kit.sphere("finial_light", 0.22, x, 4.85, z0, glow),
    ]
    parts += envelope(x, 2.45, z0 + 0.35, glow)
    mesh = kit.join(parts, "kiosk_contact_mesh")
    kit.parent(mesh, root)

    # Section gates: limestone pillars on the sidewalks, a navy lintel with brass rails across the road, an open
    # brass transom below it (a tie bar and uprights) hung with two lanterns, and a header sign above (its face is
    # drawn at runtime). Built around the origin in the gate's own frame, then parented to a root rotated to face
    # the camera's side of the road.
    f = layout["GATE_FRAME"]
    navy = kit.mat("gate_frame", "#1b2233", roughness=0.5)
    lantern = kit.mat("gate_lantern", "#fff1d0", roughness=0.3, emission="#ffcf7a", strength=0.2)
    for g in layout["SECTION_GATES"]:
        root = kit.group(f"gate_{g['section']}", g["center"][0], 0, g["center"][1], g["rotationY"])
        half = g["halfSpan"]
        ph = f["pillarHalf"] * 2
        beam_w = 2 * half
        hd = f["header"]
        lintel_bottom = f["beamTop"] - 1.1
        tie_top = f["beamBottom"] + 0.16
        parts = []
        for side in (-1, 1):
            x = side * half
            parts.append(kit.box(f"pillar{side}", ph, f["pillarHeight"], ph, x, 0, 0, stone, bevel=0.15))
            parts.append(kit.box(f"pillar_cap{side}", ph + 0.4, 0.45, ph + 0.4, x, f["pillarHeight"], 0, brass, bevel=0.1))
            parts.append(kit.box(f"pillar_band{side}", ph + 0.12, 0.3, ph + 0.12, x, f["beamBottom"] - 0.6, 0, brass, bevel=0.05))
            parts.append(kit.cylinder(f"chain{side}", 0.03, 0.9, x - side * 1.3, f["beamBottom"] - 0.9, 0, brass, vertices=6))
            parts.append(kit.sphere(f"lantern{side}", 0.3, x - side * 1.3, f["beamBottom"] - 1.1, 0, lantern))
        # The lintel: a slim navy beam between brass rails at the top of the beam band.
        parts.append(kit.box("lintel", beam_w, f["beamTop"] - lintel_bottom - 0.2, 0.4, 0, lintel_bottom + 0.1, 0, navy, bevel=0.06))
        parts.append(kit.box("rail_top", beam_w + 0.3, 0.22, 0.52, 0, f["beamTop"] - 0.22, 0, brass, bevel=0.05))
        parts.append(kit.box("rail_bottom", beam_w + 0.3, 0.22, 0.52, 0, lintel_bottom, 0, brass, bevel=0.05))
        # The open transom: a brass tie bar at the bottom of the band, joined to the lintel by slim uprights.
        parts.append(kit.box("tie_bar", beam_w, 0.16, 0.24, 0, f["beamBottom"], 0, brass, bevel=0.03))
        for k in (-2, -1, 0, 1, 2):
            parts.append(kit.box(f"upright{k}", 0.1, lintel_bottom - tie_top, 0.12, k * 1.9, tie_top, 0, brass))
        # The header frame above the beam.
        header_bottom = hd["centerY"] - hd["height"] / 2
        parts.append(kit.box("header_frame", hd["width"] + 0.5, hd["height"] + 0.4, 0.4, 0, header_bottom - 0.2, 0, navy, bevel=0.08))
        parts.append(kit.box("header_trim", hd["width"] + 0.7, 0.16, 0.5, 0, header_bottom + hd["height"] + 0.2, 0, brass, bevel=0.04))
        for side in (-1, 1):
            parts.append(kit.box(f"header_strut{side}", 0.2, header_bottom - f["beamTop"] + 0.2, 0.2, side * (hd["width"] / 2 - 0.4), f["beamTop"], 0, brass))
        mesh = kit.join(parts, f"gate_{g['section']}_frame")
        kit.parent(mesh, root, keep_transform=False)
