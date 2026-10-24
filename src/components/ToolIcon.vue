<script setup>
defineProps({ tool: String });
</script>
<template>
  <svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g v-if="tool === 'hand'">
      <path
        d="M15 26V12a3 3 0 0 1 6 0v12-17a3 3 0 0 1 6 0v17-14a3 3 0 0 1 6 0v16-9a3 3 0 0 1 6 0v14c0 10-5 14-13 14-5 0-8-3-11-7l-7-10c-3-5 1-8 4-5l6 7"
      />
    </g>
    <g v-else-if="tool === 'bowl'">
      <ellipse cx="24" cy="17" rx="19" ry="7" />
      <path d="M5 17c1 17 8 23 19 23s18-6 19-23M10 28c6 5 19 6 26 1" />
      <path d="M12 16c5-3 16-3 23 0" opacity=".5" />
    </g>
    <g v-else>
      <path
        d="m9 43 13-16 5 4-13 15ZM25 28c-10-15 18-6 14-20-1-4-8-6-12-3M27 27c8-10-1-12-1-17"
      />
      <path d="m37 3 3-2m4 13 3 1M18 16l-3-3" />
    </g>
  </svg>
</template>
