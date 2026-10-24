import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  FLAVOR_STORAGE_KEY,
  getFlavor,
  isFlavorId,
} from "./core/pudding-flavors.js";

const modeText = {
  armed: "손바닥 준비! 휘둘러 때려보세요",
  hit: "찰싹! 탱글탱글",
  ready: "한번 만져볼까요?",
  press: "꾸욱 누르는 중",
  drag: "쭈욱 늘어나는 중",
  settle: "탱글탱글, 제자리로",
};
export function usePudding() {
  const mount = ref(null),
    flavor = ref("custard"),
    tool = ref("hand"),
    softness = ref(60),
    recovery = ref(50);
  const volume = ref(100),
    muted = ref(false),
    hits = ref(0),
    mode = ref("ready");
  const ready = ref(false),
    error = ref(false),
    audioError = ref("");
  const selectedFlavor = computed(() => getFlavor(flavor.value));
  const reaction = computed(() => {
    if (tool.value === "whip" && mode.value === "armed")
      return "채찍 준비! 줄로 푸딩을 때려보세요";
    if (tool.value === "whip" && mode.value === "hit") return "찰싹! 채찍 명중";
    if (tool.value === "bowl" && mode.value === "armed")
      return "양푼 준비! 휘둘러 때려보세요";
    if (tool.value === "bowl" && mode.value === "hit") return "통! 탱글탱글";
    return modeText[mode.value];
  });
  let engine,
    disposed = false;
  const lifecycle = new AbortController();
  watch(volume, (value) => engine?.setVolume(value / 100));
  watch(muted, (value) => engine?.setSoundEnabled(!value));
  watch([softness, recovery], () =>
    engine?.configure(softness.value, recovery.value),
  );
  watch(tool, (value) => engine?.setStrikeTool(value));
  watch(flavor, (value) => {
    engine?.setFlavor(value);
    try {
      localStorage.setItem(FLAVOR_STORAGE_KEY, value);
    } catch {
      /* Storage is optional, as in v24. */
    }
  });
  function reset() {
    engine?.reset();
    softness.value = 60;
    recovery.value = 50;
    hits.value = 0;
    mode.value = "ready";
  }
  function keyboardHit() {
    if (ready.value && !error.value) engine?.keyboardStrike();
  }
  function reload() {
    window.location.reload();
  }
  // Preserve v24's optional Sites modelContext tools without requiring Sites at runtime.
  function registerTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const register = (definition) => {
      try {
        Promise.resolve(
          context.registerTool(definition, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional host API. */
      }
    };
    register({
      name: "configure_pudding",
      description:
        "Set the visible pudding softness and recovery speed, from 0 to 100.",
      inputSchema: {
        type: "object",
        properties: {
          softness: { type: "number", minimum: 0, maximum: 100 },
          speed: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["softness", "speed"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input) {
        if (
          !input ||
          !Number.isFinite(input.softness) ||
          !Number.isFinite(input.speed) ||
          input.softness < 0 ||
          input.softness > 100 ||
          input.speed < 0 ||
          input.speed > 100
        )
          throw new Error("Both values must be between 0 and 100.");
        softness.value = input.softness;
        recovery.value = input.speed;
        return { softness: input.softness, speed: input.speed };
      },
    });
    register({
      name: "reset_pudding",
      description:
        "Release the pudding, restore its shape, and reset both settings to defaults.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute() {
        reset();
        return { softness: 60, speed: 50, state: "ready" };
      },
    });
  }
  onMounted(async () => {
    registerTools();
    try {
      const saved = localStorage.getItem(FLAVOR_STORAGE_KEY);
      if (isFlavorId(saved)) flavor.value = saved;
    } catch {
      /* Use the v24 default. */
    }
    try {
      const { PuddingEngine } = await import("./core/pudding-engine.js");
      if (disposed || !mount.value) return;
      engine = new PuddingEngine(
        mount.value,
        (value) => {
          mode.value = value;
        },
        () => {
          error.value = true;
          ready.value = false;
        },
      );
      engine.onImpact = () => {
        hits.value++;
      };
      engine.setAudioCallbacks(
        (message) => {
          audioError.value = message;
        },
        () => {
          audioError.value = "";
        },
      );
      engine.configure(softness.value, recovery.value);
      engine.setFlavor(flavor.value, true);
      engine.setVolume(volume.value / 100);
      engine.setStrikeTool(tool.value);
      if (muted.value) engine.setSoundEnabled(false);
      ready.value = true;
    } catch {
      error.value = true;
      ready.value = false;
    }
  });
  onBeforeUnmount(() => {
    disposed = true;
    lifecycle.abort();
    engine?.dispose();
  });
  return {
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
  };
}
