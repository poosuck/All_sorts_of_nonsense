"""Fresh-scene compatibility probe. Optional upstream failures are reported explicitly."""
import bpy
import hashlib
import json
from pathlib import Path
import struct
import tempfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/pigeon/reviews/clay-v1"
OUT.mkdir(parents=True, exist_ok=True)
report = {"blender": bpy.app.version_string, "upstream_commit": "122fb547d8294cb35de49bef54e2af023279a9b5",
          "reference_image_file": "not present; chat reference only", "wing": {}, "core": {}}
def clean():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
def glb_json(path):
    raw = path.read_bytes()
    size, kind = struct.unpack_from("<II", raw, 12)
    assert kind == 0x4e4f534a
    return json.loads(raw[20:20+size])

with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    report["wing"] = {"status": "not executed: upstream targets Blender 5.2; adoption deferred", "reason": "This read-only job executes only the project's own export probe."}

    clean()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12)
    mesh = bpy.context.object
    mesh.name = "ExportProbeMesh"
    bpy.ops.object.armature_add()
    rig = bpy.context.object
    group = mesh.vertex_groups.new(name=rig.data.bones[0].name)
    group.add(list(range(len(mesh.data.vertices))), 1.0, "REPLACE")
    modifier = mesh.modifiers.new("ProbeSkin", "ARMATURE")
    modifier.object = rig
    mesh.parent = rig
    bone = rig.pose.bones[0]
    bone.rotation_mode = "XYZ"
    for frame, angle in [(1, 0.0), (10, 0.4)]:
        bone.rotation_euler.x = angle
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    bpy.context.scene.frame_set(1)
    destination = td / "probe.glb"
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format="GLB")
    exported = glb_json(destination)
    assert exported.get("meshes") and exported.get("skins") and exported.get("animations")
    clean()
    bpy.ops.import_scene.gltf(filepath=str(destination))
    assert any(o.type == "MESH" for o in bpy.context.scene.objects)
    assert any(o.type == "ARMATURE" for o in bpy.context.scene.objects)
    report["core"] = {"mesh_skin_animation_export": True, "reimport": True, "status": "passed"}
(OUT / "tools.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print("PIGEON_TOOL_REPORT", json.dumps(report, ensure_ascii=False))
assert report["core"]["status"] == "passed"
