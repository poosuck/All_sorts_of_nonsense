"""Camera-only head review of the recorded Blender original; never saves it."""
import bpy,math,json,hashlib
import subprocess
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'src/assets/pigeon/manifest.json').read_text())
out=root/'docs/pigeon/reviews'/manifest['revision']/'head'
out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256((root/'art/pigeon/pigeon.blend').read_bytes()).hexdigest()==manifest['blend_sha256']
source_commit=subprocess.run(['git','log','-1','--format=%H','--','art/pigeon/pigeon.blend'],cwd=root,check=True,capture_output=True,text=True).stdout.strip()
if subprocess.run(['git','status','--porcelain','--','art/pigeon/pigeon.blend'],cwd=root,check=True,capture_output=True,text=True).stdout.strip():source_commit=None
bpy.ops.wm.open_mainfile(filepath=str(root/'art/pigeon/pigeon.blend'))
scene=bpy.context.scene
camera=scene.camera
center=Vector((0,-.18,.855))
camera.data.ortho_scale=.49
scene.render.resolution_x=600;scene.render.resolution_y=600
scene.render.resolution_percentage=100
records=[]
for name,degrees in [('front',0),('left45',45),('left',90)]:
 a=math.radians(degrees)
 camera.location=center+Vector((3.4*math.sin(a),-3.4*math.cos(a),0))
 camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(out/('head-'+name+'.png'))
 bpy.ops.render.render(write_still=True)
 records.append({'view':name,'azimuth':degrees,'position':list(camera.location),'target':list(center),'orthographic_scale':.49,'file':'head-'+name+'.png'})
record={'source_model_commit':source_commit,'revision':manifest['revision'],'glb_sha256':manifest['glb_sha256'],'blend_sha256':manifest['blend_sha256'],
 'source':'unchanged art/pigeon/pigeon.blend; camera-only closeups; no model/material/light changes',
 'reference':'conversation R01 top-right face closeups, visual comparison only','views':records}
(out/'capture-record.json').write_text(json.dumps(record,indent=2)+'\n')
from PIL import Image,ImageDraw
sheet=Image.new('RGB',(1200,432),'#efeeea');draw=ImageDraw.Draw(sheet)
for i,(name,_) in enumerate([('front',0),('left45',45),('left',90)]):
 pic=Image.open(out/('head-'+name+'.png')).resize((400,400))
 sheet.paste(pic,(400*i,0));draw.text((400*i+12,410),manifest['revision']+' | '+name,fill='#252525')
sheet.save(out/'head-three-views.png')
assert hashlib.sha256((root/'art/pigeon/pigeon.blend').read_bytes()).hexdigest()==manifest['blend_sha256']
