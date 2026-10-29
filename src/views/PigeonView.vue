<template>
  <section class="pigeon-empty" aria-labelledby="pigeon-heading">
    <RouterLink to="/" class="pigeon-back">← 별짓 홈으로</RouterLink>
    <div class="pigeon-empty-message">
      <span class="eyebrow">NO. 002 · 새로 준비 중</span>
      <h1 id="pigeon-heading">비둘기 모이주기</h1>
      <p>처음부터 다시 준비합니다.</p>
    </div>
  </section>
</template>

<style scoped>
.pigeon-empty {
  min-height: 100svh;
  padding: clamp(24px, 5vw, 64px);
  display: flex;
  flex-direction: column;
}
.pigeon-back {
  align-self: flex-start;
  font-size: 14px;
}
.pigeon-empty-message {
  margin: auto 0;
  padding: 64px 0;
  text-align: center;
}
h1 {
  margin: 20px 0 16px;
  font-size: clamp(28px, 5vw, 48px);
  letter-spacing: -0.04em;
}
p {
  color: #737565;
  line-height: 1.8;
}
</style>
