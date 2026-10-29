"""New R01 clay anatomy. Run with Blender; no previous pigeon renderer/assets are used."""
import base64
import bpy
import bmesh
import hashlib
import json
import math
import os
from mathutils import Vector
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
CFG = json.loads((ROOT / "art/pigeon/profiles.json").read_text())
ART = ROOT / "art/pigeon"
ASSETS = ROOT / "src/assets/pigeon"
REVIEW = ROOT / "docs/pigeon/reviews/clay-v1"
for path in [ART, ASSETS, REVIEW]:
    path.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.name = "R01 anatomy study"
bird = bpy.data.collections.new("Pigeon_Anatomy")
scene.collection.children.link(bird)
model = bpy.data.objects.new("Pigeon_R01_Clay_v1", None)
bird.objects.link(model)
model["revision"] = CFG["revision"]
model["stage"] = "anatomy blockout"
model["source"] = "original continuous profile loft authored for R01"
def move_to_bird(obj):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    bird.objects.link(obj)
    obj.parent = model
    return obj
def material(name, color, roughness=0.78):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    return mat
clay = material("Clay plumage - anatomy only", (0.46,0.47,0.48))
foot_mat = material("Clay feet", (0.46,0.44,0.42))
beak_mat = material("Clay beak", (0.32,0.31,0.30))
cere_mat = material("Clay cere", (0.76,0.74,0.71))
eye_mat = material("Clay eye landmark", (0.25,0.24,0.22),0.40)
pupil_mat = material("Pupil landmark", (0.018,0.018,0.018),0.30)
def mesh_object(name, vertices, faces, mat=clay):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bird.objects.link(obj)
    obj.parent = model
    data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = True
    return obj
def smooth_values(points, at):
    # C1 shape-preserving Hermite interpolation along the height of the bird.
    xs = [p[0] for p in points]
    if at <= xs[0]: return points[0][1:]
    if at >= xs[-1]: return points[-1][1:]
    i = next(i for i in range(len(xs)-1) if xs[i] <= at <= xs[i+1])
    h = xs[i+1]-xs[i]
    t = (at-xs[i])/h
    out = []
    for col in range(1,len(points[0])):
        secants = [(points[k+1][col]-points[k][col])/(xs[k+1]-xs[k]) for k in range(len(xs)-1)]
        def tangent(k):
            if k == 0: return secants[0]
            if k == len(xs)-1: return secants[-1]
            a,b = secants[k-1],secants[k]
            if a*b <= 0: return 0.0
            hp,hn = xs[k]-xs[k-1],xs[k+1]-xs[k]
            w1,w2 = 2*hn+hp,hn+2*hp
            return (w1+w2)/(w1/a+w2/b)
        a,b = points[i][col],points[i+1][col]
        out.append((2*t**3-3*t**2+1)*a+(t**3-2*t**2+t)*h*tangent(i)+(-2*t**3+3*t**2)*b+(t**3-t**2)*h*tangent(i+1))
    return out
sections = CFG["bodySections"]
verts,faces = [],[]
rows,segments = 90,64
for j in range(rows):
    z = sections[0][0]+(sections[-1][0]-sections[0][0])*j/(rows-1)
    rx,front,back = smooth_values(sections,z)
    for i in range(segments):
        theta = 2*math.pi*i/segments
        verts.append((rx*math.sin(theta),(front+back)/2-(back-front)/2*math.cos(theta),z))
for j in range(rows-1):
    for i in range(segments):
        ni = (i+1)%segments
        faces.append((j*segments+i,j*segments+ni,(j+1)*segments+ni,(j+1)*segments+i))
faces.extend([tuple(reversed(range(segments))),tuple((rows-1)*segments+i for i in range(segments))])
body = mesh_object("Body_neck_head_continuous",verts,faces)
body["construction"] = "height sections + shape-preserving loft; editable parameters in profiles.json"
def body_side(y,z):
    rx,front,back = smooth_values(sections,max(sections[0][0],min(z,1)))
    ry = (back-front)/2
    d = (y-(front+back)/2)/max(0.001,ry)
    return rx*math.sqrt(max(0.018,1-d*d))
def closed_spline(points, t):
    count = len(points)
    u = (t%1)*count
    i = int(u)
    f = u-i
    a,b,c,d = [Vector(points[k%count]) for k in [i-1,i,i+1,i+2]]
    return 0.5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f)
for side,label in [(1,"Left"),(-1,"Right")]:
    vv,ff = [],[]
    center = Vector((0.155,0.46))
    rings,n = 12,64
    for layer in [0,1]:
        for j in range(rings+1):
            r = max(0.001,j/rings)
            for i in range(n):
                yz = center.lerp(closed_spline(CFG["wingOutline"],i/n),r)
                y,z = yz
                offset = 0.004+0.041*(1-r*r)**0.72 if layer==0 else -0.012
                vv.append((side*(body_side(y,z)+offset),y,z))
    layer_size = (rings+1)*n
    for layer in [0,1]:
        for j in range(rings):
            for i in range(n):
                a=layer*layer_size+j*n+i
                b=layer*layer_size+j*n+(i+1)%n
                ff.append((a,b,b+n,a+n))
        ff.append(tuple(layer*layer_size+i for i in range(n)))
    for i in range(n):
        a=rings*n+i; b=rings*n+(i+1)%n
        ff.append((a,b,b+layer_size,a+layer_size))
    obj=mesh_object("Folded_wing_volume_"+label,vv,ff)
    obj["stage"]="placement and volume only; covert layers not yet built"
def blade(name,start,end,width,mat=clay):
    start,end=Vector(start),Vector(end)
    axis=(end-start).normalized()
    across=Vector((1,0,0))
    normal=axis.cross(across).normalized()
    vv,ff=[],[]
    steps,sides=16,8
    for j in range(steps+1):
        t=j/steps
        p=start.lerp(end,t)+normal*(0.015*math.sin(math.pi*t))
        w=width*(0.10+0.90*math.sin(math.pi*t)**0.5)
        thick=0.003*(0.4+math.sin(math.pi*t))
        for i in range(sides):
            phi=2*math.pi*i/sides
            vv.append(p+across*(w*math.cos(phi))+normal*(thick*math.sin(phi)))
    for j in range(steps):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides
            ff.append((a,b,b+sides,a+sides))
    ff.extend([tuple(reversed(range(sides))),tuple(steps*sides+i for i in range(sides))])
    return mesh_object(name,vv,ff,mat)
for i in range(10):
    t=(i-4.5)/4.5
    blade("Tail_block_"+str(i+1),(0.035*t,0.255,0.31),(0.125*t,0.68-0.018*abs(t),0.175+0.012*abs(t)),0.027)
def ellipsoid(name,center,scale,mat=clay,normal=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=center)
    obj=move_to_bird(bpy.context.object)
    obj.name=name
    obj.scale=scale
    if normal is not None:
        obj.rotation_euler=Vector(normal).to_track_quat("Z","Y").to_euler()
    obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth=True
    return obj
# Small facial landmarks allow judging head/beak proportions in the clay study.
for side,label in [(1,"Left"),(-1,"Right")]:
    center=Vector((side*0.122,-0.301,0.862))
    normal=Vector((side*0.78,-0.62,0.045)).normalized()
    ellipsoid("Eye_landmark_"+label,center,(0.026,0.026,0.014),eye_mat,normal)
    ellipsoid("Pupil_landmark_"+label,center+normal*0.012,(0.011,0.011,0.003),pupil_mat,normal)
    ellipsoid("Cere_landmark_"+label,(side*0.016,-0.349,0.817),(0.020,0.026,0.013),cere_mat)
# Variable-section bill. Its upper and lower halves remain separate for later articulation.
for part,offset,scale_z in [("Upper",0.003,1.0),("Lower",-0.012,0.48)]:
    vv,ff=[],[]
    bill=[(-0.327,0.805,0.037,0.022),(-0.346,0.800,0.032,0.022),(-0.383,0.784,0.018,0.014),(-0.419,0.761,0.0015,0.002)]
    for y,z,rx,rz in bill:
        for k in range(16):
            a=2*math.pi*k/16
            vv.append((rx*math.cos(a),y,z+offset+rz*scale_z*math.sin(a)))
    for j in range(3):
        for k in range(16):
            a=j*16+k;b=j*16+(k+1)%16
            ff.append((a,b,b+16,a+16))
    ff.extend([tuple(reversed(range(16))),tuple(48+k for k in range(16))])
    mesh_object("Beak_"+part,vv,ff,beak_mat)
def tube(name,points,radii,mat=foot_mat):
    points=[Vector(p) for p in points]
    vv,ff=[],[]
    sides=10
    for j,p in enumerate(points):
        tangent=(points[min(j+1,len(points)-1)]-points[max(j-1,0)]).normalized()
        ref=Vector((0,0,1)) if abs(tangent.z)<0.9 else Vector((0,1,0))
        x=tangent.cross(ref).normalized()
        y=tangent.cross(x).normalized()
        for i in range(sides):
            a=2*math.pi*i/sides
            vv.append(p+(x*math.cos(a)+y*math.sin(a))*radii[j])
    for j in range(len(points)-1):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides
            ff.append((a,b,b+sides,a+sides))
    ff.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))])
    return mesh_object(name,vv,ff,mat)
for side,label in [(1,"Left"),(-1,"Right")]:
    x=side*0.135
    tube("Tarsus_"+label,[(x,0.005,0.185),(x,-0.040,0.103),(x,-0.075,0.038)],[0.025,0.021,0.019])
    for j,(dx,ey) in enumerate([(-0.052,-0.178),(0,-0.208),(0.052,-0.179)]):
        tube("Front_toe_"+label+"_"+str(j+1),[(x,-0.075,0.038),(x+dx*0.45,-0.130,0.025),(x+dx,ey,0.013)],[0.014,0.012,0.006])
        tube("Claw_"+label+"_"+str(j+1),[(x+dx,ey,0.013),(x+dx*1.04,ey-0.017,0.007),(x+dx*1.06,ey-0.024,0.002)],[0.006,0.004,0.001],beak_mat)
    tube("Back_toe_"+label,[(x,-0.082,0.043),(x-0.019*side,-0.017,0.023),(x-0.034*side,0.045,0.012)],[0.013,0.01,0.004])
# Metrics from the actual authoring geometry.
bpy.context.view_layer.update()
mesh_objects=[o for o in bird.objects if o.type=="MESH"]
coordinates=[o.matrix_world @ v.co for o in mesh_objects for v in o.data.vertices]
low=[min(p[i] for p in coordinates) for i in range(3)]
high=[max(p[i] for p in coordinates) for i in range(3)]
height=high[2]-low[2]
bounds={"min":low,"max":high,"height":height,"width_over_height":(high[0]-low[0])/height,"length_over_height":(high[1]-low[1])/height}
# Export only the bird, without the studio camera, ground or lights.
bpy.ops.object.select_all(action="DESELECT")
for obj in bird.objects: obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(ASSETS/"pigeon.glb"),export_format="GLB",use_selection=True,export_extras=True,export_apply=True,export_animations=False)
raw=(ASSETS/"pigeon.glb").read_bytes()
json_size=struct.unpack_from("<I",raw,12)[0]
gltf=json.loads(raw[20:20+json_size])
accessors=gltf.get("accessors",[])
triangles=sum(accessors[p["indices"]]["count"]//3 for m in gltf["meshes"] for p in m["primitives"] if "indices" in p)
# Simple fixed studio for a reproducible Blender comparison.
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=48
scene.cycles.use_denoising=False
scene.cycles.max_bounces=4
scene.render.resolution_x=480
scene.render.resolution_y=480
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGB"
scene.render.film_transparent=False
scene.view_settings.view_transform="Standard"
scene.world.use_nodes=True
scene.world.node_tree.nodes.get("Background").inputs[0].default_value=(0.82,0.82,0.82,1)
scene.world.node_tree.nodes.get("Background").inputs[1].default_value=0.8
floor_mat=material("Studio floor",(0.87,0.86,0.84),0.90)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-0.004))
floor=bpy.context.object
floor.name="Studio_floor_not_exported"
floor.data.materials.append(floor_mat)
def area(name,location,power,size):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=power
    data.shape="DISK"
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector((0,0,0.5))-obj.location).to_track_quat("-Z","Y").to_euler()
area("Studio key",(-3,-4,5),600,4)
area("Studio fill",(4,2,3),200,3)
camera_data=bpy.data.cameras.new("Eight_views_fixed_camera")
camera_data.type="ORTHO"
camera_data.ortho_scale=CFG["camera"]["orthographicScale"]
camera=bpy.data.objects.new("Eight_views_fixed_camera",camera_data)
scene.collection.objects.link(camera)
scene.camera=camera
views=["front","left45","left","back-left45","back","back-right45","right","right45"]
def position_camera(degrees):
    a=math.radians(degrees)
    camera.location=(CFG["camera"]["distance"]*math.sin(a),-CFG["camera"]["distance"]*math.cos(a),CFG["camera"]["height"])
    target=Vector((0,0.08,CFG["camera"]["targetHeight"]))
    camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
position_camera(45)
bpy.ops.wm.save_as_mainfile(filepath=str(ART/"pigeon.blend"),compress=True)
for name,degrees in zip(views,CFG["camera"]["azimuths"]):
    position_camera(degrees)
    scene.render.filepath=str(REVIEW/("blender-"+name+".png"))
    bpy.ops.render.render(write_still=True)
manifest={
 "revision":CFG["revision"],"stage":"anatomy-blockout","reference":"R01",
 "reference_file_available":False,"reference_measurements":"initial visual estimates only",
 "authoring":"art/pigeon/pigeon.blend","blender":bpy.app.version_string,
 "geometry_source":"original profile loft; no legacy pigeon model",
 "glb_sha256":hashlib.sha256(raw).hexdigest(),
 "blend_sha256":hashlib.sha256((ART/"pigeon.blend").read_bytes()).hexdigest(),
 "profiles_sha256":hashlib.sha256((ART/"profiles.json").read_bytes()).hexdigest(),
 "glb_bytes":len(raw),"triangles":triangles,"mesh_count":len(gltf["meshes"]),
 "bounds_blender":bounds,"views":dict(zip(views,CFG["camera"]["azimuths"])),
 "poses":["stand"],"limitations":["covert/neck feather layers not built","final colors and iridescence not built","pose rig and seven poses not built","reference proportions not pixel measured"]
}
(ASSETS/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
(REVIEW/"model-report.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
# A contact sheet keeps all eight actual Blender views inspectable.
from PIL import Image, ImageDraw
sheet=Image.new("RGB",(960,544),(239,238,234))
draw=ImageDraw.Draw(sheet)
for index,name in enumerate(views):
    thumb=Image.open(REVIEW/("blender-"+name+".png")).resize((240,240))
    x=(index%4)*240; y=(index//4)*272
    sheet.paste(thumb,(x,y))
    draw.text((x+12,y+246),name,fill=(50,50,48))
sheet.save(REVIEW/"blender-eight-views.png")
# Read-only CI uploads artifacts. These bounded, generated file records also permit
# retrieving the model without granting a workflow repository write permissions.
if os.environ.get("PIGEON_EXPORT_BUNDLE") == "1":
    bundle_paths=[ART/"pigeon.blend",ASSETS/"pigeon.glb",ASSETS/"manifest.json",REVIEW/"model-report.json",REVIEW/"blender-eight-views.png"]+list(REVIEW.glob("blender-*.png"))
    seen=set()
    budget=1_500_000
    for path in bundle_paths:
        if path in seen: continue
        seen.add(path)
        content=path.read_bytes()
        if len(content)>budget:
            print("PIGEON_ARTIFACT_ONLY "+str(path.relative_to(ROOT)),flush=True)
            continue
        budget-=len(content)
        encoded=base64.b64encode(content).decode()
        pieces=[encoded[i:i+16000] for i in range(0,len(encoded),16000)]
        print("PIGEON_FILE_HEADER "+json.dumps({"path":str(path.relative_to(ROOT)),"sha256":hashlib.sha256(content).hexdigest(),"parts":len(pieces),"bytes":len(content)}),flush=True)
        for i,piece in enumerate(pieces):
            print("PIGEON_FILE_CHUNK "+json.dumps({"path":str(path.relative_to(ROOT)),"index":i,"data":piece}),flush=True)
print("PIGEON_MODEL_REPORT "+json.dumps(manifest,ensure_ascii=False),flush=True)
