<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { createPigeonStudy, VIEWS } from "../features/pigeon/scene.js";
const mount = ref(null);
const ready = ref(false);
const error = ref("");
const query = new URLSearchParams(location.search);
const capture = query.get("capture") === "1";
const requested = query.get("view");
const view = ref(VIEWS.some((v) => v.id === requested) ? requested : "left45");
const framing = ref(query.get("frame") === "head" ? "head" : "body");
const surface = ref(query.get("surface") === "clay" ? "clay" : "color");
const state = ref({ frame: 0, revision: "", source: "", triangles: 0 });
let study, controller, alive = true;
async function start() {
  controller?.abort();
  study?.dispose();
  study = undefined;
  const current = new AbortController();
  controller = current;
  ready.value = false;
  error.value = "";
  await nextTick();
  if (!alive || current.signal.aborted || !mount.value) return;
  try {
    const created = await createPigeonStudy(mount.value, {
      signal: current.signal, initialView: view.value, initialFraming: framing.value, initialSurface: surface.value,
      onState(value) {
        if (!alive || current.signal.aborted) return;
        state.value = value; ready.value = value.ready; view.value = value.view; framing.value = value.framing; surface.value = value.surface;
      },
      onError(message) { if (alive && !current.signal.aborted) { error.value = message; ready.value = false; } },
    });
    if (!alive || current.signal.aborted) created.dispose();
    else study = created;
  } catch (failure) {
    if (!alive || current.signal.aborted || failure.name === "AbortError") return;
    error.value = "비둘기 모델을 불러오지 못했습니다.";
  }
}
function setView(value) { view.value = value; study?.setView(value); }
function setFraming(value) { framing.value = value; study?.setFraming(value); }
function setSurface(value) { surface.value = value; study?.setSurface(value); }
function reset() { view.value = "left45"; framing.value = "body"; study?.reset(); }
onMounted(start);
onBeforeUnmount(() => { alive = false; controller?.abort(); study?.dispose(); });
</script>

<template>
  <div class="pigeon-study" :class="{ 'is-capture': capture }">
    <header class="study-header">
      <RouterLink to="/" class="study-home" aria-label="별짓 홈으로">← <b>별짓<span>✳</span></b></RouterLink>
      <span class="study-header-note">쓸모없는 관찰, 두 번째.</span>
      <span class="study-stage">모델 검토<span v-if="ready"> · {{ state.revision }}</span></span>
    </header>
    <div class="study-layout">
      <section class="study-model" aria-labelledby="pigeon-heading">
        <div class="study-heading"><span>THE COLLECTION / NO. 002</span><h1 id="pigeon-heading">비둘기 모이주기</h1><p>둥근 체형과 포개진 깃털.</p></div>
        <div ref="mount" class="pigeon-viewport" data-testid="pigeon-scene"
          :data-ready="ready" :data-view="view" :data-framing="framing" :data-surface="surface" :data-frame="state.frame"
          :data-revision="state.revision" :data-source="state.source" :data-triangles="state.triangles" />
        <div v-if="!ready || error" class="study-loading" role="status">
          <template v-if="error"><p>{{ error }}</p><button @click="start">다시 불러오기</button></template>
          <p v-else>비둘기를 불러오는 중입니다.</p>
        </div>
        <span class="study-gesture">드래그로 회전 · 휠로 확대</span>
      </section>
      <aside class="study-controls" aria-label="비둘기 관찰 시점">
        <span class="study-eyebrow">OBSERVATION / 01</span>
        <h2>가까이 살펴봅니다<span>·</span></h2>
        <p class="study-intro">같은 비둘기를 여덟 방향에서 살펴보세요.</p>
        <div class="study-framing" aria-label="관찰 범위">
          <button :aria-pressed="framing === 'body'" :disabled="!ready" @click="setFraming('body')">전신</button>
          <button :aria-pressed="framing === 'head'" :disabled="!ready" @click="setFraming('head')">얼굴</button>
        </div>
        <div class="study-surface" aria-label="표면 보기">
          <button :aria-pressed="surface === 'color'" :disabled="!ready" @click="setSurface('color')">기본색</button>
          <button :aria-pressed="surface === 'clay'" :disabled="!ready" @click="setSurface('clay')">무채색</button>
        </div>
        <div class="study-views">
          <button v-for="item in VIEWS" :key="item.id" :aria-pressed="view === item.id"
            :disabled="!ready" @click="setView(item.id)">{{ item.label }}</button>
        </div>
        <button class="study-reset" :disabled="!ready" @click="reset">↺ 기본 시점으로</button>
        <div class="study-note"><b>체형과 깃털을 다듬는 중입니다.</b><p>목과 날개의 겹깃, 기본색을 반영했습니다. 얼굴을 확대해 두상과 부리의 연결도 살펴보세요. 동작은 아직 준비 중입니다.</p></div>
      </aside>
    </div>
    <footer class="study-footer"><span>서 있는 비둘기, 형태와 깃털 연구.</span><span>작은 차이를 관찰합니다.</span></footer>
  </div>
</template>

<style scoped>
.pigeon-study { min-height:100svh; background:#f6f5f0; color:#292e27; }
.study-header { height:78px; padding:0 36px; display:flex; align-items:center; gap:24px; border-bottom:1px solid #dfdfd6; }
.study-home { display:flex; gap:17px; align-items:center; font-size:17px; }
.study-home b { font-size:27px; letter-spacing:-1.6px; }
.study-home b span { margin-left:4px; color:#80925f; }
.study-header-note { font-size:11px; color:#7d8274; }
.study-stage { margin-left:auto; font-size:11px; border:1px solid #d8ddcf; padding:7px 12px; border-radius:18px; }
.study-layout { display:grid; grid-template-columns:minmax(0,1fr) 270px; min-height:calc(100svh - 132px); }
.study-model { position:relative; min-height:620px; overflow:hidden; background:#efeeea; }
.pigeon-viewport { position:absolute; inset:0; }
.pigeon-viewport :deep(canvas) { display:block; width:100%; height:100%; touch-action:none; }
.study-heading { position:absolute; top:32px; left:36px; z-index:1; pointer-events:none; }
.study-heading > span,.study-eyebrow { font:9px "Courier New",monospace; letter-spacing:1.7px; color:#7f8777; }
.study-heading h1 { font-size:30px; letter-spacing:-1.3px; margin:13px 0 9px; }
.study-heading p { font-size:12px; color:#838778; margin:0; }
.study-gesture { position:absolute; bottom:24px; left:36px; font-size:10px; color:#7d8275; pointer-events:none; }
.study-controls { padding:36px 26px; border-left:1px solid #dfdfd6; display:flex; flex-direction:column; }
.study-controls h2 { font-size:23px; line-height:1.5; letter-spacing:-1px; margin:18px 0 10px; }
.study-controls h2 span { color:#8c9b68; }
.study-intro { font-size:11px; color:#7e8477; line-height:1.9; word-break:keep-all; margin:0 0 24px; }
.study-views,.study-framing,.study-surface { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.study-framing { margin-bottom:7px; }
.study-surface { margin-bottom:14px; }
.study-views button,.study-framing button,.study-surface button { min-height:39px; border:1px solid #d9ded0; border-radius:7px; font-size:10px; background:#fafbf6; padding:8px 4px; }
.study-views button[aria-pressed=true],.study-framing button[aria-pressed=true],.study-surface button[aria-pressed=true] { background:#344330; color:#f6f8ef; border-color:#344330; }
.study-reset { margin-top:16px; padding:10px; border:0; font-size:11px; color:#69785d; text-align:left; }
button:disabled { opacity:.45; cursor:default; }
.study-note { margin-top:auto; padding-top:28px; font-size:10px; line-height:1.9; }
.study-note b { display:block; border-top:1px solid #dcdfd2; padding-top:19px; font-size:11px; }
.study-note p { color:#848979; word-break:keep-all; }
.study-loading { position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#efeeea; font-size:12px; color:#7b8472; }
.study-loading button { padding:9px 15px; border:1px solid #bbc6ad; border-radius:6px; margin-top:8px; }
.study-footer { min-height:54px; padding:16px 36px; display:flex; justify-content:space-between; gap:16px; color:#888c80; font-size:10px; }
.is-capture .study-header,.is-capture .study-heading,.is-capture .study-controls,.is-capture .study-footer,.is-capture .study-gesture { display:none; }
.is-capture .study-layout { display:block; min-height:100svh; }
.is-capture .study-model { height:100svh; min-height:0; }
@media(max-width:760px) {
  .study-header { height:64px; padding:0 20px; }
  .study-header-note { display:none; }
  .study-layout { display:block; }
  .study-model { height:65svh; min-height:440px; }
  .study-heading { left:22px; top:24px; }
  .study-heading h1 { font-size:25px; }
  .study-controls { padding:25px 22px; border-left:0; border-top:1px solid #dfdfd6; }
  .study-views { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .study-views button { font-size:9px; }
  .study-note { padding-top:8px; }
  .study-footer { padding:20px 22px; }
  .study-footer span:last-child { display:none; }
  .study-gesture { left:22px; }
}
</style>
