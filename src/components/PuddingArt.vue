<script setup>
import { computed, useId } from "vue";
import { flavors } from "../features/pudding/config.js";
const props = defineProps({
  flavor: { type: String, default: "custard" },
  face: { type: Boolean, default: true },
});
const id = useId().replace(/:/g, "");
const colors = computed(
  () => flavors.find((f) => f.id === props.flavor) || flavors[0],
);
</script>
<template>
  <svg class="pudding-art" viewBox="0 0 400 340" fill="none" aria-hidden="true">
    <defs>
      <linearGradient
        :id="`${id}-body`"
        x1="85"
        y1="140"
        x2="325"
        y2="255"
        gradientUnits="userSpaceOnUse"
      >
        <stop :stop-color="colors.light" />
        <stop offset=".46" :stop-color="colors.body" />
        <stop offset="1" :stop-color="colors.shade" />
      </linearGradient>
      <linearGradient
        :id="`${id}-top`"
        x1="150"
        y1="80"
        x2="270"
        y2="148"
        gradientUnits="userSpaceOnUse"
      >
        <stop :stop-color="colors.topLight" />
        <stop offset="1" :stop-color="colors.top" />
      </linearGradient>
      <linearGradient
        :id="`${id}-shine`"
        x1="140"
        y1="120"
        x2="174"
        y2="255"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#fff" stop-opacity=".65" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M119 110C122 82 278 82 281 110L321 252C330 296 70 296 79 252Z"
      :fill="`url(#${id}-body)`"
    />
    <path
      d="m140 132-29 112c-3 14 14 19 22 7l29-119Z"
      :fill="`url(#${id}-shine)`"
    />
    <path
      d="m253 141 30 109"
      :stroke="colors.shade"
      stroke-width="14"
      stroke-linecap="round"
      opacity=".22"
    />
    <path
      d="M119 110c0-40 162-40 162 0l7 25c-4 15-20 11-25 1-5-10-12-6-13 4-1 27-21 27-24 7-3-14-14-14-20-4-11 13-27 10-31 0-5-11-12-12-17-2-7 11-23 8-31 0Z"
      :fill="colors.top"
    />
    <ellipse cx="200" cy="109" rx="81" ry="28" :fill="`url(#${id}-top)`" />
    <ellipse
      cx="175"
      cy="100"
      rx="39"
      ry="9"
      fill="#fff"
      opacity=".26"
      transform="rotate(-7 175 100)"
    />
    <g v-if="face" stroke="#674226" stroke-width="4.5" stroke-linecap="round">
      <path d="M177 201v6m45-6v6" />
      <path d="M192 216q8 7 16 0" stroke-width="3" />
      <ellipse
        cx="164"
        cy="217"
        rx="10"
        ry="5"
        fill="#ed9880"
        opacity=".48"
        stroke="none"
      />
      <ellipse
        cx="235"
        cy="217"
        rx="10"
        ry="5"
        fill="#ed9880"
        opacity=".48"
        stroke="none"
      />
    </g>
  </svg>
</template>
