import * as THREE from "three";

function segment(mesh, start, end, radius) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.scale.set(radius, a.distanceTo(b), radius);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
}
export function bindPigeonRig(root, chicken = false) {
  const node = (name) => {
    const result = root.getObjectByName(name);
    if (!result) throw new Error(`Missing pigeon model node: ${name}`);
    return result;
  };
  const torso = node("Body"), neck = node("Neck"), head = node("Head"), tip = node("BeakTip");
  const wings = [node("Wing_L"), node("Wing_R")], folds = [node("Fold_L"), node("Fold_R")];
  const spreading = folds.map((fold) => fold.children.filter((child) => child.morphTargetInfluences?.length));
  const identity = new THREE.Quaternion();
  const opened = [-1, 1].map((side) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, side, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-side, 0, 0),
  )));
  const feet = [node("Foot_L"), node("Foot_R")], shins = [node("Shin_L"), node("Shin_R")];
  const baseNeck = neck.position.clone();
  let anatomy;
  root.traverse((item) => { if (item.userData.anatomy) anatomy = item.userData.anatomy; });
  const lids = [root.getObjectByName("Lid_L"), root.getObjectByName("Lid_R")].filter(Boolean);
  const jaw = root.getObjectByName("Jaw"), tail = root.getObjectByName("Tail");
  const probe = new THREE.Vector3();
  return {
    root, torso, neck, head, wings,
    pose(motion) {
      const dip = THREE.MathUtils.clamp(motion.neckAngle / 1.28, 0, 1);
      torso.rotation.x = motion.bodyPitch * (motion.wingOpen > .1 ? (chicken ? .5 : 1.1) : chicken ? .28 : .75);
      torso.rotation.z = motion.leftStep * (chicken ? .15 : .055);
      const breathing = (motion.breath ?? .5) - .5;
      torso.scale.set(1 + breathing * .009, 1 + breathing * .012, 1 + breathing * .006);
      neck.rotation.x = motion.neckAngle;
      neck.position.y = baseNeck.y + motion.neckBob * (anatomy?.peckDrop ?? (chicken ? 2.3 : 1.8));
      neck.position.z = baseNeck.z + dip * (anatomy?.peckReach ?? (chicken ? .34 : .22)) + motion.neckBob * .22 * (1 - dip);
      head.rotation.x = dip * -.05;
      head.rotation.y = motion.headTurn || 0;
      if (jaw) jaw.rotation.x = (motion.peck || 0) * .11;
      if (tail) tail.rotation.z = motion.leftStep * .12;
      for (const lid of lids) lid.morphTargetInfluences[0] = motion.blink || 0;
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        wings[i].rotation.z = side * motion.wingFlap;
        wings[i].rotation.x = motion.wingOpen * -.08;
        folds[i].quaternion.slerpQuaternions(identity, opened[i], motion.wingOpen);
        for (const mesh of spreading[i]) mesh.morphTargetInfluences[0] = motion.wingOpen;
        const step = i ? motion.rightStep : motion.leftStep;
        const lift = i ? motion.rightLift : motion.leftLift;
        feet[i].position.set(side * (chicken ? .26 : .185), .06 + lift * (chicken ? .75 : 1) + motion.legTuck * .32, .13 + step * (chicken ? .7 : 1) - motion.legTuck * .25);
        feet[i].rotation.x = -motion.legTuck * .85;
        segment(shins[i], [side * (chicken ? .29 : .2), chicken ? .3 : .39, -.025], feet[i].position.toArray(), chicken ? .020 : .018);
      }
    },
    inspect() {
      root.updateWorldMatrix(true, true);
      tip.getWorldPosition(probe); const beakHeight = probe.y;
      feet[0].getWorldPosition(probe);
      return { beakHeight, footHeight: probe.y, footZ: probe.z, wingAngle: folds[1].quaternion.angleTo(identity) + wings[1].rotation.z, height: root.position.y, x: root.position.x, z: root.position.z };
    },
    dispose() { root.traverse((object) => { if (object.isSkinnedMesh) object.skeleton.dispose(); }); root.removeFromParent(); },
  };
}
