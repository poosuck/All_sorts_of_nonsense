// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.
import { STRIKE_AUDIO_BASE64 } from './strike-audio-data.js';
export class StrikeAudio {
    audioData;
    offset;
    volume;
    maxVoices;
    volumeScale = 1;
    master = null;
    onError = () => { };
    onPlay = () => { };
    constructor(audioData = STRIKE_AUDIO_BASE64, offset = 0.7, volume = .6, maxVoices = 6) {
        this.audioData = audioData;
        this.offset = offset;
        this.volume = volume;
        this.maxVoices = maxVoices;
    }
    context = null;
    buffer = null;
    loading = null;
    voices = new Set();
    enabled = true;
    disposed = false;
    generation = 0;
    // Called synchronously from the user's pointer-down, never from autoplay.
    unlock() {
        if (this.disposed || !this.enabled)
            return;
        try {
            if (!this.context) {
                const Context = window.AudioContext || window.webkitAudioContext;
                if (!Context) {
                    this.onError("이 브라우저는 효과음을 지원하지 않습니다.");
                    return;
                }
                this.context = new Context();
                this.master = this.context.createGain();
                this.master.gain.value = this.volumeScale;
                const compressor = this.context.createDynamicsCompressor();
                compressor.threshold.value = -8;
                compressor.knee.value = 12;
                compressor.ratio.value = 12;
                this.master.connect(compressor).connect(this.context.destination);
                const bytes = Uint8Array.from(atob(this.audioData), c => c.charCodeAt(0));
                this.loading = this.context.decodeAudioData(bytes.buffer).then(buffer => { if (!this.disposed)
                    this.buffer = buffer; }).catch(() => { if (!this.disposed)
                    this.onError("효과음 디코딩에 실패했습니다. 새로고침해 주세요."); });
            }
            if (this.context.state === 'suspended')
                void this.context.resume().catch(() => { });
        }
        catch { /* An audio failure must not interrupt the pudding interaction. */ }
    }
    play() {
        if (!this.enabled || this.disposed || !this.context)
            return;
        const time = performance.now(), generation = this.generation;
        const start = () => {
            if (!this.enabled || this.disposed || generation !== this.generation || document.hidden || !this.buffer || this.context?.state !== 'running' || performance.now() - time > 150)
                return;
            // Each hit has its own source; rapid hits do not restart/cut the previous hit.
            if (this.voices.size >= this.maxVoices)
                this.voices.values().next().value?.stop();
            const source = this.context.createBufferSource(), gain = this.context.createGain();
            source.buffer = this.buffer;
            source.playbackRate.value = 1;
            gain.gain.value = this.volume;
            source.connect(gain);
            gain.connect(this.master);
            this.voices.add(source);
            source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
            // Each tool skips only its own leading audio; start immediately on impact.
            source.start(0, this.offset);
            this.onPlay();
        };
        if (this.buffer)
            start();
        else
            void this.loading?.then(start);
    }
    setVolume(volume) {
        this.volumeScale = Math.max(0, Math.min(1, volume));
        if (this.context && this.master)
            this.master.gain.setTargetAtTime(this.volumeScale, this.context.currentTime, .012);
    }
    setEnabled(enabled) { this.enabled = enabled; if (!enabled)
        this.stop();
    else
        this.unlock(); }
    stop() { this.generation++; for (const source of this.voices) {
        try {
            source.stop();
        }
        catch { }
    } this.voices.clear(); }
    dispose() { this.disposed = true; this.stop(); if (this.context)
        void this.context.close().catch(() => { }); this.buffer = null; }
}
