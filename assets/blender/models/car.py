"""The visitor's car: a stylized retro-modern coupe (deep teal, cream roof, brass and chrome).

Nose points down web -Z. Origin is on the ground under the car's center. Runtime contract:
- `body` holds every body mesh (moved by the physics chassis, leaned by suspension);
- `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR` are empties at the hubs (spin about X, front ones steer about Y);
- materials named `headlight`, `brakelight`, `reverselight` have their glow driven at runtime.
"""

import math

from lib import kit

LENGTH = 4.4
WHEEL_Z = 1.32
WHEEL_X = 0.84
WHEEL_R = 0.36
BODY_W = 1.72


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
    pts = [(2.1, 0.3), (WHEEL_Z + 0.48, 0.3)]
    pts += arc(WHEEL_Z, WHEEL_R, 0.5, 0.08, math.pi - 0.08)[1:-1]
    pts += [(WHEEL_Z - 0.48, 0.3), (-WHEEL_Z + 0.48, 0.3)]
    pts += arc(-WHEEL_Z, WHEEL_R, 0.5, 0.08, math.pi - 0.08)[1:-1]
    pts += [(-WHEEL_Z - 0.48, 0.3), (-2.08, 0.31)]
    pts += curve((-2.08, 0.31), (-2.26, 0.36), (-2.24, 0.58))
    pts += curve((-2.24, 0.58), (-2.22, 0.78), (-1.96, 0.84))
    pts += curve((-1.96, 0.84), (-1.3, 0.93), (-0.72, 0.94))
    pts += [(0.9, 0.95)]
    pts += curve((0.9, 0.95), (1.85, 0.97), (2.14, 0.8))
    pts += curve((2.14, 0.8), (2.24, 0.62), (2.18, 0.42))
    pts += curve((2.18, 0.42), (2.16, 0.32), (2.1, 0.3), steps=3)[:-1]
    return pts


def cabin_profile():
    pts = [(-0.78, 0.9)]
    pts += curve((-0.78, 0.9), (-0.4, 1.18), (-0.08, 1.32))
    pts += curve((-0.08, 1.32), (0.3, 1.4), (0.74, 1.37))
    pts += curve((0.74, 1.37), (1.25, 1.28), (1.55, 0.92))
    return pts


def roof_profile():
    pts = [(-0.12, 1.29)]
    pts += curve((-0.12, 1.29), (0.3, 1.43), (0.78, 1.395))
    pts += curve((0.78, 1.395), (1.05, 1.355), (1.18, 1.27))
    pts += [(0.78, 1.31)]
    pts += curve((0.78, 1.31), (0.3, 1.35), (-0.1, 1.24))
    return pts


def wheel(name, x, z, m):
    hub = kit.group(name, x, WHEEL_R, z)
    side = 1 if x > 0 else -1
    parts = [
        kit.cylinder(f"{name}_tire", WHEEL_R, 0.27, x, WHEEL_R, z, m["rubber"], vertices=40, bevel=0.07, axis="x"),
        kit.cylinder(f"{name}_rim", 0.235, 0.28, x, WHEEL_R, z, m["rim"], vertices=32, bevel=0.02, axis="x"),
        kit.cylinder(f"{name}_cap", 0.08, 0.06, x + side * 0.15, WHEEL_R, z, m["brass"], vertices=16, bevel=0.015, axis="x"),
    ]
    for i in range(5):
        a = i / 5 * math.pi * 2
        spoke = kit.box(f"{name}_spoke{i}", 0.04, 0.2, 0.06, x + side * 0.13, WHEEL_R + math.cos(a) * 0.1, z + math.sin(a) * 0.1, m["chrome"], bevel=0.01, origin_bottom=False)
        spoke.rotation_euler[0] = a
        parts.append(spoke)
    mesh = kit.join(parts, f"{name}_mesh")
    kit.parent(mesh, hub)
    return hub


def build(layout):
    m = {
        "paint": kit.mat("car_paint", "#1f6f72", roughness=0.28, metallic=0.45, clearcoat=1.0),
        "cream": kit.mat("car_cream", "#f1e6cc", roughness=0.35, clearcoat=0.8),
        "glass": kit.mat("car_glass", "#14202b", roughness=0.2, metallic=0.6),
        "chrome": kit.mat("chrome", "#e7e8ea", roughness=0.12, metallic=1.0),
        "brass": kit.mat("brass", "#c99a45", roughness=0.25, metallic=1.0),
        "rubber": kit.mat("rubber", "#18191c", roughness=0.9),
        "rim": kit.mat("car_rim", "#cfd2d6", roughness=0.22, metallic=1.0),
        "dark": kit.mat("car_dark", "#1b1d22", roughness=0.6),
        "head": kit.mat("headlight", "#fff7e0", roughness=0.15, emission="#fff1cc", strength=0.6),
        "brake": kit.mat("brakelight", "#b0141d", roughness=0.3, emission="#ff2020", strength=0.6),
        "reverse": kit.mat("reverselight", "#f4f4f4", roughness=0.3, emission="#ffffff", strength=0.05),
    }

    body = kit.group("body")
    parts = [
        kit.profile_extrude("shell", body_profile(), BODY_W, m["paint"], bevel=0.11, axis="x", segments=4),
        kit.profile_extrude("cabin", cabin_profile(), 1.46, m["glass"], bevel=0.07, axis="x"),
        kit.profile_extrude("roof", roof_profile(), 1.52, m["cream"], bevel=0.04, axis="x"),
    ]
    half = BODY_W / 2 + 0.1
    for side in (-1, 1):
        parts += [
            kit.box(f"stripe{side}", 0.02, 0.06, 3.2, side * (half + 0.005), 0.66, 0.05, m["cream"]),
            kit.box(f"mirror{side}", 0.18, 0.1, 0.14, side * (half + 0.07), 0.98, -0.6, m["paint"], bevel=0.04),
            kit.box(f"pillar{side}", 0.06, 0.38, 0.1, side * 0.74, 0.93, 0.32, m["cream"], bevel=0.02),
            kit.box(f"handle{side}", 0.02, 0.04, 0.22, side * (half + 0.01), 0.82, 0.2, m["chrome"]),
        ]
    # Grille, bumpers, plate, exhaust.
    parts.append(kit.box("grille", 0.86, 0.22, 0.08, 0, 0.5, -2.23, m["dark"], bevel=0.04))
    for i in range(-3, 4):
        parts.append(kit.box(f"grille_bar{i}", 0.025, 0.18, 0.05, i * 0.11, 0.52, -2.28, m["chrome"]))
    parts.append(kit.cylinder("bumper_front", 0.075, 1.9, 0, 0.4, -2.3, m["chrome"], vertices=16, bevel=0.03, axis="x"))
    parts.append(kit.cylinder("bumper_rear", 0.075, 1.86, 0, 0.42, 2.24, m["chrome"], vertices=16, bevel=0.03, axis="x"))
    parts.append(kit.box("plate", 0.5, 0.14, 0.03, 0, 0.6, 2.215, kit.mat("plate", "#f3efe2", roughness=0.5)))
    parts.append(kit.cylinder("exhaust", 0.05, 0.2, -0.55, 0.3, 2.25, m["chrome"], vertices=12, axis="z"))
    for side in (-1, 1):
        parts.append(kit.cylinder(f"headlight{side}", 0.16, 0.08, side * 0.62, 0.66, -2.2, m["head"], vertices=24, axis="z"))
        parts.append(kit.torus(f"headrim{side}", 0.165, 0.028, side * 0.62, 0.66, -2.245, m["chrome"], axis="z"))
        parts.append(kit.box(f"taillight{side}", 0.42, 0.09, 0.05, side * 0.55, 0.72, 2.205, m["brake"], bevel=0.02))
        parts.append(kit.box(f"reverse{side}", 0.12, 0.06, 0.04, side * 0.22, 0.5, 2.21, m["reverse"], bevel=0.01))
        parts.append(kit.box(f"fog{side}", 0.16, 0.06, 0.04, side * 0.6, 0.42, -2.3, m["head"], bevel=0.015))
    shell = kit.join(parts, "body_mesh")
    kit.parent(shell, body)

    for name, x, z in (("wheel_FL", -WHEEL_X, -WHEEL_Z), ("wheel_FR", WHEEL_X, -WHEEL_Z), ("wheel_RL", -WHEEL_X, WHEEL_Z), ("wheel_RR", WHEEL_X, WHEEL_Z)):
        wheel(name, x, z, m)
    for side, label in ((-1, "L"), (1, "R")):
        kit.empty(f"light_head_{label}", side * 0.62, 0.66, -2.3)
