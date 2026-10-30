"""Reproducible head/neck captures; never saves the authoring file.

PIGEON_REVIEW_BLEND and PIGEON_REVIEW_MANIFEST may point to a pinned earlier
revision. PIGEON_REVIEW_OUTPUT sets an explicit capture directory, allowing a
before/after pair to use exactly the same cameras and neutral clay override.
Set PIGEON_REVIEW_SURFACE=color to inspect the recorded native materials.
PIGEON_REVIEW_HIDE_PLUMAGE=1 isolates the unchanged anatomy surface, and
PIGEON_REVIEW_SAMPLES may lower the sample count for a recorded preview.
"""
import array
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import sys

sys.dont_write_bytecode = True
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
HEAD_VIEWS = [("front", 0), ("left45", 45), ("left", 90)]
HEAD_NECK_VIEWS = HEAD_VIEWS + [("back-left45", 135)]


def resolved_path(value):
    path = Path(value)
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def geometry_hash(objects):
    """Hash actual mesh positions/topology and transforms, excluding materials."""
    digest = hashlib.sha256()
    for obj in sorted(objects, key=lambda item: item.name):
        digest.update(obj.name.encode("utf8") + b"\0")
        digest.update(struct.pack("<16f", *(value for row in obj.matrix_world for value in row)))
        values = array.array("f", [0.0]) * (len(obj.data.vertices) * 3)
        obj.data.vertices.foreach_get("co", values)
        digest.update(values.tobytes())
        indices = array.array("i", [0]) * len(obj.data.loops)
        obj.data.loops.foreach_get("vertex_index", indices)
        digest.update(indices.tobytes())
        sizes = array.array("i", [0]) * len(obj.data.polygons)
        obj.data.polygons.foreach_get("loop_total", sizes)
        digest.update(sizes.tobytes())
    return digest.hexdigest()


def lighting_record(scene):
    lights = []
    for obj in sorted(scene.objects, key=lambda item: item.name):
        if obj.type == "LIGHT":
            lights.append({
                "name": obj.name, "type": obj.data.type,
                "energy": obj.data.energy, "color": list(obj.data.color),
                "size": getattr(obj.data, "size", None),
                "matrix_world": [list(row) for row in obj.matrix_world],
            })
    background = scene.world.node_tree.nodes.get("Background") if scene.world and scene.world.use_nodes else None
    return {"lights": lights,
            "world_background": list(background.inputs["Color"].default_value) if background else None,
            "world_strength": background.inputs["Strength"].default_value if background else None,
            "view_transform": scene.view_settings.view_transform,
            "exposure": scene.view_settings.exposure,
            "gamma": scene.view_settings.gamma}


def apply_clay_override(objects):
    materials = {}
    for name, color in [("plumage", (.26, .27, .28)),
                        ("eye", (.16, .16, .16)), ("pupil", (.012, .012, .012))]:
        material = bpy.data.materials.new("Review_only_neutral_" + name)
        material.use_nodes = True
        material.diffuse_color = (*color, 1)
        material.use_backface_culling = False
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (*color, 1)
        shader.inputs["Roughness"].default_value = .8
        materials[name] = material
    for obj in objects:
        key = "pupil" if obj.name.startswith("Pupil_") else "eye" if obj.name.startswith("Eye_globe_") else "plumage"
        obj.data.materials.clear()
        obj.data.materials.append(materials[key])
        for polygon in obj.data.polygons:
            polygon.material_index = 0


def source_commit(source):
    provided = os.environ.get("PIGEON_REVIEW_SOURCE_COMMIT")
    if provided:
        return provided
    if source != ROOT / "art/pigeon/pigeon.blend":
        return None
    status = subprocess.run(["git", "status", "--porcelain", "--", "art/pigeon/pigeon.blend"],
                            cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()
    if status:
        return None
    return subprocess.run(["git", "log", "-1", "--format=%H", "--", "art/pigeon/pigeon.blend"],
                          cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip() or None


def render_review(kind="head"):
    source = resolved_path(os.environ.get("PIGEON_REVIEW_BLEND", "art/pigeon/pigeon.blend"))
    manifest_path = resolved_path(os.environ.get("PIGEON_REVIEW_MANIFEST", "src/assets/pigeon/manifest.json"))
    manifest = json.loads(manifest_path.read_text())
    source_hash = file_hash(source)
    assert source_hash == manifest["blend_sha256"], "Review source does not match its manifest"
    surface = os.environ.get("PIGEON_REVIEW_SURFACE", "clay")
    if surface not in {"clay", "color"}:
        raise ValueError("PIGEON_REVIEW_SURFACE must be clay or color")
    hide_plumage = os.environ.get("PIGEON_REVIEW_HIDE_PLUMAGE") == "1"
    output_kind = kind + "-anatomy" if hide_plumage else kind
    out = resolved_path(os.environ.get("PIGEON_REVIEW_OUTPUT",
                        str(Path("docs/pigeon/reviews") / manifest["revision"] / output_kind)))
    out.mkdir(parents=True, exist_ok=True)
    commit = source_commit(source)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    collection = bpy.data.collections.get("Pigeon_Anatomy")
    if collection is None:
        raise RuntimeError("Pigeon_Anatomy collection missing from review source")
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    before_geometry = geometry_hash(meshes)
    lights = lighting_record(scene)
    source_samples = scene.cycles.samples
    if "PIGEON_REVIEW_SAMPLES" in os.environ:
        samples = int(os.environ["PIGEON_REVIEW_SAMPLES"])
        if samples < 1:
            raise ValueError("PIGEON_REVIEW_SAMPLES must be positive")
        scene.cycles.samples = samples
    hidden_plumage = []
    if hide_plumage:
        for obj in meshes:
            if obj.name.startswith("Plumage_"):
                obj.hide_render = True
                hidden_plumage.append(obj.name)
    if surface == "clay":
        apply_clay_override(meshes)
    camera = scene.camera
    if kind == "head":
        center, scale, views = Vector((0, -.18, .855)), .49, HEAD_VIEWS
        sheet_name = "head-three-views.png"
    elif kind == "head-neck":
        center, scale, views = Vector((0, -.12, .74)), .66, HEAD_NECK_VIEWS
        sheet_name = "head-neck-four-views.png"
    else:
        raise ValueError("Unknown review framing: " + kind)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = scale
    scene.render.resolution_x = 600
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    records = []
    for name, degrees in views:
        a = math.radians(degrees)
        camera.location = center + Vector((3.4 * math.sin(a), -3.4 * math.cos(a), 0))
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        filename = kind + "-" + name + ".png"
        scene.render.filepath = str(out / filename)
        bpy.ops.render.render(write_still=True)
        records.append({"view": name, "azimuth": degrees, "position": list(camera.location),
                        "target": list(center), "orthographic_scale": scale, "file": filename})
    after_geometry = geometry_hash(meshes)
    assert before_geometry == after_geometry, "Review changed authoring mesh geometry"
    assert lighting_record(scene) == lights, "Review changed source lighting"
    assert file_hash(source) == source_hash, "Review changed the authoring file"
    changes = ["camera framing"]
    if surface == "clay":
        changes.append("render-only neutral clay material override")
    if hide_plumage:
        changes.append("Plumage_* objects hidden for anatomy review")
    record = {"source_model_commit": commit, "revision": manifest["revision"],
              "glb_sha256": manifest["glb_sha256"], "blend_sha256": source_hash,
              "authoring_source": str(source), "manifest_source": str(manifest_path),
              "source": "authoring file, mesh positions/topology and lighting unchanged; " + "; ".join(changes),
              "surface": surface, "framing": kind,
              "anatomy_surface_only": hide_plumage,
              "hidden_plumage_objects": sorted(hidden_plumage),
              "geometry_sha256_before": before_geometry, "geometry_sha256_after": after_geometry,
              "lighting_unchanged": True, "lighting": lights,
              "render": {"engine": scene.render.engine, "samples": scene.cycles.samples,
                         "source_samples": source_samples,
                         "resolution": [600, 600], "color_mode": scene.render.image_settings.color_mode},
              "reference": "conversation R01 reference sheet; visual comparison only", "views": records}
    (out / "capture-record.json").write_text(json.dumps(record, indent=2) + "\n")
    from PIL import Image, ImageDraw
    sheet = Image.new("RGB", (400 * len(views), 432), "#efeeea")
    draw = ImageDraw.Draw(sheet)
    for index, (name, _) in enumerate(views):
        picture = Image.open(out / (kind + "-" + name + ".png")).resize((400, 400))
        sheet.paste(picture, (400 * index, 0))
        label = manifest["revision"] + " | " + surface + (" anatomy" if hide_plumage else "") + " | " + name
        draw.text((400 * index + 12, 410), label, fill="#252525")
    sheet.save(out / sheet_name)
    print("PIGEON_REVIEW_RECORD " + json.dumps({"revision": manifest["revision"], "framing": kind,
          "surface": surface, "anatomy_surface_only": hide_plumage,
          "views": len(views), "output": str(out), "blend_sha256": source_hash}), flush=True)


if __name__ == "__main__":
    render_review("head")
