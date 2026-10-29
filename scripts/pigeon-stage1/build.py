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
from functools import lru_cache

ROOT = Path(__file__).resolve().parents[2]
CFG = json.loads((ROOT / "art/pigeon/profiles.json").read_text())
ART = ROOT / "art/pigeon"
ASSETS = ROOT / "src/assets/pigeon"
REVIEW = ROOT / "docs/pigeon/reviews" / CFG["revision"]
for path in [ART, ASSETS, REVIEW]:
    path.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.name = "R01 anatomy study"
bird = bpy.data.collections.new("Pigeon_Anatomy")
scene.collection.children.link(bird)
model = bpy.data.objects.new("Pigeon_R01", None)
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
@lru_cache(maxsize=None)
def section_second_derivatives(curve):
    # Natural cubic sections provide continuous curvature. PCHIP's second
    # derivative jumps were visible as horizontal bands across the torso.
    import numpy as np
    points=np.array(curve,dtype=float)
    h=np.diff(points[:,0]); count=len(points)
    system=np.eye(count); rhs=np.zeros((count,3))
    for i in range(1,count-1):
        system[i,i-1]=h[i-1]
        system[i,i]=2*(h[i-1]+h[i])
        system[i,i+1]=h[i]
        rhs[i]=6*((points[i+1,1:]-points[i,1:])/h[i]-(points[i,1:]-points[i-1,1:])/h[i-1])
    return np.linalg.solve(system,rhs)
def cubic_values(curve,z):
    z=max(curve[0][0],min(z,curve[-1][0]))
    i=next((i for i in range(len(curve)-1) if curve[i][0]<=z<=curve[i+1][0]),len(curve)-2)
    h=curve[i+1][0]-curve[i][0]
    a=(curve[i+1][0]-z)/h; b=(z-curve[i][0])/h
    second=section_second_derivatives(tuple(map(tuple,curve)))
    return [a*curve[i][c+1]+b*curve[i+1][c+1]+((a*a*a-a)*second[i,c]+(b*b*b-b)*second[i+1,c])*h*h/6 for c in range(3)]
def body_base_values(z):
    if z>=0.900:
        # An ellipsoidal crown closes with the right curvature at the pole;
        # a finite-slope radius interpolant leaves a flat/stepped-looking cap.
        cap=math.sqrt(max(0.000001,1-((z-0.86)/0.14)**2))
        return max(0.0001,0.16*cap),-0.18-0.155*cap,-0.18+0.155*cap
    return cubic_values(sections,z)
head=CFG["head"]
eye_angle=math.radians(head["eye"]["angleDegrees"])
def body_values(z):
    original=body_base_values(z)
    if z<=.70:return original
    cap=head["cap"]
    if z>=cap["startZ"]:
        f=math.sqrt(max(.000001,1-((z-cap["centerZ"])/cap["radiusZ"])**2))
        revised=[max(.0001,cap["radiusX"]*f),cap["centerY"]-cap["frontRadius"]*f,cap["centerY"]+cap["backRadius"]*f]
    else:revised=cubic_values(head["sections"],z)
    t=max(0,min(1,(z-.70)/.07));blend=t*t*t*(10-15*t+6*t*t)
    return [a*(1-blend)+b*blend for a,b in zip(original,revised)]
def anatomy_point(theta,z):
    rx,front,back=body_values(z)
    point=Vector((rx*math.sin(theta),(front+back)/2-(back-front)/2*math.cos(theta),z))
    if z<=.74:return point
    def bump(angle,height,aw,zw):
        delta=math.atan2(math.sin(theta-angle),math.cos(theta-angle))
        return math.exp(-.5*((delta/aw)**2+((z-height)/zw)**2))
    sculpt=head["sculpt"]
    offset=0.0
    for sign in [-1,1]:
        offset+=sculpt["cheekAmplitude"]*bump(sign*(eye_angle+.15),.817,.34,.030)
        offset-=sculpt["socketDepth"]*bump(sign*eye_angle,head["eye"]["height"],.19,.022)
        offset+=.003*bump(sign*eye_angle,.896,.25,.015)
    offset+=sculpt["jawAmplitude"]*bump(0,.792,.55,.026)
    return point+Vector((math.sin(theta),-math.cos(theta),0))*offset
verts,faces = [],[]
rows,segments = 120,80
for j in range(rows):
    u=(1-math.cos(math.pi*j/(rows-1)))/2
    z = sections[0][0]+(sections[-1][0]-sections[0][0])*u
    rx,front,back = body_values(z)
    for i in range(segments):
        theta = 2*math.pi*i/segments
        verts.append(anatomy_point(theta,z))
for j in range(rows-1):
    for i in range(segments):
        ni = (i+1)%segments
        faces.append((j*segments+i,j*segments+ni,(j+1)*segments+ni,(j+1)*segments+i))
faces.extend([tuple(reversed(range(segments))),tuple((rows-1)*segments+i for i in range(segments))])
body = mesh_object("Body_neck_head_continuous",verts,faces)
body["construction"] = "continuous torso + local cranial/cheek/jaw/socket sculpt; profiles.json"
def body_side(y,z):
    rx,front,back = body_values(z)
    ry = (back-front)/2
    d = (y-(front+back)/2)/max(0.001,ry)
    return rx*math.sqrt(max(0,1-d*d))
# Longitudinal closed wing volumes: no radial disk or clamped rear fin.
for side,label in [(1,"Left"),(-1,"Right")]:
    vv,ff=[],[]
    wing=CFG["wingSections"]
    rows_w,sides_w=70,40
    for j in range(rows_w):
        y=wing[0][0]+(wing[-1][0]-wing[0][0])*j/(rows_w-1)
        xc,zc,hz,thickness=smooth_values(wing,y)
        t=max(0,min(1,(y-0.14)/0.32))
        blend=t*t*(3-2*t)
        rear_t=max(0,min(1,(y-0.30)/0.16))
        rear_fold=rear_t*rear_t*(3-2*rear_t)
        for i in range(sides_w):
            a=2*math.pi*i/sides_w
            z=zc+hz*math.cos(a)
            base=body_side(y,z)*(1-blend)+xc*blend
            # The folded flight envelope runs from the high/lateral shoulder
            # toward the low/medial tips. The reverse slope made a clamshell.
            root_embed=0.012*(1-blend)
            x=base+xc*0.65*rear_fold*math.cos(a)-root_embed+thickness*math.sin(a)
            # The high edge anchors to the torso's rear surface, while the
            # lower edge continues aft as the folded flight envelope. Keeping
            # both at the same Y produced a free-standing collar around rump.
            attach_t=max(0,min(1,(y-0.20)/0.16))
            free_t=max(0,min(1,(y-0.45)/0.19))
            anchor=attach_t*attach_t*(3-2*attach_t)*(1-free_t*free_t*(3-2*free_t))
            rx,y_front,y_back=body_values(z)
            rear_surface=(y_front+y_back)/2+(y_back-y_front)/2*math.sqrt(max(0,1-(x/max(rx,0.001))**2))
            pull=max(0,y-rear_surface+0.006)*anchor*(1+math.cos(a))/2
            # A small fixed overlap prevents two coplanar tips meeting as a lid.
            vv.append((side*x,y-pull+side*0.004*blend,z))
    for j in range(rows_w-1):
        for i in range(sides_w):
            a=j*sides_w+i;b=j*sides_w+(i+1)%sides_w
            ff.append((a,b,b+sides_w,a+sides_w))
    ff.extend([tuple(reversed(range(sides_w))),tuple((rows_w-1)*sides_w+i for i in range(sides_w))])
    obj=mesh_object("Folded_wing_volume_"+label,vv,ff)
    obj["stage"]="longitudinal shoulder-to-flight envelope; feather layers pending"
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
# First establish the tail's broad, flat volume along the rump axis. Individual
# feather ends would hide silhouette errors at this stage, so they are deferred.
vv,ff=[],[]
tail=CFG["tailSections"]
rows_t,sides_t=64,40
for j in range(rows_t):
    y=tail[0][0]+(tail[-1][0]-tail[0][0])*j/(rows_t-1)
    width,zc,thick=smooth_values(tail,y)
    for k in range(sides_t):
        a=2*math.pi*k/sides_t
        vv.append((width*math.cos(a),y,zc+thick*math.sin(a)))
for j in range(rows_t-1):
    for k in range(sides_t):
        a=j*sides_t+k;b=j*sides_t+(k+1)%sides_t
        ff.append((a,b,b+sides_t,a+sides_t))
ff.extend([tuple(reversed(range(sides_t))),tuple((rows_t-1)*sides_t+k for k in range(sides_t))])
mesh_object("Tail_anatomical_envelope",vv,ff)
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
# Surface-oriented embedded globes and flush eyelid strips.
for side,label in [(1,"Left"),(-1,"Right")]:
    angle=side*eye_angle;z=head["eye"]["height"]
    surface=anatomy_point(angle,z)
    du=(anatomy_point(angle+.001,z)-anatomy_point(angle-.001,z))/.002
    dz=(anatomy_point(angle,z+.001)-anatomy_point(angle,z-.001))/.002
    normal=du.cross(dz).normalized()
    radius=head["eye"]["radius"]
    center=surface-normal*.004
    ellipsoid("Eye_globe_"+label,center,(radius,radius*.96,head["eye"]["depth"]),eye_mat,normal)
    ellipsoid("Pupil_landmark_"+label,center+normal*.0115,(.011,.011,.0015),pupil_mat,normal)
    vv,ff=[],[]
    for j in range(5):
        t=j/4;r=.024+.009*t
        for k in range(64):
            a=2*math.pi*k/64
            p=anatomy_point(angle+r*math.cos(a)/du.length,z+r*.95*math.sin(a))
            p+=normal*(.003*(1-t)**2)
            vv.append(p)
    for j in range(4):
        for k in range(64):
            a=j*64+k;b=j*64+(k+1)%64
            ff.append((a,b,b+64,a+64))
    mesh_object("Eyelid_surface_"+label,vv,ff)
# Smooth upper/lower bill profiles share a controlled seam, rather than two plates.
for part in ["Upper","Lower"]:
    vv,ff=[],[]
    rows_b,sides_b=40,32
    for j in range(rows_b):
        y,width,top,seam,bottom=smooth_values(head["billSections"],j/(rows_b-1))
        for k in range(sides_b):
            a=2*math.pi*k/sides_b;s=math.sin(a)
            if part=="Upper":z=seam+(top-seam)*max(0,s)-.001*max(0,-s)
            else:z=seam-.001-(seam-.001-bottom)*max(0,-s)+.0005*max(0,s)
            vv.append((width*(1 if part=="Upper" else .88)*math.cos(a),y,z))
    for j in range(rows_b-1):
        for k in range(sides_b):
            a=j*sides_b+k;b=j*sides_b+(k+1)%sides_b
            ff.append((a,b,b+sides_b,a+sides_b))
    ff.extend([tuple(reversed(range(sides_b))),tuple((rows_b-1)*sides_b+k for k in range(sides_b))])
    mesh_object("Beak_"+part,vv,ff,beak_mat)
# One bridge with two low soft lobes integrated into the bill root.
vv,ff=[],[]
for j in range(32):
    y,width,zc,height=smooth_values(head["cereSections"],j/31)
    for k in range(40):
        a=2*math.pi*k/40;s=math.sin(a);x=width*math.cos(a)
        lobes=math.exp(-((x-.014)/.010)**2)+math.exp(-((x+.014)/.010)**2)-.3*math.exp(-(x/.009)**2)
        vv.append((x,y,zc+height*s+.002*max(0,s)**2*lobes))
for j in range(31):
    for k in range(40):
        a=j*40+k;b=j*40+(k+1)%40
        ff.append((a,b,b+40,a+40))
ff.extend([tuple(reversed(range(40))),tuple(31*40+k for k in range(40))])
mesh_object("Cere_integrated_bridge",vv,ff,cere_mat)
def tube(name,points,radii,mat=foot_mat):
    points=[Vector(p) for p in points]
    if len(points)==3:
        a,b,c=points; ra,rb,rc=radii
        points=[(1-t)**2*a+2*(1-t)*t*b+t*t*c for t in [i/12 for i in range(13)]]
        radii=[(1-t)**2*ra+2*(1-t)*t*rb+t*t*rc for t in [i/12 for i in range(13)]]
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
    x=side*0.130
    tube("Tarsus_"+label,[(x,0.060,0.195),(x,0.035,0.095),(x,0.015,0.040)],[0.028,0.025,0.023])
    for j,(dx,ey) in enumerate([(-0.060,-0.140),(0,-0.170),(0.060,-0.142)]):
        tube("Front_toe_"+label+"_"+str(j+1),[(x,-0.005,0.034),(x+dx*0.55,-0.070,0.026),(x+dx,ey,0.014)],[0.019,0.016,0.009])
        tube("Claw_"+label+"_"+str(j+1),[(x+dx,ey,0.014),(x+dx*1.04,ey-0.012,0.008),(x+dx*1.06,ey-0.018,0.003)],[0.006,0.004,0.001],beak_mat)
    tube("Back_toe_"+label,[(x,0.015,0.034),(x-0.018*side,0.065,0.027),(x-0.035*side,0.105,0.014)],[0.016,0.013,0.006])
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
bpy.context.preferences.filepaths.save_version=0
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
