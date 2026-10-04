// Doraemon poses: cut-out photo sprites (sprites.js, built from the 伴我同行 stills) with small SVG effects on top.
import { SPRITES } from './sprites.js';

const INK = '#1d2433';
const RED = '#e53935';
const GOLD = '#f7c948';
const S = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const L = `fill="none" ${S}`;

const star = (x, y, r = 6, color = GOLD) => {
  const p = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 4 * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.38 : r;
    p.push(`${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<path d="M${p.join(' L')} Z" fill="${color}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
};
const heart = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4 C-6 -3 -12 3 0 12 C12 3 6 -3 0 4 Z" fill="#ff5a8a" stroke="${INK}" stroke-width="1.2"/>`;

function dorayaki(x, y, bitten = false) {
  const bite = bitten ? `<path d="M${x + 5} ${y - 10} q6 7 14 1" fill="none" stroke="#7b4a1c" stroke-width="1.6"/>` : '';
  return `<g class="dora-item"><ellipse cx="${x}" cy="${y + 4}" rx="15" ry="8" fill="#c7802d" ${S} stroke-width="1.6"/>`
    + `<rect x="${x - 15}" y="${y - 2}" width="30" height="5" fill="#7b2d26"/>`
    + `<ellipse cx="${x}" cy="${y - 3}" rx="15" ry="8" fill="#e3a14a" ${S} stroke-width="1.6"/>${bite}</g>`;
}

function gadget(kind, x, y) {
  if (kind === 'door') return `<g class="dora-item"><rect x="${x - 11}" y="${y - 32}" width="22" height="34" rx="2" fill="#ff7eb6" ${S} stroke-width="1.6"/><circle cx="${x + 6}" cy="${y - 14}" r="2" fill="${GOLD}"/></g>`;
  if (kind === 'copter') return `<g class="dora-item"><ellipse class="dora-blade" cx="${x}" cy="${y - 20}" rx="18" ry="3" fill="${GOLD}" ${S} stroke-width="1.6"/><path d="M${x} ${y - 18} L${x} ${y - 4}" ${L}/></g>`;
  if (kind === 'light') return `<g class="dora-item" transform="rotate(-25 ${x} ${y})"><rect x="${x - 6}" y="${y - 30}" width="12" height="26" rx="3" fill="#ffd54f" ${S} stroke-width="1.6"/><path d="M${x - 9} ${y - 30} L${x + 9} ${y - 30} L${x + 14} ${y - 40} L${x - 14} ${y - 40} Z" fill="#fff59d" ${S} stroke-width="1.6"/></g>`;
  return `<g class="dora-item"><rect x="${x - 13}" y="${y - 28}" width="26" height="26" rx="6" fill="#ffe0a3" ${S} stroke-width="1.6"/><path d="M${x - 7} ${y - 20} L${x + 7} ${y - 20} M${x - 7} ${y - 14} L${x + 5} ${y - 14}" ${L} stroke-width="1.4"/></g>`;
}

// Closed eyes painted over the standing photo's eyes (blinking, sleeping, yawning).
const EYES = [[85.5, 23], [114, 23]];
const closedEyes = () => `<g class="dora-closed-eyes">${EYES.map(([x, y]) =>
  `<ellipse cx="${x}" cy="${y}" rx="12.6" ry="12.8" fill="#f5f5f2" stroke="#9aa0a8" stroke-width=".7"/>`
  + `<path d="M${x - 7.5} ${y + 2} Q${x} ${y + 8} ${x + 7.5} ${y + 2}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`).join('')}</g>`;

const extras = {
  zzz: `<g class="dora-zzz"><text x="150" y="30" font-size="18">Z</text><text x="164" y="14" font-size="13">z</text><text x="174" y="2" font-size="10">z</text></g>`,
  snot: `<circle class="dora-snot" cx="112" cy="54" r="7" fill="#bfe9ff" fill-opacity=".75" stroke="#58b8e8" stroke-width="1.4"/>`,
  sweat: `<path class="dora-sweat" d="M158 22 C152 32 152 38 158 38 C164 38 164 32 158 22 Z" fill="#9ee0ff" stroke="${INK}" stroke-width="1.4"/>`,
  anger: `<g class="dora-pop" transform="translate(150 14)"><path d="M-8 -2 Q-2 -2 -2 -8 M2 -8 Q2 -2 8 -2 M8 2 Q2 2 2 8 M-2 8 Q-2 2 -8 2" fill="none" stroke="${RED}" stroke-width="3" stroke-linecap="round"/></g>`,
  flush: `<ellipse cx="100" cy="70" rx="46" ry="40" fill="#ff3b3b" opacity=".16"/>`,
  sparkle: `<g class="dora-twinkle">${star(28, 30, 8)}${star(172, 22, 7)}${star(184, 84, 5)}</g>`,
  hearts: `<g class="dora-float">${heart(162, 14, 1.1)}${heart(36, 26, .8)}</g>`,
  stars: `<g class="dora-orbit">${star(64, 2, 6)}${star(136, 2, 6)}${star(100, -8, 5, '#ffe082')}</g>`,
  steam: `<g class="dora-steam"><circle cx="30" cy="34" r="7" fill="#eceff1" stroke="${INK}" stroke-width="1.2"/><circle cx="22" cy="24" r="5" fill="#eceff1" stroke="${INK}" stroke-width="1.2"/><circle cx="170" cy="34" r="7" fill="#eceff1" stroke="${INK}" stroke-width="1.2"/><circle cx="178" cy="24" r="5" fill="#eceff1" stroke="${INK}" stroke-width="1.2"/></g>`,
  bang: `<g class="dora-pop"><text x="156" y="28" font-size="30" font-weight="900" fill="${RED}" stroke="${INK}" stroke-width="1">!</text></g>`,
  note: `<g class="dora-float"><text x="156" y="26" font-size="22" fill="${INK}">♪</text><text x="30" y="40" font-size="16" fill="${INK}">♪</text></g>`,
  wavelines: `<g class="dora-float"><path d="M188 104 q6 8 0 16 M195 100 q8 12 0 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/></g>`,
  mouse: `<g class="dora-mouse"><ellipse cx="0" cy="0" rx="12" ry="7" fill="#9e9e9e" ${S} stroke-width="1.6"/><circle cx="-9" cy="-6" r="4" fill="#bdbdbd" ${S} stroke-width="1.4"/><circle cx="-12" cy="-1" r="1.2" fill="${INK}"/><path d="M12 0 Q22 -6 26 2" fill="none" stroke="${INK}" stroke-width="1.6"/></g>`,
  notebook: `<g class="dora-item"><rect x="72" y="138" width="56" height="32" rx="3" fill="#fffbe6" ${S} stroke-width="1.8"/><path d="M78 147 L120 147 M78 154 L116 154 M78 161 L110 161" ${L} stroke-width="1.3"/></g>`,
  pen: `<path class="dora-pen" d="M122 142 L134 126" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`,
  door: `<g class="dora-door"><rect x="152" y="58" width="44" height="136" rx="3" fill="#ff7eb6" ${S}/><rect x="158" y="66" width="32" height="120" rx="2" fill="none" stroke="#c2185b" stroke-width="1.6"/><circle cx="186" cy="128" r="3.4" fill="${GOLD}" ${S} stroke-width="1"/></g>`,
  copter: `<g class="dora-copter"><path d="M100 6 L100 -6" ${L}/><ellipse class="dora-blade" cx="100" cy="-7" rx="30" ry="3.6" fill="${GOLD}" ${S}/><circle cx="100" cy="6" r="3.4" fill="${GOLD}" ${S}/></g>`,
};

// sprite: which photo; eyes: paint closed eyes; img: whole-figure transform; fx: overlays; back: behind the figure.
const POSES = {
  idle: { sprite: 'smile' },
  blink: { sprite: 'smile', eyes: true },
  'look-left': { sprite: 'smile' },
  'look-right': { sprite: 'smile' },
  'walk-a': { sprite: 'smile' },
  'walk-b': { sprite: 'smile' },
  roll: { sprite: 'open' },
  'eat-a': { sprite: 'laugh', after: () => dorayaki(100, 98) },
  'eat-b': { sprite: 'laugh', fx: ['hearts'], after: () => dorayaki(100, 98, true) },
  yawn: { sprite: 'surprised', eyes: true },
  snore: { sprite: 'smile', eyes: true, fx: ['zzz', 'snot'] },
  'sit-snore': { sprite: 'smile', eyes: true, img: 'sit', fx: ['zzz'] },
  working: { sprite: 'grumpy', fx: ['notebook', 'pen'] },
  struggle: { sprite: 'surprised', fx: ['sweat'] },
  shy: { sprite: 'laugh' },
  tickle: { sprite: 'open', fx: ['sweat'] },
  angry: { sprite: 'grumpy', fx: ['flush', 'anger'] },
  happy: { sprite: 'laugh', fx: ['hearts'] },
  dizzy: { sprite: 'surprised', fx: ['stars'] },
  surprised: { sprite: 'surprised', fx: ['bang'] },
  wave: { sprite: 'open', fx: ['wavelines', 'note'] },
  huff: { sprite: 'grumpy', fx: ['flush', 'steam'] },
  pound: { sprite: 'grumpy', fx: ['flush', 'anger'] },
  knockdown: { sprite: 'surprised', img: 'lie', knocked: true },
  received: { sprite: 'surprised', fx: ['bang'] },
  complete: { sprite: 'open', fx: ['sparkle'] },
  error: { sprite: 'grumpy', fx: ['sweat'] },
  copter: { sprite: 'open', fx: ['copter'] },
  'pocket-a': { sprite: 'smile' },
  'pocket-b': { sprite: 'open', fx: ['sparkle'], gadget: true },
  door: { sprite: 'smile', back: ['door'] },
  scared: { sprite: 'surprised', fx: ['sweat', 'mouse'] },
  feed: { sprite: 'open', fx: ['hearts'], after: () => dorayaki(100, 92) },
};

export const POSE_NAMES = Object.keys(POSES);
export const GADGETS = [
  { id: 'door', name: '任意门' },
  { id: 'copter', name: '竹蜻蜓' },
  { id: 'light', name: '缩小灯' },
  { id: 'bread', name: '记忆面包' },
];

const svg = (cls, inner) => `<svg class="dora-svg ${cls}" viewBox="0 -12 200 212" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${inner}</svg>`;
const image = sprite => `<image href="${SPRITES[sprite] || SPRITES.smile}" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid meet"/>`;

export function renderPose(name, { gadgetId = 'door' } = {}) {
  const p = POSES[name] || POSES.idle;
  const pick = keys => (keys || []).map(key => extras[key]).join('');
  const figure = `<g class="dora-figure${p.img ? ` dora-figure--${p.img}` : ''}">${image(p.sprite)}${p.eyes ? closedEyes() : ''}</g>`;
  const shadow = p.img === 'lie' ? '' : `<ellipse class="dora-shadow" cx="100" cy="196" rx="46" ry="5" fill="#000" opacity=".14"/>`;
  const knocked = p.knocked ? `<g class="dora-orbit" style="transform-origin:46px 150px">${star(28, 140, 6)}${star(62, 134, 6)}${star(46, 126, 5, '#ffe082')}</g>` : '';
  const item = p.gadget ? gadget(gadgetId, 172, 116) : '';
  return svg(`dora-pose-${name}`, shadow + pick(p.back) + figure + pick(p.fx) + (p.after ? p.after() : '') + item + knocked);
}

// Edge peek: the whole figure is drawn; the pet frame is cropped so only the head pokes out.
export function renderPeek(kind = 'peek') {
  const eyes = kind === 'sleepy' ? closedEyes() : '';
  const hat = kind === 'copter' ? extras.copter : '';
  const snack = kind === 'dorayaki' ? dorayaki(100, 96) : '';
  const zzz = kind === 'sleepy' ? `<g class="dora-zzz"><text x="146" y="40" font-size="18">Z</text><text x="160" y="26" font-size="13">z</text></g>` : '';
  return svg(`dora-peek dora-peek-${kind}`, `<g class="dora-figure">${image(kind === 'dorayaki' ? 'laugh' : 'smile')}${eyes}</g>` + hat + snack + zzz);
}
