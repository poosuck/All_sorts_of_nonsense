import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createReferencePigeon,referenceWingPoint} from '../../src/features/pigeon/reference-pigeon.js';
import {sampleMotion} from '../../src/features/pigeon/motion.js';

test('reference bird owns a rounded skinned body, connected wings and deterministic shape controls',()=>{
 const bird=createReferencePigeon();
 const skin=bird.root.getObjectByName('BodySurface'),original=Float32Array.from(skin.geometry.attributes.position.array);
 for(const amount of [0,100,82])bird.setRoundness(amount);
 assert.deepEqual(skin.geometry.attributes.position.array,original,'baseline restores without cumulative sculpting');
 for(const mode of ['idle','walk','eat','fly'])for(const t of [0,.9,1.4,2.1,7.0]){
  bird.pose(sampleMotion(mode,t));bird.root.updateMatrixWorld(true);
  const values=bird.inspect();assert.ok(Object.values(values).every(Number.isFinite));
  if(mode==='eat')assert.ok(values.beakHeight>.005,'beak stays above the floor during pecks');
  for(let i=0;i<skin.geometry.attributes.position.count;i+=31){const vertex=skin.getVertexPosition(i,new THREE.Vector3());assert.ok(vertex.toArray().every(Number.isFinite));assert.ok(vertex.y>0,'animated skin stays above the floor');}
 }
 for(const side of [-1,1]){
  const wing=bird.root.getObjectByName(side<0?'Wing_L':'Wing_R');
  assert.equal(wing.children[0].children.length,4);
  for(const mesh of wing.children[0].children){
   assert.equal(mesh.geometry.morphAttributes.position[0].count,mesh.geometry.attributes.position.count);
   for(let i=0;i<mesh.geometry.attributes.position.count;i+=37){
    for(const spread of [0,.5,1]){mesh.morphTargetInfluences[0]=spread;assert.ok(mesh.getVertexPosition(i,new THREE.Vector3()).toArray().every(Number.isFinite));}
   }
  }
 }
 // Stored smooth normals must agree with the winding. DoubleSide otherwise
 // flips outward normals inward and turns tiny feathers into dark speckles.
 const fine=bird.root.getObjectByName('FinePlumage').geometry;
 for(let i=0;i<fine.index.count;i+=3){
  const ids=[0,1,2].map(j=>fine.index.getX(i+j));
  const points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(fine.attributes.position,id));
  const face=new THREE.Vector3().subVectors(points[1],points[0]).cross(new THREE.Vector3().subVectors(points[2],points[0])).normalize();
  const normal=ids.map(id=>new THREE.Vector3().fromBufferAttribute(fine.attributes.normal,id)).reduce((a,b)=>a.add(b),new THREE.Vector3()).normalize();
  assert.ok(face.dot(normal)>.2,'plumage winding agrees with outward normals');
 }
 const samples=[.02,.2,.5,.8,1];
 for(const s of samples){const l=referenceWingPoint(-1,s,0),r=referenceWingPoint(1,s,0);assert.ok(Math.abs(l.x+r.x)<1e-8);assert.equal(l.y,r.y);assert.equal(l.z,r.z);}
 bird.dispose();bird.dispose();assert.equal(bird.root.parent,null);
});


test('clay and direction-review variants construct and release their diagnostic geometry',()=>{
 for(const review of ['clay','flow']){
  const bird=createReferencePigeon({review});
  bird.setRoundness(82);bird.pose(sampleMotion('idle',0));
  assert.ok(Number.isFinite(bird.inspect().beakHeight));
  bird.dispose();
 }
});
