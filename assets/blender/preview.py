"""Render a quick three-quarter preview of a built model (development aid).

    blender --background --python assets/blender/preview.py -- <model.glb> <out.png> [distance] [height] [target_y] [target_x] [target_z] [azimuth_deg]
"""

import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
glb, out = argv[0], argv[1]
distance = float(argv[2]) if len(argv) > 2 else 8.0
height = float(argv[3]) if len(argv) > 3 else 3.0
target_y = float(argv[4]) if len(argv) > 4 else 0.6
# Target given in web coordinates (x east, z south); Blender Y = -web Z.
target_x = float(argv[5]) if len(argv) > 5 else 0.0
target_z = float(argv[6]) if len(argv) > 6 else 0.0
azimuth = math.radians(float(argv[7])) if len(argv) > 7 else math.radians(135)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)

scene = bpy.context.scene
for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
scene.render.resolution_x = 960
scene.render.resolution_y = 640
scene.render.film_transparent = False

world = bpy.data.worlds.new("preview")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.75, 0.82, 0.9, 1)
bg.inputs[1].default_value = 0.9
scene.world = world

sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
scene.collection.objects.link(sun)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
# Blender Z-up: three-quarter front-left view of a model whose nose points to Blender +Y (web -Z).
target = Vector((target_x, -target_z, target_y))
cam.location = target + Vector((math.cos(azimuth) * distance, math.sin(azimuth) * distance, height - target_y))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print(f"[preview] wrote {out}")
