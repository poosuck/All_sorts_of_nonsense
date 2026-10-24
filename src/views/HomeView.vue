<script setup>
import PuddingArt from "../components/PuddingArt.vue";
</script>
<template>
  <div class="home-view page-width">
    <section class="home-hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <div class="eyebrow">
          <i class="live-dot" /> 쓸모없는 것들의 쓸모있는 모음
        </div>
        <h1 id="hero-title">
          할 일은 없고,<br /><span class="lime-underline">별짓은 많고.</span
          ><span class="hero-asterisk">✳︎</span>
        </h1>
        <p>거창한 건 없습니다.<br />그냥, 잠깐 딴짓하고 가세요.</p>
        <a class="text-link" href="#collection"
          >오늘의 별짓 고르기 <span>↓</span></a
        >
      </div>
      <div class="hero-object" aria-hidden="true">
        <span class="orbit-label">만져도 됩니다. 진짜로.</span>
        <svg class="scribble-arrow" viewBox="0 0 100 80">
          <path d="M9 8c76-2 15 82 69 47m-13-3 15 2-3 15" />
        </svg>
        <div class="hero-plate" />
        <PuddingArt class="hero-pudding" />
        <span class="hero-sticker">쓸모<br /><b>보장 안 함</b></span>
        <span class="object-caption">FIG. 01 — 평온한 푸딩의 오후</span>
        <span class="hero-spark spark-one">✧</span
        ><span class="hero-spark spark-two">✳︎</span>
      </div>
    </section>
    <div class="manifesto-strip">
      <span>잠깐의 딴짓, 꽤 괜찮은 선택.</span
      ><span>NO GOAL. JUST PLAY. <b>↙</b></span>
    </div>
    <section
      id="collection"
      class="collection"
      aria-labelledby="collection-title"
    >
      <div class="section-heading">
        <div>
          <span class="eyebrow">THE COLLECTION</span>
          <h2 id="collection-title">오늘은 무슨 별짓?</h2>
        </div>
        <span class="collection-count">하나씩 늘어나는 중 <span>02</span></span>
      </div>
      <div class="content-grid">
        <RouterLink
          to="/pudding"
          class="content-card pudding-card"
          aria-label="말랑 푸딩 시작하기"
        >
          <div class="card-art pudding-card-art">
            <span class="card-index">NO. 001</span
            ><span class="card-badge"><i class="live-dot" /> 지금 가능</span>
            <div class="card-plate" />
            <PuddingArt /><span class="card-art-note"
              >오늘도 무해하게 찰싹.</span
            >
          </div>
          <div class="card-info">
            <div>
              <span class="card-category">촉감 만족 · 스트레스 방류</span>
              <h3>말랑 푸딩</h3>
              <p>탱글하게 누르고, 아무 일도 없던 것처럼.</p>
            </div>
            <span class="card-arrow">↗</span>
          </div>
        </RouterLink>
        <RouterLink
          to="/pigeon"
          class="content-card pigeon-card"
          aria-labelledby="pigeon-title"
        >
          <div class="card-art pigeon-card-art">
            <span class="card-index">NO. 002</span
            ><span class="card-badge soon-badge">제작 중 · 미리보기</span>
            <svg
              class="pigeon-art"
              viewBox="0 0 400 280"
              fill="none"
              aria-hidden="true"
            >
              <ellipse cx="200" cy="246" rx="97" ry="10" fill="#d9ded8" />
              <path
                d="m175 218-8 27m44-27 6 27m-50 0-14 4m14-4 13 4m37-4-12 4m12-4 15 4"
                stroke="#c27455"
                stroke-width="4"
                stroke-linecap="round"
              />
              <path
                d="M282 198c-12 37-65 45-111 25-30-14-44-46-28-74 9-17 14-28 12-49-4-46 51-63 71-29 8 14 4 34 0 48 34 8 65 44 56 79Z"
                fill="#a9b5b4"
              />
              <path
                d="M157 125c18 11 47 11 66-4l6 18c-18 17-47 11-67 2Z"
                fill="#6c8b80"
              />
              <path
                d="M173 165c33-32 77-8 93 28-24 31-63 24-93-5"
                fill="#8d9e9c"
              />
              <path
                d="m178 178 38 16m-37-5 28 14"
                stroke="#6f8581"
                stroke-width="3"
                stroke-linecap="round"
              />
              <circle cx="209" cy="85" r="5" fill="#252b2b" />
              <circle cx="210" cy="83" r="1.5" fill="white" />
              <path d="m228 94 20 8-21 5" fill="#d3ac76" />
              <path d="m144 183-38 12 37 13" fill="#829491" />
              <path
                d="m303 225 5 3m-17 7 5 2m22 6 4-2"
                stroke="#b99c66"
                stroke-width="4"
                stroke-linecap="round"
              />
            </svg>
            <span class="pigeon-thought">밥은 언제 주나요.</span
            ><span class="card-art-note">우선, 뒤뚱거림부터 연구 중</span>
          </div>
          <div class="card-info">
            <div>
              <span class="card-category">도심 힐링 · 조류 교감</span>
              <h3 id="pigeon-title">비둘기 모이주기</h3>
              <p>비둘기가 먼저 왔어요. 움직임을 구경하세요.</p>
            </div>
            <span class="card-arrow">↗</span>
          </div>
        </RouterLink>
      </div>
    </section>
    <aside class="closing-note">
      <span>✳︎</span>
      <p>아무것도 안 해도 괜찮은 곳.<br /><b>여기는 별짓입니다.</b></p>
      <span class="small-print">딴짓 연구소<br />EST. 2026</span>
    </aside>
  </div>
</template>
