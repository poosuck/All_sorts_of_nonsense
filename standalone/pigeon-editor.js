import { createApp } from "vue";
import PigeonView from "../src/views/PigeonView.vue";
import "../src/styles.css";

createApp(PigeonView, { standalone: true }).mount("#app");
