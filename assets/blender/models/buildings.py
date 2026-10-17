"""Backdrop buildings ringing the district: four mid-rise variants (`building_0` ... `building_3`), each built
at the origin facing web +Z, cloned by the runtime at the layout's placements.

Runtime contract: material `building_window_lit` glows at night.
"""

import math
import random

from lib import kit


def windows(prefix, half_w, half_d, y0, floors, floor_h, bays, out, rnd, faces=(0, 1, 2, 3), inset=0.05):
    """Window quads on the chosen faces; returns (dark, lit) lists."""
    dark, lit = [], []
    for f in range(floors):
        y = y0 + f * floor_h + floor_h * 0.25
        for face in faces:
            rot = face * math.pi / 2
            half = half_w if face % 2 == 0 else half_d
            depth = half_d if face % 2 == 0 else half_w
            for b in range(bays):
                t = (b + 0.5) / bays - 0.5
                along = t * 2 * half * 0.86
                fx = math.sin(rot) * (depth + inset) + math.cos(rot) * along
                fz = math.cos(rot) * (depth + inset) - math.sin(rot) * along
                w = kit.box(f"{prefix}w{f}_{face}_{b}", 2 * half * 0.86 / bays - 0.5, floor_h * 0.55, 0.06, fx, y, fz, None, rot=rot)
                (lit if rnd.random() < 0.35 else dark).append(w)
    return dark, lit


def finish(name, parts, dark, lit, m):
    for o in dark:
        o.data.materials.append(m["window"])
    for o in lit:
        o.data.materials.append(m["lit"])
    kit.join(parts + dark + lit, name)


def build(layout):
    rnd = random.Random(99)
    m = {
        "cream": kit.mat("bld_cream", "#eadfca", roughness=0.85),
        "terracotta": kit.mat("bld_terracotta", "#c77a57", roughness=0.85),
        "sage": kit.mat("bld_sage", "#a9b89a", roughness=0.85),
        "slate": kit.mat("bld_slate", "#5d6a78", roughness=0.6, metallic=0.2),
        "trim": kit.mat("bld_trim", "#f4efe4", roughness=0.7),
        "brass": kit.mat("bld_brass", "#bf9348", roughness=0.3, metallic=1.0),
        "window": kit.mat("building_window", "#2c4656", roughness=0.08, metallic=0.7),
        "lit": kit.mat("building_window_lit", "#2c4656", roughness=0.08, metallic=0.7, emission="#ffd59a", strength=0.05),
        "green": kit.mat("bld_green", "#5f8a4a", roughness=0.9),
    }

    # 0: cream apartment block with balconies on the front.
    parts = [kit.box("b0", 14, 30, 12, material=m["cream"], bevel=0.2), kit.box("b0_cap", 14.6, 0.6, 12.6, 0, 30, 0, m["trim"], bevel=0.1)]
    for f in range(1, 9):
        parts.append(kit.box(f"b0_bal{f}", 12, 0.25, 1.4, 0, f * 3.4, 6.6, m["trim"], bevel=0.08))
        parts.append(kit.box(f"b0_rail{f}", 12, 0.9, 0.06, 0, f * 3.4 + 0.25, 7.25, m["brass"]))
    dark, lit = windows("b0", 7, 6, 0.6, 9, 3.4, 5, 0, rnd)
    finish("building_0", parts, dark, lit, m)

    # 1: slate-glass office tower with vertical brass fins and a crown.
    parts = [kit.box("b1", 16, 42, 16, material=m["slate"], bevel=0.25), kit.box("b1_crown", 12, 3, 12, 0, 42, 0, m["trim"], bevel=0.2)]
    for face in range(4):
        rot = face * math.pi / 2
        for k in range(7):
            t = (k + 0.5) / 7 - 0.5
            fx = math.sin(rot) * 8.15 + math.cos(rot) * t * 15
            fz = math.cos(rot) * 8.15 - math.sin(rot) * t * 15
            parts.append(kit.box(f"b1_fin{face}_{k}", 0.2, 41, 0.35, fx, 0.5, fz, m["brass"], rot=rot))
    dark, lit = windows("b1", 8, 8, 0.8, 12, 3.4, 6, 0, rnd)
    finish("building_1", parts, dark, lit, m)

    # 2: terracotta low-rise with arched ground floor and rooftop garden.
    parts = [kit.box("b2", 13, 22, 13, material=m["terracotta"], bevel=0.2), kit.box("b2_cornice", 13.8, 0.7, 13.8, 0, 22, 0, m["trim"], bevel=0.15)]
    for k in range(4):
        parts.append(kit.ico(f"b2_shrub{k}", 1.2, -4 + k * 2.7, 23.4, rnd.uniform(-3, 3), m["green"], subdivisions=1, scale=(1, 0.8, 1)))
    parts.append(kit.box("b2_awning", 11, 0.2, 2.2, 0, 3.6, 7.5, m["sage"], bevel=0.06))
    dark, lit = windows("b2", 6.5, 6.5, 4.6, 5, 3.4, 4, 0, rnd)
    finish("building_2", parts, dark, lit, m)

    # 3: sage two-step tower with green terraces.
    parts = [
        kit.box("b3_low", 15, 20, 14, material=m["sage"], bevel=0.2),
        kit.box("b3_high", 11, 16, 10, 0, 20, -1, m["sage"], bevel=0.2),
        kit.box("b3_terrace", 15.4, 0.4, 14.4, 0, 20, 0, m["trim"], bevel=0.1),
        kit.box("b3_cap", 11.6, 0.5, 10.6, 0, 36, -1, m["trim"], bevel=0.1),
    ]
    for k in range(5):
        parts.append(kit.box(f"b3_planter{k}", 2.2, 0.6, 1.0, -5.5 + k * 2.75, 20.4, 6.3, m["trim"], bevel=0.08))
        parts.append(kit.ico(f"b3_green{k}", 0.8, -5.5 + k * 2.75, 21.3, 6.3, m["green"], subdivisions=1, scale=(1.3, 0.7, 0.7)))
    d1, l1 = windows("b3l", 7.5, 7, 0.8, 6, 3.2, 5, 0, rnd)
    d2, l2 = windows("b3h", 5.5, 5, 20.8, 4, 3.6, 3, 0, rnd)
    for w in d2 + l2:
        w.location.y -= 1  # Blender Y = web -Z; matches the upper block's -1 offset
    finish("building_3", parts, d1 + d2, l1 + l2, m)
