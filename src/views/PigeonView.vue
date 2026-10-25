<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowLeft, ArrowUpRight, Bird, Check, ChevronRight, Pause, Play, RotateCcw, Sparkles } from "@lucide/vue";
import { createPigeonScene } from "../features/pigeon/scene.js";
import { MOTIONS } from "../features/pigeon/motion.js";
import "../features/pigeon/pigeon.css";

const mount = ref(null);
const error = ref("");
const ready = ref(false);
const paused = ref(false);
const kind = ref("normal");
const motion = ref("idle");
const requestedView = new URLSearchParams(location.search).get("view");
const view = ref(["park", "threequarter", "front", "side", "turntable", "pair"].includes(requestedView) ? requestedView : "threequarter");
const scrub = ref(0);
const metrics = ref({ frame: 0, time: 0, height: 0, wingAngle: 0, beakHeight: 0, footZ: 0, phase: "비둘기를 불러오는 중", count: 2 });
let scene;
let alive = true;
let loadController;
const animalName = computed(() => kind.value === "chicken" ? "닭둘기" : "일반 비둘기");
const motionNotes = {
  idle: { title: "가만히 있어도, 비둘기.", body: "짧은 목과 둥근 가슴, 가볍게 오르내리는 숨. 눈을 깜박이는 순간도 살펴보세요." },
  walk: { title: "한 걸음에 한 번, 까딱.", body: "발은 번갈아 딛고, 고개는 한 박자 먼저. 작은 몸에 제법 확실한 보폭이 있습니다." },
  eat: { title: "지금은 대화가 어렵습니다.", body: "주변을 살피고, 고개를 낮추고, 콕콕. 식사에는 나름의 순서가 있습니다." },
  fly: { title: "잠깐, 비둘기였습니다.", body: "날개를 크게 펴고 이륙합니다. 한 바퀴 돈 뒤에는 발을 내리고 조심스럽게 착륙합니다." },
};

async function start() {
  loadController?.abort();
  const controller = new AbortController(); loadController = controller;
  scene?.dispose(); scene = undefined;
  ready.value = false; error.value = "";
  await nextTick();
  if (!alive || !mount.value) return;
  try {
    const created = await createPigeonScene(mount.value, {
      signal: controller.signal, initialView: view.value,
      onMetrics(value) {
        if (!alive) return;
        metrics.value = value; ready.value = true;
        motion.value = value.mode; kind.value = value.kind;
        if (!value.paused) scrub.value = value.clipTime % 7.6;
      },
      onError(message) { error.value = message; ready.value = false; },
    });
    if (!alive || controller.signal.aborted) { created.dispose(); return; }
    scene = created;
    paused.value = false;
  } catch (failure) {
    if (!alive || controller.signal.aborted || failure.name === "AbortError") return;
    error.value = "비둘기 모델 또는 3D 장면을 불러오지 못했습니다. 연결 상태와 브라우저의 그래픽 가속 설정을 확인해 주세요.";
  }
}
function setMotion(value) { motion.value = value; scrub.value = 0; scene?.setMotion(value); }
function selectKind(value) { kind.value = value; scene?.selectKind(value); }
function togglePause() { paused.value = !paused.value; scene?.setPaused(paused.value); }
function reset() { paused.value = false; kind.value = "normal"; motion.value = "idle"; scrub.value = 0; scene?.reset(); }
function setView(value) { view.value = value; scene?.setView(value); }
function seek(event) { scrub.value = Number(event.target.value); paused.value = true; scene?.seek(scrub.value); }
onMounted(start);
onBeforeUnmount(() => { alive = false; loadController?.abort(); scene?.dispose(); });
</script>

<template>
  <div class="pigeon-study" :class="{ 'is-model-review': view !== 'park' }">
    <header class="pigeon-topbar">
      <RouterLink to="/" class="pigeon-home" aria-label="별짓 홈으로"><ArrowLeft :size="17" /><span>별짓<span class="pigeon-brand-star">✳</span></span></RouterLink>
      <span class="pigeon-top-divider" />
      <span class="pigeon-top-label">쓸모없는 관찰, 두 번째.</span>
      <span class="pigeon-stage-tag"><i /> 비둘기 우선 · 모델 v3</span>
    </header>

    <section class="pigeon-world" aria-label="비둘기 모이주기 제작 미리보기">
      <div
        ref="mount"
        class="pigeon-scene"
        data-testid="pigeon-scene"
        :data-ready="ready"
        :data-motion="motion"
        :data-kind="kind"
        :data-frame="metrics.frame"
        :data-time="metrics.time.toFixed(3)"
        :data-height="metrics.height.toFixed(3)"
        :data-wing-angle="metrics.wingAngle.toFixed(3)"
        :data-beak-height="metrics.beakHeight.toFixed(3)"
        :data-foot-z="metrics.footZ.toFixed(3)"
        :data-view="view"
        data-model-revision="3"
      />

      <div class="pigeon-title-block">
        <span class="pigeon-eyebrow">THE COLLECTION / NO. 002</span>
        <h1>비둘기 모이주기<span>비둘기부터, 제대로.</span></h1>
        <p>{{ view === 'pair' ? '왼쪽 일반 비둘기 · 오른쪽 닭둘기' : '같은 빛 아래에서, 비둘기를 살펴보세요.' }}</p>
        <div class="pigeon-view-tabs" aria-label="모델 비교 시점">
          <button v-for="(label, value) in { threequarter: '모델 보기', front: '정면 비교', side: '측면 비교', pair: '크기 비교', turntable: '돌려보기' }" :key="value" :aria-pressed="view === value" :disabled="!ready" @click="setView(value)">{{ label }}</button>
        </div>
      </div>

      <div class="pigeon-scene-caption"><span class="pigeon-location-dot" />별짓 관찰실<span class="pigeon-caption-rule" />지금은 비둘기를 만드는 중.</div>

      <aside class="pigeon-observation" aria-labelledby="observation-title">
        <div class="pigeon-panel-heading"><span class="pigeon-eyebrow">OBSERVATION NOTE</span><Bird :size="19" :stroke-width="1.5" /></div>
        <h2 id="observation-title">통통함에도<br />차이가 있습니다<span>·</span></h2>
        <p class="pigeon-panel-intro">관찰할 친구와 동작을 골라 보세요.</p>
        <div class="pigeon-specimens" aria-label="관찰할 비둘기">
          <button v-for="item in [{ id: 'normal', name: '일반 비둘기', note: '적당히 통통한 편' }, { id: 'chicken', name: '닭둘기', note: '존재감이 넉넉한 편' }]" :key="item.id" :aria-pressed="kind === item.id" :disabled="!ready" @click="selectKind(item.id)">
            <span class="pigeon-specimen-drawing" :class="{ plump: item.id === 'chicken' }" aria-hidden="true"><i class="bird-body" /><i class="bird-neck" /><i class="bird-head" /><i class="bird-eye" /><i class="bird-beak" /></span>
            <span><b>{{ item.name }}</b><small>{{ item.note }}</small></span>
            <Check v-if="kind === item.id" :size="15" /><ChevronRight v-else :size="15" />
          </button>
        </div>
        <div class="pigeon-motion-label"><span>동작 관찰</span><span>04 MODES</span></div>
        <div class="pigeon-motion-tabs" aria-label="동작 선택">
          <button v-for="(label, value) in MOTIONS" :key="value" :aria-pressed="motion === value" :disabled="!ready" @click="setMotion(value)">{{ label }}<ArrowUpRight v-if="motion === value" :size="13" /></button>
        </div>
        <div class="pigeon-motion-note"><h3>{{ motionNotes[motion].title }}</h3><p>{{ motionNotes[motion].body }}</p></div>
        <label v-if="view !== 'park'" class="pigeon-scrub">자세 시점 <output for="pigeon-time">{{ scrub.toFixed(1) }}초</output><input id="pigeon-time" type="range" min="0" max="7.6" step="0.05" :value="scrub" @input="seek" /></label>
        <div class="pigeon-live-state"><i :class="{ paused }" /><span>{{ paused ? '관찰을 잠시 멈췄습니다.' : metrics.phase }}</span><span>{{ animalName }}</span></div>
      </aside>

      <div v-if="!ready || error" class="pigeon-loading" :class="{ 'has-error': error }" role="status">
        <Bird :size="32" :stroke-width="1.4" />
        <p>{{ error || '비둘기를 불러오는 중입니다.' }}</p>
        <button v-if="error" @click="start">장면 다시 불러오기</button>
      </div>

      <div class="pigeon-bottom-bar">
        <div class="pigeon-phase-note"><span>03</span><div><b>비둘기를 먼저 만듭니다.</b><small>외형 · 눈 깜박임 · 걷기 · 먹기 · 비행을 확인하는 미리보기입니다.</small></div></div>
        <div class="pigeon-scene-controls">
          <button :disabled="!ready" :aria-label="paused ? '동작 재개' : '동작 일시정지'" :aria-pressed="paused" @click="togglePause"><Play v-if="paused" :size="15" /><Pause v-else :size="15" /><span>{{ paused ? '재개' : '일시정지' }}</span></button>
          <button :disabled="!ready" aria-label="장면 처음부터" @click="reset"><RotateCcw :size="15" /><span>처음부터</span></button>
        </div>
      </div>
    </section>

    <footer class="pigeon-study-footer">
      <span><Sparkles :size="14" /> 작은 동작을 만드는 중입니다.</span>
      <p>비둘기 모델과 동작을 먼저 검토합니다. 주변환경과 모이 투척·싸움·도감은 후속 작업입니다.</p>
      <span class="pigeon-study-edition">PIGEON STUDY — 03</span>
    </footer>
  </div>
</template>
