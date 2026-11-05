"""The visitor's character: a chibi Apu (U3 of the walking character plan), about 1.47 m tall with a big head,
a short body and chunky limbs. A default look until Apu's own is captured: short dark hair, warm brown skin, a
teal jacket over a cream tee, jeans and white sneakers.

Runtime contract:
- `character` stands on the origin and faces local -Z (the runtime turns it to where it walks).
- Its joints are empty nodes the runtime turns about local X to swing them: `character_head` (origin at the neck),
  `character_arm_l` / `character_arm_r` (origin at each shoulder, arm hanging down) and `character_leg_l` /
  `character_leg_r` (origin at each hip). `_l` is the character's own left, local -X.
- Materials are plain colors named `char_*`; the runtime turns them into toon materials with an outline.
"""

import bmesh
import bpy

from lib import kit
from models.landmarks import _bake, _hang, _joint

NECK_Y = 0.86
SHOULDER = (0.25, 0.8)  # (x, y)
HIP = (0.1, 0.44)
HEAD_Y = 1.13  # head centre
HEAD_R = 0.31


def _keep(obj, keep):
    """Delete the vertices of `obj` whose web position (x, y, z) fails `keep`, cutting an open shell."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    world = obj.matrix_world
    doomed = []
    for vert in bm.verts:
        p = world @ vert.co
        if not keep(p.x, p.z, -p.y):
            doomed.append(vert)
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def _solidify(obj, thickness):
    mod = obj.modifiers.new("solidify", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 1.0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def build(layout):
    skin = kit.mat("char_skin", "#a8714b", roughness=0.7)
    hair = kit.mat("char_hair", "#1e1916", roughness=0.6)
    jacket = kit.mat("char_jacket", "#2f6e73", roughness=0.65)
    tee = kit.mat("char_tee", "#f1ead9", roughness=0.75)
    jeans = kit.mat("char_jeans", "#34497a", roughness=0.8)
    shoe = kit.mat("char_shoe", "#f4f0e8", roughness=0.6)
    sole = kit.mat("char_sole", "#c8553a", roughness=0.7)
    eye = kit.mat("char_eye", "#1a1411", roughness=0.3)
    shine = kit.mat("char_eye_shine", "#ffffff", roughness=0.2)

    root = kit.group("character")

    # Torso: an open jacket over a tee, with a belt line of jeans below.
    sx, sy = SHOULDER
    body = [
        kit.box("hips", 0.4, 0.12, 0.26, 0, 0.38, 0, jeans, bevel=0.05),
        kit.box("jacket", 0.46, 0.38, 0.3, 0, 0.46, 0, jacket, bevel=0.1, segments=4),
        kit.box("tee", 0.14, 0.34, 0.04, 0, 0.47, -0.145, tee, bevel=0.02),
        kit.box("collar_l", 0.1, 0.06, 0.06, -0.09, 0.8, -0.12, jacket, bevel=0.025),
        kit.box("collar_r", 0.1, 0.06, 0.06, 0.09, 0.8, -0.12, jacket, bevel=0.025),
        kit.cylinder("neck", 0.07, 0.1, 0, 0.8, 0, skin, vertices=16),
    ]
    _hang(_bake(body, "character_body"), root)

    # Head: a big round face, a hair shell cut back from the forehead and ears, fringe tufts, eyes and brows.
    neck = (0.0, NECK_Y, 0.0)
    face = kit.sphere("face", HEAD_R, 0, HEAD_Y, 0, skin, segments=28, rings=18, scale=(1, 0.95, 0.95))
    shell = kit.sphere("hair_shell", HEAD_R + 0.025, 0, HEAD_Y + 0.03, 0.01, hair, segments=28, rings=18, scale=(1.02, 0.97, 1.0))
    # Keep the crown and the back of the head; open the face and the ears.
    _keep(shell, lambda x, y, z: y > HEAD_Y + 0.1 - 0.5 * (z + 0.05) + 0.25 * max(0.0, abs(x) - 0.22))
    _solidify(shell, 0.02)
    head = [face, shell]
    for k, (fx, fy, size) in enumerate(((-0.17, 1.33, 0.11), (-0.05, 1.36, 0.12), (0.08, 1.35, 0.115), (0.19, 1.31, 0.1))):
        head.append(kit.ico(f"fringe{k}", size, fx, fy, -0.22, hair, subdivisions=2, scale=(1.1, 0.75, 0.8)))
    head.append(kit.ico("crown_tuft", 0.1, 0.03, 1.45, 0.04, hair, subdivisions=2, scale=(1.2, 0.6, 1.1)))
    for side in (-1, 1):
        x = side * 0.115
        head.append(kit.sphere(f"eye{side}", 0.055, x, 1.12, -0.268, eye, segments=16, rings=10, scale=(0.8, 1.25, 0.35)))
        head.append(kit.sphere(f"shine{side}", 0.017, x + 0.015, 1.145, -0.29, shine, segments=8, rings=6))
        head.append(kit.box(f"brow{side}", 0.09, 0.022, 0.03, x, 1.215, -0.262, hair, bevel=0.008))
        head.append(kit.sphere(f"ear{side}", 0.06, side * 0.305, 1.1, 0.01, skin, segments=12, rings=8, scale=(0.5, 1, 0.8)))
    head.append(kit.sphere("mouth", 0.028, 0, 1.0, -0.28, eye, segments=10, rings=6, scale=(1.4, 0.5, 0.4)))
    head_joint = _joint("character_head", root, neck)
    _hang(_bake(head, "character_head_mesh"), head_joint, neck)

    # Arms hang from the shoulders: a jacket sleeve, a cuff and a round hand.
    for side, tag in ((-1, "l"), (1, "r")):
        shoulder = (side * sx, sy, 0.0)
        x = side * (sx + 0.03)
        arm = [
            kit.sphere(f"shoulder{side}", 0.09, side * sx, sy - 0.02, 0, jacket, segments=14, rings=10),
            kit.cylinder(f"sleeve{side}", 0.075, 0.3, x, sy - 0.34, 0, jacket, vertices=14, top_radius=0.085),
            kit.cylinder(f"cuff{side}", 0.07, 0.04, x, sy - 0.37, 0, tee, vertices=14),
            kit.sphere(f"hand{side}", 0.07, x, sy - 0.42, 0, skin, segments=14, rings=10),
        ]
        arm_joint = _joint(f"character_arm_{tag}", root, shoulder)
        _hang(_bake(arm, f"character_arm_{tag}_mesh"), arm_joint, shoulder)

    # Legs from the hips: jeans, then a chunky sneaker with a coloured sole.
    hx, hy = HIP
    for side, tag in ((-1, "l"), (1, "r")):
        hip = (side * hx, hy, 0.0)
        x = side * hx
        leg = [
            kit.cylinder(f"leg{side}", 0.085, hy - 0.08, x, 0.08, 0, jeans, vertices=14),
            kit.box(f"shoe{side}", 0.15, 0.09, 0.25, x, 0.025, -0.03, shoe, bevel=0.04, segments=3),
            kit.box(f"sole{side}", 0.16, 0.03, 0.26, x, 0, -0.03, sole, bevel=0.012),
        ]
        leg_joint = _joint(f"character_leg_{tag}", root, hip)
        _hang(_bake(leg, f"character_leg_{tag}_mesh"), leg_joint, hip)
