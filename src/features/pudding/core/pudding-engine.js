// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.
import { WhipRope, SonicBoomGate } from "./whip-rope.js";
import { WhipOverlay } from "./whip-overlay.js";
import { convexHull, ropeContacts } from "./whip-contact.js";
import { WHIP_SWING_AUDIO, WHIP_HIT_AUDIO } from "./whip-audio-data.js";
import { WhipSwingGate } from "./pudding-whip.js";
import { BOWL_CURSOR } from "./pudding-tools.js";
import { BOWL_AUDIO_BASE64 } from "./bowl-audio-data.js";
import { getFlavor } from "./pudding-flavors.js";
import { StrikeAudio } from "./strike-audio.js";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { StrikeMotion, strikeStrength, sweepContact } from "./pudding-strike.js";
import { canStartPointer, isActivePointer } from "./pudding-input.js";
import { PuddingPhysics, deformPoint } from "./pudding-physics.js";
const palm = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 32 32"><path d="M9 17V8a2 2 0 0 1 4 0v7-10a2 2 0 0 1 4 0v10-8a2 2 0 0 1 4 0v9-5a2 2 0 0 1 4 0v10c0 6-3 9-8 9-4 0-6-2-8-5l-5-7a2 2 0 0 1 3-3l4 4" fill="#fff0d3" stroke="#753e20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PALM_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(palm)}") 24 24, grab`;
export class PuddingEngine {
    container;
    onMode;
    onError;
    renderer;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    physics = new PuddingPhysics();
    // Base gains calibrated to -32 LUFS, then adjusted to the requested mix.
    // Bowl measurement pads its <400 ms region with silence for the BS.1770 window.
    // Hand skips 0.2 seconds; swing gain is 80% of the calibrated level.
    handSound = new StrikeAudio(undefined, 0.2, .875992 * 12);
    bowlSound = new StrikeAudio(BOWL_AUDIO_BASE64, 0.05, .220039);
    whipSound = new StrikeAudio(WHIP_HIT_AUDIO, 0, .198381, 1);
    whipSwingSound = new StrikeAudio(WHIP_SWING_AUDIO, 0, .343163 * .8, 3);
    swingGate = new WhipSwingGate();
    rope = new WhipRope();
    whipOverlay;
    boomGate = new SonicBoomGate();
    lastWhipHit = -Infinity;
    whipOutsideSince = 0;
    get allSounds() { return [this.handSound, this.bowlSound, this.whipSound, this.whipSwingSound]; }
    stopSounds() { this.allSounds.forEach(sound => sound.stop()); }
    strikeTool = "hand";
    soundEnabled = true;
    get sound() { return this.strikeTool === "whip" ? this.whipSound : this.strikeTool === "bowl" ? this.bowlSound : this.handSound; }
    get strikeCursor() { return this.strikeTool === "whip" ? "none" : this.strikeTool === "bowl" ? BOWL_CURSOR : PALM_CURSOR; }
    meshes = [];
    flavorTransition = null;
    originals = [];
    env;
    observer;
    frame = 0;
    last = 0;
    mode = "ready";
    anchor = new THREE.Vector3(0, 2, 0);
    normal = new THREE.Vector3(0, 1, 0);
    ray = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    dragPlane = new THREE.Plane();
    grabWorld = new THREE.Vector3();
    planePoint = new THREE.Vector3();
    start = { x: 0, y: 0, time: 0 };
    held = false;
    striking = false;
    strikeLatched = false;
    motion = new StrikeMotion();
    strikePrevious = { x: 0, y: 0, t: 0 };
    hitUntil = 0;
    trail;
    flash;
    dragged = false;
    pointerId = null;
    startQ = { x: 0, z: 0, squash: 0, dent: 0 };
    disposed = false;
    dirty = true;
    cleanup = [];
    constructor(container, onMode, onError) {
        this.container = container;
        this.onMode = onMode;
        this.onError = onError;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        this.whipOverlay = new WhipOverlay();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.matchMedia("(pointer: coarse)").matches ? 1.25 : 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.scene.background = new THREE.Color("#f5f1e8");
        this.camera.position.set(4.8, 5.1, 8.1);
        this.camera.lookAt(0, 1.05, 0);
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        const room = new RoomEnvironment();
        this.env = pmrem.fromScene(room, .04);
        this.scene.environment = this.env.texture;
        room.dispose();
        pmrem.dispose();
        this.scene.add(new THREE.HemisphereLight(0xfff5df, 0xb59970, 1.7));
        const key = new THREE.DirectionalLight(0xfff1d9, 3.4);
        key.position.set(-3.5, 7, 4);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -5;
        key.shadow.camera.right = 5;
        key.shadow.camera.top = 5;
        key.shadow.camera.bottom = -5;
        key.shadow.normalBias = .025;
        key.shadow.bias = -.0002;
        key.shadow.radius = 4;
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 1.2);
        fill.position.set(4, 3, -3);
        this.scene.add(fill);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x6b5435, opacity: .19 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = .001;
        ground.receiveShadow = true;
        this.scene.add(ground);
        // Analytical contact shadow, kept subtle beneath the real moving shadow.
        const pixels = new Uint8Array(64 * 64 * 4);
        for (let y = 0; y < 64; y++)
            for (let x = 0; x < 64; x++) {
                const i = (y * 64 + x) * 4, r = ((x - 31.5) ** 2 + (y - 31.5) ** 2) / 700;
                pixels[i] = 84;
                pixels[i + 1] = 61;
                pixels[i + 2] = 27;
                pixels[i + 3] = Math.round(Math.max(0, Math.exp(-r * 4.3) - .006) * 80);
            }
        const shadowTexture = new THREE.DataTexture(pixels, 64, 64);
        shadowTexture.needsUpdate = true;
        shadowTexture.magFilter = THREE.LinearFilter;
        const contact = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
        contact.rotation.x = -Math.PI / 2;
        contact.position.y = .005;
        this.scene.add(contact);
        this.cleanup.push(() => shadowTexture.dispose());
        const custardProfile = [[0, .03], [.6, .03], [1.19, .035], [1.32, .09], [1.36, .2], [1.33, .34], [1.25, .8], [1.14, 1.43], [1.065, 1.85], [1.035, 1.95], [.96, 1.99], [.6, 2], [0, 2]];
        const caramelProfile = [[1.07, 1.88], [1.062, 1.94], [1.038, 2.008], [.99, 2.032], [.88, 2.037], [.5, 2.045], [0, 2.045]];
        const custard = new THREE.MeshPhysicalMaterial({ color: 0xffd25d, roughness: .29, metalness: 0, clearcoat: .5, clearcoatRoughness: .21, envMapIntensity: .65 });
        const caramel = new THREE.MeshPhysicalMaterial({ color: 0x954016, roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.15, side: THREE.DoubleSide });
        this.addLathe(custardProfile, custard, 62);
        this.addLathe(caramelProfile, caramel, 30);
        const body = this.meshes[0].geometry;
        const pos = body.getAttribute("position"), colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
            const t = pos.getY(i) / 2;
            const color = new THREE.Color().setRGB(1, .66 + .2 * (1 - t), .19 + .19 * (1 - t));
            color.toArray(colors, i * 3);
        }
        body.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        custard.color.set(0xffffff);
        custard.vertexColors = true;
        const canvas = this.renderer.domElement;
        canvas.setAttribute("aria-label", "3D 푸딩 — 손가락이나 마우스로 누르고 잡아 늘려보세요");
        this.container.appendChild(canvas);
        this.trail = document.createElement("div");
        this.trail.className = "strike-trail";
        this.flash = document.createElement("div");
        this.flash.className = "strike-flash";
        this.container.appendChild(this.trail);
        this.container.appendChild(this.flash);
        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(container);
        this.listen(window, "pointerdown", this.down);
        this.listen(window, "pointermove", this.move);
        this.listen(window, "pointerup", this.up);
        this.listen(window, "pointercancel", this.up);
        this.listen(canvas, "lostpointercapture", this.up);
        this.listen(canvas, "contextmenu", (e) => { if (this.held)
            e.preventDefault(); });
        this.listen(canvas, "pointerleave", () => { if (!this.held && !this.striking)
            canvas.style.cursor = "default"; });
        this.listen(window, "pointerout", (e) => { if (!e.relatedTarget)
            this.up(e); });
        this.listen(window, "scroll", this.up);
        this.listen(window, "blur", this.up);
        this.listen(document, "visibilitychange", () => { if (document.hidden) {
            this.up();
            this.stopSounds();
        } this.last = 0; });
        this.listen(canvas, "webglcontextlost", (e) => { e.preventDefault(); cancelAnimationFrame(this.frame); this.up(); this.onError(); });
        this.frame = requestAnimationFrame(this.animate);
    }
    listen(target, event, callback) { target.addEventListener(event, callback); this.cleanup.push(() => target.removeEventListener(event, callback)); }
    addLathe(profile, material, count) {
        const curve = new THREE.CatmullRomCurve3(profile.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, "centripetal");
        const points = curve.getPoints(count).map(v => new THREE.Vector2(Math.max(0, v.x), v.y));
        const geometry = new THREE.LatheGeometry(points, 96);
        geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 5);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.meshes.push(mesh);
        this.originals.push(new Float32Array(geometry.attributes.position.array));
        this.scene.add(mesh);
    }
    resize() {
        const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
        if (this.held || this.striking)
            this.up();
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.fov = w / h < .9 ? 42 : 34;
        this.camera.updateProjectionMatrix();
    }
    setMode(mode) { if (mode !== this.mode) {
        this.mode = mode;
        this.onMode(mode);
    } }
    aim(e) {
        const r = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        this.ray.setFromCamera(this.pointer, this.camera);
    }
    down = (e) => {
        if (!canStartPointer(e, this.held || this.striking))
            return;
        if (e.target instanceof Element && e.target.closest("button,a,input,select,textarea,[role=slider],.pudding-slider,[contenteditable=true]"))
            return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        const onCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (e.pointerType !== "mouse" && !onCanvas)
            return;
        this.sound.unlock();
        if (this.strikeTool === "whip")
            this.whipSwingSound.unlock();
        this.aim(e);
        const hit = onCanvas ? this.ray.intersectObjects(this.meshes)[0] : undefined;
        if (!hit?.face || (this.strikeTool === "whip" && e.pointerType === "mouse")) {
            if (e.pointerType !== "mouse")
                return;
            e.preventDefault();
            this.striking = true;
            this.strikeLatched = false;
            this.pointerId = e.pointerId;
            this.strikePrevious = { x: e.clientX, y: e.clientY, t: performance.now() };
            this.motion.start(this.strikePrevious);
            this.swingGate.reset();
            if (this.strikeTool === "whip") {
                this.rope.reset(e.clientX, e.clientY, rect.height);
                this.boomGate.reset();
                this.lastWhipHit = -Infinity;
                this.whipOutsideSince = 0;
                this.whipOverlay.show();
            }
            this.renderer.domElement.setPointerCapture(e.pointerId);
            this.renderer.domElement.style.cursor = this.strikeCursor;
            this.container.classList.add("strike-ready");
            document.documentElement.style.setProperty("--pudding-hand", this.strikeCursor);
            document.documentElement.classList.add("pudding-strike-mode");
            this.setMode("armed");
            return;
        }
        e.preventDefault();
        this.held = true;
        this.dragged = false;
        this.pointerId = e.pointerId;
        this.start = { x: e.clientX, y: e.clientY, time: performance.now() };
        this.startQ = { ...this.physics.q };
        this.setAnchor(hit);
        this.grabWorld.copy(hit.point);
        this.dragPlane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()), hit.point);
        this.renderer.domElement.setPointerCapture(e.pointerId);
        this.renderer.domElement.style.cursor = "grabbing";
        this.physics.target = { ...this.physics.q, dent: .08 };
        this.setMode("press");
    };
    setAnchor(hit) {
        if (!hit.face)
            return;
        const meshIdx = this.meshes.indexOf(hit.object), original = this.originals[meshIdx];
        const positions = hit.object.geometry.getAttribute("position");
        const a = new THREE.Vector3().fromBufferAttribute(positions, hit.face.a);
        const b = new THREE.Vector3().fromBufferAttribute(positions, hit.face.b);
        const c = new THREE.Vector3().fromBufferAttribute(positions, hit.face.c);
        const bary = THREE.Triangle.getBarycoord(hit.point, a, b, c, new THREE.Vector3()) || new THREE.Vector3(1, 0, 0);
        this.anchor.set(0, 0, 0);
        for (const [idx, weight] of [[hit.face.a, bary.x], [hit.face.b, bary.y], [hit.face.c, bary.z]])
            this.anchor.addScaledVector(new THREE.Vector3().fromArray(original, idx * 3), weight);
        this.normal.copy(hit.face.normal).normalize();
    }
    strikeMove(e) {
        if (e.pointerId !== this.pointerId)
            return;
        if (!(e.buttons & 1)) {
            this.up();
            return;
        }
        const rect = this.renderer.domElement.getBoundingClientRect();
        if (e.clientX < 0 || e.clientX > window.innerWidth || e.clientY < 0 || e.clientY > window.innerHeight) {
            this.up();
            return;
        }
        const now = performance.now(), next = { x: e.clientX, y: e.clientY, t: now };
        // A paused pointer contributes zero motion at the start of the recent window.
        if (now - this.strikePrevious.t > 100)
            this.motion.start({ ...this.strikePrevious, t: now - 80 });
        this.motion.add(next);
        const velocity = this.motion.velocity(now);
        if (this.strikeTool === "whip") {
            this.rope.target = { x: e.clientX, y: e.clientY };
            this.strikePrevious = next;
            return;
        }
        const probe = (x, y) => { if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
            return undefined; this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1); this.ray.setFromCamera(this.pointer, this.camera); return this.ray.intersectObjects(this.meshes)[0]; };
        if (!this.strikeLatched) {
            const swept = sweepContact(this.strikePrevious, next, probe);
            if (swept?.contact.face) {
                this.strikeLatched = true;
                const hit = swept.contact;
                const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
                const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
                const direction = right.multiplyScalar(velocity.x).addScaledVector(up, -velocity.y).normalize();
                const incidence = Math.max(0, -direction.dot(hit.face.normal));
                const strength = strikeStrength(velocity.speed, incidence, this.physics.softness);
                if (strength > .005) {
                    this.setAnchor(hit);
                    this.physics.strike(direction, strength);
                    this.onImpact();
                    this.sound.play();
                    this.dirty = true;
                    this.hitUntil = now + 500;
                    this.setMode("hit");
                    this.flash.style.left = (swept.x - rect.left) + "px";
                    this.flash.style.top = (swept.y - rect.top) + "px";
                    this.flash.getAnimations().forEach(animation => animation.cancel());
                    this.flash.animate([{ opacity: 1, transform: "translate(-50%,-50%) scale(.5)" }, { opacity: .9, transform: "translate(-50%,-50%) scale(1.2)", offset: .18 }, { opacity: 0, transform: "translate(-50%,-50%) scale(2)" }], { duration: 330 });
                }
            }
        }
        // Clear the latch only once the cursor is outside again. Remaining inside never repeats.
        if (!probe(next.x, next.y))
            this.strikeLatched = false;
        const dx = next.x - this.strikePrevious.x, dy = next.y - this.strikePrevious.y;
        this.trail.style.left = (next.x - rect.left) + "px";
        this.trail.style.top = (next.y - rect.top) + "px";
        this.trail.style.width = Math.min(95, Math.hypot(dx, dy) * 1.3) + "px";
        this.trail.style.transform = `translateX(-100%) rotate(${Math.atan2(dy, dx)}rad)`;
        this.trail.style.opacity = velocity.speed > 300 ? ".8" : "0";
        this.strikePrevious = next;
    }
    playWhipImpact(now) {
        // Only a confirmed pudding collision may play the slap sound.
        this.whipSound.stop();
        this.whipSound.play();
    }
    updateWhip(dt, now) {
        this.rope.advance(dt);
        const tip = this.rope.points.at(-1), oldTip = this.rope.previous.at(-1);
        const vx = (tip.x - oldTip.x) / dt, vy = (tip.y - oldTip.y) / dt, speed = Math.hypot(vx, vy);
        const handVelocity = this.motion.velocity(now);
        const whoosh = this.swingGate.update(now, handVelocity.x, handVelocity.y);
        if (whoosh)
            this.whipSwingSound.play();
        const boom = this.boomGate.update(now, speed);
        const rect = this.renderer.domElement.getBoundingClientRect();
        // Project a conservative silhouette once; only confirmed candidate impacts need raycasts.
        const projected = [], point = new THREE.Vector3();
        for (const mesh of this.meshes) {
            const pos = mesh.geometry.getAttribute("position");
            for (let i = 0; i < pos.count; i += 4) {
                point.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(this.camera);
                projected.push({ x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 });
            }
        }
        const contact = ropeContacts(this.rope.points, this.rope.previous, dt, convexHull(projected));
        if (!contact.touching) {
            if (!this.whipOutsideSince)
                this.whipOutsideSince = now;
            if (now - this.whipOutsideSince > 60)
                this.strikeLatched = false;
        }
        else
            this.whipOutsideSince = 0;
        if (!this.strikeLatched && now - this.lastWhipHit > 140) {
            for (const candidate of contact.candidates.slice(0, 4)) {
                this.pointer.set((candidate.x - rect.left) / rect.width * 2 - 1, -(candidate.y - rect.top) / rect.height * 2 + 1);
                this.ray.setFromCamera(this.pointer, this.camera);
                const hit = this.ray.intersectObjects(this.meshes)[0];
                if (!hit?.face)
                    continue;
                const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
                const direction = right.multiplyScalar(candidate.vx).addScaledVector(up, -candidate.vy).normalize();
                const incidence = Math.max(.12, -direction.dot(hit.face.normal));
                const strength = strikeStrength(candidate.speed, incidence, this.physics.softness);
                this.setAnchor(hit);
                this.physics.strike(direction, strength);
                this.onImpact();
                this.playWhipImpact(now);
                this.strikeLatched = true;
                this.lastWhipHit = now;
                this.dirty = true;
                this.hitUntil = now + 500;
                this.setMode("hit");
                this.flash.style.left = (candidate.x - rect.left) + "px";
                this.flash.style.top = (candidate.y - rect.top) + "px";
                this.flash.getAnimations().forEach(animation => animation.cancel());
                this.flash.animate([{ opacity: 1, transform: "translate(-50%,-50%) scale(.5)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(2)" }], { duration: 250 });
                break;
            }
        }
        if (boom) {
            this.whipOverlay.boom(tip.x, tip.y, now);
        }
        this.whipOverlay.draw(this.rope, now);
    }
    move = (e) => {
        if (this.striking) {
            this.strikeMove(e);
            return;
        }
        if (this.held && !isActivePointer(e, this.pointerId))
            return;
        if (!this.held && e.pointerType !== "mouse")
            return;
        this.aim(e);
        if (!this.held) {
            this.renderer.domElement.style.cursor = this.ray.intersectObjects(this.meshes).length ? "grab" : "default";
            return;
        }
        if (e.pointerId !== this.pointerId)
            return;
        if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > (e.pointerType === "touch" ? 8 : 5))
            this.dragged = true;
        if (!this.dragged)
            return;
        this.setMode("drag");
        if (!this.ray.ray.intersectPlane(this.dragPlane, this.planePoint))
            return;
        const diff = this.planePoint.clone().sub(this.grabWorld);
        const softness = 2 * (.55 + this.physics.softness * .011);
        const dx = diff.x * softness, dz = diff.z * softness;
        const len = Math.hypot(dx, dz), scale = len > 0 ? 2.4 * Math.tanh(len / 2.4) / len : 0;
        this.physics.target.x = this.startQ.x + dx * scale;
        this.physics.target.z = this.startQ.z + dz * scale;
        const stretch = diff.y * softness / 2;
        this.physics.target.squash = Math.max(-.6, Math.min(.95, this.startQ.squash + Math.tanh(stretch)));
        const length = Math.hypot(this.physics.target.x, this.physics.target.z);
        if (length > 2.4) {
            this.physics.target.x *= 2.4 / length;
            this.physics.target.z *= 2.4 / length;
        }
        this.physics.target.dent = this.startQ.dent * .4;
    };
    up = (e) => {
        if (!this.held && !this.striking)
            return;
        if (e && "pointerId" in e && !isActivePointer(e, this.pointerId))
            return;
        this.whipOverlay.hide();
        this.swingGate.reset();
        this.boomGate.reset();
        this.held = false;
        this.striking = false;
        this.strikeLatched = false;
        this.container.classList.remove("strike-ready");
        document.documentElement.classList.remove("pudding-strike-mode");
        document.documentElement.style.removeProperty("--pudding-hand");
        this.trail.style.opacity = "0";
        this.physics.release();
        const id = this.pointerId;
        this.pointerId = null;
        if (id !== null && this.renderer.domElement.hasPointerCapture(id))
            this.renderer.domElement.releasePointerCapture(id);
        this.renderer.domElement.style.cursor = "grab";
        this.setMode("settle");
    };
    animate = (now) => {
        if (this.disposed)
            return;
        this.frame = requestAnimationFrame(this.animate);
        if (document.hidden)
            return;
        const dt = this.last ? Math.min((now - this.last) / 1000, .04) : 1 / 60;
        this.last = now;
        if (this.held && !this.dragged) {
            const p = Math.min(1, (now - this.start.time) / 800);
            const strength = 2 * (.13 + this.physics.softness * .0038);
            this.physics.target.squash = Math.max(-.62, this.startQ.squash - strength * (.18 + .82 * p));
            this.physics.target.dent = .14 + .26 * p;
            this.physics.target.x = this.startQ.x - this.normal.x * .1 * p;
            this.physics.target.z = this.startQ.z - this.normal.z * .1 * p;
        }
        if (this.striking && now > this.hitUntil)
            this.setMode("armed");
        if (now - this.strikePrevious.t > 70)
            this.trail.style.opacity = "0";
        if (this.striking && this.strikeTool === "whip")
            this.updateWhip(dt, now);
        const energy = this.physics.step(dt, this.held);
        if (!this.held && !this.striking && energy < .0004 && this.mode !== "ready") {
            this.physics.reset();
            this.dirty = true;
            this.setMode("ready");
        }
        if (energy > .00001 || this.held || this.mode !== "ready" || this.dirty) {
            this.updateGeometry();
            this.dirty = false;
        }
        this.updateFlavor(now);
        this.renderer.render(this.scene, this.camera);
    };
    updateGeometry() {
        this.meshes.forEach((mesh, index) => {
            const pos = mesh.geometry.getAttribute("position"), base = this.originals[index];
            for (let i = 0; i < pos.count; i++) {
                const p = deformPoint(base[i * 3], base[i * 3 + 1], base[i * 3 + 2], this.physics.q, this.anchor, this.normal);
                pos.setXYZ(i, p[0], p[1], p[2]);
            }
            pos.needsUpdate = true;
            mesh.geometry.computeVertexNormals();
        });
    }
    setFlavor(id, immediate = false) {
        const target = getFlavor(id);
        const colors = this.meshes[0].geometry.getAttribute("color");
        const body = this.meshes[0].material;
        const sauce = this.meshes[1].material;
        const to = new Float32Array(colors.array.length);
        const bottom = new THREE.Color(target.body), top = new THREE.Color(target.top), color = new THREE.Color();
        for (let i = 0; i < colors.count; i++) {
            const t = Math.max(0, Math.min(1, this.originals[0][i * 3 + 1] / 2));
            // Keep the original custard gradient exactly; other flavors use their own neutral gradients.
            if (id === "custard")
                color.setRGB(1, .66 + .2 * (1 - t), .19 + .19 * (1 - t));
            else
                color.copy(bottom).lerp(top, t);
            color.toArray(to, i * 3);
        }
        this.flavorTransition = { started: performance.now(), from: new Float32Array(colors.array), to,
            sauceFrom: sauce.color.clone(), sauceTo: new THREE.Color(target.sauce), roughness: body.roughness,
            clearcoat: body.clearcoat, sauceRoughness: sauce.roughness, target };
        if (immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            this.updateFlavor(performance.now() + 300);
    }
    updateFlavor(now) {
        const transition = this.flavorTransition;
        if (!transition)
            return;
        const progress = Math.max(0, Math.min(1, (now - transition.started) / 300));
        const t = progress * progress * (3 - 2 * progress);
        const colors = this.meshes[0].geometry.getAttribute("color");
        for (let i = 0; i < transition.to.length; i++)
            colors.array[i] = transition.from[i] + (transition.to[i] - transition.from[i]) * t;
        colors.needsUpdate = true;
        const body = this.meshes[0].material, sauce = this.meshes[1].material;
        sauce.color.lerpColors(transition.sauceFrom, transition.sauceTo, t);
        body.roughness = THREE.MathUtils.lerp(transition.roughness, transition.target.roughness, t);
        body.clearcoat = THREE.MathUtils.lerp(transition.clearcoat, transition.target.clearcoat, t);
        sauce.roughness = THREE.MathUtils.lerp(transition.sauceRoughness, transition.target.sauceRoughness, t);
        if (progress === 1)
            this.flavorTransition = null;
    }
    setStrikeTool(tool) {
        if (tool === this.strikeTool)
            return;
        this.up();
        this.stopSounds();
        this.strikeTool = tool;
        this.sound.setEnabled(this.soundEnabled);
        this.whipSwingSound.setEnabled(this.soundEnabled && tool === "whip");
    }
    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
        if (!enabled)
            this.allSounds.forEach(sound => sound.setEnabled(false));
        else {
            this.sound.setEnabled(true);
            if (this.strikeTool === "whip")
                this.whipSwingSound.setEnabled(true);
        }
    }
    onImpact = () => { };
    setVolume(volume) { this.allSounds.forEach(sound => sound.setVolume(volume)); }
    setAudioCallbacks(onError, onPlay) {
        this.allSounds.forEach(sound => { sound.onError = onError; sound.onPlay = onPlay; });
    }
    keyboardStrike() {
        this.sound.unlock();
        this.anchor.set(0, 1.5, 1);
        this.normal.set(0, 0, 1);
        this.physics.strike({ x: .4, y: -.3, z: -.8 }, 4 + this.physics.softness / 20);
        this.sound.play();
        this.onImpact();
        this.dirty = true;
        this.setMode("hit");
    }
    configure(softness, speed) { this.physics.softness = softness; this.physics.speed = speed; }
    reset() { this.up(); this.stopSounds(); this.flash.getAnimations().forEach(animation => animation.cancel()); this.physics.reset(); this.physics.softness = 60; this.physics.speed = 50; this.setMode("ready"); this.updateGeometry(); }
    dispose() { this.up(); this.allSounds.forEach(sound => sound.dispose()); this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.cleanup.forEach(fn => fn()); this.scene.traverse(obj => { if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(m => m.dispose());
    } }); this.env.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.trail.remove(); this.flash.remove(); this.whipOverlay.dispose(); }
}
