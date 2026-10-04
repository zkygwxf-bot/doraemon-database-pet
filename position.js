const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const EDGES = ['left', 'right', 'top', 'bottom'];
export const normalizeEdge = value => EDGES.includes(value) ? value : null;

let probe = null;
// TauriTavern publishes safe-area insets as --tt-inset-*; browsers fall back to env(safe-area-inset-*).
export function readInsets(host, doc) {
  if (!probe || !probe.isConnected) {
    probe = doc.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
      + 'padding:var(--tt-inset-top, env(safe-area-inset-top, 0px)) var(--tt-inset-right, env(safe-area-inset-right, 0px)) '
      + 'var(--tt-inset-bottom, env(safe-area-inset-bottom, 0px)) var(--tt-inset-left, env(safe-area-inset-left, 0px));';
    probe.dataset.ttMobileSurface = 'free-window';
    doc.body.append(probe);
  }
  const style = host.getComputedStyle(probe);
  const px = value => Math.max(0, parseFloat(value) || 0);
  // On TauriTavern Android the keyboard does not resize the WebView; it is reported per surface as --tt-ime-bottom.
  const imeOf = element => element ? px(host.getComputedStyle(element).getPropertyValue('--tt-ime-bottom')) : 0;
  const ime = Math.max(imeOf(doc.querySelector('[data-tt-ime-active]')), imeOf(doc.getElementById('sheld')));
  return { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft), ime };
}

export function removeProbe() {
  probe?.remove();
  probe = null;
}

// Positions are ratios within the usable viewport, so rotation/keyboard changes stay safe.
export function readBounds(host, doc, preferredSize) {
  const view = host.visualViewport;
  const width = view?.width || host.innerWidth;
  const height = view?.height || host.innerHeight;
  const left = view?.offsetLeft || 0;
  const top = view?.offsetTop || 0;
  const insets = readInsets(host, doc);
  const size = Math.round(Math.min(width <= 640 ? Math.min(preferredSize, 76) : preferredSize, width - 16, height - 16));
  const edgeL = left + insets.left;
  const edgeR = left + width - insets.right;
  const edgeT = top + insets.top;
  const edgeB = top + height - Math.max(insets.bottom, insets.ime);
  const send = doc.getElementById('send_form')?.getBoundingClientRect();
  const inputVisible = send && send.width > 0 && send.height > 0 && send.bottom > top && send.top < edgeB;
  const inputAtBottom = inputVisible && send.bottom >= edgeB - 24;
  const bottom = inputAtBottom ? Math.max(edgeT + size + 16, send.top - 12) : edgeB - 12;
  return {
    width, height, left, top, size, insets, edgeL, edgeR, edgeT, edgeB,
    minX: edgeL + 8, maxX: Math.max(edgeL + 8, edgeR - size - 8),
    minY: edgeT + 8, maxY: Math.max(edgeT + 8, bottom - size),
    input: inputVisible ? send : null,
    bottomDockable: !inputAtBottom,
  };
}

export function constrain(point, bounds, snap = false) {
  let x = clamp(point.x, bounds.minX, bounds.maxX);
  let y = clamp(point.y, bounds.minY, bounds.maxY);
  if (snap) {
    if (x - bounds.minX < 22) x = bounds.minX;
    else if (bounds.maxX - x < 22) x = bounds.maxX;
  }
  const input = bounds.input;
  if (input && x + bounds.size > input.left && x < input.right && y + bounds.size > input.top - 8 && y < input.bottom) {
    y = clamp(input.top - bounds.size - 12, bounds.minY, bounds.maxY);
  }
  return { x, y };
}

// While dragging the pet may be pushed half-way past an edge; releasing there tucks it in.
export function constrainDrag(point, bounds) {
  const over = Math.round(bounds.size * 0.5);
  const maxY = bounds.bottomDockable ? bounds.edgeB - bounds.size + over : bounds.maxY;
  return {
    x: clamp(point.x, bounds.edgeL - over, bounds.edgeR - bounds.size + over),
    y: clamp(point.y, bounds.edgeT - over, Math.max(bounds.edgeT - over, maxY)),
  };
}

export function fromRatio(saved, bounds, side = 'right') {
  const valid = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y);
  const base = constrain(valid ? {
    x: bounds.minX + clamp(saved.x, 0, 1) * (bounds.maxX - bounds.minX),
    y: bounds.minY + clamp(saved.y, 0, 1) * (bounds.maxY - bounds.minY),
  } : { x: side === 'left' ? bounds.minX + 4 : bounds.maxX - 4, y: bounds.maxY - 12 }, bounds);
  const edge = valid ? normalizeEdge(saved.edge) : null;
  return edge && (edge !== 'bottom' || bounds.bottomDockable) ? dockedPoint(edge, base, bounds) : base;
}

export function toRatio(point, bounds, edge = null) {
  return { x: clamp((point.x - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX), 0, 1),
    y: clamp((point.y - bounds.minY) / Math.max(1, bounds.maxY - bounds.minY), 0, 1), edge: normalizeEdge(edge) };
}

// Distance from a (possibly overshooting) drop point to each dockable edge; negative means pushed past it.
export function nearestEdge(point, bounds) {
  const { size } = bounds;
  const candidates = [
    ['left', point.x - bounds.edgeL], ['right', bounds.edgeR - (point.x + size)],
    ['top', point.y - bounds.edgeT],
  ];
  if (bounds.bottomDockable) candidates.push(['bottom', bounds.edgeB - (point.y + size)]);
  candidates.sort((a, b) => a[1] - b[1]);
  return { edge: candidates[0][0], distance: candidates[0][1] };
}

export function snapDistance(bounds) {
  return Math.max(28, Math.min(bounds.width, bounds.height) * 0.05);
}

export function dockedPoint(edge, point, bounds) {
  const free = constrain(point, bounds);
  const { size } = bounds;
  if (edge === 'left') return { x: bounds.edgeL + 2, y: free.y };
  if (edge === 'right') return { x: bounds.edgeR - size - 2, y: free.y };
  if (edge === 'top') return { x: free.x, y: bounds.edgeT + 2 };
  return { x: free.x, y: bounds.edgeB - size - 2 };
}

// Only the head shows: `depth` pixels of the pet stay inside the screen.
export function tuckedPoint(edge, point, bounds, depth) {
  const docked = dockedPoint(edge, point, bounds);
  const { size } = bounds;
  if (edge === 'left') return { x: bounds.edgeL - (size - depth), y: docked.y };
  if (edge === 'right') return { x: bounds.edgeR - depth, y: docked.y };
  if (edge === 'top') return { x: docked.x, y: bounds.edgeT - (size - depth) };
  return { x: docked.x, y: bounds.edgeB - depth };
}

export function visibleRect(point, bounds, edge, depth) {
  const { size } = bounds;
  if (!edge) return { x: point.x, y: point.y, width: size, height: size };
  if (edge === 'left') return { x: bounds.edgeL, y: point.y, width: depth, height: size };
  if (edge === 'right') return { x: bounds.edgeR - depth, y: point.y, width: depth, height: size };
  if (edge === 'top') return { x: point.x, y: bounds.edgeT, width: size, height: depth };
  return { x: point.x, y: bounds.edgeB - depth, width: size, height: depth };
}
