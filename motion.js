const ease = 'cubic-bezier(.37,0,.63,1)';
const rise = 'cubic-bezier(.22,.61,.36,1)';
const fall = 'cubic-bezier(.55,.06,.82,.48)';
const settle = 'cubic-bezier(.2,.8,.2,1)';
const f = (offset, x = 0, y = 0, angle = 0, sx = 1, sy = 1, easing = ease) => ({
  offset, transform: `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${sx}, ${sy})`, easing,
});
const n = offset => f(offset);

// Whole-body motion per pose. Small inner parts (arms, blades, Zzz) animate in CSS.
const tracks = {
  idle: { duration: 2800, frames: [n(0), f(.35, 0, 0, 0, 1.03, .96), f(.7, 0, -2, 0, .985, 1.025), n(1)] },
  blink: { duration: 2800, frames: [n(0), f(.5, 0, 0, 0, 1.02, .98), n(1)] },
  'look-left': { duration: 1300, iterations: 1, frames: [n(0), f(.4, -3, 0, -3), f(1, -3, 0, -3)] },
  'look-right': { duration: 1300, iterations: 1, frames: [n(0), f(.4, 3, 0, 3), f(1, 3, 0, 3)] },
  'walk-a': { duration: 230, iterations: 1, frames: [f(0, 0, 0, 3), f(.5, 0, -3, -1), f(1, 0, 0, -3)] },
  'walk-b': { duration: 230, iterations: 1, frames: [f(0, 0, 0, -3), f(.5, 0, -3, 1), f(1, 0, 0, 3)] },
  roll: { duration: 680, origin: '50% 55%', frames: [f(0, 0, 0, 0, 1, 1, 'linear'), f(1, 0, 0, 360, 1, 1, 'linear')] },
  'eat-a': { duration: 900, frames: [n(0), f(.5, 0, -1, -2, 1.01, .99), n(1)] },
  'eat-b': { duration: 320, frames: [n(0), f(.5, 0, 0, 0, 1.04, .96), n(1)] },
  yawn: { duration: 1500, iterations: 1, frames: [n(0), f(.45, 0, -3, 0, .96, 1.08, rise), f(.8, 0, 0, 0, 1.02, .98, settle), n(1)] },
  snore: { duration: 3200, frames: [n(0), f(.5, 0, 1, 2, 1.04, .95), n(1)] },
  'sit-snore': { duration: 3600, frames: [f(0, 0, 4, 8, 1.02, .94), f(.5, 0, 5, 10, 1.05, .92), f(1, 0, 4, 8, 1.02, .94)] },
  working: { duration: 1400, frames: [f(0, 0, 0, -4), f(.5, 0, -3, 4), f(1, 0, 0, -4)] },
  struggle: { duration: 420, origin: '50% 10%', frames: [f(0, 0, -8, -10), f(.25, 0, -6, 6), f(.5, 0, -9, -6), f(.75, 0, -6, 10), f(1, 0, -8, -10)] },
  shy: { duration: 700, iterations: 1, frames: [n(0), f(.25, 0, 2, 0, 1.08, .88), f(.55, 0, -5, 0, .95, 1.06), f(.8, 0, 0, 0, 1.02, .98), n(1)] },
  tickle: { duration: 180, frames: [f(0, -2, 0, -6), f(.5, 2, 0, 6), f(1, -2, 0, -6)] },
  angry: { duration: 220, frames: [f(0, -2), f(.5, 2, 0, 0, 1.02, .98), f(1, -2)] },
  happy: { duration: 1100, frames: [f(0, 0, 0, -4), f(.5, 0, -3, 4), f(1, 0, 0, -4)] },
  dizzy: { duration: 1200, frames: [f(0, -2, 0, -8), f(.5, 2, 0, 8), f(1, -2, 0, -8)] },
  surprised: { duration: 600, iterations: 1, frames: [n(0), f(.3, 0, -14, 0, .94, 1.08, rise), f(.7, 0, 0, 0, 1.06, .94, fall), n(1)] },
  wave: { duration: 800, iterations: 2, frames: [n(0), f(.25, 0, 0, -5), f(.75, 0, 0, 5), n(1)] },
  huff: { duration: 500, frames: [n(0), f(.4, 0, 1, 0, 1.06, .95), f(.7, 1, 0, 0, .97, 1.04), n(1)] },
  pound: { duration: 430, iterations: 3, origin: '50% 60%', frames: [n(0), f(.45, 0, -4, 0, 1.2, 1.2), f(.6, 0, -2, -2, 1.14, 1.14), n(1)] },
  knockdown: { duration: 700, iterations: 1, frames: [f(0, 0, -18, -20, 1.03, 1.03), f(.6, 0, 2, -8, 1.05, .96), f(1, 0, 4, -12, 1, .97)] },
  received: { duration: 1080, iterations: 1, frames: [n(0), f(.18, 0, 1, -1, 1.03, .96, rise), f(.44, 0, -8, -2, .98, 1.04), f(.7, 0, -1, 1), n(1)] },
  complete: { duration: 1250, iterations: 2, frames: [n(0), f(.16, 0, 2, -1, 1.04, .95, rise), f(.4, 0, -12, -3, .97, 1.05, fall), f(.64, 0, 1, 2, 1.03, .97, settle), n(1)] },
  error: { duration: 1800, iterations: 1, frames: [n(0), f(.25, -1, 1, -4), f(.55, 1, 1, 3), f(.78, 0, 0, -1), n(1)] },
  copter: { duration: 1600, frames: [f(0, 0, -10, -3), f(.5, 0, -16, 3), f(1, 0, -10, -3)] },
  'pocket-a': { duration: 500, frames: [n(0), f(.5, 0, 1, 2, 1.02, .98), n(1)] },
  'pocket-b': { duration: 1100, iterations: 1, frames: [n(0), f(.3, 0, -10, 0, .97, 1.05, rise), f(.7, 0, 0, 0, 1.03, .97, settle), n(1)] },
  door: { duration: 1400, frames: [n(0), f(.5, 0, -2, 2), n(1)] },
  scared: { duration: 260, frames: [f(0, -3, -6, -4), f(.5, 3, -10, 4), f(1, -3, -6, -4)] },
  feed: { duration: 900, frames: [n(0), f(.5, 0, -3, 0, 1.03, .97), n(1)] },
  land: { duration: 620, bridge: 80, iterations: 1, frames: [f(0, 0, -8, 0, 1, 1.02, fall), f(.3, 0, 2, 0, 1.08, .9, rise), f(.6, 0, -3, 0, .98, 1.03, fall), n(1)] },
  'edge-left': { duration: 3400, bridge: 200, frames: [n(0), f(.5, -4, 0), n(1)] },
  'edge-right': { duration: 3400, bridge: 200, frames: [n(0), f(.5, 4, 0), n(1)] },
  'edge-top': { duration: 3400, bridge: 200, frames: [n(0), f(.5, 0, -4), n(1)] },
  'edge-bottom': { duration: 3400, bridge: 200, frames: [n(0), f(.5, 0, 4), n(1)] },
};

// Browser frames are independent of the 250ms database sampling. Only a pose
// change reads the rendered transform; dragging still has no layout reads.
export function createMotion(stage, host) {
  const reduced = host.matchMedia?.('(prefers-reduced-motion: reduce)');
  let animation = null;
  let current = '';
  let stopped = false;
  let revision = 0;
  function play(pose, { restart = false } = {}) {
    if (stopped || (pose === current && !restart)) return;
    const rendered = host.getComputedStyle(stage);
    const start = { transform: rendered.transform === 'none' ? 'translate(0px, 0px)' : rendered.transform, transformOrigin: rendered.transformOrigin };
    const ticket = ++revision;
    current = pose;
    animation?.cancel();
    animation = null;
    if (reduced?.matches || typeof stage.animate !== 'function') return;
    const track = tracks[pose] || tracks.idle;
    const origin = track.origin || '50% 88%';
    const frames = track.frames.map(frame => ({ ...frame, transformOrigin: origin }));
    // Move both the pose and its pivot from what is currently on screen, so poses never jump.
    const bridge = stage.animate([start, { transform: frames[0].transform, transformOrigin: origin }],
      { duration: track.bridge || 120, easing: settle, fill: 'forwards' });
    animation = bridge;
    bridge.onfinish = () => {
      if (stopped || ticket !== revision || reduced?.matches) return;
      bridge.cancel();
      animation = stage.animate(frames, {
        duration: track.duration, iterations: track.iterations || Infinity, fill: 'forwards',
      });
    };
  }
  function preferenceChanged() {
    const pose = current;
    current = '';
    play(pose);
  }
  reduced?.addEventListener?.('change', preferenceChanged);
  return { play, destroy() {
    stopped = true; revision++; animation?.cancel();
    reduced?.removeEventListener?.('change', preferenceChanged);
  } };
}
