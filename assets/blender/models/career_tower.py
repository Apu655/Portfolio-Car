"""Career Tower: an original contemporary corporate skyscraper (no branded likeness).

Limestone-and-glass podium with a brass entrance canopy; a gently tapering shaft of glass floor bands framed by
vertical brass fins; terraced balconies with planters stepping around the shaft; a glass sky-garden crown with
trees and a slim antenna. Built centered on the origin with the entrance facing web -X (west).
Runtime contract: materials `tower_window_lit` and `tower_crown_glow` glow at night.
"""

import math
import random

from lib import kit

FLOOR_H = 4.0
FLOORS = 18
PODIUM_H = 8.0


def build(layout):
    tower = layout["TOWER"]
    half = tower["halfSize"]
    rnd = random.Random(1123)
    m = {
        "stone": kit.mat("limestone", "#e6dccb", roughness=0.8),
        "stone_dark": kit.mat("limestone_dark", "#c9bba4", roughness=0.85),
        "glass": kit.mat("tower_glass", "#2f5a72", roughness=0.06, metallic=0.75),
        "lit": kit.mat("tower_window_lit", "#2f5a72", roughness=0.06, metallic=0.75, emission="#ffd59a", strength=0.05),
        "fin": kit.mat("brass_fin", "#b88a3e", roughness=0.3, metallic=1.0),
        "rail": kit.mat("railing_glass", "#bfe0ea", roughness=0.05, metallic=0.2, alpha=0.35),
        "planter": kit.mat("planter", "#8a7a66", roughness=0.85),
        "leaf": kit.mat("leaf", "#5f8a4a", roughness=0.9),
        "leaf2": kit.mat("leaf_light", "#7da35a", roughness=0.9),
        "crown": kit.mat("tower_crown_glow", "#dfeef2", roughness=0.05, metallic=0.2, emission="#ffe6b8", strength=0.05, alpha=0.6),
        "dark": kit.mat("tower_dark", "#2a2d33", roughness=0.6),
    }
    stone, glass, lit, fins, rails, planters, leaves = [], [], [], [], [], [], []

    # Podium with a glass lobby on the entrance (west) face and a brass canopy.
    w = half * 2
    stone.append(kit.box("podium", w, PODIUM_H, w, material=m["stone"], bevel=0.25))
    glass.append(kit.box("lobby_glass", 0.3, 5.5, w - 6, -half - 0.05, 0.2, 0, m["glass"]))
    fins.append(kit.box("canopy", 4.0, 0.35, 9.0, -half - 2.0, 5.8, 0, m["fin"], bevel=0.12))
    for z in (-3.6, 3.6):
        fins.append(kit.cylinder(f"canopy_post{z}", 0.14, 5.8, -half - 3.6, 0, z, m["fin"], vertices=12))
    stone.append(kit.box("podium_cap", w + 0.6, 0.6, w + 0.6, 0, PODIUM_H, 0, m["stone_dark"], bevel=0.2))

    # Shaft: floor slabs, glass bands (some lit at night), brass fins, terraces.
    for f in range(FLOORS):
        y = PODIUM_H + 0.6 + f * FLOOR_H
        taper = 1.0 - 0.18 * (f / (FLOORS - 1))
        size = 17.0 * taper
        terrace = f % 3 == 1
        slab = size + (2.6 if terrace else 0.8)
        stone.append(kit.box(f"slab{f}", slab, 0.35, slab, 0, y, 0, m["stone"], bevel=0.12))
        band_h = FLOOR_H - 0.35
        bays = 7
        glass.append(kit.box(f"band{f}", size - 0.2, band_h, size - 0.2, 0, y + 0.35, 0, None))
        for face in range(4):
            rot = face * math.pi / 2
            for b in range(bays):
                if rnd.random() > 0.42:
                    continue
                # A lit window: a thin quad just proud of the glass, same color by day, glowing at night.
                t = (b + 0.5) / bays - 0.5
                along = t * size
                out = size / 2 - 0.08
                x, z = (out * math.cos(rot) - along * math.sin(rot), out * math.sin(rot) + along * math.cos(rot))
                lit.append(kit.box(f"lit{f}_{face}_{b}", 0.02, band_h - 0.5, size / bays - 0.3, x, y + 0.6, z, None, rot=-rot))
            for b in range(bays + 1):
                t = b / bays - 0.5
                along = t * size
                out = size / 2 + 0.18
                x, z = (out * math.cos(rot) - along * math.sin(rot), out * math.sin(rot) + along * math.cos(rot))
                fins.append(kit.box(f"fin{f}_{face}_{b}", 0.32, band_h, 0.12, x, y + 0.35, z, None, rot=-rot))
            if terrace:
                # Railing and planters ringing the balcony.
                edge = slab / 2 - 0.15
                rx, rz = edge * math.cos(rot), edge * math.sin(rot)
                rails.append(kit.box(f"rail{f}_{face}", 0.08, 1.0, slab - 0.4, rx, y + 0.35, rz, None, rot=-rot))
                for k in range(3):
                    along = (k - 1) * size * 0.32
                    px = (edge - 0.7) * math.cos(rot) - along * math.sin(rot)
                    pz = (edge - 0.7) * math.sin(rot) + along * math.cos(rot)
                    planters.append(kit.box(f"planter{f}_{face}_{k}", 0.9, 0.6, 2.4, px, y + 0.35, pz, None, bevel=0.08, rot=-rot))
                    leaves.append(kit.ico(f"shrub{f}_{face}_{k}", 0.75, px, y + 1.25, pz, None, subdivisions=1, scale=(1.0, 0.75, 1.9)))

    top = PODIUM_H + 0.6 + FLOORS * FLOOR_H
    crown_size = 17.0 * 0.82
    stone.append(kit.box("crown_slab", crown_size + 1.2, 0.5, crown_size + 1.2, 0, top, 0, m["stone_dark"], bevel=0.15))

    # Sky garden: a glass box with trees, under a slim pergola roof and antenna.
    garden = kit.box("sky_garden", crown_size - 1.0, 7.0, crown_size - 1.0, 0, top + 0.5, 0, m["crown"], bevel=0.2)
    for i in range(7):
        a = i / 7 * math.pi * 2
        r = 3.2 + (i % 2) * 1.2
        x, z = math.cos(a) * r, math.sin(a) * r
        stone.append(kit.cylinder(f"garden_trunk{i}", 0.12, 1.6, x, top + 0.5, z, None, vertices=8))
        leaves.append(kit.ico(f"garden_tree{i}", 1.3, x, top + 2.8, z, None, subdivisions=1))
    for i in range(9):
        t = i / 8 - 0.5
        fins.append(kit.box(f"pergola{i}", 0.25, 0.3, crown_size + 0.6, t * (crown_size + 0.4), top + 7.6, 0, None))
    fins.append(kit.box("pergola_rim", crown_size + 0.8, 0.4, crown_size + 0.8, 0, top + 7.5, 0, None, bevel=0.1))
    fins.append(kit.cylinder("antenna", 0.22, tower["height"] - (top + 7.9), 0, top + 7.9, 0, None, vertices=12, top_radius=0.06))
    beacon = kit.sphere("antenna_light", 0.35, 0, tower["height"] + 0.1, 0, m["crown"])

    _assign(stone, m["stone"], "tower_stone")
    _assign(glass, m["glass"], "tower_glass_panes")
    _assign(lit, m["lit"], "tower_lit_panes")
    _assign(fins, m["fin"], "tower_fins")
    _assign(rails, m["rail"], "tower_railings")
    _assign(planters, m["planter"], "tower_planters")
    leaves_obj = _assign(leaves, m["leaf"], "tower_greenery")
    garden.name = "tower_sky_garden"
    beacon.name = "tower_beacon"
    kit.box("tower_door", 0.2, 4.0, 3.2, -half - 0.12, 0.2, 0, m["dark"])
    return leaves_obj


def _assign(objects, material, name):
    """Give every part without a material the shared one, then merge them into one draw call."""
    for o in objects:
        if not o.data.materials:
            o.data.materials.append(material)
    return kit.join(objects, name) if objects else None
