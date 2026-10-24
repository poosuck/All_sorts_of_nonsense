// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.
import { WHIP_ANGLE as angle, WHIP_GRIP as GRIP } from './whip-rope.js';
export class WhipOverlay {
    canvas = document.createElement('canvas');
    ctx;
    trail = [];
    rings = [];
    constructor() {
        this.canvas.setAttribute('aria-hidden', 'true');
        Object.assign(this.canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '80', display: 'none' });
        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);
    }
    show() { this.canvas.style.display = 'block'; this.resize(); }
    hide() { this.canvas.style.display = 'none'; this.trail = []; this.rings = []; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr); if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
    } this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    boom(x, y, now) { this.rings.push({ x, y, t: now }); }
    draw(rope, now) {
        this.resize();
        const ctx = this.ctx, points = rope.points, hand = rope.hand, N = points.length - 1;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (N < 1)
            return;
        const tip = points[N];
        this.trail.push({ x: tip.x, y: tip.y, t: now });
        this.trail = this.trail.filter(p => now - p.t < 220);
        for (let i = 1; i < this.trail.length; i++) {
            ctx.strokeStyle = `rgba(185,123,60,${i / this.trail.length * .25})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.stroke();
        }
        const stroke = (offset, color, width) => { ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for (let i = 0; i < N; i++) {
            const p = points[i], q = points[i + 1];
            ctx.lineWidth = width * (1 - i / (N + 3)) + .65;
            ctx.beginPath();
            ctx.moveTo(p.x + offset, p.y + offset);
            ctx.lineTo(q.x + offset, q.y + offset);
            ctx.stroke();
        } };
        stroke(4, '#62402618', 6);
        stroke(0, '#603b27', 6);
        stroke(-.7, '#bb8c59', 2.5);
        ctx.save();
        ctx.translate(hand.x, hand.y);
        ctx.rotate(angle);
        ctx.shadowColor = '#5a351b30';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        const g = ctx.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#c09561');
        g.addColorStop(.45, '#7e4d2a');
        g.addColorStop(1, '#462a1b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(-GRIP / 2, -6, GRIP, 12, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#d6ad745f';
        ctx.lineWidth = 1;
        for (let x = -17; x < 19; x += 5) {
            ctx.beginPath();
            ctx.moveTo(x, -5);
            ctx.lineTo(x + 3, 5);
            ctx.stroke();
        }
        ctx.fillStyle = '#cbb18d';
        ctx.fillRect(18, -6, 4, 12);
        ctx.fillRect(-22, -6, 3, 12);
        ctx.restore();
        // Small grip marker makes the actual cursor position unambiguous.
        ctx.strokeStyle = '#fff9e6aa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hand.x, hand.y, 2, 0, Math.PI * 2);
        ctx.stroke();
        this.rings = this.rings.filter(r => now - r.t < 240);
        for (const r of this.rings) {
            const t = (now - r.t) / 240;
            ctx.strokeStyle = `rgba(165,108,54,${(1 - t) * .75})`;
            ctx.lineWidth = 2 * (1 - t) + .5;
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, 8 + t * 46, 4 + t * 25, -Math.PI / 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    dispose() { this.canvas.remove(); }
}
