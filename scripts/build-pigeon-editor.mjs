import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import manifest from "../src/assets/pigeon/manifest.json" with { type: "json" };

const result = await build({
  configFile: false,
  plugins: [vue()],
  define: { "process.env.NODE_ENV": JSON.stringify("production"), "import.meta.url": "window.location.href" },
  build: {
    write: false,
    lib: { entry: "standalone/pigeon-editor.js", name: "PigeonEditor", formats: ["iife"] },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
const output = Array.isArray(result) ? result.flatMap(item => item.output) : result.output;
const code = output.filter(item => item.type === "chunk").map(item => item.code).join("\n");
const css = output.filter(item => item.fileName.endsWith(".css")).map(item => item.source).join("\n");
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>비둘기 형태 편집 · ${manifest.revision}</title><style>${css}</style></head><body><div id="app"></div><script>${code.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
await mkdir("dist/pigeon-editor", { recursive: true });
await writeFile("dist/pigeon-editor/pigeon-editor.html", html);
await writeFile("dist/pigeon-editor/사용방법.txt", `비둘기 형태 편집 · ${manifest.revision}\n\n1. ZIP 압축을 풉니다.\n2. pigeon-editor.html을 Chrome 또는 Edge에서 엽니다.\n3. 오른쪽 슬라이더로 조정합니다. 아래로 스크롤하면 목·몸통과 저장 버튼이 있습니다.\n\n설치·서버·인터넷 연결이 필요 없습니다.\n원본 비교, 실행 취소, 조정값 JSON 저장/불러오기, 수정 GLB 저장, PNG 저장을 지원합니다.\n조정값은 이 브라우저에 자동 저장됩니다. 장기 보관은 JSON으로 내려받으세요.\nBlender에서는 파일 > 가져오기 > glTF 2.0으로 수정한 GLB를 엽니다.\n원본 .blend 파일을 덮어쓰지 않습니다.\n깃털 숨기기는 보기 옵션이며, GLB에는 모든 깃털과 기존 재질이 포함됩니다.\n참고 이미지는 로컬에서만 표시됩니다. 새로 열 때 다시 선택하세요.\n이 편집기는 비율 조정 도구입니다. 정점 단위 조각·깃털 개별 편집은 Blender에서 진행하세요.\n`);
await mkdir("downloads", { recursive: true });
execFileSync("python3", ["-c", "from zipfile import ZipFile, ZIP_DEFLATED; from pathlib import Path; p=Path('dist/pigeon-editor'); z=ZipFile('downloads/pigeon-editor.zip','w',ZIP_DEFLATED); [z.write(f,f.name) for f in sorted(p.iterdir())]; z.close()"]);
console.log(`Standalone editor: ${html.length} chars → downloads/pigeon-editor.zip`);
