export const PROTOCOL = 'acu-companion/v1';
const KINDS = new Set(['info', 'success', 'warning', 'error']);
const text = value => typeof value === 'string' ? value.slice(0, 600) : '';

export const TAP = { tickleCount: 3, tickleWindow: 1200, angryCount: 6, angryWindow: 2600 };
export const REACTION_MS = {
  shy: 1600, tickle: 1600, angry: 2200, happy: 1100, dizzy: 2400, surprised: 1300, wave: 1600,
  huff: 1000, pound: 1300, knockdown: 2200, received: 1400, complete: 3500, error: 5000,
};
export const RAGE_SEQUENCE = ['angry', 'huff', 'pound', 'knockdown'];

export function normalizeSnapshot(value) {
  if (!value || value.protocol !== PROTOCOL || !Array.isArray(value.tasks) || !Array.isArray(value.notices)) return null;
  return {
    protocol: PROTOCOL, connected: value.connected === true, busy: value.busy === true,
    silent: value.silent === true, activityKnown: value.activityKnown !== false, version: Number(value.version) || 0,
    activeTaskId: value.activeTaskId === undefined ? text(value.tasks.find(task => task.busy)?.id) : text(value.activeTaskId),
    tasks: value.tasks.slice(0, 100).map(item => ({ id: text(item.id), feature: text(item.feature),
      detail: text(item.detail), kind: KINDS.has(item.kind) ? item.kind : 'info', busy: item.busy === true,
      dismissible: item.dismissible === true,
      action: item.action && typeof item.action.run === 'function' ? {
        label: text(item.action.label || '停止'),
        variant: item.action.variant === 'danger' ? 'danger' : 'default',
        run: item.action.run,
      } : null })),
    notices: value.notices.slice(0, 20).map(item => ({ id: text(item.id), title: text(item.title),
      text: text(item.text), kind: KINDS.has(item.kind) ? item.kind : 'info', createdAt: Number(item.createdAt) || 0 })),
    bubble: value.bubble && typeof value.bubble === 'object' ? value.bubble : null,
    petPresent: value.petPresent === true,
    source: text(value.source),
  };
}

// Pose priority: drag > reaction > scripted action > database work > sleep > idle fidget > idle.
export class CompanionModel {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.snapshot = { connected: false, busy: false, silent: false, tasks: [], notices: [], bubble: null };
    this.seen = new Set();
    this.history = [];
    this.reaction = null;
    this.sequence = null;
    this.tapTimes = [];
    this.petting = false;
    this.snoozing = false;
    this.snoozePose = 'snore';
    this.lastInteraction = '';
    this.moods = true;
  }
  ingest(raw) {
    const next = normalizeSnapshot(raw);
    if (!next) return false;
    const previous = this.snapshot;
    this.snapshot = next;
    if (!next.connected) {
      if (this.reaction?.source === 'database') this.reaction = null;
      return true;
    }
    const added = next.tasks.filter(task => task.busy && !previous.tasks.some(old => old.id === task.id));
    if (next.busy) { this.snoozing = false; if (this.sequence?.kind === 'idle') this.sequence = null; }
    if (this.moods && (added.length || (next.busy && !previous.busy)) && !this.localBusy())
      this.reaction = { pose: 'received', until: this.now() + REACTION_MS.received, source: 'database' };
    for (const notice of next.notices) {
      if (!notice.id || this.seen.has(notice.id)) continue;
      this.seen.add(notice.id);
      this.history.unshift(notice);
      this.history = this.history.slice(0, 20);
      if (!this.moods || this.localBusy()) continue;
      if (notice.kind === 'error' || notice.kind === 'warning') this.react('error', 'database');
      else if (notice.kind === 'success') this.react('complete', 'database');
    }
    while (this.seen.size > 200) this.seen.delete(this.seen.values().next().value);
    return true;
  }
  localBusy() {
    return this.petting || this.sequence?.kind === 'rage' || this.sequence?.kind === 'action';
  }
  activeStep() {
    if (!this.sequence) return null;
    const step = this.sequence.steps.find(item => item.until > this.now());
    if (!step) { this.sequence = null; return null; }
    return step;
  }
  pose() {
    if (this.reaction && (this.reaction.hold || this.reaction.until > this.now())) return this.reaction.pose;
    this.reaction = null;
    const step = this.activeStep();
    if (step && this.sequence.kind !== 'idle') return step.pose;
    if (this.snapshot.busy) return 'working';
    if (this.snoozing) return this.snoozePose;
    return step ? step.pose : 'idle';
  }
  quiet() {
    return this.pose() === 'idle' && !this.snapshot.busy;
  }
  nextChange() {
    const times = [];
    if (this.reaction && !this.reaction.hold) times.push(this.reaction.until);
    const step = this.activeStep();
    if (step) times.push(step.until);
    const future = times.filter(time => time > this.now());
    return future.length ? Math.min(...future) : null;
  }
  react(pose, source = 'local', ms = REACTION_MS[pose] || 1500, hold = false) {
    this.reaction = { pose, until: this.now() + ms, source, hold };
    if (this.sequence?.kind === 'idle') this.sequence = null;
    return pose;
  }
  play(steps, kind = 'idle') {
    let at = this.now();
    this.sequence = { kind, steps: steps.map(([pose, ms]) => ({ pose, until: (at += ms) })) };
    if (kind !== 'idle' && this.reaction?.source === 'local') this.reaction = null;
    return true;
  }
  stopIdle() {
    if (this.sequence?.kind === 'idle') this.sequence = null;
  }
  inRage() {
    return Boolean(this.activeStep() && this.sequence?.kind === 'rage');
  }
  wake() {
    const was = this.snoozing;
    this.snoozing = false;
    return was;
  }
  sleep() {
    if (this.snapshot.busy || this.reaction || this.localBusy()) return false;
    this.stopIdle();
    this.snoozePose = Math.random() < 0.5 ? 'snore' : 'sit-snore';
    this.snoozing = true;
    return true;
  }
  // One tap is shy, three quick taps tickle, six within 2.6s start the rage combo.
  tap() {
    if (this.wake()) { this.tapTimes = []; this.react('surprised'); return this.lastInteraction = 'surprised'; }
    if (this.inRage() || this.sequence?.kind === 'action') return '';
    const now = this.now();
    this.tapTimes = [...this.tapTimes.filter(time => now - time < TAP.angryWindow), now];
    const recent = this.tapTimes.filter(time => now - time < TAP.tickleWindow).length;
    if (this.tapTimes.length >= TAP.angryCount) {
      this.tapTimes = [];
      this.reaction = null;
      this.play(RAGE_SEQUENCE.map(pose => [pose, REACTION_MS[pose]]), 'rage');
      return this.lastInteraction = 'rage';
    }
    if (recent >= TAP.tickleCount) { this.react('tickle'); return this.lastInteraction = 'tickle'; }
    this.react('shy');
    return this.lastInteraction = 'shy';
  }
  startPet() {
    this.tapTimes = [];
    if (this.inRage()) return false;
    this.wake();
    this.petting = true;
    this.react('happy', 'local', 0, true);
    this.lastInteraction = 'pet';
    return true;
  }
  endPet(linger = 900) {
    if (!this.petting) return;
    this.petting = false;
    if (this.reaction?.pose === 'happy') this.reaction = { ...this.reaction, hold: false, until: this.now() + linger };
  }
  dizzy() { this.wake(); this.react('dizzy'); return this.lastInteraction = 'dizzy'; }
  wave() {
    if (this.reaction || this.localBusy() || this.snapshot.busy || this.snoozing) return false;
    this.react('wave');
    this.lastInteraction = 'wave';
    return true;
  }
  interruptLocal() {
    this.tapTimes = [];
    this.petting = false;
    if (this.sequence && this.sequence.kind !== 'rage') this.sequence = null;
    if (this.reaction?.source === 'local') this.reaction = null;
  }
}
