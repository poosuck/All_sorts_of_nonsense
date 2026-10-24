// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.
// Whooshes follow hand movement, not residual rope motion.
export class WhipSwingGate {
    lastSound = -Infinity;
    lastUpdate = null;
    distance = 0;
    reset() { this.lastUpdate = null; this.distance = 0; }
    update(now, vx, vy) {
        const speed = Math.hypot(vx, vy), dt = this.lastUpdate === null ? 0 : Math.min(50, Math.max(0, now - this.lastUpdate)) / 1000;
        this.lastUpdate = now;
        if (speed < 300)
            this.distance = 0;
        else
            this.distance += speed * dt;
        if (speed < 1100 || this.distance < 90 || now - this.lastSound < 400)
            return false;
        this.lastSound = now;
        this.distance = 0;
        return true;
    }
}
