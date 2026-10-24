// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.
export const zero = () => ({ x: 0, z: 0, squash: 0, dent: 0 });
export const keys = ["x", "z", "squash", "dent"];
export class PuddingPhysics {
    q = zero();
    v = zero();
    target = zero();
    softness = 60;
    speed = 50;
    impactTime = 0;
    strike(direction, strength) {
        const clamp = (n, limit) => Math.max(-limit, Math.min(limit, n));
        this.release();
        this.impactTime = 1.1;
        // Immediate contact deformation followed by a stronger elastic impulse.
        this.q.x += direction.x * strength * .022;
        this.q.z += direction.z * strength * .022;
        this.q.dent = Math.min(.38, this.q.dent + strength * .018);
        this.q.squash = Math.max(-.42, this.q.squash - strength * .006);
        this.v.x = clamp(this.v.x + direction.x * strength * 1.15, 17);
        this.v.z = clamp(this.v.z + direction.z * strength * 1.15, 17);
        this.v.squash = clamp(this.v.squash + direction.y * strength * .5 - strength * .14, 4);
        this.v.dent = Math.min(4.2, this.v.dent + strength * .48);
        this.limit();
    }
    limit() {
        const lean = Math.hypot(this.q.x, this.q.z);
        if (lean > 2.8) {
            this.q.x *= 2.8 / lean;
            this.q.z *= 2.8 / lean;
        }
        this.q.dent = Math.max(-.25, Math.min(.6, this.q.dent));
        this.q.squash = Math.max(-.65, Math.min(1.05, this.q.squash));
    }
    step(dt, held) {
        this.impactTime = Math.max(0, this.impactTime - dt);
        const frequency = held ? 15 : 6 + this.speed * .07;
        const damping = held ? .82 : (this.impactTime > 0 ? .13 : .24) + this.speed * .0012;
        const steps = Math.max(1, Math.ceil(dt / (1 / 180)));
        const h = Math.min(dt, .04) / steps;
        for (let i = 0; i < steps; i++)
            for (const k of keys) {
                this.v[k] += ((this.target[k] - this.q[k]) * frequency * frequency - 2 * damping * frequency * this.v[k]) * h;
                this.q[k] += this.v[k] * h;
            }
        this.limit();
        return keys.reduce((sum, k) => sum + Math.abs(this.q[k]) + Math.abs(this.v[k]) * .1, 0);
    }
    release() { this.target = zero(); }
    reset() { this.impactTime = 0; this.q = zero(); this.v = zero(); this.target = zero(); }
}
export function deformPoint(x, y, z, q, anchor, normal) {
    const t = Math.max(0, Math.min(1, y / 2.03));
    const influence = Math.pow(t, 1.5);
    const wide = 1 / Math.sqrt(1 + q.squash * .9);
    const scale = 1 + (wide - 1) * Math.sin(Math.min(1, t * 1.5) * Math.PI / 2);
    const d2 = (x - anchor.x) ** 2 + (y - anchor.y) ** 2 + (z - anchor.z) ** 2;
    const local = Math.exp(-d2 / .68) * t;
    return [
        x * scale + q.x * (influence * .78 + local * .22) - normal.x * q.dent * local,
        Math.max(.022, y * (1 + q.squash) - normal.y * q.dent * local - (x * q.x + z * q.z) * .09 * influence),
        z * scale + q.z * (influence * .78 + local * .22) - normal.z * q.dent * local,
    ];
}
