import { STRIKE_AUDIO_BASE64 } from './strike-audio-data';

export class StrikeAudio {
  constructor(private audioData = STRIKE_AUDIO_BASE64, private offset = 0.7, private volume = .6, private maxVoices = 6) {}
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;
  private voices = new Set<AudioBufferSourceNode>();
  private enabled = true;
  private disposed = false;
  private generation = 0;

  // Called synchronously from the user's pointer-down, never from autoplay.
  unlock() {
    if (this.disposed || !this.enabled) return;
    try {
      if (!this.context) {
        const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        const bytes = Uint8Array.from(atob(this.audioData), c => c.charCodeAt(0));
        this.loading = this.context.decodeAudioData(bytes.buffer).then(buffer => { if(!this.disposed) this.buffer=buffer; }).catch(() => {});
      }
      if(this.context.state==='suspended') void this.context.resume().catch(() => {});
    } catch { /* An audio failure must not interrupt the pudding interaction. */ }
  }
  play() {
    if(!this.enabled || this.disposed || !this.context) return;
    const time=performance.now(), generation=this.generation;
    const start=()=>{
      if(!this.enabled || this.disposed || generation!==this.generation || document.hidden || !this.buffer || this.context?.state!=='running' || performance.now()-time>150) return;
      // Each hit has its own source; rapid hits do not restart/cut the previous hit.
      if(this.voices.size>=this.maxVoices) this.voices.values().next().value?.stop();
      const source=this.context.createBufferSource(), gain=this.context.createGain();
      source.buffer=this.buffer;source.playbackRate.value=1;gain.gain.value=this.volume;
      source.connect(gain);gain.connect(this.context.destination);this.voices.add(source);
      source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};
      // Each tool skips only its own leading audio; start immediately on impact.
      source.start(0, this.offset);
    };
    if(this.buffer) start();else void this.loading?.then(start);
  }
  setEnabled(enabled: boolean) {this.enabled=enabled;if(!enabled)this.stop();else this.unlock();}
  stop() {this.generation++;for(const source of this.voices) {try{source.stop();}catch{}}this.voices.clear();}
  dispose() {this.disposed=true;this.stop();if(this.context)void this.context.close().catch(()=>{});this.buffer=null;}
}
