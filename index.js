import { CompanionModel } from './model.js';
import { createDatabaseObserver } from './database-observer.js';
import {
  readBounds, fromRatio, toRatio, constrain, constrainDrag, nearestEdge, snapDistance,
  dockedPoint, tuckedPoint, visibleRect, normalizeEdge, removeProbe,
} from './position.js';
import { createMotion } from './motion.js';
import { StoryCarousel, pickLine } from './stories.js';
import { renderPose, renderPeek, GADGETS } from './doraemon.js';

const ID = 'doraemon-database-pet';
const VERSION = '1.1.0';
const PEEK_RATIO = 0.6;
const TUCK_DELAY_MS = 4000;
const PEEK_ROTATE_MS = 30000;
const IDLE_MIN_MS = 15000;
const IDLE_SPREAD_MS = 5000;
const SLEEP_MS = 60000;
const NIGHT_SLEEP_MS = 25000;
const WAVE_COOLDOWN_MS = 30000;
const DIZZY_REVERSALS = 4;
const DIZZY_SWING_PX = 14;
const LONG_PRESS_MS = 550;
const MOBILE_BOOK_MS = 1400;
const LINE_MS = 2400;

const defaults = {
  enabled: true, hideOriginal: true, mirrorBubble: true, idleActions: true, stroll: true, copterFlight: false,
  edgePeeks: true, sleepy: true, nightOwl: true, hoverWave: true, taskMoods: true,
  chatter: true, pocketIdle: true, mouseEgg: true, healingStories: false,
  size: 88, side: 'right', position: null, dorayaki: { date: '', count: 0, total: 0 },
};
const TOGGLES = [
  ['enabled', '显示哆啦A梦'],
  ['hideOriginal', '隐藏数据库原桌宠'],
  ['mirrorBubble', '用哆啦A梦的气泡显示数据库消息（含冷笑话和停止按钮）'],
  ['idleActions', '空闲时做小动作'],
  ['stroll', '散步和打滚（会左右挪一点）'],
  ['copterFlight', '空闲时戴竹蜻蜓在屏幕上飞'],
  ['edgePeeks', '拖到屏幕边缘后躲起来探头'],
  ['sleepy', '久不理会会睡着'],
  ['nightOwl', '深夜（23点后）更容易犯困'],
  ['hoverWave', '鼠标靠近时打招呼'],
  ['taskMoods', '数据库任务开始/完成/出错时做表情'],
  ['chatter', '互动时说话'],
  ['pocketIdle', '空闲时偶尔掏四次元口袋'],
  ['mouseEgg', '老鼠彩蛋（偶尔被老鼠吓到）'],
  ['healingStories', '空闲时讲小故事'],
];
const LABELS = {
  idle: '发呆中', blink: '眨眼', 'look-left': '东张西望', 'look-right': '东张西望', 'walk-a': '散步中', 'walk-b': '散步中',
  roll: '打滚中', 'eat-a': '偷吃铜锣烧', 'eat-b': '偷吃铜锣烧', yawn: '打哈欠', snore: '打呼噜', 'sit-snore': '坐着打瞌睡',
  working: '帮数据库干活', struggle: '被拎起来了', shy: '害羞', tickle: '怕痒', angry: '生气了', happy: '被摸得很舒服',
  dizzy: '被晃晕了', surprised: '吓一跳', wave: '打招呼', huff: '气鼓鼓', pound: '锤屏幕', knockdown: '把自己震倒了',
  received: '收到新任务', complete: '任务完成啦', error: '任务好像出错了', copter: '竹蜻蜓飞行中', 'pocket-a': '翻口袋',
  'pocket-b': '掏出道具', door: '打开任意门', scared: '被老鼠吓到', feed: '吃铜锣烧', land: '落地', peek: '躲在边上偷看',
};

let active = null;
let bootTimer = null;
let stopped = true;

const el = (doc, tag, text, className) => {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const button = (doc, text, className) => {
  const node = el(doc, 'button', text, className);
  node.type = 'button';
  return node;
};
const today = () => new Date().toLocaleDateString('sv-SE');

export function createCompanion(host, context) {
  const doc = host.document;
  const store = context.extensionSettings;
  const saved = store[ID] || {};
  const settings = { ...defaults, ...saved, dorayaki: { ...defaults.dorayaki, ...(saved.dorayaki || {}) } };
  settings.size = Math.min(140, Math.max(56, Number(settings.size) || 88));
  settings.side = settings.side === 'left' ? 'left' : 'right';
  const model = new CompanionModel();
  const storyteller = new StoryCarousel();
  const subscriptions = [];
  const timers = new Set();
  let dataSource = null;
  let unsubscribe = null;
  let destroyed = false;
  let settingsMount = null;
  let settingsControls = null;
  let point = null;
  let bounds = null;
  let dragging = null;
  let dragFrame = null;
  let layoutFrame = null;
  let geometryDirty = true;
  let inputElement = null;
  let holdTimer = null;
  let mobileBookTimer = null;
  let longPressed = false;
  let suppressClick = false;
  let hovering = false;
  let tucked = false;
  let tuckTimer = null;
  let peekVariant = 'peek';
  let peekRotateTimer = null;
  let landingUntil = 0;
  let lastWaveAt = 0;
  let lastActive = Date.now();
  let lastBusy = false;
  let travel = null;
  let gadgetId = 'door';
  let line = null;
  let expanded = false;
  let expandedKey = '';
  let bubbleSignature = '';
  let lastRenderKey = '';
  let lastNotebookVersion = '';
  let wakeTimer = null;
  let stopFeedback = null;
  let taskStopBusy = false;
  let lastImeSignature = '';

  const root = el(doc, 'div', undefined, 'dora-pet');
  root.id = `${ID}-root`;
  root.dataset.version = VERSION;
  root.dataset.pose = 'idle';
  // TauriTavern's mobile classifier otherwise treats a fixed element at top:0 as an edge window and shifts it down.
  root.dataset.ttMobileSurface = 'free-window';
  root.style.transition = 'none';
  const overlay = el(doc, 'div', undefined, 'dora-ui');
  overlay.id = `${ID}-ui`;
  const portrait = button(doc, undefined, 'dora-pet__portrait');
  portrait.setAttribute('aria-label', '哆啦A梦：轻点、连点或长按互动；拖动移动；电脑右键或手机长按打开口袋笔记');
  portrait.setAttribute('aria-expanded', 'false');
  const frame = el(doc, 'span', undefined, 'dora-pet__frame');
  const sway = el(doc, 'span', undefined, 'dora-pet__sway');
  const stage = el(doc, 'span', undefined, 'dora-pet__stage');
  const sprite = el(doc, 'span', undefined, 'dora-pet__sprite');
  stage.append(sprite); sway.append(stage); frame.append(sway); portrait.append(frame);
  root.append(portrait);
  const motion = createMotion(stage, host);

  const message = el(doc, 'section', undefined, 'dora-ui__bubble');
  message.hidden = true;
  message.setAttribute('aria-live', 'polite');
  message.dataset.ttMobileSurface = 'free-window';

  const notebook = el(doc, 'section', undefined, 'dora-ui__notebook');
  notebook.id = `${ID}-notebook`;
  notebook.hidden = true;
  notebook.dataset.ttMobileSurface = 'free-window';
  notebook.setAttribute('aria-label', '哆啦A梦的口袋笔记');
  portrait.setAttribute('aria-controls', notebook.id);
  const header = el(doc, 'div', undefined, 'dora-ui__header');
  const close = button(doc, '×', 'dora-ui__close');
  close.setAttribute('aria-label', '收起口袋笔记');
  header.append(el(doc, 'strong', '哆啦A梦的口袋笔记'), close);
  const databaseOpen = button(doc, '打开数据库本体', 'dora-ui__primary');
  const connection = el(doc, 'p', '等待数据库数据接口', 'dora-ui__connection');
  const taskList = el(doc, 'div', undefined, 'dora-ui__tasks');
  const historyList = el(doc, 'div', undefined, 'dora-ui__history');
  const dorayakiText = el(doc, 'p', '', 'dora-ui__stat');
  const controls = el(doc, 'div', undefined, 'dora-ui__controls');
  const actionButtons = {};
  for (const [key, caption] of [['feed', '喂铜锣烧'], ['pocket', '掏口袋'], ['copter', '竹蜻蜓飞一圈'], ['door', '任意门'], ['wave', '打招呼'], ['story', '讲个小故事']]) {
    const node = button(doc, caption);
    node.dataset.action = key;
    controls.append(node);
    actionButtons[key] = node;
  }
  const help = el(doc, 'p', '轻点害羞 · 连点三下怕痒 · 连戳六下会生气 · 长按被摸 · 拖着甩会晕 · 拖到边上会躲起来 · 电脑右键 / 手机长按 1.4 秒开关笔记', 'dora-ui__help');
  notebook.append(header, databaseOpen, connection, taskList, el(doc, 'h4', '最近的通知'), historyList, dorayakiText, controls, help);

  const storyBubble = el(doc, 'section', undefined, 'dora-ui__story');
  storyBubble.hidden = true;
  storyBubble.dataset.ttMobileSurface = 'free-window';
  const storyHeading = el(doc, 'div', undefined, 'dora-ui__story-heading');
  const storyTitle = el(doc, 'strong');
  const storyClose = button(doc, '×', 'dora-ui__close');
  storyClose.setAttribute('aria-label', '收起小故事');
  storyHeading.append(storyTitle, storyClose);
  const storyText = el(doc, 'p');
  storyText.setAttribute('aria-live', 'polite');
  const storyNext = button(doc, '换一篇', 'dora-ui__small');
  const storyFoot = el(doc, 'div', undefined, 'dora-ui__story-foot');
  storyFoot.append(el(doc, 'span', '每 30 秒换一篇'), storyNext);
  storyBubble.append(storyHeading, storyText, storyFoot);
  overlay.append(message, notebook, storyBubble);
  doc.body.append(root, overlay);

  function listen(target, name, handler, options) {
    target.addEventListener(name, handler, options);
    subscriptions.push(() => target.removeEventListener(name, handler, options));
  }
  function later(fn, ms) {
    const id = host.setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, Math.max(0, ms));
    timers.add(id);
    return id;
  }
  function cancel(id) {
    if (id === null || id === undefined) return null;
    host.clearTimeout(id); timers.delete(id);
    return null;
  }
  function save() {
    store[ID] = { ...(store[ID] || {}), ...settings };
    context.saveSettingsDebounced?.();
    position();
    settingsControls?.sync();
  }
  function dockEdge() {
    return settings.position ? normalizeEdge(settings.position.edge) : null;
  }
  function depth() {
    return Math.round((bounds?.size || settings.size) * PEEK_RATIO);
  }
  function showingPeek() {
    return Boolean(tucked && dockEdge() && !dragging?.moved && !travel);
  }
  function say(kind, override) {
    if (!settings.chatter || !settings.enabled) return;
    const text = override || pickLine(kind);
    if (text) { line = { text, until: Date.now() + LINE_MS }; later(update, LINE_MS + 20); }
  }
  function markActive() {
    lastActive = Date.now();
    if (model.wake()) update();
  }

  // ---------- Docking and tucking ----------
  function canTuck() {
    return settings.edgePeeks && settings.enabled && Boolean(dockEdge()) && !hovering && !dragging && !travel
      && !model.snapshot.busy && !model.reaction && !model.localBusy() && notebook.hidden;
  }
  function scheduleTuck() {
    tuckTimer = cancel(tuckTimer);
    if (!canTuck() || tucked) return;
    tuckTimer = later(() => { tuckTimer = null; if (canTuck()) { tucked = true; rollPeek(); position(); } }, TUCK_DELAY_MS);
  }
  function untuck() {
    tuckTimer = cancel(tuckTimer);
    if (!tucked) return;
    tucked = false;
    position();
  }
  function rollPeek() {
    const dice = Math.random();
    peekVariant = dice < 0.025 ? 'copter' : dice < 0.05 ? 'dorayaki' : 'peek';
    peekRotateTimer = cancel(peekRotateTimer);
    peekRotateTimer = later(() => { peekRotateTimer = null; if (tucked) { rollPeek(); update(); } }, PEEK_ROTATE_MS);
  }

  // ---------- Geometry ----------
  function applyPoint(next) {
    point = next;
    const dpr = host.devicePixelRatio || 1;
    root.style.transform = `translate3d(${Math.round(point.x * dpr) / dpr}px, ${Math.round(point.y * dpr) / dpr}px, 0)`;
  }
  function scheduleLayout(refreshGeometry = false) {
    geometryDirty ||= refreshGeometry;
    if (destroyed || layoutFrame !== null) return;
    layoutFrame = host.requestAnimationFrame(() => {
      layoutFrame = null;
      if (geometryDirty) position();
      else if (!dragging?.moved) placePanels();
    });
  }
  function watchInput() {
    const next = doc.getElementById('send_form');
    if (next !== inputElement) {
      if (inputElement) geometryObserver?.unobserve(inputElement);
      inputElement = next;
      if (inputElement) geometryObserver?.observe(inputElement);
      scheduleLayout(true);
    }
    // TauriTavern moves the composer with CSS when the keyboard opens; no resize event fires.
    const rect = inputElement?.getBoundingClientRect();
    const signature = rect ? `${Math.round(rect.top)}:${Math.round(rect.height)}` : '';
    if (signature !== lastImeSignature) { lastImeSignature = signature; scheduleLayout(true); }
  }
  const geometryObserver = typeof host.ResizeObserver === 'function' ? new host.ResizeObserver(() => scheduleLayout(true)) : null;
  const panelObserver = typeof host.ResizeObserver === 'function' ? new host.ResizeObserver(() => scheduleLayout()) : null;
  panelObserver?.observe(notebook); panelObserver?.observe(message); panelObserver?.observe(storyBubble);

  function position() {
    if (destroyed) return;
    bounds = readBounds(host, doc, settings.size);
    geometryDirty = false;
    const { width, height, size } = bounds;
    root.style.setProperty('--dora-size', `${size}px`);
    overlay.style.setProperty('--dora-page-width', `${Math.max(180, Math.min(320, width - 24))}px`);
    overlay.style.setProperty('--dora-page-height', `${Math.max(140, Math.min(460, height - 32))}px`);
    if (dragging?.moved) applyPoint(constrainDrag(dragging.pending, bounds));
    else if (!travel) {
      const base = fromRatio(settings.position, bounds, settings.side);
      const edge = dockEdge();
      applyPoint(showingPeek() ? tuckedPoint(edge, base, bounds, depth()) : base);
    }
    if (!dragging?.moved) placePanels();
    update();
  }
  function anchorRect() {
    if (!point || !bounds) return null;
    return visibleRect(point, bounds, showingPeek() ? dockEdge() : null, depth());
  }
  function placePanels() {
    if (destroyed || !bounds || !point || dragging?.moved) return;
    const anchor = anchorRect();
    const { width, height, left: offsetLeft, top: offsetTop } = bounds;
    const top0 = Math.max(offsetTop, bounds.edgeT);
    const bottom0 = Math.min(offsetTop + height, bounds.edgeB);
    root.dataset.side = anchor.x + anchor.width / 2 < offsetLeft + width / 2 ? 'left' : 'right';
    function placePanel(panel, cap) {
      panel.style.maxHeight = `${Math.max(48, Math.min(cap, bottom0 - top0 - 24))}px`;
      const pw = panel.offsetWidth;
      let ph = panel.offsetHeight;
      const above = anchor.y - top0 - 12;
      const below = bottom0 - (anchor.y + anchor.height) - 12;
      let px = anchor.x + anchor.width / 2 - pw / 2;
      let py;
      if (above >= ph + 10) py = anchor.y - ph - 10;
      else if (below >= ph + 10) py = anchor.y + anchor.height + 10;
      else if (anchor.x - offsetLeft - 12 >= pw + 10) { px = anchor.x - pw - 10; py = anchor.y + anchor.height / 2 - ph / 2; }
      else if (offsetLeft + width - anchor.x - anchor.width - 12 >= pw + 10) { px = anchor.x + anchor.width + 10; py = anchor.y + anchor.height / 2 - ph / 2; }
      else {
        const upwards = above >= below;
        panel.style.maxHeight = `${Math.max(48, (upwards ? above : below) - 10)}px`;
        ph = panel.offsetHeight;
        py = upwards ? anchor.y - ph - 10 : anchor.y + anchor.height + 10;
      }
      panel.style.left = `${Math.min(Math.max(offsetLeft + 12, px), offsetLeft + width - pw - 12)}px`;
      panel.style.top = `${Math.min(Math.max(top0 + 12, py), bottom0 - ph - 12)}px`;
    }
    if (!notebook.hidden) placePanel(notebook, 460);
    if (!message.hidden) placePanel(message, 220);
    if (!storyBubble.hidden) placePanel(storyBubble, 300);
  }

  // ---------- Travel: stroll, copter flight and the Anywhere Door ----------
  function stopTravel(persist = true) {
    if (!travel) return;
    const finished = travel;
    travel = null;
    cancel(finished.timer);
    root.style.transition = '';
    root.dataset.vanish = 'false';
    if (persist && point && bounds) {
      settings.position = toRatio(constrain(point, bounds), bounds, null);
      save();
    } else position();
  }
  function stroll(kind) {
    if (dockEdge() || travel || host.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false;
    const roomLeft = point.x - bounds.minX;
    const roomRight = bounds.maxX - point.x;
    if (Math.max(roomLeft, roomRight) < 60) return false;
    const dir = roomLeft < 60 ? 1 : roomRight < 60 ? -1 : Math.random() < 0.5 ? -1 : 1;
    const steps = kind === 'walk' ? 12 : 6;
    const stepPx = kind === 'walk' ? 8 : 15;
    const stepMs = kind === 'walk' ? 230 : 170;
    let step = 0;
    travel = { kind, pose: 'idle', timer: null };
    root.style.transition = `transform ${stepMs}ms linear`;
    const tick = () => {
      if (!travel || travel.kind !== kind) return;
      if (step >= steps) { stopTravel(true); return; }
      travel.pose = kind === 'roll' ? 'roll' : step % 2 ? 'walk-b' : 'walk-a';
      applyPoint(constrain({ x: point.x + dir * stepPx, y: point.y }, bounds));
      step++;
      update();
      travel.timer = later(tick, stepMs);
    };
    tick();
    return true;
  }
  function randomTarget() {
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = constrain({
        x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY) * 0.85,
      }, bounds);
      if (Math.hypot(candidate.x - point.x, candidate.y - point.y) > bounds.size * 1.5) return candidate;
    }
    return constrain({ x: point.x < bounds.minX + (bounds.maxX - bounds.minX) / 2 ? bounds.maxX : bounds.minX, y: point.y }, bounds);
  }
  function fly() {
    if (travel || dragging || !settings.enabled || model.snapshot.busy) return false;
    model.interruptLocal(); markActive(); untuck();
    settings.position = { ...(settings.position || toRatio(point, bounds)), edge: null };
    position();
    const target = randomTarget();
    const distance = Math.hypot(target.x - point.x, target.y - point.y);
    const ms = Math.round(Math.min(5000, Math.max(1600, distance / 0.16)));
    travel = { kind: 'copter', pose: 'copter', timer: null };
    say('copter');
    update();
    // Lift off first, then glide; the transition carries the whole pet.
    travel.timer = later(() => {
      if (!travel) return;
      root.style.transition = `transform ${ms}ms cubic-bezier(.45,0,.55,1)`;
      applyPoint(target);
      travel.timer = later(() => { landingUntil = Date.now() + 620; stopTravel(true); later(update, 640); }, ms + 40);
    }, 450);
    return true;
  }
  function door() {
    if (travel || dragging || !settings.enabled || model.snapshot.busy) return false;
    model.interruptLocal(); markActive(); untuck();
    settings.position = { ...(settings.position || toRatio(point, bounds)), edge: null };
    position();
    const target = randomTarget();
    travel = { kind: 'door', pose: 'door', timer: null };
    say('door');
    update();
    travel.timer = later(() => {
      if (!travel) return;
      root.dataset.vanish = 'true';
      travel.timer = later(() => {
        if (!travel) return;
        root.style.transition = 'none';
        applyPoint(target);
        root.getBoundingClientRect();
        root.style.transition = '';
        root.dataset.vanish = 'false';
        stopTravel(true);
        model.react('wave');
        update();
      }, 320);
    }, 1300);
    return true;
  }

  // ---------- Scripted actions ----------
  function feed() {
    if (!settings.enabled || model.inRage()) return false;
    markActive(); untuck(); stopTravel(true);
    const stat = settings.dorayaki;
    if (stat.date !== today()) { stat.date = today(); stat.count = 0; }
    stat.count += 1; stat.total += 1;
    model.reaction = null;
    model.play([['feed', 900], ['eat-b', 650], ['eat-a', 450], ['eat-b', 900]], 'action');
    say('feed');
    save();
    return true;
  }
  function pocket() {
    if (!settings.enabled || model.inRage()) return false;
    markActive(); untuck(); stopTravel(true);
    const choice = GADGETS[Math.floor(Math.random() * GADGETS.length)];
    gadgetId = choice.id;
    model.reaction = null;
    model.play([['pocket-a', 1300], ['pocket-b', 2200]], 'action');
    say('', '我找找……');
    later(() => say('', `${choice.name}！`), 1300);
    update();
    return true;
  }
  function mouseScare() {
    model.reaction = null;
    model.play([['scared', 2400], ['huff', 800]], 'action');
    say('scared');
    update();
  }

  // ---------- Idle behaviour ----------
  function scheduleIdle() {
    later(runIdle, IDLE_MIN_MS + Math.random() * IDLE_SPREAD_MS);
  }
  function runIdle() {
    const quiet = settings.enabled && settings.idleActions && !doc.hidden && !dragging && !travel && notebook.hidden
      && !showingPeek() && model.quiet() && !model.snoozing && !storyteller.current;
    if (quiet) {
      const dice = Math.random();
      const idle = steps => { model.play(steps, 'idle'); update(); };
      if (dice < 0.14) idle([['blink', 160]]);
      else if (dice < 0.22) idle([['blink', 140], ['idle', 110], ['blink', 140]]);
      else if (dice < 0.36) idle([['look-left', 1300], ['idle', 250], ['look-right', 1300]]);
      else if (dice < 0.52) { if (!(settings.stroll && stroll('walk'))) idle([['look-right', 1600]]); }
      else if (dice < 0.60) { if (!(settings.stroll && stroll('roll'))) idle([['blink', 160]]); }
      else if (dice < 0.72) idle([['eat-a', 900], ['eat-b', 650], ['eat-a', 450], ['eat-b', 900]]);
      else if (dice < 0.80) idle([['yawn', 1500]]);
      else if (dice < 0.87 && settings.pocketIdle) pocket();
      else if (dice < 0.92 && settings.copterFlight) fly();
      else if (dice < 0.95 && settings.mouseEgg) mouseScare();
      else idle([[dice < 0.975 ? 'look-left' : 'look-right', 1800]]);
    }
    scheduleIdle();
  }
  function sleepThreshold() {
    const hour = new Date().getHours();
    return settings.nightOwl && (hour >= 23 || hour < 6) ? NIGHT_SLEEP_MS : SLEEP_MS;
  }
  function checkSleep() {
    if (!settings.enabled || !settings.sleepy || model.snoozing || dragging || travel || doc.hidden) return;
    if (model.snapshot.busy || !model.quiet()) { if (model.snapshot.busy) lastActive = Date.now(); return; }
    if (Date.now() - lastActive >= sleepThreshold() && model.sleep()) update();
  }

  // ---------- Database bubble mirror ----------
  function bubbleView(b) {
    const tone = b.type === 'joke' ? 'joke' : b.type === 'notice' ? b.notice?.kind || 'info' : b.task?.kind || 'info';
    let heading = '';
    let body = '';
    if (b.type === 'joke') { heading = '你知道吗？'; body = b.text; }
    else if (b.showRealWork) {
      heading = b.type === 'notice' ? b.notice?.title || '' : b.task?.feature || '';
      body = b.type === 'notice' ? b.notice?.text || '' : b.task?.detail || '';
    } else if (b.type === 'notice' || b.task) body = `正在${b.word || '忙活'}…`;
    const detailTitle = b.type === 'notice' ? b.notice?.title || '' : b.type === 'task' ? b.task?.feature || '' : '';
    const detailText = b.type === 'notice' ? b.notice?.text || '' : b.type === 'task' ? b.task?.detail || '' : '';
    const actions = b.type === 'notice' ? (b.notice?.actions || []).map(action => ({ ...action, kind: 'noticeAction' }))
      : b.type === 'task' && b.task?.action ? [{ label: b.task.action.label, variant: b.task.action.variant, kind: 'taskAction' }] : [];
    return {
      tone, heading, body, detailTitle, detailText, actions,
      closable: b.type !== 'task' || b.task?.dismissible === true,
      expandable: !b.showRealWork && b.type !== 'joke' && Boolean(detailText || detailTitle),
    };
  }
  function renderBubble(mode, b) {
    const signature = JSON.stringify([mode, b, mode === 'line' ? line?.text : '', expanded]);
    if (signature === bubbleSignature) return false;
    bubbleSignature = signature;
    message.replaceChildren();
    message.dataset.mode = mode;
    if (mode === 'line') {
      message.dataset.kind = 'line';
      message.append(el(doc, 'p', line.text, 'dora-ui__bubble-text'));
      return true;
    }
    const view = bubbleView(b);
    message.dataset.kind = view.tone;
    message.setAttribute('role', view.tone === 'error' ? 'alert' : 'status');
    const bodyNode = el(doc, 'div', undefined, 'dora-ui__bubble-body');
    if (view.heading) bodyNode.append(el(doc, 'p', view.heading, 'dora-ui__bubble-heading'));
    if (view.body) bodyNode.append(el(doc, 'p', view.body, 'dora-ui__bubble-text'));
    if (view.expandable) {
      bodyNode.classList.add('is-expandable');
      bodyNode.tabIndex = 0;
      bodyNode.setAttribute('role', 'button');
      bodyNode.setAttribute('aria-expanded', String(expanded));
      bodyNode.title = expanded ? '点击收起' : '点击查看在做什么';
      if (expanded) {
        const detail = el(doc, 'div', undefined, 'dora-ui__bubble-detail');
        if (view.detailTitle) detail.append(el(doc, 'p', view.detailTitle, 'dora-ui__bubble-detail-title'));
        if (view.detailText) detail.append(el(doc, 'p', view.detailText));
        bodyNode.append(detail);
      }
      const toggle = event => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        expanded = !expanded;
        dataSource?.invoke(expanded ? 'pause' : 'resume');
        update();
      };
      bodyNode.addEventListener('click', toggle);
      bodyNode.addEventListener('keydown', toggle);
    }
    message.append(bodyNode);
    if (view.actions.length || view.closable) {
      const tools = el(doc, 'div', undefined, 'dora-ui__bubble-tools');
      for (const action of view.actions) {
        const node = button(doc, action.label, `dora-ui__bubble-action${action.variant === 'danger' ? ' is-danger' : ''}`);
        node.disabled = b.actionBusy;
        node.addEventListener('click', async event => {
          event.stopPropagation();
          node.disabled = true;
          try {
            const ok = await dataSource?.invoke(action.kind, { slideKey: b.key, actionIndex: action.index });
            if (!ok) say('', '提示已经更新了，请再看一眼～');
          } catch (error) {
            console.warn('[哆啦A梦桌宠] 数据库操作失败', error);
            say('', '操作没成功，请打开数据库面板看看。');
          } finally { bubbleSignature = ''; update(); }
        });
        tools.append(node);
      }
      if (view.closable) {
        const node = button(doc, '×', 'dora-ui__bubble-close');
        const label = b.type === 'task' ? '关闭提示' : '下一条';
        node.title = label; node.setAttribute('aria-label', label);
        node.addEventListener('click', event => {
          event.stopPropagation();
          dataSource?.invoke(b.type === 'task' ? 'dismissTask' : 'skip', { slideKey: b.key });
        });
        tools.append(node);
      }
      message.append(tools);
    }
    return true;
  }

  // ---------- Notebook ----------
  function setNotebook(open) {
    if (open) { storyteller.dismiss(); untuck(); }
    notebook.hidden = !open;
    if (open) overlay.hidden = false;
    portrait.setAttribute('aria-expanded', String(open));
    if (open) { lastNotebookVersion = ''; updateNotebook(); close.focus({ preventScroll: true }); }
    else (settings.enabled === false ? settingsMount?.querySelector('button[aria-controls]') : portrait)?.focus({ preventScroll: true });
    position();
    if (!open) scheduleTuck();
  }
  function openDatabaseApp() {
    setNotebook(false);
    const menuItem = doc.getElementById('acu-v2-menu-item')
      || doc.getElementById('shujuku_v120-menu-item')
      || [...doc.querySelectorAll('#extensionsMenu .list-group-item, #extensionsMenu [role="menuitem"]')].find(item =>
        item.querySelector('.fa-database') && /数据库/.test(item.textContent || ''));
    if (menuItem instanceof host.HTMLElement) { menuItem.click(); return true; }
    setNotebook(true);
    connection.textContent = '没找到数据库入口，请确认数据库扩展已启用';
    return false;
  }
  function currentTask() {
    return model.snapshot.tasks.find(task => task.id === model.snapshot.activeTaskId && task.busy) || null;
  }
  async function stopTask(taskId) {
    if (taskStopBusy) return;
    dataSource?.refresh();
    const task = currentTask();
    if (!task?.action?.run || task.id !== taskId) {
      stopFeedback = { text: '任务提示已更新，请确认后再停止。', kind: 'warning', until: Date.now() + 8000 };
      lastNotebookVersion = ''; update(); return;
    }
    taskStopBusy = true; stopFeedback = null; lastNotebookVersion = ''; update();
    try { await task.action.run(); }
    catch { stopFeedback = { text: '停止失败，请重试或打开数据库面板。', kind: 'error', until: Date.now() + 8000 }; }
    finally { taskStopBusy = false; dataSource?.refresh(); lastNotebookVersion = ''; update(); }
  }
  function updateNotebook() {
    const snapshot = model.snapshot;
    const source = dataSource?.getSnapshot().source || 'waiting';
    const feedback = stopFeedback?.until > Date.now() ? stopFeedback : null;
    const version = JSON.stringify([snapshot.tasks.map(task => [task.id, task.feature, task.detail, task.busy, Boolean(task.action)]),
      model.history.map(item => item.id), snapshot.busy, snapshot.connected, snapshot.activityKnown, source,
      settings.enabled, settings.dorayaki, snapshot.activeTaskId, feedback?.text, taskStopBusy, snapshot.petPresent]);
    if (version === lastNotebookVersion) return;
    lastNotebookVersion = version;
    const erii = doc.getElementById('erii-database-pet-root') ? ' · 检测到绘梨衣桌宠也在运行，建议只启用一个' : '';
    connection.textContent = (snapshot.connected
      ? snapshot.busy ? '数据库正在处理任务' : snapshot.activityKnown === false ? '已连接数据库 · 等待任务通知' : '已连接数据库 · 现在空闲'
      : source === 'unsupported-view' ? '当前数据库界面版本暂不兼容，请反馈数据库版本' : '等待数据库加载；保持数据库扩展启用即可')
      + (snapshot.connected && !snapshot.petPresent ? ' · 数据库自带桌宠被关掉了，冷笑话和忙碌状态可能不全' : '') + erii;
    taskList.replaceChildren();
    if (feedback) { const note = el(doc, 'p', feedback.text); note.dataset.kind = feedback.kind; taskList.append(note); }
    if (!snapshot.tasks.length) taskList.append(el(doc, 'p', snapshot.connected ? snapshot.busy ? '任务已经开始，进度会随数据库提示同步。' : '现在没有进行中的任务。' : '尚未收到任务数据。'));
    const activeId = currentTask()?.id;
    for (const task of snapshot.tasks) {
      const card = el(doc, 'article', undefined, 'dora-ui__task');
      card.dataset.kind = task.kind;
      const textBox = el(doc, 'div');
      textBox.append(el(doc, 'strong', task.feature || '数据库任务'), el(doc, 'p', task.detail || (task.busy ? '处理中…' : '等待处理')));
      card.append(textBox);
      if (task.id === activeId && task.action?.run) {
        const stop = button(doc, taskStopBusy ? '停止中…' : task.action.label || '停止', 'dora-ui__stop');
        stop.disabled = taskStopBusy;
        stop.addEventListener('click', () => stopTask(task.id));
        card.append(stop);
      }
      taskList.append(card);
    }
    historyList.replaceChildren();
    if (!model.history.length) historyList.append(el(doc, 'p', '新通知会记在这里。'));
    for (const record of model.history.slice(0, 6)) {
      const card = el(doc, 'article', undefined, 'dora-ui__record');
      card.dataset.kind = record.kind;
      if (record.title) card.append(el(doc, 'strong', record.title));
      card.append(el(doc, 'p', record.text));
      historyList.append(card);
    }
    const stat = settings.dorayaki;
    dorayakiText.textContent = `今天吃了 ${stat.date === today() ? stat.count : 0} 个铜锣烧 · 一共吃了 ${stat.total} 个`;
    for (const node of Object.values(actionButtons)) node.disabled = settings.enabled === false;
    actionButtons.copter.disabled ||= snapshot.busy;
    actionButtons.door.disabled ||= snapshot.busy;
    actionButtons.story.disabled ||= snapshot.busy;
    if (!notebook.hidden) scheduleLayout();
  }

  // ---------- Stories ----------
  function storyBlocked(bubbleVisible) {
    return settings.enabled === false || doc.hidden || model.snapshot.busy || bubbleVisible
      || !notebook.hidden || Boolean(dragging) || Boolean(travel);
  }
  function tellStory() {
    if (settings.enabled === false || model.snapshot.busy) return;
    setNotebook(false);
    storyteller.show(); update();
  }

  // ---------- Main render ----------
  function currentPose() {
    if (dragging?.moved) return 'struggle';
    if (travel?.pose && travel.pose !== 'idle') return travel.pose;
    if (showingPeek()) return 'peek';
    const pose = model.pose();
    if (pose === 'idle' && Date.now() < landingUntil) return 'land';
    return pose;
  }
  function render(pose) {
    const edge = pose === 'peek' ? dockEdge() : '';
    const variant = pose === 'peek' ? (model.snoozing ? 'sleepy' : peekVariant) : '';
    const key = `${pose}|${edge}|${variant}|${pose === 'pocket-b' ? gadgetId : ''}`;
    if (key === lastRenderKey) return;
    lastRenderKey = key;
    sprite.innerHTML = pose === 'peek' ? renderPeek(variant) : renderPose(pose === 'land' ? 'idle' : pose, { gadgetId });
    root.dataset.pose = pose;
    if (edge) root.dataset.tucked = edge;
    else delete root.dataset.tucked;
    motion.play(pose === 'peek' ? `edge-${edge}` : pose);
    portrait.title = `${LABELS[pose] || LABELS.idle} · 轻点互动 · 拖动移动 · 右键打开口袋笔记`;
  }
  function update() {
    if (destroyed) return;
    if (settings.enabled === false && dragging) cancelDrag();
    root.hidden = settings.enabled === false;
    overlay.hidden = root.hidden && notebook.hidden;
    model.moods = settings.taskMoods;
    const snapshot = model.snapshot;
    const now = Date.now();
    if (snapshot.busy !== lastBusy) {
      lastBusy = snapshot.busy;
      lastActive = now;
      if (snapshot.busy) { if (travel) stopTravel(true); model.stopIdle(); untuck(); }
      else scheduleTuck();
    }
    const pose = currentPose();
    if (!root.hidden) render(pose);

    const replacePet = settings.enabled !== false && settings.hideOriginal && snapshot.connected;
    const replaceBubble = settings.enabled !== false && settings.mirrorBubble && snapshot.connected;
    if (doc.body.hasAttribute('data-dora-hide-pet') !== replacePet) doc.body.toggleAttribute('data-dora-hide-pet', replacePet);
    if (doc.body.hasAttribute('data-dora-hide-bubble') !== replaceBubble) doc.body.toggleAttribute('data-dora-hide-bubble', replaceBubble);

    const b = replaceBubble ? snapshot.bubble : null;
    if (b?.key !== expandedKey) { expandedKey = b?.key || ''; expanded = false; }
    const lineActive = line && line.until > now ? line : null;
    if (!lineActive) line = null;
    const blockedUi = root.hidden || Boolean(dragging?.moved) || !notebook.hidden;
    const mode = blockedUi ? '' : b ? 'db' : lineActive && !storyteller.current ? 'line' : '';
    const wasHidden = message.hidden;
    message.hidden = !mode;
    let changed = wasHidden !== message.hidden;
    if (mode) changed = renderBubble(mode, b) || changed;
    else bubbleSignature = '';

    updateNotebook();
    const beforeStory = storyBubble.hidden;
    storyteller.tick({ blocked: storyBlocked(Boolean(b)), automatic: settings.healingStories === true && pose === 'idle' });
    const story = storyteller.current;
    storyBubble.hidden = !story || root.hidden;
    if (story && storyTitle.textContent !== story.title) {
      storyTitle.textContent = story.title; storyText.textContent = story.text;
      storyBubble.scrollTop = 0; changed = true;
    }
    changed ||= beforeStory !== storyBubble.hidden;
    if (changed && !dragging?.moved) scheduleLayout();

    wakeTimer = cancel(wakeTimer);
    const next = model.nextChange();
    if (next) wakeTimer = later(() => { wakeTimer = null; update(); if (!model.reaction && !model.localBusy()) scheduleTuck(); }, next - Date.now() + 15);
  }

  // ---------- Settings panel ----------
  function mountSettings() {
    if (settingsMount?.isConnected) return;
    const target = doc.getElementById('extensions_settings2') || doc.getElementById('extensions_settings');
    if (!target) return;
    settingsMount = el(doc, 'details', undefined, 'dora-settings');
    settingsMount.id = `${ID}-settings`;
    settingsMount.append(el(doc, 'summary', `哆啦A梦 · 数据库桌宠 v${VERSION}`));
    const fields = [];
    for (const [key, label] of TOGGLES) {
      const row = el(doc, 'label');
      const input = el(doc, 'input');
      input.type = 'checkbox';
      input.checked = settings[key] === true;
      row.append(input, el(doc, 'span', label));
      settingsMount.append(row);
      listen(input, 'change', () => {
        settings[key] = input.checked;
        if (key === 'enabled' && !input.checked) stopTravel(false);
        if (key === 'edgePeeks' && !input.checked) untuck();
        save();
      });
      fields.push([key, input]);
    }
    const sizeRow = el(doc, 'label', '大小');
    const range = el(doc, 'input');
    range.type = 'range'; range.min = '56'; range.max = '140'; range.step = '4'; range.value = String(settings.size);
    sizeRow.append(range);
    settingsMount.append(sizeRow);
    listen(range, 'input', () => { settings.size = Number(range.value); save(); });
    const row = el(doc, 'div', undefined, 'dora-settings__buttons');
    const reset = button(doc, '重置位置');
    const openBook = button(doc, '打开口袋笔记');
    openBook.setAttribute('aria-controls', notebook.id);
    row.append(reset, openBook);
    settingsMount.append(row);
    listen(reset, 'click', resetPosition);
    listen(openBook, 'click', () => setNotebook(true));
    settingsMount.append(el(doc, 'p', '保持「龙血玄黄·数据库」启用，并在数据库设置里打开它自带的桌宠（这里会自动把它藏起来）；冷笑话、任务进度和停止按钮都来自数据库本身。'));
    settingsControls = { sync() { for (const [key, input] of fields) input.checked = settings[key] === true; range.value = String(settings.size); } };
    target.append(settingsMount);
  }

  // ---------- Pointer interaction ----------
  function resetPosition() { cancelDrag(); stopTravel(false); model.interruptLocal(); tucked = false; settings.position = null; landingUntil = 0; save(); }
  function clearHold() {
    holdTimer = cancel(holdTimer);
    mobileBookTimer = cancel(mobileBookTimer);
  }
  function flushDrag() {
    dragFrame = null;
    if (!dragging?.moved || destroyed) return;
    applyPoint(constrainDrag(dragging.pending, bounds));
    root.style.setProperty('--dora-tilt', `${dragging.tilt || 0}deg`);
  }
  function cancelDrag() {
    clearHold();
    model.endPet();
    if (dragFrame !== null) host.cancelAnimationFrame(dragFrame);
    dragFrame = null;
    const pointerId = dragging?.id;
    dragging = null;
    longPressed = false;
    root.dataset.dragging = 'false'; root.style.setProperty('--dora-tilt', '0deg');
    try { if (pointerId !== undefined && portrait.hasPointerCapture(pointerId)) portrait.releasePointerCapture(pointerId); } catch { /* already released */ }
  }
  function finishDrag(event, cancelled = false) {
    if (!dragging) return;
    if (event && event.pointerId !== dragging.id) return;
    const moved = dragging.moved;
    if (cancelled) {
      suppressClick = Boolean(moved || longPressed);
      if (moved && point && bounds) {
        settings.position = toRatio(constrain(point, bounds), bounds, null);
        cancelDrag(); save(); return;
      }
      cancelDrag(); update(); position(); scheduleTuck();
      return;
    }
    if (moved) {
      if (event) dragging.pending = { x: dragging.origin.x + event.clientX - dragging.startX, y: dragging.origin.y + event.clientY - dragging.startY };
      if (dragFrame !== null) host.cancelAnimationFrame(dragFrame);
      flushDrag();
      const drop = constrainDrag(dragging.pending, bounds);
      const near = nearestEdge(drop, bounds);
      const edge = near.distance <= snapDistance(bounds) ? near.edge : null;
      const pushedIn = Boolean(edge) && near.distance < -8;
      const base = edge ? dockedPoint(edge, drop, bounds) : constrain(drop, bounds, true);
      settings.position = toRatio(base, bounds, edge);
      const dizzy = dragging.reversals >= DIZZY_REVERSALS;
      suppressClick = true;
      cancelDrag();
      if (dizzy) { model.dizzy(); say('dizzy'); tucked = false; }
      else if (pushedIn && settings.edgePeeks) { tucked = true; rollPeek(); }
      else { tucked = false; landingUntil = Date.now() + 620; later(update, 640); }
      save();
      scheduleTuck();
      return;
    }
    const held = longPressed;
    cancelDrag();
    if (held) { suppressClick = true; update(); scheduleTuck(); }
    else { suppressClick = true; interactTap(); }
  }
  function interactTap() {
    if (settings.enabled === false || destroyed) return;
    const wasTucked = showingPeek();
    landingUntil = 0; storyteller.dismiss(); stopTravel(true);
    lastActive = Date.now();
    untuck();
    if (wasTucked) { update(); return; }
    const result = model.tap();
    if (result === 'rage') say('rage');
    else if (result) say(result);
    update();
  }
  listen(portrait, 'pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false || dragging) return;
    if (travel) stopTravel(true);
    position(); suppressClick = false; longPressed = false;
    const rendered = root.getBoundingClientRect();
    point = { x: rendered.x, y: rendered.y };
    dragging = { id: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { ...point }, pending: { ...point },
      moved: false, lastX: event.clientX, tilt: 0, dir: 0, swingFrom: event.clientX, reversals: 0 };
    storyteller.dismiss(); update();
    try { portrait.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
    holdTimer = later(() => {
      holdTimer = null;
      if (!dragging || dragging.moved) return;
      longPressed = true; suppressClick = true; landingUntil = 0;
      lastActive = Date.now(); untuck();
      if (model.startPet()) say('pet');
      update();
    }, LONG_PRESS_MS);
    if (event.pointerType === 'touch') {
      mobileBookTimer = later(() => {
        mobileBookTimer = null;
        if (!dragging || dragging.moved) return;
        longPressed = true; suppressClick = true;
        model.endPet(0); setNotebook(true); update();
      }, MOBILE_BOOK_MS);
    }
  });
  listen(portrait, 'pointermove', event => {
    if (event.pointerId !== dragging?.id) return;
    const dx = event.clientX - dragging.startX;
    const dy = event.clientY - dragging.startY;
    if (!dragging.moved && Math.hypot(dx, dy) < (event.pointerType === 'touch' ? 8 : 6)) return;
    if (!dragging.moved) {
      dragging.moved = true; clearHold(); model.interruptLocal(); model.wake();
      tucked = false; tuckTimer = cancel(tuckTimer);
      lastActive = Date.now();
      notebook.hidden = true; portrait.setAttribute('aria-expanded', 'false');
      root.dataset.dragging = 'true';
      bounds = readBounds(host, doc, settings.size);
      update();
    }
    event.preventDefault();
    dragging.pending = { x: dragging.origin.x + dx, y: dragging.origin.y + dy };
    const step = event.clientX - dragging.lastX;
    const dir = Math.sign(step);
    if (dir && dir !== dragging.dir) {
      if (dragging.dir && Math.abs(event.clientX - dragging.swingFrom) >= DIZZY_SWING_PX) dragging.reversals++;
      dragging.dir = dir; dragging.swingFrom = event.clientX;
    }
    dragging.tilt = Math.max(-10, Math.min(10, step * 0.4));
    dragging.lastX = event.clientX;
    if (dragFrame === null) dragFrame = host.requestAnimationFrame(flushDrag);
  });
  listen(portrait, 'pointerup', event => finishDrag(event));
  listen(portrait, 'pointercancel', event => finishDrag(event, true));
  listen(portrait, 'lostpointercapture', event => finishDrag(event, true));
  listen(host, 'blur', () => finishDrag(null, true));
  listen(portrait, 'pointerenter', event => {
    hovering = true;
    tuckTimer = cancel(tuckTimer);
    if (event.pointerType !== 'mouse' || dragging) return;
    if (showingPeek()) { untuck(); markActive(); return; }
    if (settings.hoverWave && Date.now() - lastWaveAt > WAVE_COOLDOWN_MS && model.wave()) {
      lastWaveAt = Date.now(); say('wave'); update();
    }
  });
  listen(portrait, 'pointerleave', () => { hovering = false; scheduleTuck(); });
  listen(portrait, 'click', event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; event.preventDefault(); return; }
    suppressClick = false; interactTap();
  });
  listen(portrait, 'contextmenu', event => {
    event.preventDefault();
    if (dragging?.moved || longPressed || event.pointerType === 'touch') return;
    setNotebook(notebook.hidden);
  });
  listen(portrait, 'keydown', event => {
    if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); setNotebook(true); return; }
    if (event.key === 'Home') { event.preventDefault(); resetPosition(); return; }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault(); stopTravel(false); position();
    model.interruptLocal(); landingUntil = 0; tucked = false;
    const step = event.shiftKey ? 28 : 10;
    const moved = constrain({ x: point.x + delta[0] * step, y: point.y + delta[1] * step }, bounds);
    settings.position = toRatio(moved, bounds, null);
    save();
  });
  listen(message, 'pointerenter', () => { if (message.dataset.mode === 'db') dataSource?.invoke('pause'); });
  listen(message, 'pointerleave', event => {
    if (message.dataset.mode !== 'db') return;
    if (expanded && event.pointerType !== 'mouse') return;
    dataSource?.invoke('resume');
  });
  listen(close, 'click', () => setNotebook(false));
  listen(databaseOpen, 'click', openDatabaseApp);
  listen(actionButtons.feed, 'click', () => { setNotebook(false); feed(); });
  listen(actionButtons.pocket, 'click', () => { setNotebook(false); pocket(); });
  listen(actionButtons.copter, 'click', () => { setNotebook(false); fly(); });
  listen(actionButtons.door, 'click', () => { setNotebook(false); door(); });
  listen(actionButtons.wave, 'click', () => { setNotebook(false); markActive(); model.interruptLocal(); model.react('wave'); say('wave'); update(); });
  listen(actionButtons.story, 'click', tellStory);
  listen(storyNext, 'click', () => {
    if (storyBlocked(false)) return;
    storyteller.show(); update();
    if (storyBubble.matches(':hover')) storyteller.pause('hover');
    if (storyBubble.contains(doc.activeElement)) storyteller.pause('focus');
  });
  listen(storyClose, 'click', () => { storyteller.dismiss(); update(); portrait.focus({ preventScroll: true }); });
  listen(storyBubble, 'pointerenter', () => storyteller.pause('hover'));
  listen(storyBubble, 'pointerleave', () => storyteller.resume('hover'));
  listen(storyBubble, 'focusin', () => storyteller.pause('focus'));
  listen(storyBubble, 'focusout', event => { if (!storyBubble.contains(event.relatedTarget)) storyteller.resume('focus'); });
  listen(storyBubble, 'pointerdown', event => { if (event.pointerType === 'touch') storyteller.pause('touch'); });
  listen(doc, 'keydown', event => {
    if (event.key !== 'Escape') return;
    if (dragging) finishDrag(null, true);
    if (!notebook.hidden) setNotebook(false);
    if (!storyBubble.hidden) { storyteller.dismiss(); update(); }
  });
  listen(doc, 'focusin', () => scheduleLayout(true));
  listen(doc, 'focusout', () => scheduleLayout(true));
  listen(doc, 'visibilitychange', () => { if (!doc.hidden) { lastActive = Date.now(); scheduleLayout(true); } });
  listen(host, 'resize', () => scheduleLayout(true));
  if (host.visualViewport) {
    listen(host.visualViewport, 'resize', () => scheduleLayout(true));
    listen(host.visualViewport, 'scroll', () => scheduleLayout(true));
  }

  function accept(snapshot) {
    if (!model.ingest(snapshot)) return;
    update();
  }
  function connect() {
    if (dataSource) return;
    dataSource = createDatabaseObserver(host);
    unsubscribe = dataSource.subscribe(accept);
  }
  const tick = host.setInterval(() => { if (!doc.hidden) { update(); checkSleep(); } }, 1000);
  timers.add(tick);
  const detection = host.setInterval(() => { connect(); mountSettings(); watchInput(); }, 1500);
  timers.add(detection);

  connect(); mountSettings(); watchInput(); position(); scheduleIdle(); scheduleTuck();
  root.getBoundingClientRect();
  root.style.transition = '';
  return {
    model,
    refresh: update,
    actions: { feed, pocket, fly, door, mouseScare },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      storyteller.dismiss();
      cancelDrag(); motion.destroy();
      travel = null;
      if (layoutFrame !== null) host.cancelAnimationFrame(layoutFrame);
      geometryObserver?.disconnect(); panelObserver?.disconnect();
      unsubscribe?.();
      dataSource?.destroy();
      for (const remove of subscriptions) remove();
      for (const timer of timers) { host.clearInterval(timer); host.clearTimeout(timer); }
      timers.clear();
      root.remove(); overlay.remove(); settingsMount?.remove(); removeProbe();
      doc.body.removeAttribute('data-dora-hide-pet');
      doc.body.removeAttribute('data-dora-hide-bubble');
    },
  };
}

function bootstrap(attempt = 0) {
  bootTimer = null;
  if (stopped || active) return;
  let context;
  try { context = window.SillyTavern?.getContext?.(); } catch { /* host starting */ }
  if (context?.extensionSettings && typeof context.saveSettingsDebounced === 'function' && document.body) {
    active = createCompanion(window, context);
    window.addEventListener('pagehide', onPageHide);
  } else if (attempt < 300) bootTimer = setTimeout(() => bootstrap(attempt + 1), 200);
  else console.warn('[哆啦A梦桌宠] 酒馆设置接口尚未就绪，重新启用插件可重试。');
}
export function onActivate() { stopped = false; if (!active && bootTimer === null) bootTimer = setTimeout(() => bootstrap(), 0); }
export function onEnable() { onActivate(); }
function onPageHide(event) { if (!event.persisted) onDisable(); }
export function onDisable() {
  stopped = true;
  clearTimeout(bootTimer); bootTimer = null;
  active?.destroy(); active = null;
  window.removeEventListener('pagehide', onPageHide);
}
export function onClean() { onDisable(); }
export function getCompanion() { return active; }

// Older hosts and TauriTavern's deferred third-party activation may evaluate the module without calling hooks;
// bootstrap waits for SillyTavern.getContext, and onActivate's guards keep every route on a single instance.
if (typeof window !== 'undefined') onActivate();
