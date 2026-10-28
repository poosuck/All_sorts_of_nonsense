import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './resources.js';

const smooth = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const HEAD = new THREE.Vector3(0, 1.16, .44);
const NECK = new THREE.Vector3(0, .82, .23);
const c = value => new THREE.Color(value);

function ellipsoid(p, center, radii) {
  const a = new THREE.Vector3().subVectors(p, center);
  const k0 = Math.hypot(a.x/radii.x, a.y/radii.y, a.z/radii.z);
  const k1 = Math.hypot(a.x/radii.x**2, a.y/radii.y**2, a.z/radii.z**2);
  return k1 < 1e-8 ? -Math.min(radii.x,radii.y,radii.z) : k0*(k0-1)/k1;
}
const volumes = [
  [[0,.60,-.12],[.47,.415,.66]],
  [[0,.62,.29],[.395,.37,.40]],
  [[0,.72,-.08],[.445,.30,.53]],
  [[0,.94,.32],[.235,.275,.26]],
  [HEAD.toArray(),[.227,.225,.225]],
].map(([center,radii])=>({center:new THREE.Vector3(...center),radii:new THREE.Vector3(...radii)}));
function unite(a,b,k) { const h=Math.max(k-Math.abs(a-b),0)/k; return Math.min(a,b)-h*h*k*.25; }
export function referenceDistance(x,y,z) {
  const point=new THREE.Vector3(x,y,z);
  let value=ellipsoid(point,volumes[0].center,volumes[0].radii);
  for(let i=1;i<volumes.length;i++) value=unite(value,ellipsoid(point,volumes[i].center,volumes[i].radii),i<3?.16:.12);
  return value;
}
function flank(y,z) {
  if(referenceDistance(0,y,z)>=0) return 0;
  let low=0,high=.8;
  for(let i=0;i<16;i++){const mid=(low+high)*.5;if(referenceDistance(mid,y,z)<0)low=mid;else high=mid;}
  return (low+high)*.5;
}
function skinWeights(p) {
  const neck=smooth(p.y,.76,1.05)*smooth(p.z,-.04,.25);
  const head=smooth(p.y,1.01,1.19);
  return [1-neck,neck*(1-head),neck*head,0];
}
function bodyColor(p) {
  const base=c('#9f99a4').lerp(c('#b3aab2'),smooth(p.z,-.5,.48)*.45);
  const neck=smooth(p.y,.75,.94)*(1-smooth(p.y,1.09,1.20))*smooth(p.z,.02,.3);
  const throat=c('#725579').lerp(c('#3f706a'),smooth(p.y,.87,1.07));
  base.lerp(throat,neck*.90);
  base.lerp(c('#59616e'),smooth(p.y,1.03,1.22));
  return base;
}
function torsoDistance(x,y,z) {
  const point=new THREE.Vector3(x,y,z);
  let value=ellipsoid(point,volumes[0].center,volumes[0].radii);
  for(let i=1;i<3;i++)value=unite(value,ellipsoid(point,volumes[i].center,volumes[i].radii),.16);
  return value;
}
function bodyGeometry(torsoOnly=false) {
  const n=58,half=n/2;
  const marching=new MarchingCubes(n,new THREE.MeshBasicMaterial(),false,false,40000);
  marching.isolation=0;
  for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const px=(x-half)/half*.94,py=(y-half)/half*.84+.72,pz=(z-half)/half*1.12;
    marching.field[z*n*n+y*n+x]=-(torsoOnly?torsoDistance(px,py,pz):referenceDistance(px,py,pz));
  }
  marching.update();
  const p=marching.geometry.attributes.position;
  const positions=[],colors=[],uvs=[],joints=[],weights=[];
  for(let i=0;i<marching.count;i++) {
    const v=new THREE.Vector3(p.getX(i)*.94,p.getY(i)*.84+.72,p.getZ(i)*1.12);
    positions.push(...v.toArray()); colors.push(...bodyColor(v).toArray());
    const center=THREE.MathUtils.lerp(-.05,.44,smooth(v.y,.75,1.15));
    uvs.push((Math.atan2(v.x,v.z-center)/Math.PI/2+.5)*3.0,v.y*1.0);
    joints.push(0,1,2,0); weights.push(...skinWeights(v));
  }
  for(let i=0;i<uvs.length;i+=6){const q=[uvs[i],uvs[i+2],uvs[i+4]];if(Math.max(...q)-Math.min(...q)>1.5)for(let j=0;j<6;j+=2)if(uvs[i+j]<1.5)uvs[i+j]+=3;}
  const raw=new THREE.BufferGeometry();
  for(const [name,data,size] of [['position',positions,3],['color',colors,3],['uv',uvs,2],['skinWeight',weights,4]])raw.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  raw.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
  const geo=mergeVertices(raw,1e-5);geo.computeVertexNormals();geo.clearGroups();
  marching.geometry.dispose();marching.material.dispose();raw.dispose();return geo;
}
function featherTexture() {
  if (typeof document === 'undefined') return null;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;
  const ctx=canvas.getContext('2d'),rand=seededRandom(28261);
  ctx.fillStyle='#808080';ctx.fillRect(0,0,512,1024);
  // Incomplete feather tips, staggered with restrained size/direction variation.
  for(let row=-2;row<36;row++)for(let col=-1;col<17;col++) {
    const x=col*32+(row%2)*16+(rand()-.5)*7,y=row*30+(rand()-.5)*7;
    const w=10+rand()*5,h=16+rand()*8;
    ctx.strokeStyle='rgba(40,40,40,.30)';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(x-w,y+h*.5);ctx.quadraticCurveTo(x-w*.5,y+h*.94,x,y+h);
    if(rand()>.35)ctx.quadraticCurveTo(x+w*.5,y+h*.94,x+w,y+h*.5);ctx.stroke();
    ctx.strokeStyle='rgba(225,225,225,.18)';ctx.lineWidth=.6;
    for(let j=-2;j<=2;j++){ctx.beginPath();ctx.moveTo(x,y+4);ctx.lineTo(x+j*3,y+h-3-Math.abs(j));ctx.stroke();}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.NoColorSpace;texture.anisotropy=4;return texture;
}
function materials(plain) {
  const bump=featherTexture();
  let albedo=null;
  if(bump){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;
    const ctx=canvas.getContext('2d');ctx.drawImage(bump.image,0,0);
    const pixels=ctx.getImageData(0,0,512,1024);
    for(let i=0;i<pixels.data.length;i+=4){
      const value=Math.min(255,Math.round(247+(pixels.data[i]-128)*.20));
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
    }
    ctx.putImageData(pixels,0,0);albedo=new THREE.CanvasTexture(canvas);
    albedo.wrapS=albedo.wrapT=THREE.RepeatWrapping;albedo.colorSpace=THREE.SRGBColorSpace;albedo.anisotropy=4;
  }
  const body=new THREE.MeshPhysicalMaterial({color:'#ffffff',vertexColors:true,roughness:.90,map:albedo,bumpMap:bump,bumpScale:.0038,
    sheen:.18,sheenRoughness:.9,sheenColor:c('#c5bdc5'),metalness:0,iridescence:.22,iridescenceThicknessRange:[230,370]});
  body.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vReferencePosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvReferencePosition = position;');
    shader.fragmentShader='varying vec3 vReferencePosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
      #ifdef USE_IRIDESCENCE
        material.iridescence *= smoothstep(.76,.94,vReferencePosition.y)*(1.-smoothstep(1.07,1.18,vReferencePosition.y));
      #endif`);
  };
  body.customProgramCacheKey=()=> 'reference-plumage-3';
  const wing=new THREE.MeshPhysicalMaterial({color:'#ffffff',vertexColors:true,roughness:.9,sheen:.16,sheenRoughness:.9,side:THREE.DoubleSide});
  const plainMat=new THREE.MeshStandardMaterial({color:'#a5a5a5',roughness:.9,side:THREE.DoubleSide});
  return {body:plain?plainMat:body,wing:plain?plainMat:wing,
    head:new THREE.MeshStandardMaterial({color:'#59616e',roughness:.9}),
    beak:new THREE.MeshStandardMaterial({color:'#66606a',roughness:.73}),
    cere:new THREE.MeshStandardMaterial({color:'#d1c9c4',roughness:.92}),
    feet:new THREE.MeshStandardMaterial({color:'#c36d67',roughness:.85}),
    claw:new THREE.MeshStandardMaterial({color:'#625964',roughness:.82}),
    rim:new THREE.MeshStandardMaterial({color:'#55505a',roughness:.8}),
    iris:new THREE.MeshPhysicalMaterial({color:'#d68b24',roughness:.30,clearcoat:.5}),
    pupil:new THREE.MeshPhysicalMaterial({color:'#111018',roughness:.18,clearcoat:.8}),
    glint:new THREE.MeshBasicMaterial({color:'#fff8ea'}),owned:[bump,albedo,body,wing,plainMat]};
}
function addMesh(geo,mat,name,parent,pos=[0,0,0],scale=[1,1,1]) {
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(...pos);mesh.scale.set(...scale);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
// Folded outline and spread outline share wing-local coordinates and topology.
export function referenceWingPoint(side,s,t,open=false,lift=0) {
  if(open) {
    const width=THREE.MathUtils.lerp(Math.max(.12,Math.sin(clamp(s,0,1)*Math.PI)**.55),.78,smooth(s,.60,.85));
    return new THREE.Vector3(side*(.235+s*1.12),.90+s*.05+lift,.15-s*.33+t*.40*width);
  }
  const width=Math.max(.12,Math.sin(clamp(s,0,1)*Math.PI)**.58);
  const z=.19-s*.99;
  const y=.81-s*.24+t*.235*width;
  const surface = flank(y,z);
  const tipX = THREE.MathUtils.lerp(flank(.59,-.66),.10,smooth(s,.86,1.12));
  const x = s > .86 ? THREE.MathUtils.lerp(surface,tipX,smooth(s,.86,.99)) : surface;
  return new THREE.Vector3(side*(x+.008+Math.sin(clamp(s,0,1)*Math.PI)*(1-t*t)*.038+lift),y,z);
}
function wingGeometry(side,kind,plain=false) {
  const positions=[],spread=[],indices=[],colors=[];
  const patch=(s0,t0,length,width,rows,cols,isVane=false,layer=0,banded=false)=>{
    const offset=positions.length/3;
    for(let r=0;r<=rows;r++)for(let col=0;col<=cols;col++){
      const v=r/rows,u=col/cols*2-1;
      const outline=isVane?(v>.60?Math.sqrt(Math.max(0,1-((v-.60)/.40)**2)):.8+.2*v/.60):1;
      const s=s0+v*length,t=t0+u*width*outline;
      const lift=isVane?(.002+Math.sin(v*Math.PI)*(1-u*u)*.0010+layer*.0016)*(kind==='under-coverts'?-1:1):0;
      const a=referenceWingPoint(side,s,t,false,lift),b=referenceWingPoint(side,kind==='shell'?s*.90:s,t,true,lift);
      positions.push(...a.toArray());spread.push(...b.toArray());
      const band=banded&&kind!=='under-coverts';
      const tipShade=isVane?(.89+.11*(1-u*u)-.025*smooth(v,.86,1)):1;
      const shade=(isVane?1-.025*Math.sin(s0*87+t0*19):.97)*tipShade;
      const color=c(band?'#45424e':kind==='under-coverts'?'#b1aab4':kind==='flight'?'#77717f':s>.92?'#66606c':'#bfb7be').multiplyScalar(shade);
      colors.push(...color.toArray());
      if(r<rows&&col<cols){const i=offset+r*(cols+1)+col;indices.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1);}
    }
  };
  if(kind==='shell') patch(.015,0,.97,.97,32,16);
  if((kind==='coverts'||kind==='under-coverts')&&!plain) {
    // Staggered small shoulder vanes grow larger toward the rear, all point tailward.
    for(let row=0;row<9;row++){
      const s=.035+row*.077,columns=7;
      for(let col=0;col<columns;col++){
        const t=-.80+col*.255+(row%2)*.11;
        if(Math.abs(t)>.91)continue;
        patch(s,t,(.115+row*.007)*(1+.035*Math.sin(row*13+col*7)),(.16+row*.002)*(1+.04*Math.cos(col*11+row*5)),16,10,true,10-row,row===6||row===8);
      }
    }
  }
  if(kind==='flight') {
    for(let i=0;i<8;i++) patch(.62+(i%3)*.027,-.84+i*.24,.35+(1-Math.abs(i-3.5)/4)*.09,.19,18,10,true,-8+i);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));if(side>0)for(let i=0;i<indices.length;i+=3){const t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}
  geo.setIndex(indices);geo.computeVertexNormals();
  const open=geo.clone();open.setAttribute('position',new THREE.Float32BufferAttribute(spread,3));open.computeVertexNormals();
  geo.morphAttributes.position=[open.attributes.position.clone()];geo.morphAttributes.normal=[open.attributes.normal.clone()];open.dispose();
  return geo;
}
function finePlumage(surface,torsoOnly=false) {
  const random=seededRandom(28292),positions=[],normals=[],colors=[],uv=[],joints=[],weights=[],indices=[];
  const geo=surface.toNonIndexed(),p=geo.attributes.position,n=geo.attributes.normal;
  const sample=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let k=0;k<4200;k++) {
    const tri=Math.floor(random()*(p.count/3))*3,u=Math.sqrt(random()),v=random(),bary=[1-u,u*(1-v),u*v];
    sample.set(0,0,0);normal.set(0,0,0);
    for(let j=0;j<3;j++) {sample.addScaledVector(new THREE.Vector3().fromBufferAttribute(p,tri+j),bary[j]);normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(n,tri+j),bary[j]);}
    normal.normalize();
    const neck=!torsoOnly&&sample.y>.84&&sample.y<1.13&&sample.z>.10;
    if(sample.y<.22||sample.y>1.17||(!neck&&random()>.45))continue;
    // The wing owns its flank. Keep body plumage out of the folded wing surface.
    if(Math.abs(normal.x)>.5&&sample.z<.20&&sample.y>.4&&sample.y<.96)continue;
    const direction=new THREE.Vector3(0,-1,-.25);direction.addScaledVector(normal,-direction.dot(normal)).normalize();
    const across=new THREE.Vector3().crossVectors(direction,normal).normalize();
    const length=(neck?.022:.033)*( .8+random()*.4),width=neck?.0045:.0070;
    const base=positions.length/3;
    for(const [along,side,lift] of [[0,0,.0007],[.60,-1,.0018],[1,0,.0038],[.60,1,.0018]]) {
      const q=sample.clone().addScaledVector(direction,along*length).addScaledVector(across,side*width).addScaledVector(normal,lift);
      positions.push(...q.toArray());normals.push(...normal.toArray());colors.push(...(torsoOnly?c('#a7a0aa'):bodyColor(q)).multiplyScalar(.86+random()*.13).toArray());
      uv.push(.5,q.y);joints.push(0,1,2,0);weights.push(...skinWeights(q));
    }
    indices.push(base,base+2,base+1,base,base+3,base+2);
  }
  geo.dispose();
  const result=new THREE.BufferGeometry();
  for(const[name,data,size]of[['position',positions,3],['normal',normals,3],['color',colors,3],['uv',uv,2],['skinWeight',weights,4]])result.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  result.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));result.setIndex(indices);return result;
}
function createFace(head,m) {
  const sphere=new THREE.SphereGeometry(1,24,16),lids=[];
  for(const side of [-1,1]) {
    const eye=new THREE.Group();eye.name=side<0?'Eye_L':'Eye_R';eye.position.set(side*.201,.025,.104);
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(side*.91,.04,.41).normalize());head.add(eye);
    addMesh(sphere,m.rim,`EyeRim_${side}`,eye,[0,0,0],[.032,.033,.008]);
    addMesh(sphere,m.iris,`Iris_${side}`,eye,[0,0,.006],[.025,.026,.009]);
    addMesh(sphere,m.pupil,`Pupil_${side}`,eye,[0,0,.014],[.010,.012,.005]);
    addMesh(sphere,m.glint,`EyeGlint_${side}`,eye,[-.005,.007,.019],[.0025,.003,.001]);
    const lid=addMesh(new THREE.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI/2),m.head,`Lid_${side}`,eye,[0,.034,.008],[.033,.001,.011]);lids.push(lid);
  }
  // Short, tapered beak, horizontal split and a distinct matte cere.
  const beak=(lower=false)=>{
    const p=[],ind=[];
    for(let r=0;r<=12;r++)for(let col=0;col<=16;col++){
      const t=r/12,a=col/16*Math.PI*2,w=.045*(1-t)**.65+.001,h=(lower?.012:.024)*(1-t)**.6+.001;
      p.push(Math.cos(a)*w,-.047-t*.027+(lower?-.026:0)+Math.sin(a)*h,.19+t*.15);
      if(r<12&&col<16){const i=r*17+col;ind.push(i,i+1,i+17,i+1,i+18,i+17);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(ind);geo.computeVertexNormals();return geo;
  };
  addMesh(beak(),m.beak,'UpperBeak',head);
  const jaw=new THREE.Group();head.add(jaw);addMesh(beak(true),m.beak,'LowerBeak',jaw);
  addMesh(sphere,m.cere,'Cere',head,[0,-.024,.207],[.034,.012,.029]);
  const tip=new THREE.Object3D();tip.name='BeakTip';tip.position.set(0,-.074,.34);head.add(tip);
  return {lids,jaw,tip};
}
function tailGeometry() {
  const p=[],colors=[],ind=[];
  for(let f=0;f<10;f++){
    const off=p.length/3,offset=f-4.5;
    for(let r=0;r<=24;r++)for(let col=0;col<=10;col++){
      const t=r/24,u=col/10*2-1,outline=t>.76?Math.sqrt(Math.max(0,1-((t-.76)/.24)**2)):.92;
      p.push(offset*.035*(1+t*.2)+u*.036*outline,.47-t*.14+.002*(1-u*u)+(f-4.5)*.008*t+u*.018*outline,-.64-t*(.32+(1-Math.abs(offset)/5)*.045));
      colors.push(...c(t>.80?'#45414b':'#75717c').toArray());
      if(r<24&&col<10){const i=off+r*11+col;ind.push(i,i+1,i+11,i+1,i+12,i+11);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(ind);g.computeVertexNormals();return g;
}
function segment(mesh,a,b,radius) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
  mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.scale.set(radius,start.distanceTo(end),radius);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
}

export function createReferencePigeon({review='final'}={}) {
  const plain=review==='clay',flow=review==='flow',m=materials(plain);
  const root=new THREE.Group();root.name='ReferencePigeon_v4';
  const body=new THREE.Bone();body.name='Body';root.add(body);
  const neck=new THREE.Bone();neck.name='Neck';neck.position.copy(NECK);body.add(neck);
  const head=new THREE.Bone();head.name='Head';head.position.copy(HEAD).sub(NECK);neck.add(head);
  const skeleton=new THREE.Skeleton([body,neck,head]);
  const skin=new THREE.SkinnedMesh(bodyGeometry(),m.body);skin.name='BodySurface';skin.frustumCulled=false;skin.castShadow=true;skin.receiveShadow=true;
  root.add(skin);root.updateMatrixWorld(true);skin.bind(skeleton);
  let plumage=null;
  if(!plain){
    const material=new THREE.MeshPhysicalMaterial({vertexColors:true,color:'#ffffff',roughness:.91,sheen:.15,side:THREE.DoubleSide});
    plumage=new THREE.SkinnedMesh(finePlumage(skin.geometry),material);plumage.name='FinePlumage';plumage.frustumCulled=false;plumage.castShadow=false;plumage.receiveShadow=true;root.add(plumage);plumage.bind(skeleton);
  }
  const torsoGeo=bodyGeometry(true);
  torsoGeo.translate(0,-.60,.12).scale(.992,.992,.992).translate(0,.60,-.12);
  const fillColor=torsoGeo.attributes.color;
  for(let i=0;i<fillColor.count;i++)fillColor.setXYZ(i,...c('#a7a0aa').toArray());
  const fillMaterial=m.body.clone();if(fillMaterial.isMeshPhysicalMaterial)fillMaterial.iridescence=0;
  const torsoFill=addMesh(torsoGeo,fillMaterial,'DorsalVolume',body);
  torsoFill.castShadow=false;torsoFill.visible=false;
  const fillPlumes=plain?null:addMesh(finePlumage(torsoGeo,true),plumage.material,'DorsalPlumage',body);
  if(fillPlumes){fillPlumes.castShadow=false;fillPlumes.visible=false;}
  const face=createFace(head,m);
  const wings=[],spreading=[];
  for(const side of [-1,1]) {
    const hinge=new THREE.Group();hinge.name=side<0?'Wing_L':'Wing_R';hinge.position.set(side*.235,.90,.15);body.add(hinge);wings.push(hinge);
    const fold=new THREE.Group();fold.name=side<0?'Fold_L':'Fold_R';hinge.add(fold);
    const meshes=[];
    for(const kind of ['shell','flight','coverts','under-coverts']) {
      if(plain&&(kind==='coverts'||kind==='under-coverts'))continue;
      const geo=wingGeometry(side,kind,plain);geo.translate(-hinge.position.x,-hinge.position.y,-hinge.position.z);
      for (const attr of geo.morphAttributes.position) for(let i=0;i<attr.count;i++) attr.setXYZ(i,attr.getX(i)-hinge.position.x,attr.getY(i)-hinge.position.y,attr.getZ(i)-hinge.position.z);
      const mesh=addMesh(geo,m.wing,`Wing_${kind}_${side}`,fold);mesh.castShadow=kind==='shell';meshes.push(mesh);
      if(flow&&kind==='coverts'){mesh.material=new THREE.MeshNormalMaterial({side:THREE.DoubleSide});m.owned.push(mesh.material);}
    }
    if(flow)for(const s of [.12,.30,.48,.66])for(const t of [-.5,0,.5]){
      const a=referenceWingPoint(side,s,t,false,.025).sub(hinge.position);
      const b=referenceWingPoint(side,s+.07,t,false,.025).sub(hinge.position);
      fold.add(new THREE.ArrowHelper(b.clone().sub(a).normalize(),a,a.distanceTo(b),0x338767,.026,.014));
    }
    spreading.push(meshes);
  }
  const tail=addMesh(tailGeometry(),m.wing,'Tail',body);
  const feet=[],shins=[];
  const tube=new THREE.CylinderGeometry(1,1,1,12),sphere=new THREE.SphereGeometry(1,16,10);
  for(const side of [-1,1]) {
    const foot=new THREE.Group();foot.name=side<0?'Foot_L':'Foot_R';root.add(foot);feet.push(foot);
    const shin=addMesh(tube,m.feet,side<0?'Shin_L':'Shin_R',root);shins.push(shin);
    for(const [i,angle,length] of [[0,-.56,.17],[1,0,.20],[2,.63,.15],[3,Math.PI,.085]]) {
      const end=[Math.sin(angle)*length,.012,Math.cos(angle)*length];
      const toe=addMesh(tube,m.feet,`Toe_${side}_${i}`,foot);segment(toe,[0,.024,0],end,.015);
      addMesh(sphere,m.feet,`ToeJoint_${side}_${i}`,foot,[end[0]*.55,.018,end[2]*.55],[.017,.014,.018]);
      addMesh(sphere,m.claw,`Claw_${side}_${i}`,foot,end,[.010,.007,.023]);
    }
  }
  const originalPositions=new Map(), originalMorphs=new Map(), originalNormals=new Map();
  root.traverse(mesh=>{if(mesh.geometry){originalPositions.set(mesh.geometry,Float32Array.from(mesh.geometry.attributes.position.array));if(mesh.geometry.attributes.normal)originalNormals.set(mesh.geometry,Float32Array.from(mesh.geometry.attributes.normal.array));if(mesh.geometry.morphAttributes.position?.length)originalMorphs.set(mesh.geometry,mesh.geometry.morphAttributes.position.map(a=>Float32Array.from(a.array)));}});
  let disposed=false,roundness=82,lastMotion=null;
  const setRoundness=value=>{
    roundness=Number.isFinite(Number(value))?clamp(Number(value),0,100):82;
    const amount=(roundness-82)/100;
    // The sculpt is the baseline; roundness only adjusts torso + its attached wings.
    for(const [geo,original] of originalPositions){
      const isTorso=geo===skin.geometry||geo===plumage?.geometry||geo===torsoFill.geometry||geo===fillPlumes?.geometry,wing=wings.find(w=>w.children[0].children.some(o=>o.geometry===geo));
      if(!isTorso&&!wing)continue;
      const position=geo.attributes.position;
      for(let i=0;i<position.count;i++){
        const k=i*3,x=original[k],y=original[k+1],z=original[k+2];
        // Wing coordinates are relative to their hinge; deform both outlines coherently below.
        const worldY=y+(wing?.position.y||0),worldX=x+(wing?.position.x||0);
        const mask=(1-smooth(worldY,.83,1.08))*smooth(worldY,.12,.38);
        position.setXYZ(i,worldX*(1+amount*.20*mask)-(wing?.position.x||0),y,z);
        if(wing)for(let j=0;j<geo.morphAttributes.position.length;j++){
          const originalOpen=originalMorphs.get(geo)[j];
          geo.morphAttributes.position[j].setXYZ(i,originalOpen[k]+wing.position.x*amount*.20,originalOpen[k+1],originalOpen[k+2]);
        }
      }
      position.needsUpdate=true;for(const attr of geo.morphAttributes.position||[])attr.needsUpdate=true;
      if(geo===plumage?.geometry||geo===fillPlumes?.geometry){
        const normal=geo.attributes.normal,originalNormal=originalNormals.get(geo);
        for(let i=0;i<normal.count;i++){
          const k=i*3,y=original[i*3+1],mask=(1-smooth(y,.83,1.08))*smooth(y,.12,.38);
          const v=new THREE.Vector3(originalNormal[k]/(1+amount*.20*mask),originalNormal[k+1],originalNormal[k+2]).normalize();
          normal.setXYZ(i,v.x,v.y,v.z);
        }
        normal.needsUpdate=true;
      } else geo.computeVertexNormals();
      geo.computeBoundingSphere();
    }
  };
  function pose(motion) {
    lastMotion=motion;
    torsoFill.visible=motion.neckAngle>.20;
    if(fillPlumes)fillPlumes.visible=torsoFill.visible;
    body.position.y=-.035;
    body.rotation.set(motion.bodyPitch*.65,0,motion.leftStep*.04);
    const breath=(motion.breath??.5)-.5;body.scale.set(1+breath*.005,1+breath*.007,1+breath*.004);
    neck.position.copy(NECK);neck.position.y+=motion.neckBob*.95;neck.position.z+=motion.neckAngle*.03;
    neck.rotation.x=motion.neckAngle;head.rotation.y=motion.headTurn||0;head.rotation.x=-motion.neckAngle*.05;
    face.jaw.rotation.x=(motion.peck||0)*.09;
    face.lids.forEach(lid=>{const blink=motion.blink||0;lid.scale.y=.001+blink*.033;lid.position.y=.034-blink*.034;});
    for(let i=0;i<2;i++) {
      const side=i?1:-1;wings[i].rotation.z=side*motion.wingFlap;wings[i].rotation.x=-motion.wingOpen*.08;
      for(const mesh of spreading[i])mesh.morphTargetInfluences[0]=motion.wingOpen;
      const lift=i?motion.rightLift:motion.leftLift,step=i?motion.rightStep:motion.leftStep;
      feet[i].position.set(side*.18,.018+lift+motion.legTuck*.28,.13+step-motion.legTuck*.18);
      feet[i].rotation.x=-motion.legTuck*.7;
      segment(shins[i],[side*.19,.255,.045],feet[i].position.toArray(),.024);
    }
    tail.rotation.z=motion.leftStep*.06;
  }
  return {root,source:'reference',name:'참고 이미지 기반 비둘기 v4',animations:['idle','walk','eat','fly'],setRoundness,pose,
    inspect(){root.updateMatrixWorld(true);const p=face.tip.getWorldPosition(new THREE.Vector3()),f=feet[0].getWorldPosition(new THREE.Vector3());return {beakHeight:p.y,footHeight:f.y,footZ:f.z,wingAngle:(lastMotion?.wingOpen||0)*Math.PI/2+wings[1].rotation.z,height:root.position.y,x:root.position.x,z:root.position.z};},
    dispose(){if(disposed)return;disposed=true;const geometries=new Set(),mats=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const mat of [o.material].flat().filter(Boolean)){mats.add(mat);for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);}});for(const v of m.owned.filter(Boolean)){if(v.isTexture)textures.add(v);else mats.add(v);}geometries.forEach(g=>g.dispose());mats.forEach(mat=>mat.dispose());textures.forEach(t=>t.dispose());skeleton.dispose();root.removeFromParent();},
  };
}
