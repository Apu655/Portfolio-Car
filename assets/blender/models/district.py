"""The Career District's static scenery: ground with a pond basin, roads, sidewalks, markings, plazas,
landscaping, trees, and streetlights. All placements come from the layout JSON.

Runtime contract: `collider_mesh_ground` is the drivable ground (trimesh collider); material `street_lamp`
glows at night; the water surface itself is rendered at runtime.
"""

import math
import random

import bmesh
import bpy

from lib import kit


def rounded_rect(half_x, half_z, radius, steps_per_corner=10):
    """Points around a rounded rectangle (web x, z), counterclockwise seen from above."""
    pts = []
    corners = [(half_x - radius, half_z - radius, 0), (-(half_x - radius), half_z - radius, math.pi / 2),
               (-(half_x - radius), -(half_z - radius), math.pi), (half_x - radius, -(half_z - radius), 1.5 * math.pi)]
    for cx, cz, a0 in corners:
        for i in range(steps_per_corner + 1):
            a = a0 + (math.pi / 2) * i / steps_per_corner
            pts.append((cx + radius * math.cos(a), cz + radius * math.sin(a)))
    return pts


def mesh_from(name, verts, faces, material=None, face_materials=None, materials=()):
    """Build a mesh from web-space verts (x, y, z) and faces."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(kit.v(*p)) for p in verts], [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    for m in materials or ([material] if material else []):
        obj.data.materials.append(m)
    if face_materials:
        for poly, idx in zip(me.polygons, face_materials):
            poly.material_index = idx
    return obj


def ring(name, outer, inner, y, material):
    verts = [(x, y, z) for x, z in outer] + [(x, y, z) for x, z in inner]
    n = len(outer)
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return mesh_from(name, verts, faces, material)


def raised_strip(name, outer, inner, height, material, skip=None):
    """A curb-height strip between two matching outlines (sidewalk ring), optionally with gaps."""
    bm = bmesh.new()
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        mid = ((outer[i][0] + inner[j][0]) / 2, (outer[i][1] + inner[j][1]) / 2)
        if skip and skip(*mid):
            continue
        quad = [outer[i], outer[j], inner[j], inner[i]]
        bottom = [bm.verts.new(kit.v(x, 0.0, z)) for x, z in quad]
        top = [bm.verts.new(kit.v(x, height, z)) for x, z in quad]
        bm.faces.new(top)
        for k in range(4):
            bm.faces.new((bottom[k], bottom[(k + 1) % 4], top[(k + 1) % 4], top[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def pond_depth(p, x, z):
    n = math.hypot((x - p["center"][0]) / p["radiusX"], (z - p["center"][1]) / p["radiusZ"])
    shore_start = 1 - p["shore"] / min(p["radiusX"], p["radiusZ"])
    if n >= 1:
        return 0.0
    if n <= shore_start:
        return p["depth"]
    return p["depth"] * ((1 - n) / (1 - shore_start))


def ground(layout, m):
    """A fine grid around the pond (sculpted basin) surrounded by four large flat quads."""
    p = layout["POND"]
    half = layout["WORLD_HALF"] + 40
    x0, x1 = p["center"][0] - p["radiusX"] - 4, p["center"][0] + p["radiusX"] + 4
    z0, z1 = p["center"][1] - p["radiusZ"] - 4, p["center"][1] + p["radiusZ"] + 4
    step = 1.0
    nx, nz = int(round((x1 - x0) / step)), int(round((z1 - z0) / step))
    verts, faces, mats = [], [], []
    for j in range(nz + 1):
        for i in range(nx + 1):
            x, z = x0 + i * (x1 - x0) / nx, z0 + j * (z1 - z0) / nz
            verts.append((x, -pond_depth(p, x, z), z))
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + nx + 1, a + nx + 2, a + 1))
            cx, cz = x0 + (i + 0.5) * (x1 - x0) / nx, z0 + (j + 0.5) * (z1 - z0) / nz
            mats.append(1 if pond_depth(p, cx, cz) > 0.02 else 0)
    # Frame of flat quads around the pond grid.
    base = len(verts)
    frame = [(-half, -half), (half, -half), (half, half), (-half, half), (x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    verts += [(x, 0.0, z) for x, z in frame]
    o, q = base, base + 4
    for a, b in ((0, 1), (1, 2), (2, 3), (3, 0)):
        faces.append((o + a, q + a, q + b, o + b))
        mats.append(0)
    obj = mesh_from("collider_mesh_ground", verts, faces, face_materials=mats, materials=(m["grass"], m["pond_bed"]))
    kit.smooth(obj, 30)
    return obj


def build(layout):
    rnd = random.Random(7)
    roads = layout["ROADS"]
    loop = roads["loop"]
    w = roads["width"]
    m = {
        "grass": kit.mat("grass", "#6f9a4f", roughness=0.95),
        "pond_bed": kit.mat("pond_bed", "#8a7b5c", roughness=0.9),
        "asphalt": kit.mat("asphalt", "#3a3d44", roughness=0.92),
        "sidewalk": kit.mat("sidewalk", "#cfc8bb", roughness=0.9),
        "plaza": kit.mat("plaza", "#e2d6c0", roughness=0.85),
        "paint": kit.mat("road_paint", "#f2efe6", roughness=0.6),
        "paint_y": kit.mat("road_paint_yellow", "#e9b84a", roughness=0.6),
        "bark": kit.mat("bark", "#6b4f3a", roughness=0.95),
        "leaf_a": kit.mat("leaf_a", "#4f7d3c", roughness=0.9),
        "leaf_b": kit.mat("leaf_b", "#6f9a45", roughness=0.9),
        "leaf_c": kit.mat("leaf_c", "#8aa84f", roughness=0.9),
        "hedge": kit.mat("hedge", "#3f6b36", roughness=0.95),
        "rock": kit.mat("rock", "#9b958a", roughness=0.95),
        "wood": kit.mat("wood_deck", "#a0754d", roughness=0.8),
        "metal": kit.mat("lamp_metal", "#2f343c", roughness=0.45, metallic=0.7),
        "lamp": kit.mat("street_lamp", "#fff4dc", roughness=0.3, emission="#ffd59a", strength=0.05),
        "flower_a": kit.mat("flower_a", "#e86f7f", roughness=0.8),
        "flower_b": kit.mat("flower_b", "#f2c94c", roughness=0.8),
        "lily": kit.mat("lily", "#5c8f4a", roughness=0.8),
        "reed": kit.mat("reed", "#7a8f4a", roughness=0.9),
    }

    ground(layout, m)

    # Roads: the loop (ring) and the cross street, slightly above the ground.
    outer = rounded_rect(loop["halfX"] + w / 2, loop["halfZ"] + w / 2, loop["cornerRadius"] + w / 2)
    inner = rounded_rect(loop["halfX"] - w / 2, loop["halfZ"] - w / 2, loop["cornerRadius"] - w / 2)
    road_parts = [ring("road_loop", outer, inner, 0.02, m["asphalt"])]
    road_parts.append(kit.box("road_cross", w, 0.02, 2 * (loop["halfZ"] - w / 2) + 0.4, 0, 0.0, 0, m["asphalt"]))
    kit.join(road_parts, "roads")

    # Sidewalks: outer and inner rings plus both sides of the cross street, with curbs.
    sw, curb = roads["sidewalk"], roads["curbHeight"]
    s_out = rounded_rect(loop["halfX"] + w / 2 + sw, loop["halfZ"] + w / 2 + sw, loop["cornerRadius"] + w / 2 + sw)
    s_in = rounded_rect(loop["halfX"] - w / 2 - sw, loop["halfZ"] - w / 2 - sw, max(1.0, loop["cornerRadius"] - w / 2 - sw))
    walks = [
        raised_strip("walk_outer", s_out, outer, curb, m["sidewalk"]),
        raised_strip("walk_inner", inner, s_in, curb, m["sidewalk"], skip=lambda x, z: abs(x) < w / 2 + 0.01),
    ]
    span = loop["halfZ"] - w / 2 - sw
    for side in (-1, 1):
        walks.append(kit.box(f"walk_cross{side}", sw, curb, 2 * span, side * (w / 2 + sw / 2), 0, 0, m["sidewalk"], bevel=0.04))
    kit.join(walks, "sidewalks")

    # Paved plazas: tower forecourt, south-east prop plaza, kiosk promenade, billboard lawn path.
    tower = layout["TOWER"]
    plazas = [
        kit.box(f"plaza_{p['name']}", p["size"][0], 0.05, p["size"][1], p["center"][0], curb if p["name"] != "kiosks" else 0.0, p["center"][1], m["plaza"])
        for p in layout["PLAZAS"]
    ]
    kit.join(plazas, "plazas")

    # Markings: dashed centre line around the loop and down the cross street, edge lines, crosswalks.
    marks, yellow = [], []
    center = rounded_rect(loop["halfX"], loop["halfZ"], loop["cornerRadius"], steps_per_corner=12)
    n = len(center)
    for i in range(n):
        a, b = center[i], center[(i + 1) % n]
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        steps = max(1, int(seg // 4))
        for k in range(steps):
            if k % 2:
                continue
            t0, t1 = k / steps, min(1, (k + 0.6) / steps)
            p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            mx, mz = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
            if abs(mx) < w / 2 + 1 and abs(abs(mz) - loop["halfZ"]) < 1:
                continue  # leave the junctions clear
            length = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
            yellow.append(kit.box(f"dash{i}_{k}", 0.16, 0.012, length, mx, 0.03, mz, None, rot=-math.atan2(p1[0] - p0[0], p1[1] - p0[1])))
    for zz in range(-44, 46, 6):
        if abs(zz) < 2:
            continue
        marks.append(kit.box(f"cross_dash{zz}", 0.16, 0.012, 2.6, 0, 0.03, zz, None))
    for side in (-1, 1):
        zj = side * (loop["halfZ"] - w / 2 - 0.9)
        for k in range(-4, 5):
            marks.append(kit.box(f"zebra{side}_{k}", 0.6, 0.012, 2.2, k * 1.05, 0.03, zj - side * 1.4, None))
    for o in yellow:
        o.data.materials.append(m["paint_y"])
    for o in marks:
        o.data.materials.append(m["paint"])
    kit.join(yellow, "markings_yellow")
    kit.join(marks, "markings_white")

    # Trees: trunk plus clustered soft canopies in three greens.
    trunks, canopies = [], {"leaf_a": [], "leaf_b": [], "leaf_c": []}
    for idx, t in enumerate(layout["TREES"]):
        x, _, z = t["position"]
        s = t["scale"]
        trunks.append(kit.cylinder(f"trunk{idx}", 0.22 * s, 3.2 * s, x, 0, z, None, vertices=8, top_radius=0.14 * s))
        key = ("leaf_a", "leaf_b", "leaf_c")[t["variant"]]
        for c in range(3):
            ox, oz = rnd.uniform(-0.8, 0.8) * s, rnd.uniform(-0.8, 0.8) * s
            r = rnd.uniform(1.3, 1.8) * s
            canopies[key].append(kit.ico(f"canopy{idx}_{c}", r, x + ox, (3.6 + c * 0.7) * s, z + oz, None, subdivisions=2, scale=(1, 0.85, 1)))
    for o in trunks:
        o.data.materials.append(m["bark"])
    kit.join(trunks, "tree_trunks")
    for key, objs in canopies.items():
        for o in objs:
            o.data.materials.append(m[key])
        if objs:
            kit.join(objs, f"tree_{key}")

    # Streetlights: pole, curved arm, glowing head.
    lamp_parts, heads = [], []
    for idx, lamp in enumerate(layout["LAMPS"]):
        x, _, z = lamp["position"]
        r = lamp["rotationY"]
        fx, fz = -math.sin(r), -math.cos(r)
        lamp_parts.append(kit.cylinder(f"pole{idx}", 0.12, 6.4, x, 0, z, None, vertices=10, top_radius=0.08))
        lamp_parts.append(kit.cylinder(f"pole_base{idx}", 0.22, 0.5, x, 0, z, None, vertices=10, bevel=0.04))
        arm = kit.box(f"arm{idx}", 0.1, 0.1, 1.6, x + fx * 0.75, 6.25, z + fz * 0.75, None, rot=r)
        lamp_parts.append(arm)
        heads.append(kit.box(f"lamp{idx}", 0.5, 0.2, 0.8, x + fx * 1.55, 6.0, z + fz * 1.55, None, bevel=0.06, rot=r))
    for o in lamp_parts:
        o.data.materials.append(m["metal"])
    for o in heads:
        o.data.materials.append(m["lamp"])
    kit.join(lamp_parts, "lamp_posts")
    kit.join(heads, "lamp_heads")

    # Landscaping: hedges along the forecourt, flower beds in the park, pond rocks, reeds, lilies, dock.
    hedges = []
    fc_x = tower["center"][0] - tower["halfSize"] - 8
    for side in (-1, 1):
        hedges.append(kit.box(f"hedge{side}", 14, 0.9, 1.2, fc_x, curb, tower["center"][1] + side * 12.5, None, bevel=0.35))
    for o in hedges:
        o.data.materials.append(m["hedge"])
    kit.join(hedges, "hedges")

    flowers = {"flower_a": [], "flower_b": []}
    for bed, (bx, bz) in enumerate([(-55, 30), (-22, 30), (-55, -35)]):
        for k in range(26):
            key = "flower_a" if k % 2 else "flower_b"
            flowers[key].append(kit.ico(f"flower{bed}_{k}", 0.25, bx + rnd.uniform(-3, 3), 0.25, bz + rnd.uniform(-1.5, 1.5), None, subdivisions=1))
    for key, objs in flowers.items():
        for o in objs:
            o.data.materials.append(m[key])
        kit.join(objs, f"beds_{key}")

    p = layout["POND"]
    rocks, reeds, lilies = [], [], []
    for k in range(34):
        a = k / 34 * math.pi * 2 + rnd.uniform(-0.05, 0.05)
        rr = 1.04 + rnd.uniform(0, 0.08)
        x, z = p["center"][0] + math.cos(a) * p["radiusX"] * rr, p["center"][1] + math.sin(a) * p["radiusZ"] * rr
        if 0.9 < a < 2.2:
            continue  # leave the north-west shore open so the car can drive in
        rocks.append(kit.ico(f"rock{k}", rnd.uniform(0.35, 0.8), x, 0.1, z, None, subdivisions=1, scale=(1, 0.6, 1), smooth_angle=20))
    for k in range(40):
        a = rnd.uniform(3.4, 5.6)
        rr = rnd.uniform(0.82, 0.97)
        x, z = p["center"][0] + math.cos(a) * p["radiusX"] * rr, p["center"][1] + math.sin(a) * p["radiusZ"] * rr
        reeds.append(kit.cylinder(f"reed{k}", 0.04, rnd.uniform(0.8, 1.5), x, -0.35, z, None, vertices=5, top_radius=0.005))
    for k in range(14):
        x = p["center"][0] + rnd.uniform(-0.6, 0.6) * p["radiusX"]
        z = p["center"][1] + rnd.uniform(-0.55, 0.55) * p["radiusZ"]
        lilies.append(kit.cylinder(f"lily{k}", rnd.uniform(0.3, 0.55), 0.02, x, -0.07, z, None, vertices=12))
    for objs, key, name in ((rocks, "rock", "pond_rocks"), (reeds, "reed", "pond_reeds"), (lilies, "lily", "pond_lilies")):
        for o in objs:
            o.data.materials.append(m[key])
        kit.join(objs, name)
    dock = [kit.box("dock", 2.4, 0.15, 6, p["center"][0] + p["radiusX"] - 1.5, 0.25, p["center"][1] + 3, m["wood"], bevel=0.03)]
    for dz in (-2.5, 2.5):
        dock.append(kit.cylinder(f"dock_post{dz}", 0.12, 1.2, p["center"][0] + p["radiusX"] - 2.6, -0.8, p["center"][1] + 3 + dz, m["wood"], vertices=8))
    kit.join(dock, "dock")
