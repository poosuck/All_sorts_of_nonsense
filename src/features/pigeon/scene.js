import * as THREE from "three";
import { advanceClock, MOTIONS, sampleMotion } from "./motion.js";
import { createPigeon, createPigeonMaterials } from "./pigeon-model.js";
import { createPark } from "./park.js";
import { createResourcePool, makeTexture } from "./resources.js";

export function createPigeonScene(container, { onMetrics, onError } = {}) {
  const pool = createResourcePool();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dee5d9");
  scene.fog = new THREE.Fog("#dee5d9", 32, 75);
  let renderer;
  const birds = [];
  let disposed = false, frame = 0, time = 0, lastTime = 0, lastReport = -1;
  let paused = false, contextLost = false, selected = 0;
  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
  const clock = { frameId: 0 };
  const observer = new ResizeObserver(resize);
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.domElement.setAttribute("aria-label", "공원의 비둘기 3D 동작 미리보기");
    renderer.domElement.setAttribute("role", "img");
    container.append(renderer.domElement);
    scene.add(new THREE.HemisphereLight("#fff4df", "#a2a99c", 1.9));
    const sun = new THREE.DirectionalLight("#ffedc8", 2.7);
    sun.position.set(-6, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 11, bottom: -11, near: 0.5, far: 40 });
    sun.shadow.normalBias = 0.045;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 3;
    scene.add(sun);
    createPark(scene, pool);
    const materials = createPigeonMaterials(pool);
    const shadowMap = pool.texture(makeTexture((ctx, w) => {
      const gradient = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gradient.addColorStop(0, "rgba(40,37,30,.38)");
      gradient.addColorStop(0.5, "rgba(40,37,30,.16)");
      gradient.addColorStop(1, "rgba(40,37,30,0)");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, w);
    }, 64));
    const origins = [
      { x: -1.65, z: 1.15, heading: 0.75, chicken: false, scale: 1.16, mode: "eat" },
      { x: 2.15, z: -0.6, heading: -0.48, chicken: true, scale: 1.32, mode: "eat" },
      { x: -4.2, z: -3.7, heading: 0.55, chicken: false, scale: 1, mode: "walk" },
      { x: 0.05, z: -4.6, heading: 0.9, chicken: false, scale: 0.92, mode: "eat" },
      { x: 4.2, z: -3.55, heading: -0.8, chicken: false, scale: 0.96, mode: "walk" },
      { x: -1.4, z: -7.8, heading: 0.8, chicken: false, scale: 0.86, mode: "walk" },
    ];
    origins.forEach((origin, i) => {
      const model = createPigeon(pool, materials, origin);
      model.root.scale.setScalar(origin.scale);
      model.root.position.set(origin.x, 0, origin.z);
      model.root.rotation.y = origin.heading;
      scene.add(model.root);
      const shadow = new THREE.Mesh(pool.geometry("bird-shadow", () => new THREE.PlaneGeometry(1, 1)), pool.material({ map: shadowMap, transparent: true, depthWrite: false, roughness: 1 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.006;
      shadow.scale.set(origin.chicken ? 3.2 : 2, origin.chicken ? 2.9 : 1.9, 1);
      scene.add(shadow);
      birds.push({ model, origin, shadow, mode: origin.mode, startTime: -i * 1.2, phase: "", poseState: sampleMotion(origin.mode, i * 1.2, i) });
    });
    const ringMaterial = pool.material({ color: "#758650", transparent: true, opacity: 0.58, roughness: 1, depthWrite: false, side: THREE.DoubleSide });
    const marker = new THREE.Mesh(pool.geometry("selection-ring", () => new THREE.RingGeometry(0.91, 0.927, 64)), ringMaterial);
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.015;
    scene.add(marker);

    function draw(timestamp) {
      if (disposed || contextLost) return;
      const delta = lastTime ? (timestamp - lastTime) / 1000 : 0;
      lastTime = timestamp;
      const suspended = paused || document.hidden;
      time = advanceClock(time, delta, suspended);
      if (!suspended || frame === 0) {
        birds.forEach((bird, i) => {
          const sample = sampleMotion(bird.mode, time - bird.startTime, i);
          bird.phase = sample.phase;
          const { origin, model } = bird;
          const sin = Math.sin(origin.heading), cos = Math.cos(origin.heading);
          const target = new THREE.Vector3(
            origin.x + (sample.x * cos + sample.z * sin) * origin.scale,
            sample.height * origin.scale,
            origin.z + (-sample.x * sin + sample.z * cos) * origin.scale,
          );
          const blend = frame === 0 ? 1 : 1 - Math.exp(-Math.max(delta, 0.001) * 12);
          model.root.position.lerp(target, blend);
          const angle = origin.heading + sample.yaw;
          model.root.rotation.y += Math.atan2(Math.sin(angle - model.root.rotation.y), Math.cos(angle - model.root.rotation.y)) * blend;
          for (const key of Object.keys(sample)) {
            if (typeof sample[key] === "number") bird.poseState[key] += (sample[key] - bird.poseState[key]) * blend;
          }
          model.pose(bird.poseState);
          bird.shadow.position.x = model.root.position.x;
          bird.shadow.position.z = model.root.position.z;
          bird.shadow.material.opacity = 1 / (1 + model.root.position.y * 0.65);
          const spread = 1 + model.root.position.y * 0.1;
          bird.shadow.scale.set((origin.chicken ? 3.2 : 2) * spread, (origin.chicken ? 2.9 : 1.9) * spread, 1);
        });
        const active = birds[selected];
        marker.position.x = active.model.root.position.x;
        marker.position.z = active.model.root.position.z;
        marker.scale.setScalar(active.origin.chicken ? 1.5 : 1.12);
        renderer.render(scene, camera);
        frame++;
      }
      if (time - lastReport >= 0.15 || lastReport < 0) {
        report(); lastReport = time;
      }
      clock.frameId = requestAnimationFrame(draw);
    }

    function report() {
      const active = birds[selected];
      onMetrics?.({
        ready: true, frame, time, paused: paused || document.hidden,
        kind: active.origin.chicken ? "chicken" : "normal", mode: active.mode,
        phase: active.phase, count: birds.length,
        ...active.model.inspect(),
      });
    }
    function visibility() { lastTime = 0; lastReport = -1; report(); }
    function loseContext(event) {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(clock.frameId);
      onError?.("3D 연결이 중단되었습니다. 장면 다시 불러오기를 눌러 주세요.");
    }
    document.addEventListener("visibilitychange", visibility);
    renderer.domElement.addEventListener("webglcontextlost", loseContext);
    observer.observe(container);
    resize();
    clock.frameId = requestAnimationFrame(draw);
    return {
      setMotion(mode) {
        if (!Object.hasOwn(MOTIONS, mode)) return;
        birds[selected].mode = mode;
        birds[selected].startTime = time;
        lastReport = -1;
      },
      selectKind(kind) {
        selected = kind === "chicken" ? 1 : 0;
        lastReport = -1; report();
      },
      setPaused(value) { paused = value; lastTime = 0; report(); },
      reset() {
        time = 0; lastReport = -1; frame = 0;
        birds.forEach((bird, i) => { bird.startTime = -i * 1.2; bird.mode = bird.origin.mode; });
        selected = 0; paused = false; lastTime = 0;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(clock.frameId);
        observer.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        renderer.domElement.removeEventListener("webglcontextlost", loseContext);
        release();
      },
    };
  } catch (error) {
    observer.disconnect();
    release();
    throw error;
  }

  function resize() {
    if (!renderer || disposed) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    // Fixed view; narrower PC windows pull back instead of clipping the flock.
    const extra = Math.max(0, 1.55 - camera.aspect) * 5;
    camera.position.set(4.5 + extra * 0.2, 4.8 + extra * 0.4, 11.5 + extra);
    camera.lookAt(0.1, 1.0, -1.3);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (frame > 0 && !contextLost) renderer.render(scene, camera);
  }
  function release() {
    scene.traverse((object) => {
      // The resource pool owns shared geometry/materials; each instance owns its buffers.
      if (object.isInstancedMesh) object.dispose();
      if (object.isLight && object.shadow) object.shadow.dispose();
    });
    scene.clear(); pool.dispose();
    renderer?.dispose();
    if (renderer && !contextLost) renderer.forceContextLoss();
    renderer?.domElement.remove();
  }
}
