export const MOTIONS = Object.freeze({
  walk: "걷기",
  eat: "먹기",
  fly: "날기",
});

const TAU = Math.PI * 2;
const smooth = (v) => v * v * (3 - 2 * v);

// Seconds of visible simulation time, independent of the display refresh rate.
// A flight is a complete takeoff / circuit / landing, followed by a short rest.
export const FLIGHT_DURATION = 7.6;
export function sampleMotion(mode, seconds, seed = 0) {
  if (!Object.hasOwn(MOTIONS, mode)) throw new Error(`Unknown motion: ${mode}`);
  const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const result = {
    x: 0, z: 0, height: 0, yaw: 0, bodyPitch: 0,
    neckAngle: 0, neckBob: 0, leftStep: 0, rightStep: 0,
    leftLift: 0, rightLift: 0, wingOpen: 0, wingFlap: 0,
    legTuck: 0, phase: "휴식", peck: 0,
  };
  if (mode === "walk") {
    const travel = t * 0.33;
    const stride = t * 8.8;
    result.x = 0.92 * (1 - Math.cos(travel));
    result.z = 0.72 * Math.sin(travel);
    result.yaw = Math.atan2(0.92 * Math.sin(travel), 0.72 * Math.cos(travel));
    result.height = Math.abs(Math.sin(stride)) * 0.027;
    result.neckBob = Math.sin(stride * 2 - 0.4) * 0.037;
    result.leftStep = Math.sin(stride) * 0.18;
    result.rightStep = -result.leftStep;
    result.leftLift = Math.max(0, Math.cos(stride)) * 0.11;
    result.rightLift = Math.max(0, -Math.cos(stride)) * 0.11;
    result.bodyPitch = Math.sin(stride * 2) * 0.025;
    result.phase = "뒤뚱뒤뚱 걷는 중";
  } else if (mode === "eat") {
    const cycle = ((t + seed * 0.17) % 2.6) / 2.6;
    // A deliberate look, a quick dip, three little pecks, then a slower rise.
    let dip = 0;
    if (cycle > 0.16 && cycle < 0.32) dip = smooth((cycle - 0.16) / 0.16);
    else if (cycle >= 0.32 && cycle < 0.72) dip = 1;
    else if (cycle >= 0.72 && cycle < 0.94) dip = 1 - smooth((cycle - 0.72) / 0.22);
    const peck = cycle >= 0.32 && cycle < 0.72
      ? Math.max(0, Math.sin((cycle - 0.32) / 0.4 * TAU * 3)) : 0;
    result.neckAngle = dip * (1.28 + peck * 0.15);
    result.neckBob = -dip * 0.19 - peck * 0.025;
    result.bodyPitch = dip * 0.1;
    result.peck = peck;
    result.phase = dip > 0.8 ? "콕콕, 모이 먹는 중" : "주변을 살피는 중";
  } else {
    const p = (t % FLIGHT_DURATION) / FLIGHT_DURATION;
    const airborne = p < 0.88 ? Math.sin(p / 0.88 * Math.PI) : 0;
    const envelope = Math.pow(Math.max(0, airborne), 0.8);
    const circuit = Math.min(p / 0.88, 1) * TAU;
    result.height = envelope * 2.65;
    result.x = (1 - Math.cos(circuit)) * 1.15;
    result.z = Math.sin(circuit) * 0.6;
    result.yaw = Math.atan2(1.15 * Math.sin(circuit), 0.6 * Math.cos(circuit));
    result.bodyPitch = envelope * 0.25;
    result.neckAngle = -envelope * 0.2;
    result.wingOpen = Math.min(1, envelope * 5);
    result.wingFlap = Math.sin(t * 19) * 0.55 * result.wingOpen;
    result.legTuck = Math.min(1, envelope * 3);
    result.phase = p < 0.15 ? "날개 펴고 이륙" : p < 0.66 ? "가볍게 비행 중"
      : p < 0.88 ? "발을 내리고 착륙" : "착륙 후 휴식";
  }
  return result;
}

export function advanceClock(time, delta, paused = false) {
  return time + (paused || !Number.isFinite(delta) ? 0 : Math.max(0, Math.min(delta, 0.05)));
}
