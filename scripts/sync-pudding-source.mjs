import { readFile, writeFile, mkdir } from "node:fs/promises";
import ts from "typescript";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postcss from "postcss";

const root = fileURLToPath(new URL("../", import.meta.url));
const upstream = path.join(root, "vendor/pudding-v24");
const target = path.join(root, "src/features/pudding/core");
const manifest = JSON.parse(
  await readFile(path.join(upstream, "manifest.json"), "utf8"),
);
const check = process.argv.includes("--check");
const modified = [];

function replace(source, from, to, expected = 1) {
  if (source.split(from).length - 1 !== expected)
    throw new Error(`Upstream anchor changed: ${from.slice(0, 70)}`);
  return source.split(from).join(to);
}
async function output(file, contents) {
  if (check) {
    if ((await readFile(file, "utf8")) !== contents)
      modified.push(path.relative(root, file));
  } else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }
}

// Verify the supplied source before making deterministic, explicitly scoped adaptations.
for (const [file, digest] of Object.entries(manifest.files)) {
  const data = await readFile(path.join(upstream, file));
  if (createHash("sha256").update(data).digest("hex") !== digest)
    throw new Error(`Upstream file changed: ${file}`);
  if (!file.startsWith("lib/")) continue;
  let source = data.toString("utf8");
  if (file === "lib/pudding-engine.ts") {
    source = replace(
      source,
      "private whipOverlay = new WhipOverlay();",
      "private whipOverlay: WhipOverlay;",
    );
    source = replace(
      source,
      "this.renderer.setPixelRatio(",
      "this.whipOverlay = new WhipOverlay();\n    this.renderer.setPixelRatio(",
    );
    source = replace(
      source,
      "this.physics.strike(direction,strength);",
      "this.physics.strike(direction,strength);this.onImpact();",
      2,
    );
    source = replace(
      source,
      "  configure(softness: number,speed: number)",
      `  onImpact: () => void = () => {};
  setVolume(volume: number) { this.allSounds.forEach(sound => sound.setVolume(volume)); }
  setAudioCallbacks(onError: (message: string) => void, onPlay: () => void) {
    this.allSounds.forEach(sound => { sound.onError = onError; sound.onPlay = onPlay; });
  }
  keyboardStrike() {
    this.sound.unlock(); this.anchor.set(0,1.5,1); this.normal.set(0,0,1);
    this.physics.strike({x:.4,y:-.3,z:-.8},4+this.physics.softness/20);
    this.sound.play(); this.onImpact(); this.dirty=true; this.setMode("hit");
  }
  configure(softness: number,speed: number)`,
    );
  }
  if (file === "lib/strike-audio.ts") {
    source = replace(
      source,
      "export class StrikeAudio {",
      `export class StrikeAudio {
  private volumeScale = 1;
  private master: GainNode | null = null;
  onError: (message: string) => void = () => {};
  onPlay: () => void = () => {};`,
    );
    source = replace(
      source,
      "if (!Context) return;",
      'if (!Context) { this.onError("이 브라우저는 효과음을 지원하지 않습니다."); return; }',
    );
    source = replace(
      source,
      "this.context = new Context();",
      `this.context = new Context();
        this.master = this.context.createGain(); this.master.gain.value = this.volumeScale;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value=-8; compressor.knee.value=12; compressor.ratio.value=12;
        this.master.connect(compressor).connect(this.context.destination);`,
    );
    source = replace(
      source,
      "}).catch(() => {});",
      '}).catch(() => { if (!this.disposed) this.onError("효과음 디코딩에 실패했습니다. 새로고침해 주세요."); });',
    );
    source = replace(
      source,
      "gain.connect(this.context.destination);",
      "gain.connect(this.master!);",
    );
    source = replace(
      source,
      "source.start(0, this.offset);",
      "source.start(0, this.offset);this.onPlay();",
    );
    source = replace(
      source,
      "  setEnabled(enabled: boolean)",
      `  setVolume(volume: number) {
    this.volumeScale=Math.max(0,Math.min(1,volume));
    if(this.context && this.master) this.master.gain.setTargetAtTime(this.volumeScale,this.context.currentTime,.012);
  }
  setEnabled(enabled: boolean)`,
    );
  }
  let js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      removeComments: false,
    },
    fileName: file,
  }).outputText;
  js = js.replace(
    /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
    (_, a, specifier, b) =>
      `${a}${path.extname(specifier) ? specifier : specifier + ".js"}${b}`,
  );
  await output(
    path.join(target, path.basename(file, ".ts") + ".js"),
    "// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.\n" +
      js,
  );
}

const css = await readFile(path.join(upstream, "app/globals.css"), "utf8");
const variables = css.match(/:root\{([^}]+)\}/)[1];
const tree = postcss.parse(css.slice(css.indexOf(".playroom{")));
tree.walkRules((rule) => {
  if (rule.selector.startsWith("html.pudding-strike-mode")) return; // Original temporary whole-window tool cursor.
  rule.selectors = rule.selectors.map(
    (selector) => `.pudding-page ${selector}`,
  );
});
const prefix = `/* Scoped original v24 stylesheet. Generated by npm run source:sync. */
body.pudding-route { background:#f5f1e8; }
.pudding-page { ${variables}; background:var(--background); color:var(--foreground); font-family:Arial,"Noto Sans KR","Malgun Gothic",sans-serif; min-height:100vh; }
.pudding-page button { font:inherit; cursor:pointer; }
.pudding-page .eyebrow { display:inline; }
`;
await output(
  path.join(root, "src/features/pudding/original.css"),
  prefix + tree.toString() + "\n",
);
if (modified.length)
  throw new Error("Generated files differ: " + modified.join(", "));
console.log(
  check
    ? "v24 snapshot integrity and generated source verified."
    : "v24 JavaScript modules and scoped original CSS generated.",
);
