import { PROTOCOL } from './model.js';

const clean = (value, max = 600) => typeof value === 'string' ? value.slice(0, max) : '';
const tone = value => ['info', 'success', 'warning', 'error'].includes(value) ? value : 'info';
const EVENTS = { pause: 'onPause', resume: 'onResume', skip: 'onSkip', noticeAction: 'onNoticeAction', taskAction: 'onTaskAction', dismissTask: 'onDismissTask' };

// Read the database's own Vue tree. Handlers are only invoked when the user clicks the mirrored control.
export function findComponent(root, name) {
  const queue = [root];
  const seen = new Set();
  let remaining = 1500;
  while (queue.length && remaining-- > 0) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    const component = node.component;
    if ((component?.type?.__name || node.type?.__name) === name) return component || node;
    if (component?.subTree) queue.push(component.subTree);
    if (Array.isArray(node.children)) queue.push(...node.children);
    if (Array.isArray(node.dynamicChildren)) queue.push(...node.dynamicChildren);
    if (node.ssContent) queue.push(node.ssContent);
  }
  return null;
}

function readBubble(props) {
  const slide = props.slide;
  if (!slide || typeof slide !== 'object' || typeof slide.type !== 'string') return null;
  const task = props.task;
  return {
    key: clean(String(slide.key ?? '')), type: clean(slide.type), word: clean(slide.word), text: clean(slide.text, 1200),
    notice: slide.type === 'notice' && slide.notice ? {
      id: clean(slide.notice.id), title: clean(slide.notice.title), text: clean(slide.notice.text, 1200), kind: tone(slide.notice.kind),
      actions: (Array.isArray(slide.notice.actions) ? slide.notice.actions : []).slice(0, 4)
        .map((action, index) => ({ index, label: clean(action?.label), variant: action?.variant === 'danger' ? 'danger' : 'default' }))
        .filter(action => action.label),
    } : null,
    task: task && typeof task.id === 'string' ? {
      id: clean(task.id), feature: clean(task.feature), detail: clean(task.detail, 1200), kind: tone(task.kind),
      dismissible: task.dismissible === true,
      action: task.action && typeof task.action.run === 'function' ? { label: clean(task.action.label || '停止'), variant: task.action.variant === 'danger' ? 'danger' : 'default' } : null,
    } : null,
    showRealWork: props.showRealWork === true,
    actionBusy: props.actionBusy === true,
  };
}

export function readDatabaseView(doc) {
  const empty = source => ({ connected: false, source, busy: false, activityKnown: false, task: null, notice: null, bubble: null, bubbleComponent: null, petPresent: false });
  const root = doc.getElementById('acu-app-v2');
  const tree = root?._vnode;
  if (!tree) return empty(root ? 'unsupported-view' : 'waiting');
  const layer = findComponent(tree, 'DeskPetLayer');
  if (!layer?.subTree) return empty('unsupported-view');
  const pet = findComponent(layer.subTree, 'DeskPet');
  const bubble = findComponent(layer.subTree, 'NoticeBubble');
  const petBusy = pet?.props?.busy;
  const props = bubble?.props;
  if (!props || !('slide' in props) || !('task' in props)) return empty('unsupported-view');
  const current = props.task;
  const task = current && typeof current.id === 'string' ? {
    id: clean(current.id), feature: clean(current.feature), detail: clean(current.detail),
    kind: tone(current.kind), busy: current.busy === true, dismissible: current.dismissible === true,
    action: current.action && typeof current.action.run === 'function' ? { label: clean(current.action.label || '停止'), variant: current.action.variant === 'danger' ? 'danger' : 'default', run: current.action.run } : null,
  } : null;
  const incoming = props.slide?.type === 'notice' ? props.slide.notice : null;
  const notice = incoming && typeof incoming.id === 'string' ? {
    id: clean(incoming.id), title: clean(incoming.title), text: clean(incoming.text),
    kind: tone(incoming.kind), createdAt: Number(incoming.createdAt) || 0,
  } : null;
  return {
    connected: true, source: 'database-view',
    busy: typeof petBusy === 'boolean' ? petBusy : task?.busy === true,
    activityKnown: typeof petBusy === 'boolean' || task?.busy === true,
    task, notice, bubble: readBubble(props), bubbleComponent: bubble, petPresent: Boolean(pet),
  };
}

export function createDatabaseObserver(host, { now = () => Date.now(), interval = 250 } = {}) {
  const subscribers = new Set();
  let snapshot = { protocol: PROTOCOL, connected: false, source: 'waiting', busy: false, activityKnown: false, activeTaskId: '', tasks: [], notices: [], bubble: null, petPresent: false, silent: false, version: 0 };
  let signature = '';
  let destroyed = false;
  let bubbleComponent = null;
  const observed = new Map();
  function sample() {
    if (destroyed) return;
    let view;
    try { view = readDatabaseView(host.document); }
    catch { view = { connected: false, source: 'unsupported-view', busy: false, activityKnown: false, bubble: null }; }
    bubbleComponent = view.bubbleComponent || null;
    if (!view.connected || !view.busy) observed.clear();
    if (view.task) observed.set(view.task.id, { task: view.task, seenAt: now() });
    for (const [id, record] of observed) if (now() - record.seenAt > 15000) observed.delete(id);
    const tasks = view.busy ? [...observed.values()].map(record => record.task).slice(-20) : view.task ? [view.task] : [];
    const next = { protocol: PROTOCOL, connected: view.connected, source: view.source,
      busy: view.busy, activityKnown: view.activityKnown, tasks,
      activeTaskId: view.busy && view.task?.busy ? view.task.id : '',
      notices: view.notice ? [view.notice] : [], bubble: view.bubble || null, petPresent: view.petPresent === true, silent: false };
    const key = JSON.stringify(next);
    // JSON omits functions. A new native stop handler must still reach the UI.
    const actionChanged = tasks.some((task, index) => task.action?.run !== snapshot.tasks[index]?.action?.run);
    if (key === signature && !actionChanged) return;
    signature = key;
    snapshot = { ...next, version: snapshot.version + 1 };
    for (const listener of subscribers) {
      try { listener(snapshot); } catch (error) { console.warn('[哆啦A梦桌宠] 刷新桌宠时出错', error); }
    }
  }
  // Route a mirrored bubble click through the database's own carousel, exactly like its original button.
  async function invoke(name, { slideKey, actionIndex } = {}) {
    sample();
    const component = bubbleComponent;
    const props = component?.props;
    if (!props?.slide || (slideKey !== undefined && String(props.slide.key) !== slideKey)) return false;
    const listener = component.vnode?.props?.[EVENTS[name]];
    if (name === 'noticeAction') {
      const action = props.slide.notice?.actions?.[actionIndex];
      if (!action) return false;
      if (typeof listener === 'function') await listener(action);
      else await action.run?.();
    } else if (name === 'taskAction') {
      if (typeof listener === 'function') await listener();
      else if (typeof props.task?.action?.run === 'function') await props.task.action.run();
      else return false;
    } else if (typeof listener === 'function') listener();
    else return false;
    host.setTimeout(sample, 30);
    return true;
  }
  sample();
  const timer = host.setInterval(sample, interval);
  return {
    getSnapshot: () => snapshot,
    refresh() { sample(); return snapshot; },
    invoke,
    subscribe(listener) {
      if (typeof listener !== 'function' || destroyed) return () => {};
      subscribers.add(listener);
      try { listener(snapshot); } catch (error) { console.warn('[哆啦A梦桌宠] 刷新桌宠时出错', error); }
      return () => subscribers.delete(listener);
    },
    destroy() {
      destroyed = true;
      host.clearInterval(timer);
      subscribers.clear();
      observed.clear();
      bubbleComponent = null;
    },
  };
}
