<script setup>
import {
  Mouse,
  MoveUpRight,
  RotateCcw,
  SlidersHorizontal,
  Hand,
  Monitor,
  Check,
  Volume2,
  VolumeX,
} from "@lucide/vue";
import { FLAVORS } from "../features/pudding/core/pudding-flavors.js";
import {
  BOWL_IMAGE,
  WHIP_IMAGE,
} from "../features/pudding/core/pudding-tools.js";
import { usePudding } from "../features/pudding/usePudding.js";
import "../features/pudding/original.css";
import "../features/pudding/controls.css";
const {
  mount,
  flavor,
  selectedFlavor,
  tool,
  softness,
  recovery,
  volume,
  muted,
  hits,
  mode,
  reaction,
  ready,
  error,
  audioError,
  reset,
  keyboardHit,
  reload,
} = usePudding();
</script>

<template>
  <div class="pudding-page">
    <div class="playroom">
      <header class="topbar">
        <RouterLink to="/" class="brand" aria-label="별짓 홈"
          ><span class="brand-mark">p.</span
          ><span>pudding<span class="brand-dot">.</span></span></RouterLink
        >
        <span class="edition">A LITTLE MOMENT OF PLAY</span>
        <div class="home-return">
          <span class="desktop-label"
            ><Monitor :size="15" :stroke-width="1.5" aria-hidden="true" />
            플레이그라운드</span
          ><RouterLink to="/" aria-label="별짓 홈으로"
            >별짓 홈으로 ↗</RouterLink
          >
        </div>
      </header>
      <section class="workspace" aria-label="푸딩 플레이그라운드">
        <div class="stage">
          <div class="stage-heading">
            <span class="eyebrow"
              >{{
                String(
                  FLAVORS.findIndex((item) => item.id === flavor) + 1,
                ).padStart(2, "0")
              }}
              / {{ selectedFlavor.english }}</span
            >
            <h1>오늘은, 말랑하게.</h1>
            <p>꾹 누르고, 잡아 늘리고, 놓아보세요.</p>
          </div>
          <div
            ref="mount"
            class="canvas-mount"
            data-testid="pudding-target"
            :data-ready="ready"
            :data-impact-count="hits"
            role="button"
            :tabindex="ready && !error ? 0 : -1"
            :aria-disabled="!ready || error"
            aria-label="손가락이나 마우스로 누르고 잡아 늘릴 수 있는 3D 푸딩. Enter 또는 스페이스로도 타격할 수 있어요."
            @keydown.enter.prevent="keyboardHit"
            @keydown.space.prevent="keyboardHit"
          />
          <div v-if="!ready && !error" class="loading" role="status">
            푸딩을 준비하고 있어요…
          </div>
          <div v-if="error" class="error-message" role="alert">
            <strong>3D 화면을 표시할 수 없어요.</strong>
            <p>브라우저의 그래픽 가속을 확인하고 새로고침해 주세요.</p>
            <button @click="reload">새로고침</button>
          </div>
          <div class="mode-badge" :class="mode" aria-live="polite">
            <Hand :size="15" :stroke-width="1.6" aria-hidden="true" />{{
              reaction
            }}
          </div>
          <div class="stage-footer">
            <span>천천히, 마음 가는 대로.</span
            ><span>JUST PUDDING. JUST PLAY.</span>
          </div>
        </div>
        <aside class="controls" aria-label="푸딩 설정">
          <div class="panel-heading">
            <SlidersHorizontal
              :size="19"
              :stroke-width="1.6"
              aria-hidden="true"
            />
            <h2>나만의 말랑함</h2>
          </div>
          <p class="panel-description">손끝에 맞게 조절해 보세요.</p>
          <div class="tool-picker">
            <h3 id="tool-label">때리는 도구</h3>
            <div
              class="tool-options"
              data-slot="toggle-group"
              role="group"
              aria-labelledby="tool-label"
            >
              <button
                class="tool-option"
                :data-state="tool === 'hand' ? 'on' : 'off'"
                :aria-pressed="tool === 'hand'"
                aria-label="손"
                @click="tool = 'hand'"
              >
                <Hand :size="24" aria-hidden="true" /><span>손</span
                ><Check v-if="tool === 'hand'" :size="15" aria-hidden="true" />
              </button>
              <button
                class="tool-option"
                :data-state="tool === 'bowl' ? 'on' : 'off'"
                :aria-pressed="tool === 'bowl'"
                aria-label="양푼"
                @click="tool = 'bowl'"
              >
                <img :src="BOWL_IMAGE" alt="" width="40" height="23" /><span
                  >양푼</span
                ><Check v-if="tool === 'bowl'" :size="15" aria-hidden="true" />
              </button>
              <button
                class="tool-option"
                :data-state="tool === 'whip' ? 'on' : 'off'"
                :aria-pressed="tool === 'whip'"
                aria-label="채찍"
                @click="tool = 'whip'"
              >
                <img :src="WHIP_IMAGE" alt="" width="32" height="32" /><span
                  >채찍</span
                ><Check v-if="tool === 'whip'" :size="15" aria-hidden="true" />
              </button>
            </div>
            <p>
              {{
                tool === "whip"
                  ? "좌클릭을 누르고 휘둘러요. 줄이 닿으면 찰싹! 끝이 빠르게 튕기면 공기 파동!"
                  : "PC에서 좌클릭을 누른 채 휘둘러요."
              }}
            </p>
          </div>
          <div class="flavor-picker">
            <h3 id="flavor-label">푸딩 맛</h3>
            <div
              class="flavor-options"
              data-slot="toggle-group"
              role="group"
              aria-labelledby="flavor-label"
            >
              <button
                v-for="item in FLAVORS"
                :key="item.id"
                class="flavor-option"
                :data-state="flavor === item.id ? 'on' : 'off'"
                :aria-pressed="flavor === item.id"
                :aria-label="item.name"
                @click="flavor = item.id"
              >
                <span
                  class="flavor-swatch"
                  :style="{
                    backgroundColor: item.body,
                    borderColor: item.sauce,
                  }"
                  aria-hidden="true"
                  ><Check
                    v-if="flavor === item.id"
                    :size="17"
                    :stroke-width="2.5" /></span
                ><span>{{ item.name }}</span>
              </button>
            </div>
          </div>
          <div class="setting">
            <div class="setting-top">
              <label for="softness">말랑함</label
              ><output for="softness">{{
                String(softness).padStart(2, "0")
              }}</output>
            </div>
            <div class="pudding-slider">
              <input
                id="softness"
                v-model.number="softness"
                type="range"
                min="0"
                max="100"
                step="1"
                :style="{ '--range': `${softness}%` }"
              />
            </div>
            <div class="range-labels">
              <span>단단하게</span><span>말랑하게</span>
            </div>
          </div>
          <div class="setting">
            <div class="setting-top">
              <label for="recovery">복원 속도</label
              ><output for="recovery">{{
                String(recovery).padStart(2, "0")
              }}</output>
            </div>
            <div class="pudding-slider">
              <input
                id="recovery"
                v-model.number="recovery"
                type="range"
                min="0"
                max="100"
                step="1"
                :style="{ '--range': `${recovery}%` }"
              />
            </div>
            <div class="range-labels">
              <span>느긋하게</span><span>빠르게</span>
            </div>
          </div>
          <button class="reset-button" @click="reset">
            <RotateCcw :size="16" :stroke-width="1.7" aria-hidden="true" /> 처음
            상태로
          </button>
          <button
            class="sound-button"
            :aria-pressed="!muted"
            :aria-label="muted ? '음소거 해제' : '음소거'"
            @click="muted = !muted"
          >
            <VolumeX v-if="muted" :size="17" aria-hidden="true" /><Volume2
              v-else
              :size="17"
              aria-hidden="true"
            />
            효과음 {{ muted ? "꺼짐" : "켜짐" }}
          </button>
          <div class="sound-volume">
            <div class="setting-top">
              <label for="volume">효과음 볼륨</label
              ><output for="volume">{{ volume }}%</output>
            </div>
            <div class="pudding-slider">
              <input
                id="volume"
                v-model.number="volume"
                type="range"
                min="0"
                max="100"
                :style="{ '--range': `${volume}%` }"
              />
            </div>
          </div>
          <p v-if="audioError" class="sound-error" role="alert">
            {{ audioError }}
          </p>
          <div class="how-to">
            <span class="eyebrow">HOW TO PLAY</span>
            <div>
              <Mouse :size="20" :stroke-width="1.4" aria-hidden="true" />
              <p><strong>꾹 누르기</strong><span>눌러서 납작하게</span></p>
            </div>
            <div>
              <MoveUpRight :size="21" :stroke-width="1.4" aria-hidden="true" />
              <p><strong>잡아당기기</strong><span>끌어서 쭈욱 늘리기</span></p>
            </div>
            <div>
              <Hand :size="21" :stroke-width="1.4" aria-hidden="true" />
              <p><strong>손 놓기</strong><span>탱글하게 돌아오는 순간</span></p>
            </div>
          </div>
          <div class="strike-guide">
            <strong>PC · 휘둘러 때리기</strong>
            <p>
              화면 어디서든 좌클릭을 누른 채<br />휘둘러 보세요.
              {{
                tool === "whip"
                  ? "채찍으로"
                  : tool === "bowl"
                    ? "양푼으로"
                    : "손바닥으로"
              }}
              푸딩을 향해 휘둘러요.
            </p>
          </div>
          <div class="flavor-note">
            <span class="flavor-rule" /><span
              >{{ selectedFlavor.note }}<br /><small
                >가장 단순한, 가장 부드러운.</small
              ></span
            >
          </div>
        </aside>
      </section>
      <footer class="bottom-bar">
        <span>손끝에서 시작하는 작은 쉼표.</span
        ><span>PUDDING PLAYGROUND <b>© 2026</b></span>
      </footer>
    </div>
  </div>
</template>
