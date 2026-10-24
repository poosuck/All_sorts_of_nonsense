"use client";

import { useEffect, useRef, useState } from "react";
import { Mouse, MoveUpRight, RotateCcw, SlidersHorizontal, Hand, Monitor, Check, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WHIP_IMAGE, BOWL_IMAGE, type StrikeTool } from "@/lib/pudding-tools";
import { FLAVORS, FLAVOR_STORAGE_KEY, getFlavor, isFlavorId, type FlavorId } from "@/lib/pudding-flavors";
import type { PuddingEngine } from "@/lib/pudding-engine";

type Mode = "ready" | "press" | "drag" | "settle" | "armed" | "hit";
const modeText: Record<Mode, string> = { armed: "손바닥 준비! 휘둘러 때려보세요", hit: "찰싹! 탱글탱글", ready: "한번 만져볼까요?", press: "꾸욱 누르는 중", drag: "쭈욱 늘어나는 중", settle: "탱글탱글, 제자리로" };

export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<PuddingEngine | null>(null);
  const [strikeTool, setStrikeTool] = useState<StrikeTool>("hand");
  const toolPreference = useRef<StrikeTool>("hand");
  const [flavor, setFlavor] = useState<FlavorId>("custard");
  const flavorPreference = useRef<FlavorId>("custard");
  const selectedFlavor = getFlavor(flavor);
  const selectFlavor = (value: string) => {
    if(!isFlavorId(value)) return;
    flavorPreference.current=value; setFlavor(value); engine.current?.setFlavor(value);
    try { localStorage.setItem(FLAVOR_STORAGE_KEY,value); } catch { /* Storage is optional. */ }
  };
  const [softness, setSoftness] = useState(60);
  const [speed, setSpeed] = useState(50);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundPreference = useRef(true);
  const [mode, setMode] = useState<Mode>("ready");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const values = useRef({ softness: 60, speed: 50 });
  const setSettings = (s: number, v: number) => {
    values.current = { softness: s, speed: v };
    setSoftness(s); setSpeed(v); engine.current?.configure(s, v);
  };
  const reset = () => { setSettings(60, 50); engine.current?.reset(); setMode("ready"); };

  useEffect(() => {
    let disposed = false;
    try { const saved=localStorage.getItem(FLAVOR_STORAGE_KEY); if(isFlavorId(saved)) { flavorPreference.current=saved; setFlavor(saved); } } catch { /* Use the default when storage is unavailable. */ }
    import("@/lib/pudding-engine").then(({ PuddingEngine }) => {
      if (disposed || !mount.current) return;
      try {
        engine.current = new PuddingEngine(mount.current, setMode, () => setError(true));
        engine.current.configure(values.current.softness, values.current.speed);
        engine.current.setFlavor(flavorPreference.current,true);
        engine.current.setStrikeTool(toolPreference.current);
        if(!soundPreference.current) engine.current.setSoundEnabled(false);
        setReady(true);
      } catch (e) { console.error(e); setError(true); }
    }).catch(() => setError(true));
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, opts: { signal: AbortSignal }) => unknown } }).modelContext;
    const lifecycle = new AbortController();
    if (context?.registerTool) {
      const register = (tool: unknown) => { try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} };
      register({ name: "configure_pudding", description: "Set the visible pudding softness and recovery speed, from 0 to 100.", inputSchema: { type: "object", properties: { softness: { type: "number", minimum: 0, maximum: 100 }, speed: { type: "number", minimum: 0, maximum: 100 } }, required: ["softness", "speed"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: (input: unknown) => { const p = input as Record<string, unknown>; if (!p || typeof p.softness !== "number" || typeof p.speed !== "number" || !Number.isFinite(p.softness) || !Number.isFinite(p.speed) || p.softness < 0 || p.softness > 100 || p.speed < 0 || p.speed > 100) throw new Error("Both values must be between 0 and 100."); setSettings(p.softness, p.speed); return { softness: p.softness, speed: p.speed }; } });
      register({ name: "reset_pudding", description: "Release the pudding, restore its shape, and reset both settings to defaults.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute: () => { reset(); return { softness: 60, speed: 50, state: "ready" }; } });
    }
    return () => { disposed = true; lifecycle.abort(); engine.current?.dispose(); engine.current = null; };
  }, []);

  return <main className="playroom">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">p.</span><span>pudding<span className="brand-dot">.</span></span></div>
      <span className="edition">A LITTLE MOMENT OF PLAY</span>
      <span className="desktop-label"><Monitor size={15} strokeWidth={1.5} /> 플레이그라운드</span>
    </header>
    <section className="workspace" aria-label="푸딩 플레이그라운드">
      <div className="stage">
        <div className="stage-heading"><span className="eyebrow">{String(FLAVORS.findIndex(item => item.id === flavor)+1).padStart(2,"0")} / {selectedFlavor.english}</span><h1>오늘은, 말랑하게.</h1><p>꾹 누르고, 잡아 늘리고, 놓아보세요.</p></div>
        <div ref={mount} className="canvas-mount" aria-label="손가락이나 마우스로 누르고 잡아 늘릴 수 있는 3D 푸딩" />
        {!ready && !error && <div className="loading" role="status">푸딩을 준비하고 있어요…</div>}
        {error && <div className="error-message" role="alert"><strong>3D 화면을 표시할 수 없어요.</strong><p>브라우저의 그래픽 가속을 확인하고 새로고침해 주세요.</p><button onClick={() => window.location.reload()}>새로고침</button></div>}
        <div className={`mode-badge ${mode}`} aria-live="polite"><Hand size={15} strokeWidth={1.6} />{mode === "armed" && strikeTool === "whip" ? "채찍 준비! 줄로 푸딩을 때려보세요" : mode === "hit" && strikeTool === "whip" ? "찰싹! 채찍 명중" : mode === "armed" && strikeTool === "bowl" ? "양푼 준비! 휘둘러 때려보세요" : mode === "hit" && strikeTool === "bowl" ? "통! 탱글탱글" : modeText[mode]}</div>
        <div className="stage-footer"><span>천천히, 마음 가는 대로.</span><span>JUST PUDDING. JUST PLAY.</span></div>
      </div>
      <aside className="controls" aria-label="푸딩 설정">
        <div className="panel-heading"><SlidersHorizontal size={19} strokeWidth={1.6} /><h2>나만의 말랑함</h2></div>
        <p className="panel-description">손끝에 맞게 조절해 보세요.</p>
        <div className="tool-picker">
          <h3 id="tool-label">때리는 도구</h3>
          <ToggleGroup type="single" value={strikeTool} onValueChange={value => { if(value !== "hand" && value !== "bowl" && value !== "whip") return; toolPreference.current=value; setStrikeTool(value); engine.current?.setStrikeTool(value); }} aria-labelledby="tool-label" className="tool-options" spacing={2}>
            <ToggleGroupItem value="hand" className="tool-option"><Hand size={24} /><span>손</span>{strikeTool === "hand" && <Check size={15} />}</ToggleGroupItem>
            <ToggleGroupItem value="bowl" className="tool-option"><img src={BOWL_IMAGE} alt="" width={40} height={23} /><span>양푼</span>{strikeTool === "bowl" && <Check size={15} />}</ToggleGroupItem>
            <ToggleGroupItem value="whip" className="tool-option"><img src={WHIP_IMAGE} alt="" width={32} height={32} /><span>채찍</span>{strikeTool === "whip" && <Check size={15} />}</ToggleGroupItem>
          </ToggleGroup>
          <p>{strikeTool === "whip" ? "좌클릭을 누르고 휘둘러요. 줄이 닿으면 찰싹! 끝이 빠르게 튕기면 공기 파동!" : "PC에서 좌클릭을 누른 채 휘둘러요."}</p>
        </div>
        <div className="flavor-picker">
          <h3 id="flavor-label">푸딩 맛</h3>
          <ToggleGroup type="single" value={flavor} onValueChange={selectFlavor} aria-labelledby="flavor-label" className="flavor-options" spacing={1}>
            {FLAVORS.map(item => <ToggleGroupItem key={item.id} value={item.id} aria-label={item.name} className="flavor-option">
              <span className="flavor-swatch" style={{ backgroundColor: item.body, borderColor: item.sauce }} aria-hidden="true">{flavor===item.id && <Check size={17} strokeWidth={2.5} />}</span>
              <span>{item.name}</span>
            </ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <div className="setting"><div className="setting-top"><label id="softness-label">말랑함</label><output>{softness.toString().padStart(2, "0")}</output></div><Slider aria-labelledby="softness-label" value={[softness]} onValueChange={([v]) => setSettings(v, speed)} min={0} max={100} step={1} className="pudding-slider" /><div className="range-labels"><span>단단하게</span><span>말랑하게</span></div></div>
        <div className="setting"><div className="setting-top"><label id="speed-label">복원 속도</label><output>{speed.toString().padStart(2, "0")}</output></div><Slider aria-labelledby="speed-label" value={[speed]} onValueChange={([v]) => setSettings(softness, v)} min={0} max={100} step={1} className="pudding-slider" /><div className="range-labels"><span>느긋하게</span><span>빠르게</span></div></div>
        <button className="reset-button" onClick={reset}><RotateCcw size={16} strokeWidth={1.7} /> 처음 상태로</button>
        <button className="sound-button" aria-pressed={soundEnabled} onClick={() => { const next=!soundEnabled;setSoundEnabled(next);soundPreference.current=next;engine.current?.setSoundEnabled(next); }}>{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />} 효과음 {soundEnabled ? "켜짐" : "꺼짐"}</button>
        <div className="how-to"><span className="eyebrow">HOW TO PLAY</span><div><Mouse size={20} strokeWidth={1.4} /><p><strong>꾹 누르기</strong><span>눌러서 납작하게</span></p></div><div><MoveUpRight size={21} strokeWidth={1.4} /><p><strong>잡아당기기</strong><span>끌어서 쭈욱 늘리기</span></p></div><div><Hand size={21} strokeWidth={1.4} /><p><strong>손 놓기</strong><span>탱글하게 돌아오는 순간</span></p></div></div>
        <div className="strike-guide"><strong>PC · 휘둘러 때리기</strong><p>화면 어디서든 좌클릭을 누른 채<br />휘둘러 보세요. {strikeTool === "whip" ? "채찍으로" : strikeTool === "bowl" ? "양푼으로" : "손바닥으로"} 푸딩을 향해 휘둘러요.</p></div><div className="flavor-note"><span className="flavor-rule" /><span>{selectedFlavor.note}<br /><small>가장 단순한, 가장 부드러운.</small></span></div>
      </aside>
    </section>
    <footer className="bottom-bar"><span>손끝에서 시작하는 작은 쉼표.</span><span>PUDDING PLAYGROUND <b>© 2026</b></span></footer>
  </main>;
}
