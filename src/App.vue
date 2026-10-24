<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import BrandLogo from "./components/BrandLogo.vue";
const route = useRoute();
const main = ref(null);
const isPudding = computed(() => route.name === "pudding");
const isContent = computed(() => ["pudding", "pigeon"].includes(route.name));
watch(
  isPudding,
  (value) => document.body.classList.toggle("pudding-route", value),
  { immediate: true },
);
watch(
  () => route.path,
  async () => {
    await nextTick();
    main.value?.focus({ preventScroll: true });
  },
);
</script>

<template>
  <a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <header v-if="!isContent" class="site-header">
    <RouterLink to="/" class="brand-link" aria-label="별짓 홈"
      ><BrandLogo
    /></RouterLink>
    <span class="header-note">아주 쓸데있는 딴짓.</span>
    <nav aria-label="메인 메뉴">
      <RouterLink to="/#collection" class="nav-collection"
        >별짓 모음 <span>↗</span></RouterLink
      >
      <span class="version-label">VOL. 0.1</span>
    </nav>
  </header>
  <main id="main" ref="main" tabindex="-1"><RouterView /></main>
  <footer v-if="!isContent" class="site-footer">
    <BrandLogo small />
    <span>생산성은 잠시 내려두세요.</span>
    <span class="footer-end"
      >© {{ new Date().getFullYear() }} BYEOLJIT
      <span class="footer-star">✳︎</span></span
    >
  </footer>
</template>
