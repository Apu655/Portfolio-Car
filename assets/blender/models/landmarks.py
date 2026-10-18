"""Landmarks at the section stops: the SeCAREly robot, the Projects Hall, the campus, and the roadside billboard
frame. Each is built at the origin; the runtime places and turns it from the layout.

Runtime contract:
- `robot` faces local -Z (the runtime turns it to face the car). Its joints are empty nodes the runtime can turn:
  `robot_head` (origin at the neck), `robot_arm_l` / `robot_arm_r` (origin at each shoulder, arm hanging down;
  `_l` is the robot's own left, local -X). Materials `robot_eye` and `robot_screen` glow.
- `projects_hall` and `campus` have their front on local -Z, with a flat dark panel recessed just behind the front
  plane where the runtime lays its painted sign. Materials `hall_window_lit` and `campus_window_lit` glow at night.
- `roadside_billboard` faces local +Z: posts, a leaned-back cabinet with a bezel around the face rectangle (the
  runtime adds the face itself), and a brass hood over a `roadside_lamp` strip.
"""

import math

import bpy
from mathutils import Euler, Matrix

from lib import kit


def _bake(objects, name):
    """Merge parts into one mesh and apply its transform, so its origin is the world origin."""
    obj = kit.join(objects, name)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def _hang(mesh, parent, at=(0.0, 0.0, 0.0)):
    """Parent a baked mesh under an empty standing at web point `at`, keeping the geometry where it is."""
    mesh.data.transform(Matrix.Translation(-kit.v(*at)))
    mesh.location = (0.0, 0.0, 0.0)
    mesh.parent = parent
    return mesh


def _joint(name, parent, at):
    joint = kit.empty(name, *at)
    joint.parent = parent
    return joint


def _palette():
    return {
        "stone": kit.mat("landmark_limestone", "#e6dccb", roughness=0.8),
        "brass": kit.mat("landmark_brass", "#c39545", roughness=0.28, metallic=1.0),
        "navy": kit.mat("landmark_navy", "#1b2233", roughness=0.5),
        "panel": kit.mat("landmark_sign_panel", "#141a26", roughness=0.7),
        "roof": kit.mat("landmark_roof", "#2f3646", roughness=0.7),
    }


# ---------- the robot ----------


def robot(layout, m):
    spec = layout["ROBOT"]
    s = spec["height"] / 3.6  # modeled at 3.6 m tall, footprint radius under 1.0 m
    shell = kit.mat("robot_shell", "#efe8da", roughness=0.35, clearcoat=0.6)
    screen = kit.mat("robot_screen", "#0d2a33", roughness=0.3, emission="#59c3d6", strength=1.0)
    eye = kit.mat("robot_eye", "#c8fbff", roughness=0.2, emission="#9ff3ff", strength=1.0)

    def scaled(obj):
        obj.data.transform(Matrix.Scale(s, 4))
        return obj

    root = kit.group("robot")

    body = [
        kit.cylinder("skirt", 0.78, 0.32, 0, 0, 0, m["navy"], top_radius=0.7, bevel=0.06),
        kit.cylinder("pedestal", 0.34, 0.5, 0, 0.3, 0, m["brass"], vertices=24, top_radius=0.42),
        kit.box("torso", 1.3, 1.55, 1.0, 0, 0.75, 0, shell, bevel=0.22, segments=4),
        kit.box("screen_bezel", 0.86, 0.66, 0.08, 0, 1.22, -0.52, m["navy"], bevel=0.03),
        kit.box("screen", 0.72, 0.52, 0.04, 0, 1.29, -0.565, screen, bevel=0.01),
        kit.cylinder("neck", 0.16, 0.2, 0, 2.26, 0, m["brass"], vertices=16),
    ]
    _hang(scaled(_bake(body, "robot_body")), root)

    neck = (0.0, 2.38 * s, 0.0)
    head = [
        kit.box("head_shell", 1.12, 0.82, 0.86, 0, 2.44, 0, shell, bevel=0.2, segments=4),
        kit.box("visor", 0.86, 0.5, 0.06, 0, 2.6, -0.44, m["navy"], bevel=0.025),
        kit.cylinder("antenna", 0.03, 0.24, 0, 3.24, 0, m["brass"], vertices=8),
        kit.sphere("antenna_tip", 0.11, 0, 3.49, 0, eye, segments=12, rings=8),
    ]
    for side in (-1, 1):
        head.append(kit.sphere(f"eye{side}", 0.12, side * 0.19, 2.9, -0.475, eye, segments=16, rings=10, scale=(1, 1.15, 0.45)))
        head.append(kit.cylinder(f"ear{side}", 0.15, 0.12, side * 0.58, 2.85, 0, m["brass"], vertices=16, axis="x"))
    for k, a in enumerate((-60, -30, 0, 30, 60)):  # a dotted smile
        r = math.radians(a)
        head.append(kit.sphere(f"smile{k}", 0.03, 0.14 * math.sin(r), 2.8 - 0.14 * math.cos(r), -0.47, eye, segments=8, rings=6))
    head_joint = _joint("robot_head", root, neck)
    _hang(scaled(_bake(head, "robot_head_mesh")), head_joint, neck)

    for side, tag in ((-1, "l"), (1, "r")):
        shoulder = (side * 0.72 * s, 1.98 * s, 0.0)
        x = side * 0.8
        arm = [
            kit.sphere(f"shoulder{side}", 0.19, side * 0.72, 1.98, 0, m["brass"], segments=16, rings=10),
            kit.cylinder(f"upper_arm{side}", 0.11, 0.7, x, 1.28, 0, shell, vertices=16),
            kit.cylinder(f"cuff{side}", 0.13, 0.08, x, 1.22, 0, m["brass"], vertices=16),
            kit.sphere(f"hand{side}", 0.17, x, 1.1, 0, m["navy"], segments=16, rings=10),
        ]
        arm_joint = _joint(f"robot_arm_{tag}", root, shoulder)
        _hang(scaled(_bake(arm, f"robot_arm_{tag}_mesh")), arm_joint, shoulder)


# ---------- the Projects Hall ----------


def projects_hall(layout, m):
    spec = layout["PROJECTS_HALL"]
    w, d = spec["size"]  # built facing north, so the world footprint is the local one
    h, sign = spec["height"], spec["sign"]
    hw, hd = w / 2, d / 2
    lit = kit.mat("hall_window_lit", "#2f5a72", roughness=0.06, metallic=0.75, emission="#ffd59a", strength=0.35)
    front = -hd
    wall_top = h - 2.0  # the sawtooth roof rises from here to the full height
    bay = w - 3.2  # between the corner piers
    store_top = 4.6
    sign_bottom = sign["centerY"] - sign["height"] / 2
    sign_top = sign_bottom + sign["height"]

    parts = [
        kit.box("plinth", w, 0.3, d, 0, 0, 0, m["stone"], bevel=0.04),
        kit.box("core", w, wall_top - 0.3, d - 0.6, 0, 0.3, 0.3, m["stone"]),
        # The glass front: a lit storefront between limestone piers, under a brass canopy.
        kit.box("storefront", bay, store_top - 0.3, 0.12, 0, 0.3, front + 0.5, lit),
        kit.box("canopy", bay + 0.8, 0.22, 1.0, 0, store_top, front + 0.1, m["brass"], bevel=0.05),
        kit.box("transom", bay, 0.14, 0.2, 0, 3.3, front + 0.38, m["navy"]),
        # The spandrel carries the painted sign: a dark panel just behind the front plane, framed in brass.
        kit.box("spandrel", bay, wall_top - store_top, 0.4, 0, store_top, front + 0.3, m["stone"]),
        kit.box("sign_panel", sign["width"], sign["height"], 0.06, 0, sign_bottom, front + 0.06, m["panel"]),
        kit.box("sign_frame_top", sign["width"] + 0.4, 0.2, 0.1, 0, sign_top, front + 0.05, m["brass"]),
        kit.box("sign_frame_bottom", sign["width"] + 0.4, 0.2, 0.1, 0, sign_bottom - 0.2, front + 0.05, m["brass"]),
        kit.box("parapet", w, 0.7, 0.4, 0, wall_top, front + 0.2, m["stone"]),
        kit.box("coping", w + 0.2, 0.14, 0.5, 0, wall_top + 0.7, front + 0.2, m["brass"]),
    ]
    for side in (-1, 1):
        parts.append(kit.box(f"pier{side}", 1.6, wall_top + 0.4, 0.6, side * (hw - 0.8), 0.3, front + 0.3, m["stone"], bevel=0.06))
        parts.append(kit.box(f"sign_frame{side}", 0.2, sign["height"], 0.1, side * (sign["width"] / 2 + 0.1), sign_bottom, front + 0.05, m["brass"]))
        # Tall lit windows down each side, in navy frames.
        for k, z in enumerate((-hd + 2.6, 0.3, hd - 2.4)):
            parts.append(kit.box(f"side_frame{side}_{k}", 0.05, 6.3, 1.7, side * (hw + 0.025), 1.85, z, m["navy"]))
            parts.append(kit.box(f"side_window{side}_{k}", 0.08, 6.0, 1.4, side * (hw + 0.04), 2.0, z, lit))
    for k in range(7):  # storefront mullions
        parts.append(kit.box(f"mullion{k}", 0.14, store_top - 0.3, 0.2, -bay / 2 + k * bay / 6, 0.3, front + 0.38, m["navy"]))

    # Sawtooth roof: three teeth whose glazed vertical faces look forward, over the front parapet.
    tooth = (d - 0.6) / 3
    for k in range(3):
        z0 = front + 0.6 + k * tooth
        parts.append(kit.profile_extrude(f"tooth{k}", [(z0, wall_top), (z0 + tooth, wall_top), (z0, h)], w - 0.4, m["roof"], axis="x"))
        parts.append(kit.box(f"skylight{k}", w - 0.8, h - wall_top - 0.25, 0.06, 0, wall_top + 0.1, z0 - 0.03, lit))

    root = kit.group("projects_hall")
    _hang(_bake(parts, "projects_hall_mesh"), root)


# ---------- the campus ----------


def _clock_face(name, y, out, lit, m):
    """One clock face on the tower's -Z side, `out` from the tower axis, as a single mesh about the axis."""
    z = -out
    parts = [
        kit.cylinder(f"{name}_dial", 0.95, 0.1, 0, y, z - 0.02, lit, vertices=32, axis="z"),
        kit.torus(f"{name}_rim", 0.95, 0.07, 0, y, z - 0.06, m["brass"], axis="z", major_segments=32, minor_segments=8),
    ]
    for k, (length, width, angle) in enumerate(((0.5, 0.09, -1.05), (0.75, 0.06, 1.05))):  # ten past ten
        hand = kit.box(f"{name}_hand{k}", width, length, 0.03, math.sin(angle) * length / 2, y + math.cos(angle) * length / 2, z - 0.1, m["navy"], origin_bottom=False)
        hand.rotation_euler = Euler((0.0, angle, 0.0), "XYZ")
        parts.append(hand)
    return _bake(parts, name)


def campus(layout, m):
    spec = layout["CAMPUS"]
    d, w = spec["size"]  # world (x, z) footprint; built facing north and turned west, so local width is world z
    h, top, sign = spec["height"], spec["towerHeight"], spec["sign"]
    hw, hd = w / 2, d / 2
    brick = kit.mat("campus_brick", "#9a5a44", roughness=0.85)
    lit = kit.mat("campus_window_lit", "#2f4a5c", roughness=0.1, metallic=0.5, emission="#ffd59a", strength=0.35)
    front = -hd
    hall_front = front + 3.0  # the portico stands in front of the hall
    hall_d = hd - hall_front
    hall_z = (hall_front + hd) / 2
    eave = 7.6
    sign_bottom = sign["centerY"] - sign["height"] / 2
    sign_top = sign_bottom + sign["height"]
    portico_w = 9.8

    parts = [
        # The hall: a stone base course, brick walls with stone quoins, a stone cornice and a slate gable roof.
        kit.box("base", w + 0.2, 0.6, hall_d + 0.2, 0, 0, hall_z, m["stone"]),
        kit.box("walls", w, eave - 0.6 - 0.6, hall_d, 0, 0.6, hall_z, brick),
        kit.box("cornice", w + 0.4, 0.6, hall_d + 0.4, 0, eave - 0.6, hall_z, m["stone"], bevel=0.05),
        kit.profile_extrude("roof", [(hall_front - 0.2, eave), (hd + 0.2, eave), (hall_z, h)], w + 0.4, m["roof"], axis="x"),
        kit.profile_extrude("gable_ends", [(hall_front, eave), (hd, eave), (hall_z, h - 0.15)], w + 0.5, m["stone"], axis="x"),
        kit.box("door", 1.6, 3.0, 0.08, 0, 0.75, hall_front - 0.03, m["navy"]),
        # Steps up to the portico.
        kit.box("step1", portico_w + 0.8, 0.25, hall_front - front + 0.3, 0, 0, (front - 0.3 + hall_front) / 2, m["stone"]),
        kit.box("step2", portico_w + 0.4, 0.25, hall_front - front, 0, 0.25, (front + hall_front) / 2, m["stone"]),
        kit.box("stylobate", portico_w, 0.25, hall_front - front - 0.3, 0, 0.5, (front + 0.3 + hall_front) / 2, m["stone"]),
        # Entablature: architrave, the frieze carrying the painted sign in a recessed dark panel, and a cornice.
        kit.box("architrave", portico_w, sign_bottom - 5.9, 3.0, 0, 5.9, front + 1.5, m["stone"]),
        kit.box("frieze", portico_w, eave - sign_bottom, 2.85, 0, sign_bottom, front + 0.15 + 1.425, m["stone"]),
        kit.box("sign_panel", sign["width"], sign["height"], 0.1, 0, sign_bottom, front + 0.08, m["panel"]),
        kit.box("portico_cornice", portico_w + 0.5, 0.25, 3.3, 0, eave, front - 0.25 + 1.65, m["stone"]),
    ]
    for side in (-1, 1):
        sx = side * (sign["width"] / 2 + (portico_w - sign["width"]) / 4)
        parts.append(kit.box(f"frieze_block{side}", (portico_w - sign["width"]) / 2, eave - sign_bottom, 0.15, sx, sign_bottom, front + 0.075, m["stone"]))
        for qz in (hall_front + 0.3, hd - 0.3):
            parts.append(kit.box(f"quoin{side}_{qz}", 0.7, eave - 1.2, 0.7, side * (hw - 0.3), 0.6, qz, m["stone"]))
    # The portico's gable: a stone tympanum inside a slate roof that runs back to the hall's ridge.
    pediment_base = eave + 0.25
    roof = kit.profile_extrude("portico_roof", [(-5.3, 0), (5.3, 0), (0, h - pediment_base)], hall_z - front + 0.2, m["roof"], axis="x", center=(0, pediment_base, (front - 0.2 + hall_z) / 2))
    roof.rotation_euler = kit.yaw(math.pi / 2)
    tympanum = kit.profile_extrude("tympanum", [(-4.75, 0), (4.75, 0), (0, 1.75)], 0.15, m["stone"], axis="x", center=(0, pediment_base + 0.1, front - 0.225))
    tympanum.rotation_euler = kit.yaw(math.pi / 2)
    parts += [roof, tympanum]
    # Six columns.
    for k in range(6):
        cx = -4.15 + k * 1.66
        parts.append(kit.box(f"col_base{k}", 0.75, 0.2, 0.75, cx, 0.75, front + 0.75, m["stone"]))
        parts.append(kit.cylinder(f"col{k}", 0.3, 4.8, cx, 0.95, front + 0.75, m["stone"], vertices=16, top_radius=0.26))
        parts.append(kit.box(f"col_cap{k}", 0.8, 0.15, 0.8, cx, 5.75, front + 0.75, m["stone"]))

    # Lit windows with stone surrounds: beside the portico, behind the columns, and down both sides.
    def window(name, x, y, z, width, height, axis):
        if axis == "z":  # on a wall facing -Z
            parts.append(kit.box(f"{name}_surround", width + 0.3, height + 0.3, 0.04, x, y - 0.15, z - 0.02, m["stone"]))
            parts.append(kit.box(f"{name}_glass", width, height, 0.08, x, y, z - 0.04, lit))
        else:  # on a wall facing ±X; `axis` is the side
            parts.append(kit.box(f"{name}_surround", 0.04, height + 0.3, width + 0.3, x + axis * 0.02, y - 0.15, z, m["stone"]))
            parts.append(kit.box(f"{name}_glass", 0.08, height, width, x + axis * 0.04, y, z, lit))

    for side in (-1, 1):
        for row, (y, wh) in enumerate(((1.4, 2.2), (4.2, 2.0))):
            window(f"front{side}_{row}", side * 6.4, y, hall_front, 1.1, wh, "z")
            for k, z in enumerate((hall_front + 1.8, hall_z, hd - 1.8)):
                window(f"side{side}_{row}_{k}", side * hw, y, z, 1.1, wh, side)
        window(f"portico{side}", side * 1.66, 1.4, hall_front, 0.8, 2.2, "z")  # between the columns

    # The clock tower rises from the ridge: brick shaft, a stone clock stage, an open belfry, and a slate spire.
    tz = hall_z
    parts += [
        kit.box("tower_shaft", 3.2, 3.3, 3.2, 0, 7.0, tz, brick),
        kit.box("tower_band", 3.4, 0.3, 3.4, 0, 10.0, tz, m["stone"]),
        kit.box("clock_stage", 3.4, 2.6, 3.4, 0, 10.3, tz, m["stone"]),
        kit.box("tower_cornice", 3.8, 0.3, 3.8, 0, 12.9, tz, m["stone"], bevel=0.04),
        kit.box("belfry_dark", 2.4, 1.3, 2.4, 0, 13.2, tz, m["navy"]),
        kit.box("belfry_cap", 3.8, 0.25, 3.8, 0, 14.5, tz, m["stone"], bevel=0.04),
        kit.cylinder("spire", 3.6 / math.sqrt(2), top - 14.75, 0, 14.75, tz, m["roof"], vertices=4, top_radius=0.02, rot=math.pi / 4),
    ]
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append(kit.box(f"belfry_post{sx}{sz}", 0.6, 1.3, 0.6, sx * 1.4, 13.2, tz + sz * 1.4, m["stone"]))
    for k in range(4):
        face = _clock_face(f"clock{k}", 11.6, 1.7, lit, m)
        face.rotation_euler = kit.yaw(k * math.pi / 2)
        face.location = kit.v(0, 0, tz)
        parts.append(face)

    root = kit.group("campus")
    _hang(_bake(parts, "campus_mesh"), root)


# ---------- the roadside billboard frame ----------


def roadside_billboard(layout, m):
    f = layout["ROADSIDE_FRAME"]
    fw, fh, cy, tilt = f["width"], f["height"], f["centerY"], f["tilt"]
    lamp = kit.mat("roadside_lamp", "#fff1d0", roughness=0.3, emission="#ffd9a0", strength=0.3)
    up = (math.cos(tilt), -math.sin(tilt))  # (y, z) of the face's up direction
    normal = (math.sin(tilt), math.cos(tilt))  # (y, z) of the face's normal

    def panel(name, sx, sy, sz, a, b, c, material):
        """A box in the face's own frame: `a` across, `b` up the face, `c` out of the face (+ toward the viewer)."""
        y = cy + b * up[0] + c * normal[0]
        z = b * up[1] + c * normal[1]
        obj = kit.box(name, sx, sy, sz, a, y, z, material, origin_bottom=False)
        obj.rotation_euler = Euler((-tilt, 0.0, 0.0), "XYZ")
        return obj

    back = 0.06  # the cabinet's front, behind the face plane
    depth = 0.5
    rim = 0.18
    parts = [
        panel("cabinet", fw + 2 * rim, fh + 2 * rim, depth, 0, 0, -back - depth / 2, m["navy"]),
        # A brass bezel around the face rectangle, its front flush with the face plane.
        panel("bezel_top", fw + 2 * rim, rim, back, 0, fh / 2 + rim / 2, -back / 2, m["brass"]),
        panel("bezel_bottom", fw + 2 * rim, rim, back, 0, -fh / 2 - rim / 2, -back / 2, m["brass"]),
        # The hood over the top edge, with the lamp strip under its lip.
        panel("hood", fw + 0.6, 0.12, 0.85, 0, fh / 2 + rim + 0.06, -back - depth + 0.425, m["brass"]),
        panel("lamp", fw, 0.06, 0.12, 0, fh / 2 + 0.15, 0.2, lamp),
    ]
    # Posts rise into the cabinet from behind: the top's front edge stays 0.09 m behind the face plane.
    post_top = cy + (-0.09 - f["postHalf"] * normal[1]) / normal[0]
    for side in (-1, 1):
        parts.append(panel(f"bezel{side}", rim, fh, back, side * (fw / 2 + rim / 2), 0, -back / 2, m["brass"]))
        x = side * f["postOffset"]
        parts.append(kit.box(f"post{side}", 2 * f["postHalf"], post_top, 2 * f["postHalf"], x, 0, 0, m["navy"], bevel=0.03))
        parts.append(kit.box(f"footing{side}", 0.8, 0.3, 0.8, x, 0, 0, m["stone"], bevel=0.04))

    root = kit.group("roadside_billboard")
    _hang(_bake(parts, "roadside_billboard_mesh"), root)


def build(layout):
    m = _palette()
    robot(layout, m)
    projects_hall(layout, m)
    campus(layout, m)
    roadside_billboard(layout, m)
