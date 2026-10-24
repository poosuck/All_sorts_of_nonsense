// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.
const N = 28, STEP = 1 / 240;
export const WHIP_ANGLE = -Math.PI / 3, WHIP_GRIP = 44;
export function lateralDrag(vx, vy, tx, ty, dt) {
    const normalSpeed = -ty * vx + tx * vy;
    const retained = Math.exp(-(3.5 + .004 * Math.abs(normalSpeed)) * dt);
    const removed = normalSpeed * (1 - retained);
    return { vx: vx + ty * removed, vy: vy - tx * removed };
}
export class WhipRope {
    points = [];
    previous = [];
    hand = { x: 0, y: 0 };
    target = { x: 0, y: 0 };
    length = 300;
    stiffness = .8;
    anchor() { return { x: this.hand.x + Math.cos(WHIP_ANGLE) * WHIP_GRIP / 2, y: this.hand.y + Math.sin(WHIP_ANGLE) * WHIP_GRIP / 2 }; }
    reset(x, y, height) {
        this.hand = { x, y };
        this.target = { x, y };
        this.length = Math.min(300, height * .78);
        const a = this.anchor(), seg = this.length / N;
        this.points = Array.from({ length: N + 1 }, (_, i) => ({ x: a.x, y: a.y + i * seg, vx: 0, vy: 0, ox: a.x, oy: a.y + i * seg, w: i === 0 ? 0 : 1 + 3 * (i / N) ** 2 }));
        this.previous = this.points.map(p => ({ x: p.x, y: p.y }));
    }
    advance(dt) {
        if (!this.points.length || dt <= 0)
            return;
        this.previous = this.points.map(p => ({ x: p.x, y: p.y }));
        dt = Math.min(dt, .05);
        const from = { ...this.hand }, destination = { ...this.target }, steps = Math.ceil(dt / STEP);
        for (let k = 0; k < steps; k++) {
            this.target = { x: from.x + (destination.x - from.x) * (k + 1) / steps, y: from.y + (destination.y - from.y) * (k + 1) / steps };
            this.simulate(dt / steps);
        }
        this.target = destination;
    }
    simulate(dt) {
        this.hand = { ...this.target };
        const a = this.anchor(), seg = this.length / N;
        const damping = Math.exp(-.85 * dt), stiffness = this.stiffness;
        const root = this.points[0];
        root.vx = (a.x - root.x) / dt;
        root.vy = (a.y - root.y) / dt;
        const changes = this.points.map(() => ({ x: 0, y: 0 }));
        for (let i = 0; i < N - 1; i++) {
            const nodes = [this.points[i], this.points[i + 1], this.points[i + 2]];
            const ux = nodes[1].x - nodes[0].x, uy = nodes[1].y - nodes[0].y;
            const vx = nodes[2].x - nodes[1].x, vy = nodes[2].y - nodes[1].y;
            const u2 = Math.max(1e-8, ux * ux + uy * uy), v2 = Math.max(1e-8, vx * vx + vy * vy);
            const g0 = { x: -uy / u2, y: ux / u2 }, g2 = { x: -vy / v2, y: vx / v2 };
            const gradients = [g0, { x: -g0.x - g2.x, y: -g0.y - g2.y }, g2];
            let rate = 0, weight = 0;
            nodes.forEach((p, j) => { const g = gradients[j]; rate += g.x * p.vx + g.y * p.vy; weight += p.w * (g.x * g.x + g.y * g.y); });
            if (weight > 1e-8) {
                const impulse = -rate * (1 - Math.exp(-7 * dt)) / weight;
                nodes.forEach((p, j) => { changes[i + j].x += p.w * gradients[j].x * impulse; changes[i + j].y += p.w * gradients[j].y * impulse; });
            }
        }
        for (let i = 1; i <= N; i++) {
            this.points[i].vx += changes[i].x;
            this.points[i].vy += changes[i].y;
        }
        // Snapshot tangents before integration so drag does not depend on update order.
        const tangents = this.points.map((p, i) => {
            const before = this.points[Math.max(0, i - 1)], after = this.points[Math.min(N, i + 1)];
            let dx = after.x - before.x, dy = after.y - before.y;
            if (Math.hypot(dx, dy) < 1e-8) {
                dx = p.x - before.x;
                dy = p.y - before.y;
            }
            const len = Math.hypot(dx, dy) || 1;
            return { x: dx / len, y: dy / len };
        });
        for (let i = 1; i <= N; i++) {
            const p = this.points[i];
            p.ox = p.x;
            p.oy = p.y;
            const v = lateralDrag(p.vx, p.vy, tangents[i].x, tangents[i].y, dt);
            p.vx = v.vx * damping;
            p.vy = v.vy * damping + 800 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        this.points[0].x = a.x;
        this.points[0].y = a.y;
        const stretchLambda = new Float64Array(N), bendLambda = new Float64Array(N - 1);
        const constrain = (i, j, rest, alpha, lambdas, index) => {
            const p = this.points[i], q = this.points[j], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
            if (d < 1e-8)
                return;
            const dl = (-(d - rest) - alpha * lambdas[index]) / (p.w + q.w + alpha);
            lambdas[index] += dl;
            p.x -= p.w * dl * dx / d;
            p.y -= p.w * dl * dy / d;
            q.x += q.w * dl * dx / d;
            q.y += q.w * dl * dy / d;
        };
        // Bend resistance uses only neighbouring nodes, with no world-space target shape.
        const bendCompliance = .000015 / Math.pow(1 + stiffness * 5, 2);
        for (let pass = 0; pass < 32; pass++) {
            for (let k = 0; k < N - 1; k++) {
                const i = pass % 2 ? k : N - 2 - k;
                constrain(i, i + 2, 2 * seg, bendCompliance * (1 + 2 * i / N) / (dt * dt), bendLambda, i);
            }
            for (let k = 0; k < N; k++) {
                const i = pass % 2 ? k : N - 1 - k;
                constrain(i, i + 1, seg, 1e-9 / (dt * dt), stretchLambda, i);
            }
        }
        for (let i = 1; i <= N; i++) {
            const p = this.points[i];
            p.vx = (p.x - p.ox) / dt;
            p.vy = (p.y - p.oy) / dt;
        }
    }
}
// Pixel-speed threshold is a visual effect threshold, not a physical Mach measurement.
export class SonicBoomGate {
    armed = true;
    last = -Infinity;
    reset() { this.armed = true; this.last = -Infinity; }
    update(now, speed) {
        if (speed < 650)
            this.armed = true;
        if (!this.armed || speed < 1800 || now - this.last < 650)
            return false;
        this.armed = false;
        this.last = now;
        return true;
    }
}
