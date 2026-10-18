"""The visitor's car: an original British grand tourer (deep racing green, chrome and brass).

Long low bonnet, a cabin set well back, a fastback roof flowing into a ducktail, and wide rear haunches. An
original design in the spirit of classic British GTs: no maker's grille shape, badge, or name.

Nose points down web -Z. Origin is on the ground under the car's center. The wheels sit where the physics puts
them (CAR_TUNING in src/world/physics/vehicle.ts). Runtime contract:
- `body` holds every body mesh (moved by the physics chassis, leaned by suspension);
- `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR` are empties at the hubs (spin about X, front ones steer about Y);
- `light_head_L`, `light_head_R` mark the headlamps;
- materials named `headlight`, `brakelight`, `reverselight` have their glow driven at runtime; `car_paint` is the body.
"""

import math

from lib import kit

WHEEL_Z = 1.32
WHEEL_X = 0.84
WHEEL_R = 0.36
BODY_W = 1.76
ARCH_R = 0.44


def arc(cz, cy, r, a0, a1, steps=10):
    return [(cz + r * math.cos(a0 + (a1 - a0) * i / steps), cy + r * math.sin(a0 + (a1 - a0) * i / steps)) for i in range(steps + 1)]


def curve(p0, p1, p2, steps=6):
    """Quadratic Bezier from p0 to p2 via p1, excluding p0."""
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        out.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))
    return out


def body_profile():
    """Side silhouette (z, y), walked along the sills from the tail to the nose, then back over the top."""
    pts = [(2.12, 0.3), (WHEEL_Z + ARCH_R, 0.3)]
    pts += arc(WHEEL_Z, WHEEL_R, ARCH_R, 0.06, math.pi - 0.06)[1:-1]
    pts += [(WHEEL_Z - ARCH_R, 0.28), (-WHEEL_Z + ARCH_R, 0.28)]
    pts += arc(-WHEEL_Z, WHEEL_R, ARCH_R, 0.06, math.pi - 0.06)[1:-1]
    pts += [(-WHEEL_Z - ARCH_R, 0.3), (-2.12, 0.3)]
    # A low nose rounding up into a long bonnet that rises gently to the windscreen.
    pts += curve((-2.12, 0.3), (-2.27, 0.34), (-2.25, 0.52))
    pts += curve((-2.25, 0.52), (-2.23, 0.65), (-2.08, 0.68))
    pts += curve((-2.08, 0.68), (-1.2, 0.8), (-0.42, 0.86))
    # The beltline under the glass, then the rear deck up to a ducktail lip and down the tail.
    pts += [(1.1, 0.9)]
    pts += curve((1.1, 0.9), (1.8, 0.93), (2.13, 0.97))
    pts += curve((2.13, 0.97), (2.24, 0.82), (2.22, 0.6))
    pts += curve((2.22, 0.6), (2.22, 0.4), (2.14, 0.31), steps=4)[:-1]
    return pts


def glasshouse_profile():
    """The windows: a steeply raked windscreen, a short roof, and a long fastback."""
    pts = [(-0.42, 0.84)]
    pts += curve((-0.42, 0.84), (-0.12, 1.12), (0.14, 1.2))
    pts += curve((0.14, 1.2), (0.45, 1.25), (0.8, 1.22))
    pts += curve((0.8, 1.22), (1.5, 1.12), (1.98, 0.93))
    pts += [(1.98, 0.86)]
    return pts


def roof_profile():
    """The painted roof, running back over the fastback and leaving a band of rear glass."""
    pts = [(0.1, 1.17)]
    pts += curve((0.1, 1.17), (0.45, 1.258), (0.82, 1.228))
    pts += curve((0.82, 1.228), (1.15, 1.19), (1.42, 1.1))
    pts += [(1.38, 1.05)]
    pts += curve((1.38, 1.05), (1.1, 1.15), (0.8, 1.19))
    pts += curve((0.8, 1.19), (0.45, 1.215), (0.12, 1.13))
    return pts


def haunch_profile(cz, front):
    """A fender bulge over one wheel: a swelling top line, then the arch cut back over the tyre."""
    if front:
        pts = [(cz - 0.7, 0.48)]
        pts += curve((cz - 0.7, 0.48), (cz - 0.35, 0.79), (cz + 0.2, 0.79))
        pts += curve((cz + 0.2, 0.79), (cz + 0.6, 0.77), (cz + 0.68, 0.55))
    else:
        pts = [(cz - 0.72, 0.52)]
        pts += curve((cz - 0.72, 0.52), (cz - 0.3, 0.95), (cz + 0.3, 0.93))
        pts += curve((cz + 0.3, 0.93), (cz + 0.72, 0.9), (cz + 0.78, 0.56))
    pts += arc(cz, WHEEL_R, ARCH_R + 0.02, 0.22, math.pi - 0.22)
    return pts


def wheel(name, x, z, m):
    hub = kit.group(name, x, WHEEL_R, z)
    side = 1 if x > 0 else -1
    parts = [
        kit.cylinder(f"{name}_tire", WHEEL_R, 0.27, x, WHEEL_R, z, m["rubber"], vertices=40, bevel=0.06, axis="x"),
        kit.cylinder(f"{name}_rim", 0.265, 0.28, x, WHEEL_R, z, m["rim"], vertices=36, bevel=0.015, axis="x"),
        kit.cylinder(f"{name}_dish", 0.2, 0.29, x, WHEEL_R, z, m["graphite"], vertices=32, axis="x"),
        kit.cylinder(f"{name}_cap", 0.055, 0.06, x + side * 0.15, WHEEL_R, z, m["brass"], vertices=16, bevel=0.012, axis="x"),
    ]
    # Ten slim spokes, and a brass brake caliper peeking through them.
    for i in range(10):
        a = i / 10 * math.pi * 2
        spoke = kit.box(f"{name}_spoke{i}", 0.03, 0.2, 0.035, x + side * 0.145, WHEEL_R + math.cos(a) * 0.12, z + math.sin(a) * 0.12, m["rim"], origin_bottom=False)
        spoke.rotation_euler[0] = a
        parts.append(spoke)
    parts.append(kit.box(f"{name}_caliper", 0.06, 0.1, 0.16, x + side * 0.08, WHEEL_R + 0.12, z - 0.06, m["brass"], bevel=0.015, origin_bottom=False))
    mesh = kit.join(parts, f"{name}_mesh")
    kit.parent(mesh, hub)
    return hub


def build(layout):
    m = {
        "paint": kit.mat("car_paint", "#1d4d3e", roughness=0.26, metallic=0.55, clearcoat=1.0),
        "glass": kit.mat("car_glass", "#0f1820", roughness=0.06, metallic=0.4, clearcoat=1.0),
        "chrome": kit.mat("chrome", "#e7e8ea", roughness=0.1, metallic=1.0),
        "brass": kit.mat("brass", "#c99a45", roughness=0.25, metallic=1.0),
        "rubber": kit.mat("rubber", "#17181b", roughness=0.9),
        "rim": kit.mat("car_rim", "#d4d7db", roughness=0.18, metallic=1.0),
        "graphite": kit.mat("car_graphite", "#3a3d43", roughness=0.35, metallic=0.8),
        "dark": kit.mat("car_dark", "#15171b", roughness=0.55),
        "head": kit.mat("headlight", "#fff7e0", roughness=0.12, emission="#fff1cc", strength=0.6),
        "brake": kit.mat("brakelight", "#9e1218", roughness=0.25, emission="#ff2020", strength=0.6),
        "reverse": kit.mat("reverselight", "#f4f4f4", roughness=0.3, emission="#ffffff", strength=0.05),
    }

    body = kit.group("body")
    parts = [
        kit.profile_extrude("shell", body_profile(), BODY_W, m["paint"], bevel=0.12, axis="x", segments=4),
        kit.profile_extrude("glasshouse", glasshouse_profile(), 1.34, m["glass"], bevel=0.06, axis="x"),
        kit.profile_extrude("roof", roof_profile(), 1.4, m["paint"], bevel=0.04, axis="x"),
    ]
    # Wide haunches over the rear wheels and a softer swell over the front ones.
    for side in (-1, 1):
        parts.append(kit.profile_extrude(f"haunch{side}", haunch_profile(WHEEL_Z, False), 0.15, m["paint"], bevel=0.06, axis="x", center=(side * 0.89, 0, 0)))
        parts.append(kit.profile_extrude(f"fender{side}", haunch_profile(-WHEEL_Z, True), 0.1, m["paint"], bevel=0.045, axis="x", center=(side * 0.88, 0, 0)))

    half = BODY_W / 2
    for side in (-1, 1):
        parts += [
            # A chrome line along the base of the side windows, slim sills, and mirrors.
            kit.box(f"window_line{side}", 0.02, 0.025, 2.3, side * 0.68, 0.86, 0.75, m["chrome"]),
            kit.box(f"sill{side}", 0.06, 0.08, 1.7, side * (half + 0.02), 0.28, 0.0, m["dark"], bevel=0.02),
            kit.box(f"mirror{side}", 0.2, 0.09, 0.13, side * (half + 0.05), 0.9, -0.36, m["paint"], bevel=0.035),
            kit.box(f"handle{side}", 0.015, 0.025, 0.16, side * (half + 0.005), 0.78, 0.22, m["chrome"]),
        ]

    # Front: a wide rounded grille with horizontal slats, slim swept lamps, a splitter, and bonnet vents.
    parts.append(kit.box("grille", 1.0, 0.24, 0.08, 0, 0.36, -2.22, m["dark"], bevel=0.06))
    for i in range(4):
        parts.append(kit.box(f"grille_slat{i}", 0.92, 0.018, 0.04, 0, 0.4 + i * 0.05, -2.26, m["chrome"]))
    parts.append(kit.box("splitter", 1.6, 0.04, 0.22, 0, 0.27, -2.12, m["dark"]))
    for side in (-1, 1):
        lamp = kit.box(f"headlamp{side}", 0.4, 0.07, 0.34, side * 0.6, 0.6, -2.0, m["head"], bevel=0.03)
        lamp.rotation_euler[2] = side * 0.38
        parts.append(lamp)
        bezel = kit.box(f"headlamp_bezel{side}", 0.44, 0.02, 0.36, side * 0.6, 0.59, -2.0, m["chrome"])
        bezel.rotation_euler[2] = side * 0.38
        parts.append(bezel)
        parts.append(kit.box(f"bonnet_vent{side}", 0.32, 0.015, 0.1, side * 0.32, 0.8, -1.15, m["dark"]))
    # Rear: a light bar across the ducktail, tail clusters, a diffuser, and four exhausts.
    parts.append(kit.box("light_bar", 1.36, 0.035, 0.04, 0, 0.9, 2.2, m["brake"]))
    for side in (-1, 1):
        parts.append(kit.box(f"taillight{side}", 0.3, 0.08, 0.05, side * 0.62, 0.8, 2.205, m["brake"], bevel=0.02))
        parts.append(kit.box(f"reverse{side}", 0.1, 0.05, 0.04, side * 0.3, 0.42, 2.2, m["reverse"], bevel=0.01))
        for offset in (0.38, 0.52):
            parts.append(kit.cylinder(f"exhaust{side}{offset}", 0.045, 0.16, side * offset, 0.33, 2.2, m["chrome"], vertices=12, axis="z"))
    parts.append(kit.box("diffuser", 1.2, 0.1, 0.18, 0, 0.27, 2.1, m["dark"]))
    parts.append(kit.box("plate", 0.48, 0.12, 0.03, 0, 0.58, 2.215, kit.mat("plate", "#f3efe2", roughness=0.5)))
    shell = kit.join(parts, "body_mesh")
    kit.parent(shell, body)

    for name, x, z in (("wheel_FL", -WHEEL_X, -WHEEL_Z), ("wheel_FR", WHEEL_X, -WHEEL_Z), ("wheel_RL", -WHEEL_X, WHEEL_Z), ("wheel_RR", WHEEL_X, WHEEL_Z)):
        wheel(name, x, z, m)
    for side, label in ((-1, "L"), (1, "R")):
        kit.empty(f"light_head_{label}", side * 0.6, 0.6, -2.25)
