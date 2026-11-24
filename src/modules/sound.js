// Tiny synthesised sound kit (WebAudio, no files). Muted by default.

let ctx = null;
let enabled = false;

const ensure = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

function noiseBurst(t0, dur, freq, q, gain) {
  const c = ctx;
  const len = Math.ceil(c.sampleRate * dur);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0);
}

export const sound = {
  get enabled() { return enabled; },
  toggle(on = !enabled) { enabled = on; if (on) ensure(); return enabled; },

  /** mirror-up / shutter / mirror-down */
  shutter() {
    if (!enabled) return;
    ensure();
    const t = ctx.currentTime + 0.01;
    noiseBurst(t, 0.045, 2400, 1.4, 0.9);
    noiseBurst(t + 0.006, 0.03, 5200, 2.5, 0.5);
    noiseBurst(t + 0.085, 0.06, 1600, 1.2, 0.7);
  },

  /** soft mechanical tick for the iris & frame counter */
  tick(vol = 0.18) {
    if (!enabled) return;
    ensure();
    noiseBurst(ctx.currentTime + 0.005, 0.02, 3800, 3, vol);
  },

  /** rising whine while the shutter button is held (flash charging) */
  charge(duration = 0.9) {
    if (!enabled) return () => {};
    ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(900, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(5200, ctx.currentTime + duration);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.025, ctx.currentTime + 0.1);
    o.connect(g).connect(ctx.destination);
    o.start();
    return () => {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
      o.stop(ctx.currentTime + 0.2);
    };
  },
};
