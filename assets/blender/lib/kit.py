"""Shared modeling kit for the Career District assets (Blender 4.2+ / 5.x, run headless).

Every helper takes positions and sizes in the *web* convention used by the TypeScript layout:
three.js / glTF axes, Y up, +X east, +Z south, meters. The kit converts to Blender's Z-up space,
and the glTF exporter (export_yup=True) converts back, so numbers read the same on both sides.
"""

import math

import bmesh
import bpy
from mathutils import Euler, Vector

# ---------- coordinates ----------


def v(x, y, z):
    """Web (x, y-up, z-south) -> Blender (x, y-north, z-up)."""
    return Vector((x, -z, y))


def size(sx, sy, sz):
    """Web extents (width x, height y, depth z) -> Blender extents."""
    return Vector((sx, sz, sy))


def yaw(radians):
    """Rotation about the web Y axis (heading) as a Blender Euler about Z."""
    return Euler((0.0, 0.0, radians), "XYZ")


# ---------- scene ----------


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects, bpy.data.curves):
        for item in list(block):
            block.remove(item)


_materials = {}


def mat(name, color, roughness=0.55, metallic=0.0, emission=None, strength=1.0, clearcoat=0.0, alpha=1.0, ior=1.45):
    """Principled material that exports cleanly to glTF (base color, PBR, emission, clearcoat)."""
    key = name
    if key in _materials and _materials[key].name in bpy.data.materials:
        return _materials[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    rgba = (*_srgb_to_linear(color), 1.0)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["IOR"].default_value = ior
    if clearcoat:
        _set_input(bsdf, ("Coat Weight", "Clearcoat"), clearcoat)
        _set_input(bsdf, ("Coat Roughness", "Clearcoat Roughness"), 0.05)
    if emission:
        _set_input(bsdf, ("Emission Color", "Emission"), (*_srgb_to_linear(emission), 1.0))
        _set_input(bsdf, ("Emission Strength",), strength)
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else m.blend_method
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "BLENDED"
    _materials[key] = m
    return m


def _set_input(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return


def _srgb_to_linear(hex_color):
    h = hex_color.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# ---------- primitives (all positions/sizes in web convention) ----------


def _finish(obj, material, bevel=0.0, segments=3, smooth_angle=35):
    if material is not None:
        obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.harden_normals = False
        _apply(obj, mod)
    smooth(obj, smooth_angle)
    return obj


def _apply(obj, mod):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def smooth(obj, angle=35):
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()


def box(name, sx, sy, sz, x=0.0, y=0.0, z=0.0, material=None, bevel=0.0, segments=3, rot=0.0, origin_bottom=True):
    """Box of web extents (sx, sy, sz). By default (x, y, z) is the center of its bottom face."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size(sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    obj.location = v(x, y + (sy / 2 if origin_bottom else 0), z)
    obj.rotation_euler = yaw(rot)
    return _finish(obj, material, bevel, segments)


def cylinder(name, radius, height, x=0.0, y=0.0, z=0.0, material=None, vertices=32, bevel=0.0, top_radius=None, axis="y", rot=0.0):
    """Cylinder standing on (x, y, z) along web Y (or lying along web X/Z)."""
    if top_radius is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=height, vertices=vertices)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=radius, radius2=top_radius, depth=height, vertices=vertices)
    obj = bpy.context.active_object
    obj.name = name
    if axis == "y":
        obj.location = v(x, y + height / 2, z)
        obj.rotation_euler = yaw(rot)
    elif axis == "x":
        obj.rotation_euler = Euler((0, math.pi / 2, rot), "XYZ")
        obj.location = v(x, y, z)
    else:  # web z
        obj.rotation_euler = Euler((math.pi / 2, 0, rot), "XYZ")
        obj.location = v(x, y, z)
    return _finish(obj, material, bevel)


def sphere(name, radius, x=0.0, y=0.0, z=0.0, material=None, segments=24, rings=16, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=segments, ring_count=rings)
    obj = bpy.context.active_object
    obj.name = name
    obj.location = v(x, y, z)
    obj.scale = size(*scale)
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, material, smooth_angle=80)


def ico(name, radius, x=0.0, y=0.0, z=0.0, material=None, subdivisions=2, scale=(1, 1, 1), smooth_angle=60):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=radius, subdivisions=subdivisions)
    obj = bpy.context.active_object
    obj.name = name
    obj.location = v(x, y, z)
    obj.scale = size(*scale)
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, material, smooth_angle=smooth_angle)


def torus(name, major, minor, x=0.0, y=0.0, z=0.0, material=None, axis="y", major_segments=48, minor_segments=12):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=major_segments, minor_segments=minor_segments)
    obj = bpy.context.active_object
    obj.name = name
    obj.location = v(x, y, z)
    if axis == "x":
        obj.rotation_euler = Euler((0, math.pi / 2, 0), "XYZ")
    elif axis == "z":
        obj.rotation_euler = Euler((math.pi / 2, 0, 0), "XYZ")
    return _finish(obj, material, smooth_angle=80)


def profile_extrude(name, points, depth, material=None, bevel=0.0, axis="x", center=(0.0, 0.0, 0.0), segments=4):
    """Extrude a closed 2D profile. With axis="x", points are (z_forward, y_up) in web space — a side profile
    extruded across width `depth` along web X. With axis="y", points are (x, z) — a footprint extruded up."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    if axis == "x":
        verts = [bm.verts.new(v(-depth / 2, py, pz)) for pz, py in points]
        extrude_dir = v(depth, 0, 0)
    else:
        verts = [bm.verts.new(v(px, 0, pz)) for px, pz in points]
        extrude_dir = v(0, depth, 0)
    face = bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=[face])
    result = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [e for e in result["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=extrude_dir, verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = v(*center)
    bpy.context.view_layer.objects.active = obj
    return _finish(obj, material, bevel, segments)


def empty(name, x=0.0, y=0.0, z=0.0, rot=0.0):
    """Named marker node (e.g. light_head_L, zone_experience) that the runtime looks up by name."""
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = v(x, y, z)
    obj.rotation_euler = yaw(rot)
    return obj


def join(objects, name):
    """Merge meshes (keeping their materials) into one object to save draw calls."""
    objects = [o for o in objects if o is not None]
    if len(objects) == 1:
        objects[0].name = name
        return objects[0]
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def parent(child, parent_obj, keep_transform=True):
    child.parent = parent_obj
    if keep_transform:
        child.matrix_parent_inverse = parent_obj.matrix_world.inverted()
    return child


def group(name, x=0.0, y=0.0, z=0.0, rot=0.0):
    """Empty used as a transform parent (wheels, letters, kiosks)."""
    return empty(name, x, y, z, rot)


def export(path):
    """Write the whole scene to a binary glTF with modifiers applied and Y-up axes."""
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_lights=False,
        use_selection=False,
    )
