<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { createPigeonStudy, VIEWS } from "../features/pigeon/scene.js";
import { SHAPE_GROUPS } from "../features/pigeon/shape-editor.js";
import { useShapeEditing } from "../features/pigeon/useShapeEditing.js";
const props = defineProps({ standalone: Boolean });
const mount = ref(null);
const ready = ref(false);
const error = ref("");
const query = new URLSearchParams(location.search);
const capture = query.get("capture") === "1";
const requested = query.get("view");
const view = ref(VIEWS.some((v) => v.id === requested) ? requested : "left45");
const framing = ref(["head", "head-neck"].includes(query.get("frame")) ? query.get("frame") : "body");
const surface = ref(query.get("surface") === "color" ? "color" : "clay");
const state = ref({ frame: 0, revision: "", source: "", triangles: 0 });
let study, controller, alive = true;
const editor = useShapeEditing(() => study, props.standalone || query.get("edit") === "1");
const { editing, values: shape, comparing, feathers, message, busy, canUndo, canRedo, changed: shapeChanged } = editor;
const referenceImage = ref(""), referenceError = ref("");
function loadReference(file) {
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) {
    referenceError.value = "15MB 이하의 PNG·JPG·WebP 이미지를 선택하세요."; return;
  }
  if (referenceImage.value) URL.revokeObjectURL(referenceImage.value);
  referenceImage.value = URL.createObjectURL(file); referenceError.value = "";
}
function clearReference() {
  URL.revokeObjectURL(referenceImage.value); referenceImage.value = "";
}
function historyShortcut(event) {
  if (!editing.value || busy.value || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || !(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? editor.redo() : editor.undo(); }
}
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
    else { study = created; editor.initialize(); }
  } catch (failure) {
    if (!alive || current.signal.aborted || failure.name === "AbortError") return;
    error.value = "비둘기 모델을 불러오지 못했습니다.";
  }
}
function setView(value) { view.value = value; study?.setView(value); }
function setFraming(value) { framing.value = value; study?.setFraming(value); }
function setSurface(value) { surface.value = value; study?.setSurface(value); }
function reset() { view.value = "left45"; framing.value = "body"; surface.value = "clay"; study?.reset(); }
onMounted(() => { start(); window.addEventListener("keydown", historyShortcut); });
onBeforeUnmount(() => { alive = false; controller?.abort(); study?.dispose(); clearReference(); window.removeEventListener("keydown", historyShortcut); });
</script>

<template>
  <div class="pigeon-study" :class="{ 'is-capture': capture, 'is-editing': editing }">
    <header class="study-header">
      <RouterLink v-if="!standalone" to="/" class="study-home" aria-label="별짓 홈으로">← <b>별짓<span>✳</span></b></RouterLink>
      <span v-else class="study-home"><b>비둘기<span>✳</span></b></span>
      <span class="study-header-note">쓸모없는 관찰, 두 번째.</span>
      <span class="study-stage">{{ editing ? '형태 편집' : '두상·목 검토' }}<span v-if="ready"> · {{ state.revision }}</span></span>
    </header>
    <div class="study-layout">
      <section class="study-model" aria-labelledby="pigeon-heading">
        <div class="study-heading"><span>THE COLLECTION / NO. 002</span><h1 id="pigeon-heading">{{ editing ? '비둘기 형태 편집' : '비둘기 모이주기' }}</h1><p>{{ editing ? (comparing ? '원본 비교 중 · 조정값은 보존됩니다.' : '슬라이더를 움직여 형태를 조정하세요.') : '머리에서 목, 가슴으로 이어지는 곡선.' }}</p></div>
        <div ref="mount" class="pigeon-viewport" data-testid="pigeon-scene"
          :data-ready="ready" :data-view="view" :data-framing="framing" :data-surface="surface" :data-frame="state.frame"
          :data-revision="state.revision" :data-source="state.source" :data-triangles="state.triangles"
          :data-editing="editing" :data-comparing="comparing" :data-adjusted="shapeChanged && editing && !comparing" />
        <div v-if="!ready || error" class="study-loading" role="status">
          <template v-if="error"><p>{{ error }}</p><button @click="start">다시 불러오기</button></template>
          <p v-else>비둘기를 불러오는 중입니다.</p>
        </div>
        <span class="study-gesture">드래그로 회전 · 휠로 확대</span>
        <div v-if="editing && referenceImage" class="reference-card">
          <div><b>참고 이미지</b><button aria-label="참고 이미지 닫기" @click="clearReference">×</button></div>
          <img :src="referenceImage" alt="직접 선택한 비둘기 참고 이미지" @error="referenceError = '이미지를 읽을 수 없습니다.'; clearReference()">
          <small>모서리를 끌어 크기를 조절하세요.</small>
        </div>
      </section>
      <aside class="study-controls" aria-label="비둘기 관찰 시점">
        <span class="study-eyebrow">{{ editing ? 'SHAPE EDITOR / 01' : 'OBSERVATION / 01' }}</span>
        <h2>{{ editing ? '직접 조정합니다' : '형태를 살펴봅니다' }}<span>·</span></h2>
        <p class="study-intro">{{ editing ? '머리·목·몸통과 깃털이 함께 변형됩니다. 조정값은 이 브라우저에 자동 저장됩니다.' : '무채색으로 두상과 목의 연결을 살펴보세요.' }}</p>
        <button class="edit-toggle" :disabled="!ready || busy" :aria-pressed="editing" @click="editor.toggle">{{ editing ? '편집 닫기' : '직접 형태 조정하기' }}</button>
        <div class="study-framing" aria-label="관찰 범위">
          <button :aria-pressed="framing === 'body'" :disabled="!ready" @click="setFraming('body')">전신</button>
          <button :aria-pressed="framing === 'head'" :disabled="!ready" @click="setFraming('head')">얼굴</button>
          <button :aria-pressed="framing === 'head-neck'" :disabled="!ready" @click="setFraming('head-neck')">머리·목</button>
        </div>
        <details class="view-options" :open="!editing">
          <summary>시점·표면 선택</summary>
        <div class="study-surface" aria-label="표면 보기">
          <button :aria-pressed="surface === 'color'" :disabled="!ready" @click="setSurface('color')">기존색</button>
          <button :aria-pressed="surface === 'clay'" :disabled="!ready" @click="setSurface('clay')">무채색</button>
        </div>
        <div class="study-views">
          <button v-for="item in VIEWS" :key="item.id" :aria-pressed="view === item.id"
            :disabled="!ready" @click="setView(item.id)">{{ item.label }}</button>
        </div>
        <button class="study-reset" :disabled="!ready" @click="reset">↺ 기본 시점으로</button>
        </details>
        <template v-if="editing">
          <div class="edit-history">
            <button :disabled="!ready || busy || !canUndo" @click="editor.undo">실행 취소</button>
            <button :disabled="!ready || busy || !canRedo" @click="editor.redo">다시 실행</button>
            <button :disabled="!ready || busy" :aria-pressed="comparing" @click="editor.compare">{{ comparing ? '수정본 보기' : '원본 비교' }}</button>
            <button :disabled="!ready || busy" :aria-pressed="feathers" @click="editor.toggleFeathers">{{ feathers ? '깃털 숨기기' : '깃털 보이기' }}</button>
          </div>
          <fieldset v-for="group in SHAPE_GROUPS" :key="group.label" class="shape-group" :disabled="!ready || busy || comparing">
            <legend>{{ group.label }}</legend>
            <div v-for="control in group.controls" :key="control.key" class="shape-control">
              <div class="shape-label"><label :for="'shape-' + control.key">{{ control.label }}</label><span>{{ shape[control.key] > 0 ? '+' : '' }}{{ shape[control.key] }}%</span></div>
              <input :id="'shape-' + control.key" type="range" :min="control.min" :max="control.max" :step="control.step || 1"
                :value="shape[control.key]" @input="editor.update(control.key, $event.target.value)" @change="editor.commit">
              <small v-if="control.hint">{{ control.hint }}</small>
            </div>
          </fieldset>
          <button class="shape-reset" :disabled="!ready || busy || !shapeChanged" @click="editor.reset">모든 조정값을 0으로</button>
          <div class="edit-files">
            <b>작업 보관</b>
            <div class="edit-history">
              <button :disabled="!ready || busy" @click="editor.exportJSON">조정값 JSON 저장</button>
              <label class="file-button" :class="{ disabled: busy || !ready }">조정값 불러오기<input type="file" accept=".json,application/json" :disabled="!ready || busy" @change="editor.importJSON($event.target.files[0]); $event.target.value = ''"></label>
              <button :disabled="!ready || busy || comparing" @click="editor.exportGLB">{{ busy ? '저장 중…' : '수정 모델 GLB 저장' }}</button>
              <button :disabled="!ready || busy" @click="editor.screenshot">현재 화면 PNG 저장</button>
              <label class="file-button">참고 이미지 열기<input type="file" accept="image/png,image/jpeg,image/webp" @change="loadReference($event.target.files[0]); $event.target.value = ''"></label>
            </div>
            <p>GLB에는 모든 깃털과 기존 색상이 포함됩니다. Blender의 파일 → 가져오기 → glTF 2.0으로 여세요. 참고 이미지는 서버로 전송되지 않습니다.</p>
            <p class="edit-message" role="status">{{ message }}</p>
            <p v-if="referenceError" role="alert">{{ referenceError }}</p>
          </div>
        </template>
        <div v-else class="study-note"><b>두상과 목의 형태를 다듬는 중입니다.</b><p>둥근 머리, 부리 아래 턱선, 뒤통수에서 등으로 이어지는 곡선을 확인합니다. 머리·목 보기에서 가슴까지의 연결을 확대할 수 있습니다.</p></div>
      </aside>
    </div>
    <footer class="study-footer"><span>서 있는 비둘기, 두상과 목의 형태 연구.</span><span>작은 차이를 관찰합니다.</span></footer>
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
.is-editing .study-layout { grid-template-columns:minmax(0,1fr) 350px; height:calc(100svh - 132px); }
.is-editing .study-controls { overflow-y:auto; }
.is-editing .study-model { min-height:0; }
.is-editing .study-controls h2 { margin-top:12px; }
.is-editing .study-intro { margin-bottom:12px; }
.is-editing .study-controls { padding-top:24px; }
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
.study-framing { margin-bottom:7px; grid-template-columns:repeat(3,minmax(0,1fr)); }
.study-surface { margin-bottom:14px; }
.study-views button,.study-framing button,.study-surface button { min-height:39px; border:1px solid #d9ded0; border-radius:7px; font-size:10px; background:#fafbf6; padding:8px 4px; }
.study-views button[aria-pressed=true],.study-framing button[aria-pressed=true],.study-surface button[aria-pressed=true] { background:#344330; color:#f6f8ef; border-color:#344330; }
.study-reset { margin-top:16px; padding:10px; border:0; font-size:11px; color:#69785d; text-align:left; }
button:disabled { opacity:.45; cursor:default; }
.study-note { margin-top:auto; padding-top:28px; font-size:10px; line-height:1.9; }
.study-note b { display:block; border-top:1px solid #dcdfd2; padding-top:19px; font-size:11px; }
.study-note p { color:#848979; word-break:keep-all; }
.edit-toggle { background:#344330; color:#fff; border:0; border-radius:7px; padding:12px; font-size:12px; margin-bottom:16px; }
.view-options { margin-bottom:14px; }
.view-options summary { display:none; cursor:pointer; font-size:12px; padding:11px 0; color:#59684e; }
.is-editing .view-options summary { display:list-item; list-style-position:inside; }
.is-editing .view-options[open] { padding-bottom:10px; border-bottom:1px solid #d9ded0; }
.edit-history { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.edit-history button,.file-button,.shape-reset { border:1px solid #d9ded0; border-radius:6px; padding:10px 6px; background:#fafbf6; font-size:11px; text-align:center; }
.edit-history button[aria-pressed=true] { border-color:#697c58; background:#e5ebdf; }
.shape-group { min-width:0; margin:24px 0 0; padding:0; border:0; border-top:1px solid #d9ded0; }
.shape-group legend { font-size:13px; font-weight:700; padding:0 10px 0 0; }
.shape-control { margin-top:17px; }
.shape-label { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px; }
.shape-label span { font:12px monospace; color:#59684e; }
.shape-control input { width:100%; accent-color:#485d39; cursor:pointer; margin:10px 0 2px; }
.shape-control small { display:block; color:#7c8276; font-size:10px; line-height:1.5; }
.shape-group:disabled { opacity:.5; }
.shape-reset { margin-top:22px; }
.edit-files { margin-top:24px; padding-top:20px; border-top:1px solid #d9ded0; }
.edit-files > b { display:block; margin-bottom:12px; font-size:13px; }
.edit-files p { font-size:10px; line-height:1.8; color:#727b68; }
.edit-message { min-height:18px; }
.file-button { position:relative; cursor:pointer; overflow:hidden; display:flex; align-items:center; justify-content:center; }
.file-button input { position:absolute; inset:0; width:100%; opacity:0; cursor:pointer; }
.file-button.disabled { opacity:.45; }
.reference-card { position:absolute; right:20px; bottom:20px; z-index:1; width:270px; height:250px; min-width:160px; min-height:120px; max-width:85%; max-height:70%; resize:both; overflow:auto; background:#fafbf6ee; border:1px solid #cfd5c8; border-radius:9px; padding:10px; box-shadow:0 4px 20px #0001; }
.reference-card > div { display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:8px; }
.reference-card button { border:0; font-size:18px; padding:0 6px; }
.reference-card img { display:block; width:100%; }
.reference-card small { font-size:9px; color:#727b68; }
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
  .is-editing .study-layout { display:block; height:auto; }
  .is-editing .study-model { position:sticky; top:0; z-index:2; height:50svh; min-height:300px; }
  .is-editing .study-heading { top:12px; }
  .is-editing .study-heading h1 { font-size:18px; margin-top:7px; }
  .is-editing .study-heading > span { display:none; }
  .is-editing .study-controls { overflow:visible; }
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
