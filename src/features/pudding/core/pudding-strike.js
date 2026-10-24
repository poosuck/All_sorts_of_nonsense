// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.
export class StrikeMotion {
    samples = [];
    start(p) { this.samples = [p]; }
    add(p) {
        // Retain the sample bracketing the 80 ms window, including stationary holds.
        this.samples.push(p);
        while (this.samples.length > 2 && this.samples[1].t < p.t - 80)
            this.samples.shift();
    }
    velocity(now) {
        const last = this.samples.at(-1), first = this.samples[0];
        if (!last || !first || last.t === first.t || now - last.t > 100)
            return { x: 0, y: 0, speed: 0 };
        const cutoff = Math.max(first.t, last.t - 80);
        const second = this.samples[1] ?? last;
        const alpha = first.t < cutoff ? Math.min(1, (cutoff - first.t) / (second.t - first.t)) : 0;
        const x0 = first.x + (second.x - first.x) * alpha, y0 = first.y + (second.y - first.y) * alpha;
        const dt = Math.max(8, last.t - cutoff) / 1000;
        const x = (last.x - x0) / dt, y = (last.y - y0) / dt;
        return { x, y, speed: Math.hypot(x, y) };
    }
}
export function strikeStrength(speed, incidence, softness) {
    return (6 + softness * .11) * Math.tanh(Math.max(0, speed) / 950) * Math.sqrt(Math.max(0, Math.min(1, incidence)));
}
// Sweep the whole screen-space movement, rather than checking just its endpoint.
export function sweepContact(from, to, hit) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / 3));
    for (let i = 1; i <= steps; i++) {
        const x = from.x + (to.x - from.x) * i / steps, y = from.y + (to.y - from.y) * i / steps;
        const contact = hit(x, y);
        if (contact)
            return { contact, x, y };
    }
    return undefined;
}
