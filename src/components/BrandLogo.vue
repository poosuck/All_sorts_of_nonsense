<script setup>
defineProps({ small: Boolean });
</script>
<template>
  <span class="brand-logo" :class="{ small }">
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="m23 1 6 13 15-2-9 12 7 14-16-5-12 11 1-17L2 18l16-2Z"
        fill="currentColor"
      />
      <circle cx="22" cy="22" r="1.5" fill="var(--paper)" />
      <circle cx="29" cy="21" r="1.5" fill="var(--paper)" /></svg
    ><span>별짓<span class="brand-dot">.</span></span>
  </span>
</template>
