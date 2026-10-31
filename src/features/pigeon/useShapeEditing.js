import { computed, ref } from "vue";
import { DEFAULT_SHAPE, validateShape } from "./shape-editor.js";
import manifest from "../../assets/pigeon/manifest.json";

const STORAGE_KEY = `pigeon-shape-editor:${manifest.glb_sha256}`;
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useShapeEditing(getStudy, initiallyEditing) {
  const editing = ref(initiallyEditing), values = ref({ ...DEFAULT_SHAPE });
  const comparing = ref(false), feathers = ref(true), message = ref(""), busy = ref(false);
  const history = ref([{ ...DEFAULT_SHAPE }]), cursor = ref(0);
  const canUndo = computed(() => cursor.value > 0);
  const canRedo = computed(() => cursor.value < history.value.length - 1);
  const changed = computed(() => Object.values(values.value).some(value => value !== 0));
  function show() { getStudy()?.setShape(editing.value && !comparing.value ? values.value : DEFAULT_SHAPE); }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recipe()));
      message.value = "이 브라우저에 자동 저장됨";
    } catch { message.value = "자동 저장이 차단되어 있습니다. 조정값 JSON을 내려받아 보관하세요."; }
  }
  function recipe() {
    return { format: "pigeon-shape-edit", version: 1, baseRevision: manifest.revision, baseSha256: manifest.glb_sha256, values: { ...values.value } };
  }
  function parseRecipe(data) {
    if (data?.format !== "pigeon-shape-edit" || data.version !== 1) throw new Error("비둘기 편집 화면에서 저장한 JSON을 선택하세요.");
    if (data.baseSha256 !== manifest.glb_sha256 || data.baseRevision !== manifest.revision) throw new Error("다른 버전 모델의 조정값입니다. 원본 버전이 같은 파일을 선택하세요.");
    return validateShape(data.values);
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      values.value = parseRecipe(JSON.parse(saved));
      history.value = [{ ...values.value }];
      message.value = "지난 조정값을 불러왔습니다.";
    }
  } catch { message.value = "지난 저장값을 읽지 못했습니다. 원본에서 시작합니다."; }
  function commit() {
    const current = history.value[cursor.value];
    if (JSON.stringify(current) !== JSON.stringify(values.value)) {
      history.value = history.value.slice(0, cursor.value + 1);
      history.value.push({ ...values.value });
      if (history.value.length > 80) history.value.shift();
      cursor.value = history.value.length - 1;
    }
    save();
  }
  return {
    editing, values, comparing, feathers, message, busy, canUndo, canRedo, changed,
    initialize() { if (editing.value) show(); },
    toggle() {
      editing.value = !editing.value; comparing.value = false;
      show(); getStudy()?.setFeathers(editing.value ? feathers.value : true);
    },
    update(key, value) { values.value = validateShape({ ...values.value, [key]: Number(value) }); show(); },
    commit,
    undo() {
      if (!canUndo.value) return;
      values.value = { ...history.value[--cursor.value] }; comparing.value = false; show(); save();
    },
    redo() {
      if (!canRedo.value) return;
      values.value = { ...history.value[++cursor.value] }; comparing.value = false; show(); save();
    },
    reset() { values.value = { ...DEFAULT_SHAPE }; comparing.value = false; show(); commit(); },
    compare() { comparing.value = !comparing.value; show(); },
    toggleFeathers() { feathers.value = !feathers.value; getStudy()?.setFeathers(feathers.value); },
    exportJSON() { download(new Blob([JSON.stringify(recipe(), null, 2)], { type: "application/json" }), `pigeon-${manifest.revision}-adjustments.json`); },
    async importJSON(file) {
      if (!file) return;
      try {
        if (file.size > 100000) throw new Error("조정값 파일이 너무 큽니다.");
        const imported = parseRecipe(JSON.parse(await file.text()));
        values.value = imported; comparing.value = false; show(); commit();
        message.value = "조정값을 불러왔습니다.";
      } catch (error) { message.value = error instanceof SyntaxError ? "JSON 파일을 읽을 수 없습니다." : error.message; }
    },
    async exportGLB() {
      busy.value = true;
      try {
        const buffer = await getStudy().exportGLB(values.value);
        download(new Blob([buffer], { type: "model/gltf-binary" }), `pigeon-${manifest.revision}-edited.glb`);
        message.value = "수정한 모델을 GLB로 저장했습니다. Blender에서 가져올 수 있습니다.";
      } catch { message.value = "모델을 저장하지 못했습니다. 다시 시도해 주세요."; }
      finally { busy.value = false; }
    },
    screenshot() {
      const link = document.createElement("a");
      link.href = getStudy().screenshot(); link.download = `pigeon-${manifest.revision}-preview.png`; link.click();
    },
  };
}
