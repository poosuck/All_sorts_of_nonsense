import * as THREE from "three";
import { advanceClock, MOTIONS, sampleMotion } from "./motion.js";
import { loadPigeonAssets } from "./pigeon-model.js";
import { createPark } from "./park.js";
import { createResourcePool, makeTexture } from "./resources.js";

export async function createPigeonScene(container, { onMetrics, onError, signal, initialView = "park" } = {}) {
  const assets = await loadPigeonAssets(signal);
  const pool = createResourcePool();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dee5d9");
  scene.fog = new THREE.Fog("#dee5d9", 32, 75);
  const parkFog = scene.fog;
  let renderer;
  const birds = [];
  let disposed = false, frame = 0, time = 0, lastTime = 0, lastReport = -1;
  let paused = false, contextLost = false, selected = 0;
  let view = initialView, dirty = true;
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
    scene.add(new THREE.HemisphereLight("#f2f5ff", "#a49b86", 1.25));
    const sun = new THREE.DirectionalLight("#fff0ce", 3.15);
    sun.position.set(-6, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 11, bottom: -11, near: 0.5, far: 40 });
    sun.shadow.normalBias = 0.045;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 3;
    scene.add(sun);
    const environment = new THREE.Group(); scene.add(environment);
    createPark(environment, pool);
    const studio = new THREE.Mesh(pool.geometry("studio-floor", () => new THREE.PlaneGeometry(100, 100)), pool.material({ color: "#eee6d7", roughness: .95 }));
    studio.rotation.x = -Math.PI / 2; studio.position.y = -.025; studio.receiveShadow = true; scene.add(studio);
    const shadowMap = pool.texture(makeTexture((ctx, w) => {
      const gradient = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gradient.addColorStop(0, "rgba(40,37,30,.38)");
      gradient.addColorStop(0.5, "rgba(40,37,30,.16)");
      gradient.addColorStop(1, "rgba(40,37,30,0)");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, w);
    }, 64));
    const origins = [
      { x: -1.65, z: 1.15, heading: 0.75, chicken: false, scale: 1.16, mode: "eat" },
      { x: 2.15, z: 0.2, heading: -0.48, chicken: true, scale: 1.14, mode: "eat" },
      { x: -4.2, z: -3.7, heading: 0.55, chicken: false, scale: 1, mode: "walk" },
      { x: 0.05, z: -4.6, heading: 0.9, chicken: false, scale: 0.92, mode: "eat" },
      { x: 4.2, z: -3.55, heading: -0.8, chicken: false, scale: 0.96, mode: "walk" },
      { x: -1.4, z: -7.8, heading: 0.8, chicken: false, scale: 0.86, mode: "walk" },
    ];
    origins.forEach((origin, i) => {
      const model = assets.create(origin.chicken);
      // Fine foreground plumage is unnecessary on the smaller background birds.
      if (i >= 2) model.root.getObjectByName("FinePlumage").visible = false;
      model.root.scale.setScalar(origin.scale);
      model.root.position.set(origin.x, 0, origin.z);
      model.root.rotation.y = origin.heading;
      scene.add(model.root);
      const shadow = new THREE.Mesh(pool.geometry("bird-shadow", () => new THREE.PlaneGeometry(1, 1)), pool.material({ map: shadowMap, transparent: true, depthWrite: false, roughness: 1 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.006;
      shadow.scale.set(origin.chicken ? 3.2 : 2, origin.chicken ? 2.9 : 1.9, 1);
      scene.add(shadow);
      const initialTime = view === "park" ? i * 1.2 : 0;
      birds.push({ model, origin, shadow, mode: origin.mode, startTime: -initialTime, phase: "", poseState: sampleMotion(origin.mode, initialTime, view === "park" ? i : 0) });
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
      if (!suspended || frame === 0 || dirty) {
        const review = view !== "park";
        environment.visible = !review; studio.visible = review;
        scene.background.set(review ? "#f4efe6" : "#dee5d9");
        scene.fog = review ? null : parkFog;
        birds.forEach((bird, i) => {
          const sample = sampleMotion(bird.mode, (time - bird.startTime) * (bird.origin.chicken && bird.mode === "walk" ? .78 : 1), review ? 0 : i);
          bird.phase = sample.phase;
          const { origin, model } = bird;
          const sin = Math.sin(origin.heading), cos = Math.cos(origin.heading);
          const target = new THREE.Vector3(
            review ? (i === 0 ? -1.6 : 1.45) : origin.x + (sample.x * cos + sample.z * sin) * origin.scale,
            sample.height * origin.scale,
            review ? 0 : origin.z + (-sample.x * sin + sample.z * cos) * origin.scale,
          );
          model.root.visible = !review || i < 2; bird.shadow.visible = model.root.visible;
          const blend = frame === 0 || dirty ? 1 : 1 - Math.exp(-Math.max(delta, 0.001) * 12);
          model.root.position.lerp(target, blend);
          const angle = review ? (view === "side" ? Math.PI / 2 : view === "turntable" ? time * .4 : .18) : origin.heading + sample.yaw;
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
        marker.visible = !review;
        renderer.render(scene, camera);
        frame++; dirty = false;
      }
      if (time - lastReport >= 0.15 || lastReport < 0) {
        report(); lastReport = time;
      }
      clock.frameId = requestAnimationFrame(draw);
    }

    function report() {
      const active = birds[selected];
      onMetrics?.({
        ready: true, frame, time, paused: paused || document.hidden, view, revision: 2,
        kind: active.origin.chicken ? "chicken" : "normal", mode: active.mode,
        clipTime: Math.max(0, time - active.startTime),
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
        if (view !== "park") for (const bird of birds.slice(0, 2)) { bird.mode = mode; bird.startTime = time; }
        dirty = true; resize();
        lastReport = -1;
      },
      selectKind(kind) {
        selected = kind === "chicken" ? 1 : 0;
        lastReport = -1; report();
      },
      setPaused(value) { paused = value; lastTime = 0; report(); },
      setView(value) {
        if (!["park", "front", "side", "turntable"].includes(value)) return;
        view = value; dirty = true;
        if (view !== "park") {
          const mode = birds[selected].mode, start = birds[selected].startTime;
          for (const bird of birds.slice(0, 2)) { bird.mode = mode; bird.startTime = start; }
        }
        resize(); lastReport = -1;
      },
      seek(value) {
        time = Math.max(0, value); paused = true; dirty = true; lastTime = 0; lastReport = -1;
        for (const bird of birds) bird.startTime = 0;
      },
      reset() {
        time = 0; lastReport = -1; frame = 0;
        birds.forEach((bird, i) => { bird.startTime = -i * 1.2; bird.mode = bird.origin.mode; });
        selected = 0; paused = false; lastTime = 0; dirty = true; resize();
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
    if (width > 700) camera.setViewOffset(width, height, Math.min(155, width * .12), 0, width, height);
    else camera.clearViewOffset();
    // Fixed view; narrower PC windows pull back instead of clipping the flock.
    const extra = Math.max(0, 1.55 - camera.aspect) * 5;
    if (view !== "park") {
      const flying = birds[selected]?.mode === "fly";
      camera.position.set(0, flying ? 2.6 : 1.9, (flying ? 11.8 : 8.7) + extra);
      camera.lookAt(0, flying ? 1.8 : .95, 0);
    } else {
      camera.position.set(3.1 + extra * .2, 3.1 + extra * .4, 10.9 + extra);
      camera.lookAt(.15, .85, -1.2);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (frame > 0 && !contextLost && !dirty) renderer.render(scene, camera);
  }
  function release() {
    scene.traverse((object) => {
      // The resource pool owns shared geometry/materials; each instance owns its buffers.
      if (object.isInstancedMesh) object.dispose();
      if (object.isSkinnedMesh) object.skeleton.dispose();
      if (object.isLight && object.shadow) object.shadow.dispose();
    });
    scene.clear(); pool.dispose(); assets.dispose();
    renderer?.dispose();
    if (renderer && !contextLost) renderer.forceContextLoss();
    renderer?.domElement.remove();
  }
}
