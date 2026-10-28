import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

const CLIP_MATCH = Object.freeze({
  idle: /idle|stand|rest|breath|waiting/i,
  walk: /walk|run|stride|step/i,
  eat: /eat|peck|feed|feeding/i,
  fly: /fly|flight|flap|takeoff|flying/i,
});

function namedPart(root, pattern) {
  let match;
  root.traverse((node) => {
    if (!match && pattern.test(node.name) && (node.isBone || node.isObject3D)) match = node;
  });
  return match;
}

export function createOpenPigeon(gltf) {
  const model = cloneSkinned(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error("무료 비둘기 GLB에 3D 형상이 없습니다.");
  const dimensions = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(dimensions.y) || dimensions.y < 0.001) {
    throw new Error("무료 비둘기 GLB의 높이를 계산하지 못했습니다.");
  }

  // Existing v3 scene is stylized and uses a larger authoring scale.
  // Normalize the imported model once; never deform the source geometry.
  const scale = 1.32 / dimensions.y;
  const center = bounds.getCenter(new THREE.Vector3());
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  const root = new THREE.Group();
  root.name = "OpenLicensePigeon";
  root.add(model);

  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.isSkinnedMesh) object.frustumCulled = false;
    }
  });

  const mixer = gltf.animations.length ? new THREE.AnimationMixer(model) : null;
  const head = namedPart(model, /(?:^|[._ -])(head|neck)(?:$|[._ -])/i);
  const leftWing = namedPart(model, /(?:^|[._ -])(left.?wing|wing.?l)(?:$|[._ -])/i);
  const rightWing = namedPart(model, /(?:^|[._ -])(right.?wing|wing.?r)(?:$|[._ -])/i);
  const headRest = head?.rotation.clone();
  const wingRest = [leftWing?.rotation.clone(), rightWing?.rotation.clone()];
  let lastMode = "";
  let action = null;
  let activeClip = null;
  const probe = new THREE.Vector3();

  function selectClip(mode) {
    if (!mixer) return;
    const preferred = gltf.animations.find((clip) => CLIP_MATCH[mode]?.test(clip.name));
    // Do not play an unrelated clip as if it were a matching action.
    const candidate = preferred || (mode === "idle" ? gltf.animations[0] : null);
    if (activeClip === candidate) return;
    mixer.stopAllAction();
    action = null;
    activeClip = candidate;
    if (!candidate) return;
    action = mixer.clipAction(candidate);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
  }

  return {
    root,
    source: "open",
    animations: gltf.animations.map((clip) => clip.name),
    pose(motion, seconds = 0, mode = "idle") {
      if (lastMode !== mode) {
        selectClip(mode);
        lastMode = mode;
      }
      if (action && mixer) {
        // Seek deterministically: clock pause and timeline scrubbing both work.
        mixer.setTime(Math.max(0, seconds));
      }
      // A static CC0 GLB still has a faint breathing/bobbing motion.
      // Named part pivots are used only if native animation is not available.
      if (!action) {
        if (head && headRest) {
          head.rotation.copy(headRest);
          head.rotation.x += mode === "eat" ? motion.neckAngle * 0.24 : mode === "walk" ? Math.sin(seconds * 8) * 0.04 : Math.sin(seconds * 1.7) * 0.02;
          head.rotation.y += mode === "idle" ? Math.sin(seconds * 0.8) * 0.06 : 0;
        }
        if (mode === "fly") {
          if (leftWing && wingRest[0]) { leftWing.rotation.copy(wingRest[0]); leftWing.rotation.z += motion.wingFlap * 0.7; }
          if (rightWing && wingRest[1]) { rightWing.rotation.copy(wingRest[1]); rightWing.rotation.z -= motion.wingFlap * 0.7; }
        } else {
          if (leftWing && wingRest[0]) leftWing.rotation.copy(wingRest[0]);
          if (rightWing && wingRest[1]) rightWing.rotation.copy(wingRest[1]);
        }
      }
      // Rotate the *inner* mesh rather than the scene-controlled outer root.
      model.rotation.z = mode === "walk" ? Math.sin(seconds * 8.8) * 0.014 : 0;
      model.rotation.x = mode === "eat" && !action ? motion.bodyPitch * 0.18 : 0;
    },
    inspect() {
      root.updateWorldMatrix(true, true);
      if (head) head.getWorldPosition(probe);
      else root.getWorldPosition(probe).add(new THREE.Vector3(0, 1.05, 0));
      const beakHeight = probe.y;
      return {
        beakHeight, footHeight: root.position.y, footZ: root.position.z,
        wingAngle: 0, height: root.position.y,
        x: root.position.x, z: root.position.z,
      };
    },
  };
}
