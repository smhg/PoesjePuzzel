'use strict';
const CAT_COLORS = [
  { name: 'oranje',  base: '#f3a85e', dark: '#d07c38', light: '#ffd9a8', pattern: 'tabby',   eye: '#6fb36a' },
  { name: 'grijs',   base: '#b5b2c6', dark: '#847f9c', light: '#e2e0ee', pattern: 'tabby',   eye: '#f0b545' },
  { name: 'room',    base: '#f7e7d3', dark: '#d3b48f', light: '#fffaf1', pattern: 'plain',   eye: '#5aa7d6' },
  { name: 'zwart',   base: '#55505f', dark: '#2f2a38', light: '#8a849c', pattern: 'plain',   eye: '#f3c948' },
  { name: 'lapjes',  base: '#f8ecde', dark: '#d8bd9d', light: '#fffbf4', pattern: 'calico',  eye: '#8bc48a' },
  { name: 'siamees', base: '#f2e3cf', dark: '#9a6f4e', light: '#fff8ec', pattern: 'siamese', eye: '#6ab7ea' },
  { name: 'tuxedo',  base: '#56515f', dark: '#302c3a', light: '#8c87a0', pattern: 'tuxedo',  eye: '#9ad58f' },
  { name: 'roze',    base: '#f3bccb', dark: '#d58aa2', light: '#fde4ec', pattern: 'plain',   eye: '#7fb6e8' },
  { name: 'bruin',   base: '#c0916a', dark: '#8a5f3f', light: '#e6c3a0', pattern: 'tabby',   eye: '#8cc9a0' },
  { name: 'lila',    base: '#cdbfe3', dark: '#9b88bf', light: '#ece4fa', pattern: 'plain',   eye: '#f0b545' },
];

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// Begrijpt '#rrggbb' en 'rgb(r,g,b)' (zoals mix() teruggeeft).
function hexToRgb(hex) {
  if (hex[0] !== '#') { const m = hex.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]]; }
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Hoekpunten van de buitenrand(en) van een groep vakjes, met de klok mee (y naar beneden).
// inset trekt de rand naar binnen. Elke lus is een lijst {x, y, convex}.
function outlineLoops(cells, cs, ox, oy, inset) {
  const has = (x, y) => cells.some(c => c.x === x && c.y === y);
  const edges = [];
  for (const c of cells) {
    const X = c.x, Y = c.y;
    if (!has(X, Y - 1)) edges.push({ a: [X, Y], b: [X + 1, Y] });
    if (!has(X + 1, Y)) edges.push({ a: [X + 1, Y], b: [X + 1, Y + 1] });
    if (!has(X, Y + 1)) edges.push({ a: [X + 1, Y + 1], b: [X, Y + 1] });
    if (!has(X - 1, Y)) edges.push({ a: [X, Y + 1], b: [X, Y] });
  }
  const byStart = new Map();
  for (const e of edges) { const k = e.a.join(','); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(e); }
  const used = new Set();
  const loops = [];
  for (const e0 of edges) {
    if (used.has(e0)) continue;
    const loop = []; let e = e0;
    while (e && !used.has(e)) {
      used.add(e); loop.push(e);
      e = (byStart.get(e.b.join(',')) || []).find(x => !used.has(x));
    }
    const verts = [];
    for (let i = 0; i < loop.length; i++) {
      const cur = loop[i], nxt = loop[(i + 1) % loop.length];
      const d1 = [cur.b[0] - cur.a[0], cur.b[1] - cur.a[1]], d2 = [nxt.b[0] - nxt.a[0], nxt.b[1] - nxt.a[1]];
      if (d1[0] === d2[0] && d1[1] === d2[1]) continue;
      const cross = d1[0] * d2[1] - d1[1] * d2[0];
      const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
      verts.push({ x: ox + cur.b[0] * cs + inset * (n1[0] + n2[0]), y: oy + cur.b[1] * cs + inset * (n1[1] + n2[1]), convex: cross > 0 });
    }
    if (verts.length >= 3) loops.push(verts);
  }
  return loops;
}

// Tekent de buitenrand van een groep vakjes als één vloeiende, afgeronde vorm.
// Bolle hoeken worden rond met rOut, holle hoeken met rIn; inset trekt de rand naar binnen.
function outlinePath(ctx, cells, cs, ox, oy, inset, rOut, rIn) {
  for (const verts of outlineLoops(cells, cs, ox, oy, inset)) {
    const N = verts.length;
    const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    ctx.moveTo((verts[N - 1].x + verts[0].x) / 2, (verts[N - 1].y + verts[0].y) / 2);
    for (let i = 0; i < N; i++) {
      const pv = verts[(i + N - 1) % N], v = verts[i], nv = verts[(i + 1) % N];
      const r = Math.min(v.convex ? rOut : rIn, dist(pv, v) / 2, dist(v, nv) / 2);
      ctx.arcTo(v.x, v.y, nv.x, nv.y, r);
    }
    ctx.closePath();
  }
}

// Punten met buitennormaal langs diezelfde afgeronde buitenrand, ongeveer 'step' uit elkaar.
// Hierlangs komen de plukjes vacht.
function outlineSamples(cells, cs, ox, oy, inset, rOut, rIn, step) {
  const out = [];
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  for (const verts of outlineLoops(cells, cs, ox, oy, inset)) {
    const N = verts.length;
    const corners = verts.map((v, i) => {
      const pv = verts[(i + N - 1) % N], nv = verts[(i + 1) % N];
      const d1 = dist(pv, v) || 1, d2 = dist(v, nv) || 1;
      const r = Math.min(v.convex ? rOut : rIn, d1 / 2, d2 / 2);
      const u1 = { x: (pv.x - v.x) / d1, y: (pv.y - v.y) / d1 }, u2 = { x: (nv.x - v.x) / d2, y: (nv.y - v.y) / d2 };
      return {
        r, convex: v.convex,
        a: { x: v.x + u1.x * r, y: v.y + u1.y * r }, b: { x: v.x + u2.x * r, y: v.y + u2.y * r },
        c: { x: v.x + (u1.x + u2.x) * r, y: v.y + (u1.y + u2.y) * r },
      };
    });
    for (let i = 0; i < N; i++) {
      const prev = corners[(i + N - 1) % N], cur = corners[i];
      // recht stuk
      const dx = cur.a.x - prev.b.x, dy = cur.a.y - prev.b.y, len = Math.hypot(dx, dy);
      if (len > 1e-6) {
        const nx = dy / len, ny = -dx / len;
        const n = Math.max(1, Math.round(len / step));
        for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; out.push({ x: prev.b.x + dx * t, y: prev.b.y + dy * t, nx, ny }); }
      }
      // boogje om de hoek
      if (cur.r > 1e-6) {
        const a0 = Math.atan2(cur.a.y - cur.c.y, cur.a.x - cur.c.x);
        let da = Math.atan2(cur.b.y - cur.c.y, cur.b.x - cur.c.x) - a0;
        while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const n = Math.max(1, Math.round(Math.abs(da) * cur.r / step));
        const s = cur.convex ? 1 : -1;
        for (let k = 0; k < n; k++) {
          const ang = a0 + da * (k + 0.5) / n;
          out.push({ x: cur.c.x + Math.cos(ang) * cur.r, y: cur.c.y + Math.sin(ang) * cur.r, nx: Math.cos(ang) * s, ny: Math.sin(ang) * s });
        }
      }
    }
  }
  return out;
}

// Punten met buitennormaal rondom een ellips.
function ellipseSamples(cx, cy, rx, ry, step) {
  const out = [];
  const n = Math.max(8, Math.round(Math.PI * (rx + ry) / step));
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
    let nx = x / rx, ny = y / ry; const l = Math.hypot(nx, ny) || 1;
    out.push({ x: cx + x * rx, y: cy + y * ry, nx: nx / l, ny: ny / l });
  }
  return out;
}

// Eén plukje vacht: een smal, licht gebogen driehoekje vanaf (x,y) in richting (nx,ny).
// Voegt alleen toe aan het huidige pad (zodat veel plukjes in één fill kunnen).
function tuft(ctx, x, y, nx, ny, len, w, bend) {
  const px = -ny, py = nx;
  const tx = x + nx * len + px * bend, ty = y + ny * len + py * bend;
  const mx = x + nx * len * 0.5 + px * bend * 0.3, my = y + ny * len * 0.5 + py * bend * 0.3;
  ctx.moveTo(x + px * w / 2, y + py * w / 2);
  ctx.quadraticCurveTo(mx + px * w * 0.22, my + py * w * 0.22, tx, ty);
  ctx.quadraticCurveTo(mx - px * w * 0.22, my - py * w * 0.22, x - px * w / 2, y - py * w / 2);
  ctx.closePath();
}

// Pluizige rand rond een vorm: drie lagen plukjes (schaduwtint, basiskleur, lichte topjes).
// samples: punten met buitennormaal; opt.len(s) geeft per punt een lengtefactor (voor wangetjes),
// opt.scale schaalt alles (pootjes).
function furEdge(ctx, samples, cols, seed, cs, opt = {}) {
  const sc = opt.scale || 1, lenFn = opt.len || null;
  const layer = (color, lenMul, wMul, every, salt, filter) => {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < samples.length; i += every) {
      const s = samples[i];
      if (filter && !filter(s)) continue;
      const m = lenFn ? lenFn(s, i) : 1;
      const r1 = seeded(seed + salt + i * 4.7), r2 = seeded(seed + salt + i * 9.3 + 1), r3 = seeded(seed + salt + i * 2.9 + 2);
      const len = cs * (0.04 + 0.06 * r1) * lenMul * m * sc;
      const w = cs * (0.05 + 0.04 * r2) * wMul * Math.sqrt(m) * sc;
      // plukjes hangen een tikje naar beneden
      let nx = s.nx, ny = s.ny + 0.3; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
      const root = cs * 0.04 * sc;
      tuft(ctx, s.x - s.nx * root, s.y - s.ny * root, nx, ny, len + root, w, (r3 - 0.5) * len * 0.9);
    }
    ctx.fill();
  };
  layer(rgba(cols.dark, 0.26), 1.0, 1.4, 1, 0, null);
  layer(rgba(cols.base, 0.85), 0.9, 1.1, 1, 500, null);
  layer(rgba(cols.base, 0.6), 0.7, 0.9, 1, 700, null);
  layer(rgba(cols.light, 0.5), 0.6, 0.75, 2, 900, s => s.ny < 0.25);
}

// Korte zachte haartjes binnenin een vorm: lichte op de bovenkant, donkere op de onderkant.
// items: {x, y, dx, dy, light}
function hairs(ctx, items, cs, lightCol, darkCol, lightA, darkA) {
  ctx.lineCap = 'round'; ctx.lineWidth = cs * 0.03;
  for (const [color, light] of [[rgba(lightCol, lightA), true], [rgba(darkCol, darkA), false]]) {
    ctx.strokeStyle = color; ctx.beginPath();
    for (const h of items) {
      if (h.light !== light) continue;
      ctx.moveTo(h.x, h.y);
      ctx.quadraticCurveTo(h.x + h.dx * 0.5 + h.dy * 0.15, h.y + h.dy * 0.5 - h.dx * 0.15, h.x + h.dx, h.y + h.dy);
    }
    ctx.stroke();
  }
}

// Heel fijne korrel over de vacht (soft-light), één keer aangemaakt.
let FUR_GRAIN = null;
function furGrain(ctx) {
  if (!FUR_GRAIN) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const img = g.createImageData(64, 64);
    for (let i = 0; i < 64 * 64; i++) {
      const v = 96 + Math.floor(seeded(i + 0.5) * 64);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0); FUR_GRAIN = c;
  }
  return ctx.createPattern(FUR_GRAIN, 'repeat');
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
// Voorspelbare 'willekeur' per vakje, zodat strepen niet flikkeren.
function seeded(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

class Cat {
  constructor(cells, colorIdx, cs) {
    this.cs = cs;
    this.color = CAT_COLORS[colorIdx % CAT_COLORS.length];
    this.cells = cells.map(c => ({ x: c.x, y: c.y }));
    this.normalize();
    this.pos = { x: 0, y: 0 };
    this.prev = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.placed = false; this.gx = 0; this.gy = 0;
    this.held = false;
    this.state = 'idle';        // idle | held | walking | stretching | sleeping
    this.stateTime = 0;
    this.idleTime = Levels.rnd(-20, 0);
    this.sleepAfter = Levels.rnd(18, 45);
    this.pitch = Levels.rnd(0.85, 1.25);
    this.seed = Math.floor(Math.random() * 1000);
    // iedere poes haar eigen staart: een vraagteken-haakje of een krul om zich heen (nooit bijna recht),
    // welke kant op, hoe laat de krul begint, een lichte S, lengte en dikte; plus vaste plukjes pluis
    const side = Math.random() < 0.5 ? -1 : 1;
    this.tail = {
      curl: Levels.rnd(2.0, 3.1) * side, k: Levels.rnd(1.3, 2.4), wave: Levels.rnd(0, 0.4) * -side,
      len: Levels.rnd(0.85, 1.1), thick: Levels.rnd(0.9, 1.15),
      fuzz: Array.from({ length: 18 }, (_, i) => ({
        u: 0.12 + 0.86 * seeded(this.seed + i * 3.3), side: i % 2 ? 1 : -1,
        len: 0.5 + seeded(this.seed + i * 7.1) * 0.8, w: 0.6 + seeded(this.seed + i * 11.7) * 0.5,
        bend: seeded(this.seed + i * 5.9) - 0.5,
      })),
    };
    this.anim = {
      sx: 1, sy: 1, squash: 0, squashV: 0, lift: 0, headDx: 0, headDy: 0,
      earTwitch: 0, earL: 0, earR: 0, blink: 0, nextBlink: Levels.rnd(1, 5), tailPhase: Levels.rnd(0, 6.28),
      lookX: 0, lookY: 0, attn: 0, sniff: 0, nextSniff: Levels.rnd(3, 10), sniffPhase: 0,
      tongue: 0, tongueX: 0, tongueMode: null, tongueT: 0, nextTongue: Levels.rnd(12, 40), lickIn: -1,
      shake: 0, grump: 0, grumpT: 0,
      walkPhase: 0, rot: 0, wag: 0, stretch: 0, tailAct: 0, tailFlick: 0, nextFlick: Levels.rnd(4, 16), breath: 0,
    };
    this.walkTarget = null;
    this.bubble = null;
    this.curiosity = Levels.rnd(0.25, 0.65);   // hoe snel deze poes ergens naar kijkt
    this.wasPlaced = false;
    this.attnEvent = null;                      // waar ze nu naar kijkt (bron van interesse)
    this.zzzTimer = 0;
    this.fur = null;            // cache van de vacht (lijfje + kop), zie ensureFur()
    this.drawScale = 1;
    this.computeFeatures();
  }

  normalize() {
    const mx = Math.min(...this.cells.map(c => c.x)), my = Math.min(...this.cells.map(c => c.y));
    this.cells.forEach(c => { c.x -= mx; c.y -= my; });
    this.cols = Math.max(...this.cells.map(c => c.x)) + 1;
    this.rows = Math.max(...this.cells.map(c => c.y)) + 1;
  }
  has(x, y) { return this.cells.some(c => c.x === x && c.y === y); }
  neighbours(c) { return Levels.DIRS.filter(([dx, dy]) => this.has(c.x + dx, c.y + dy)); }
  freeSides(c) { return Levels.DIRS.filter(([dx, dy]) => !this.has(c.x + dx, c.y + dy)); }

  computeFeatures() {
    const cells = this.cells;
    const ends = cells.map((c, i) => [c, i]).filter(([c]) => this.neighbours(c).length === 1);
    let headIdx;
    if (cells.length === 1) headIdx = 0;
    else if (ends.length) {
      // kies het liefst een kop die onderaan of opzij zit, dat kijkt gezelliger
      ends.sort((a, b) => (b[0].y - a[0].y) + (Math.random() - 0.5));
      headIdx = ends[0][1];
    } else headIdx = Math.floor(Math.random() * cells.length);
    this.headIdx = headIdx;
    const h = cells[headIdx];
    const nb = this.neighbours(h);
    if (cells.length === 1) this.facing = { x: 0, y: 1 };
    else if (nb.length === 1) this.facing = { x: -nb[0][0], y: -nb[0][1] };
    else {
      const fs = this.freeSides(h);
      const down = fs.find(([dx, dy]) => dy === 1) || fs[0] || [0, 1];
      this.facing = { x: down[0], y: down[1] };
    }
    // staart: het vakje het verst van de kop
    let best = headIdx, bestD = -1;
    cells.forEach((c, i) => {
      const d = Math.abs(c.x - h.x) + Math.abs(c.y - h.y) + Math.random() * 0.5;
      if (i !== headIdx && d > bestD) { bestD = d; best = i; }
    });
    this.tailIdx = cells.length === 1 ? 0 : best;
    const t = cells[this.tailIdx];
    const fs = this.freeSides(t);
    let dir = fs[0] || [0, -1];
    if (cells.length > 1) {
      // liefst van de kop af
      fs.sort((a, b) => ((b[0] * (t.x - h.x) + b[1] * (t.y - h.y)) - (a[0] * (t.x - h.x) + a[1] * (t.y - h.y))));
      dir = fs[0] || dir;
    } else dir = [1, 0];
    this.tailDir = { x: dir[0], y: dir[1] };
  }

  rotate() {
    const c0 = this.center();
    this.cells = this.cells.map(c => ({ x: -c.y, y: c.x }));
    this.normalize();
    this.facing = { x: -this.facing.y, y: this.facing.x };
    this.tailDir = { x: -this.tailDir.y, y: this.tailDir.x };
    const c1 = this.center();
    this.pos.x += c0.x - c1.x; this.pos.y += c0.y - c1.y;
    this.anim.squash = 0.06; this.anim.squashV = 0.4;
    this.anim.earTwitch = 1;
    this.fur = null;            // vorm veranderd: vacht opnieuw tekenen
  }

  get width() { return this.cols * this.cs; }
  get height() { return this.rows * this.cs; }
  center() { return { x: this.pos.x + this.width / 2, y: this.pos.y + this.height / 2 }; }
  get bottom() { return this.pos.y + this.height; }
  cellRect(c) { return { x: this.pos.x + c.x * this.cs, y: this.pos.y + c.y * this.cs, w: this.cs, h: this.cs }; }
  cellCenter(c) { return { x: this.pos.x + (c.x + 0.5) * this.cs, y: this.pos.y + (c.y + 0.5) * this.cs }; }
  containsPoint(px, py) {
    const m = this.cs * 0.1;
    return this.cells.some(c => {
      const r = this.cellRect(c);
      return px >= r.x - m && px <= r.x + r.w + m && py >= r.y - m && py <= r.y + r.h + m;
    });
  }
  bbox(shrink = 0) {
    return { x: this.pos.x + shrink, y: this.pos.y + shrink, w: this.width - 2 * shrink, h: this.height - 2 * shrink };
  }

  // --- gedrag ------------------------------------------------------------
  pickUp() {
    this.held = true; this.placed = false; this.state = 'held'; this.stateTime = 0;
    this.walkTarget = null; this.idleTime = 0; this.bubble = null;
    this.anim.squash = -0.05; this.anim.squashV = 0;
  }
  drop() {
    this.held = false; this.state = 'idle'; this.stateTime = 0; this.idleTime = 0;
    this.sleepAfter = Levels.rnd(18, 45);
    this.anim.squash = 0.09; this.anim.squashV = 0;
  }
  walkTo(target, withStretch = false) {
    this.walkTarget = target; this.placed = false; this.idleTime = 0;
    this.preKind = withStretch ? 'stretch' : 'huh';          // eerst even rekken, of een vragend kopje
    this.preDur = withStretch ? 0.9 : 0.45;
    this.state = 'stretching'; this.stateTime = 0;
    this.anim.earTwitch = 1;
    this.hop = null;
  }
  // huppelend naar de bestemming: een paar sprongetjes langs een lichte boog
  startHops() {
    const cs = this.cs, p0 = { x: this.pos.x, y: this.pos.y }, p1 = this.walkTarget;
    const d = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const side = Math.random() < 0.5 ? -1 : 1;
    const px = -(p1.y - p0.y) / d, py = (p1.x - p0.x) / d;
    const bow = d * Levels.rnd(0.12, 0.3) * side;
    this.hop = {
      p0, p1, c: { x: (p0.x + p1.x) / 2 + px * bow, y: (p0.y + p1.y) / 2 + py * bow },
      n: clamp(Math.round(d / (cs * 1.5)), 2, 5), i: 0, t: -0.05, dur: 0.36, pause: 0.1, side,
    };
    this.state = 'walking'; this.stateTime = 0;
  }
  say() { /* geen tekstwolkjes; de poezen laten alleen een geluidje horen */ }
  wake() {
    if (this.state === 'sleeping') { this.state = 'idle'; this.stateTime = 0; }
    this.idleTime = 0; this.sleepAfter = Levels.rnd(18, 45);
  }

  update(dt, t, game) {
    const a = this.anim;
    this.stateTime += dt;
    // snelheid
    const vx = (this.pos.x - this.prev.x) / Math.max(dt, 1e-3), vy = (this.pos.y - this.prev.y) / Math.max(dt, 1e-3);
    // schudden: snelle richtingwisselingen terwijl ze gedragen wordt maken haar even boos
    const pvx = this.vel.x, pvy = this.vel.y;
    this.vel.x = lerp(this.vel.x, vx, Math.min(1, dt * 12));
    this.vel.y = lerp(this.vel.y, vy, Math.min(1, dt * 12));
    this.prev.x = this.pos.x; this.prev.y = this.pos.y;
    const speed = Math.hypot(this.vel.x, this.vel.y);
    const jerk = Math.hypot(this.vel.x - pvx, this.vel.y - pvy) / Math.max(dt, 1e-3);
    a.shake = a.shake * Math.exp(-dt * 1.6) + (this.held ? jerk * dt * 0.00009 : 0);
    if (a.shake > 1 && a.grumpT <= 0) {
      a.grumpT = 3.2; a.shake = 0.3;
      if (typeof Sound !== 'undefined') { Sound.purrStop(0.2); Sound.mrrp(this.pitch, 'grr'); }
    }
    if (a.grumpT > 0) { a.grumpT -= dt; if (a.grumpT <= 0 && this.held && typeof Sound !== 'undefined') Sound.purrStart(this.pitch); }
    a.grump = lerp(a.grump, a.grumpT > 0 ? 1 : 0, Math.min(1, dt * (a.grumpT > 0 ? 8 : 2.5)));

    // wiebelen bij bewegen: uitrekken in de bewegingsrichting
    const k = 0.00003;
    let tsx = 1 + Math.abs(this.vel.x) * k - Math.abs(this.vel.y) * k * 0.5;
    let tsy = 1 + Math.abs(this.vel.y) * k - Math.abs(this.vel.x) * k * 0.5;
    tsx = clamp(tsx, 0.96, 1.05); tsy = clamp(tsy, 0.96, 1.05);
    a.sx = lerp(a.sx, tsx, Math.min(1, dt * 8));
    a.sy = lerp(a.sy, tsy, Math.min(1, dt * 8));
    const hd = this.cs * 0.07;
    a.headDx = lerp(a.headDx, clamp(-this.vel.x * 0.025, -hd, hd), Math.min(1, dt * 7));
    a.headDy = lerp(a.headDy, clamp(-this.vel.y * 0.025, -hd, hd), Math.min(1, dt * 7));
    a.wag = lerp(a.wag, clamp(speed / 600, 0, 1), Math.min(1, dt * 4));
    // de staart zwaait alleen als de poes gedragen wordt of loopt; in rust ligt hij stil met af en toe een tik
    const active = this.held || this.state === 'walking' || this.state === 'stretching';
    a.tailAct = lerp(a.tailAct, active ? 1 : 0, Math.min(1, dt * (active ? 5 : 1.2)));
    a.tailPhase += dt * (1.6 + a.wag * 1.4) * a.tailAct;
    a.tailFlick = Math.max(0, a.tailFlick - dt / 1.8);
    a.nextFlick -= dt;
    if (a.nextFlick <= 0) { a.nextFlick = Levels.rnd(8, 24); if (!active && this.state !== 'sleeping') a.tailFlick = 1; }

    // veertje voor het pletten/stuiteren
    a.squashV += (-a.squash * 160 - a.squashV * 18) * dt;
    a.squash += a.squashV * dt;

    a.lift = lerp(a.lift, this.held ? 1 : 0, Math.min(1, dt * 9));

    // knipperen & oortjes
    a.nextBlink -= dt;
    if (a.nextBlink <= 0) { a.blink = 1; a.nextBlink = Levels.rnd(2.5, 6.5); }
    a.blink = Math.max(0, a.blink - dt * 7);
    if (a.earTwitch > 0.99) { const w = Math.random(); if (w < 0.4) a.earR = 1; else if (w < 0.8) a.earL = 1; else { a.earL = 1; a.earR = 1; } }
    if (this.state !== 'sleeping' && Math.random() < dt * 0.55) { const w = Math.random(); if (w < 0.4) a.earR = 1; else if (w < 0.8) a.earL = 1; else { a.earL = 1; a.earR = 1; } }
    a.earTwitch = Math.max(0, a.earTwitch - dt * 4);
    a.earL = Math.max(0, a.earL - dt * 4.5); a.earR = Math.max(0, a.earR - dt * 4.5);
    // snuffelen: korte buien waarin het neusje trilt en de snorharen meebewegen; vaker als ze ergens naar kijkt
    a.nextSniff -= dt * (1 + a.attn * 2.5) * (this.state === 'sleeping' ? 0.15 : 1);
    if (a.nextSniff <= 0) { a.sniff = 1; a.nextSniff = Levels.rnd(5, 14); }
    if (a.sniff > 0) { a.sniff = Math.max(0, a.sniff - dt / 0.7); a.sniffPhase += dt * 42; }

    // tongetje: af en toe een 'blep' (puntje tong blijft even uitsteken) en na het neerleggen soms een likje
    if (this.placed && !this.wasPlaced && Math.random() < 0.45) a.lickIn = Levels.rnd(0.5, 1.2);
    this.wasPlaced = this.placed;
    if (a.lickIn >= 0) { a.lickIn -= dt; if (a.lickIn < 0 && !a.tongueMode) { a.tongueMode = 'lick'; a.tongueT = 0; } }
    if (!a.tongueMode && this.state !== 'sleeping' && !this.held) {
      a.nextTongue -= dt;
      if (a.nextTongue <= 0) { a.nextTongue = Levels.rnd(25, 70); a.tongueMode = Math.random() < 0.7 ? 'blep' : 'lick'; a.tongueT = 0; a.blepDur = Levels.rnd(2, 5); }
    }
    if (a.tongueMode === 'blep') {
      a.tongueT += dt;
      const d = a.blepDur || 3;
      a.tongue = a.tongueT < 0.3 ? a.tongueT / 0.3 : a.tongueT > d - 0.3 ? Math.max(0, (d - a.tongueT) / 0.3) : 1;
      a.tongueX = Math.sin(a.tongueT * 1.3) * 0.15;
      if (this.held || a.tongueT >= d) { a.tongueMode = null; a.tongue = 0; }
    } else if (a.tongueMode === 'lick') {
      a.tongueT += dt;
      const u = a.tongueT / 0.55;                       // tong komt uit, veegt opzij over het mondje en gaat weer naar binnen
      a.tongue = Math.sin(Math.min(1, u) * Math.PI);
      a.tongueX = Math.cos(Math.min(1, u) * Math.PI) * -0.9;
      if (u >= 1) { a.tongueMode = null; a.tongue = 0; }
    } else a.tongue = Math.max(0, a.tongue - dt * 4);

    // interesse: kijkt deze poes naar iets dat gebeurt (een poes die gedragen wordt of huppelt)?
    const ev = game && game.interest;
    if (ev && ev.source !== this && this.state !== 'sleeping' && !this.held) {
      if (!this.attnEvent || this.attnEvent.id !== ev.id) {
        const hp = this.headPos();
        const dist = Math.hypot(ev.x - hp.x, ev.y - hp.y);
        // ieder voor zich: niet allemaal tegelijk, en niet van heel ver
        const yes = dist < 520 && Math.random() < this.curiosity;
        this.attnEvent = { id: ev.id, yes, delay: Levels.rnd(0.15, 0.7), t: 0 };
      }
      this.attnEvent.t += dt;
      if (this.attnEvent.yes && this.attnEvent.t > this.attnEvent.delay) {
        if (a.attn < 0.05) { a.earL = 1; a.earR = 1; }           // oortjes spitsen: 'hé, wat is dat?'
        a.attn = lerp(a.attn, 1, Math.min(1, dt * 5));
        this.attnTarget = { x: ev.x, y: ev.y };
      }
    } else {
      a.attn = lerp(a.attn, 0, Math.min(1, dt * 1.6));
      if (a.attn < 0.02 && this.attnEvent && !(ev && ev.id === this.attnEvent.id)) this.attnEvent = null;
    }
    if (this.attnTarget) {
      const hp = this.headPos();
      const dx = this.attnTarget.x - hp.x, dy = this.attnTarget.y - hp.y, dd = Math.hypot(dx, dy) || 1;
      a.lookX = lerp(a.lookX, dx / dd * a.attn, Math.min(1, dt * 5));
      a.lookY = lerp(a.lookY, dy / dd * a.attn, Math.min(1, dt * 5));
    }

    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }

    // toestanden; ademen/waggelen wordt hier gezet (niet opgeteld) en pas in draw() toegepast,
    // anders stapelt het via de lerp van a.sy op tot een flink groeien en krimpen
    a.breath = 0;
    a.hop = 0;
    if (this.state === 'stretching') {
      const dur = this.preDur || 0.9, prog = Math.min(1, this.stateTime / dur);
      if (this.preKind === 'huh') {
        // vragend kopje: even scheef, oortje trilt
        a.rot = Math.sin(prog * Math.PI) * 0.11 * (this.seed % 2 ? 1 : -1);
      } else {
        a.stretch = Math.sin(prog * Math.PI);
      }
      if (this.stateTime > dur) { a.stretch = 0; a.rot = 0; if (this.walkTarget) this.startHops(); else { this.state = 'idle'; this.stateTime = 0; } }
    } else if (this.state === 'walking' && this.walkTarget) {
      if (!this.hop) this.startHops();
      const h = this.hop;
      h.t += dt;
      if (h.t >= 0) {
        const u = Math.min(1, h.t / h.dur), e = u * u * (3 - 2 * u);
        const sTot = (h.i + e) / h.n, v = 1 - sTot;
        this.pos.x = v * v * h.p0.x + 2 * v * sTot * h.c.x + sTot * sTot * h.p1.x;
        this.pos.y = v * v * h.p0.y + 2 * v * sTot * h.c.y + sTot * sTot * h.p1.y;
        a.hop = Math.sin(u * Math.PI) * this.cs * 0.3;
        a.rot = Math.sin(u * Math.PI) * 0.07 * (h.i % 2 ? -h.side : h.side);
        if (u >= 1) {
          // landen: plofje, stofwolkjes, even wachten voor de volgende sprong
          a.squash = 0.07; a.hop = 0; a.rot = 0;
          if (game && game.spawnPuff) { const c = this.center(); game.spawnPuff(c.x, this.bottom - this.cs * 0.1); }
          h.i++; h.t = -h.pause;
          if (h.i >= h.n) {
            this.pos.x = h.p1.x; this.pos.y = h.p1.y;
            this.walkTarget = null; this.hop = null; this.state = 'idle'; this.stateTime = 0;
            a.squash = 0.09; a.earTwitch = 1;
          }
        }
      }
    } else if (this.state === 'idle') {
      a.rot = lerp(a.rot, 0, Math.min(1, dt * 6));
      // dicht tegen een andere poes aan word je sneller slaperig; naast een slapende poes nog sneller
      let snug = 1;
      if (game && game.cats) {
        const bb = this.bbox(-this.cs * 0.35);
        for (const o of game.cats) {
          if (o === this || o.held || o.state === 'walking' || o.state === 'stretching') continue;
          const ob = o.bbox();
          if (bb.x < ob.x + ob.w && bb.x + bb.w > ob.x && bb.y < ob.y + ob.h && bb.y + bb.h > ob.y) snug = Math.max(snug, o.state === 'sleeping' ? 4.5 : 3);
        }
      }
      this.idleTime += dt * snug;
      if (this.idleTime > this.sleepAfter) { this.state = 'sleeping'; this.stateTime = 0; this.zzzTimer = 0.5; }
    } else if (this.state === 'sleeping') {
      a.breath = Math.sin(this.stateTime * 1.6) * 0.008;
      this.zzzTimer -= dt;
      if (this.zzzTimer <= 0 && game) {
        this.zzzTimer = Levels.rnd(1.2, 2.2);
        const hc = this.headPos();
        game.spawnZzz(hc.x + this.cs * 0.35, hc.y - this.cs * 0.45);
      }
    } else if (this.state === 'held') {
      a.rot = lerp(a.rot, clamp(this.vel.x * 0.00012, -0.1, 0.1), Math.min(1, dt * 6));
    }
  }

  headPos() {
    const h = this.cells[this.headIdx];
    const hc = this.cellCenter(h);
    return {
      x: hc.x + this.facing.x * this.cs * 0.12 + this.anim.headDx,
      y: hc.y + this.facing.y * this.cs * 0.12 + this.anim.headDy - this.cs * 0.04 - this.anim.lift * 14,
    };
  }

  // --- tekenen -----------------------------------------------------------
  tracePath(ctx, inset, ox = 0, oy = 0) {
    const cs = this.cs;
    ctx.beginPath();
    outlinePath(ctx, this.cells, cs, this.pos.x + ox, this.pos.y + oy, inset, (cs - 2 * inset) * 0.46, cs * 0.24);
  }

  drawShadow(ctx) {
    const a = this.anim, lift = Math.min(1, a.lift + (a.hop || 0) / (this.cs * 0.3) * 0.6);
    const f = this.fur;
    if (f && f.shadow) {
      // gecachete, al vervaagde schaduw stempelen; bij optillen iets groter, lichter en verder weg
      const grow = 1 + lift * 0.1, dx = 4 + lift * 10, dy = 7 + lift * 22;
      ctx.save();
      ctx.globalAlpha = 0.3 - lift * 0.12;
      ctx.drawImage(f.shadow, this.pos.x - f.SM + dx - (grow - 1) * f.sw / 2, this.pos.y - f.SM + dy - (grow - 1) * f.sh / 2, f.sw * grow, f.sh * grow);
      ctx.restore();
      return;
    }
    // zonder cache (zou niet moeten voorkomen): de oude manier
    const S = ctx.getTransform ? ctx.getTransform().a : 1;
    const OFF = 4000;
    ctx.save();
    ctx.shadowColor = `rgba(70,35,45,${0.28 - lift * 0.1})`;
    ctx.shadowBlur = (10 + lift * 18) * S;
    ctx.shadowOffsetX = (OFF + 4 + lift * 10) * S;
    ctx.shadowOffsetY = (7 + lift * 22) * S;
    ctx.fillStyle = '#000';
    this.tracePath(ctx, this.cs * 0.1, -OFF, 0);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx, t) {
    const a = this.anim, cs = this.cs, col = this.color;
    const c = this.center();
    // schaal van het scherm (voor de resolutie van de vachtcache), gemeten vóór het pletten/draaien
    if (ctx.getTransform) { const m = ctx.getTransform(); this.drawScale = Math.hypot(m.a, m.b) || 1; }
    this.ensureFur(this.drawScale);
    this.drawShadow(ctx);

    ctx.save();
    const sq = a.squash;
    const stretch = a.stretch || 0;
    const s = 1 + a.lift * 0.04;
    ctx.translate(c.x, c.y - a.lift * 14 - (a.hop || 0));
    ctx.rotate(a.rot);
    ctx.scale(a.sx * s * (1 - sq * 0.6) * (1 + stretch * 0.06) * (1 - a.breath * 0.5), a.sy * s * (1 + sq) * (1 - stretch * 0.03) * (1 + a.breath));
    ctx.translate(-c.x, -c.y);

    this.drawTail(ctx, t);
    this.drawBody(ctx);
    this.drawHead(ctx, t);
    ctx.restore();
  }

  // --- vachtcache ----------------------------------------------------------
  // De pluizige vacht (honderden plukjes en haartjes) is te duur om elk beeldje te tekenen.
  // Daarom tekenen we lijfje en kop één keer op eigen canvasjes, op schermresolutie, en
  // plakken die elk beeldje. Opnieuw tekenen bij een andere vorm/kijkrichting (draaien) of
  // als de schermschaal flink verandert. Oogjes, oortjes, staart, pootjes-wiebel en de
  // plet-/til-animatie blijven gewoon live.
  // cache-bitmaps meteen vrijgeven (bij een nieuwe puzzel), zonder op de garbage collector te wachten
  dispose() {
    const f = this.fur; this.fur = null;
    if (!f) return;
    for (const cv of [f.body, f.head, f.shadow]) if (cv) { cv.width = 0; cv.height = 0; }
  }
  furKey() {
    return this.cells.map(c => c.x + ',' + c.y).join(';') + '|' + this.headIdx + '|' + this.facing.x + ',' + this.facing.y;
  }
  ensureFur(S) {
    S = clamp(S || 1, 0.5, 4);
    const key = this.furKey();
    const f = this.fur;
    if (f && f.key === key && Math.abs(f.S / S - 1) < 0.12) return f;
    const cs = this.cs, M = cs * 0.26;
    // lijfje, in lokale coördinaten t.o.v. pos
    const bw = this.width + 2 * M, bh = this.height + 2 * M;
    const body = document.createElement('canvas');
    body.width = Math.ceil(bw * S); body.height = Math.ceil(bh * S);
    const bc = body.getContext('2d');
    bc.scale(S, S); bc.translate(M - this.pos.x, M - this.pos.y);
    this.paintBody(bc);
    // kop (met pootjes), met het middelpunt van de kop als oorsprong
    const r = cs * 0.44, hr = r * 1.75;
    const head = document.createElement('canvas');
    head.width = head.height = Math.ceil(hr * 2 * S);
    const hc = head.getContext('2d');
    hc.scale(S, S); hc.translate(hr, hr);
    this.paintHead(hc);
    // schaduw: één keer vervagen en daarna alleen nog stempelen (blur per frame is duur op tablets)
    const SM = cs * 0.5, sw = this.width + 2 * SM, sh = this.height + 2 * SM;
    const shadow = document.createElement('canvas');
    shadow.width = Math.ceil(sw * S); shadow.height = Math.ceil(sh * S);
    const sc = shadow.getContext('2d');
    sc.scale(S, S); sc.translate(SM - this.pos.x, SM - this.pos.y);
    sc.shadowColor = 'rgba(70,35,45,1)'; sc.shadowBlur = 12 * S; sc.shadowOffsetX = 4000 * S;
    sc.fillStyle = '#000'; this.tracePath(sc, cs * 0.1, -4000, 0); sc.fill();
    this.fur = { key, S, body, M, bw, bh, head, hr, shadow, SM, sw, sh };
    return this.fur;
  }

  // Het lijfje met vacht, in absolute coördinaten (de cache-context is verschoven).
  paintBody(c) {
    const cs = this.cs, col = this.color, inset = cs * 0.06, seed = this.seed;
    const edgeDark = mix(col.base, col.dark, 0.35);
    // zachte waas om de rand heen
    c.fillStyle = rgba(col.base, 0.28); this.tracePath(c, inset - cs * 0.05); c.fill();
    c.fillStyle = rgba(col.base, 0.5); this.tracePath(c, inset - cs * 0.025); c.fill();
    // plukjes langs de rand
    const samples = outlineSamples(this.cells, cs, this.pos.x, this.pos.y, inset, (cs - 2 * inset) * 0.46, cs * 0.24, cs * 0.03);
    furEdge(c, samples, { dark: edgeDark, base: col.base, light: col.light }, seed, cs);
    // het lijfje zelf
    c.save();
    this.tracePath(c, inset);
    c.fillStyle = col.base; c.fill();
    c.clip();
    // volume per vakje
    for (const cell of this.cells) {
      const cc = this.cellCenter(cell);
      const g = c.createRadialGradient(cc.x - cs * 0.14, cc.y - cs * 0.2, cs * 0.05, cc.x, cc.y, cs * 0.72);
      g.addColorStop(0, rgba(col.light, 0.5));
      g.addColorStop(0.65, rgba(col.light, 0.08));
      g.addColorStop(1, rgba(col.light, 0));
      c.fillStyle = g;
      c.fillRect(cc.x - cs, cc.y - cs, cs * 2, cs * 2);
    }
    // donkerder naar onderen
    const bb = this.bbox();
    const lg = c.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
    lg.addColorStop(0, rgba(col.dark, 0));
    lg.addColorStop(1, rgba(col.dark, 0.26));
    c.fillStyle = lg; c.fillRect(bb.x - 10, bb.y - 10, bb.w + 20, bb.h + 20);
    this.drawPattern(c);
    // zachte haartjes: boven licht, onder donker, ze liggen van het midden af en een beetje omlaag
    const items = [];
    this.cells.forEach((cell, i) => {
      const cc = this.cellCenter(cell);
      for (let k = 0; k < 64; k++) {
        const r1 = seeded(seed + i * 101 + k * 3.1), r2 = seeded(seed + i * 57 + k * 7.7 + 1), r3 = seeded(seed + i * 23 + k * 1.3 + 2), r4 = seeded(seed + i * 11 + k * 5.5 + 3);
        const x = cc.x + (r1 - 0.5) * cs * 0.94, y = cc.y + (r2 - 0.5) * cs * 0.94;
        const ang = Math.atan2((y - cc.y) / cs * 1.2 + 0.6, (x - cc.x) / cs * 1.2) + (r3 - 0.5) * 0.8;
        const len = cs * (0.05 + 0.05 * r4);
        items.push({ x, y, dx: Math.cos(ang) * len, dy: Math.sin(ang) * len, light: y < cc.y - cs * 0.02 });
      }
    });
    hairs(c, items, cs, col.light, col.dark, 0.2, 0.1);
    // fijne korrel
    c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.35;
    c.fillStyle = furGrain(c); c.fillRect(bb.x - cs, bb.y - cs, bb.w + 2 * cs, bb.h + 2 * cs);
    c.restore();
    // lichtrandje linksboven: de rand iets verschoven getekend, binnen de clip blijft alleen de bovenkant over
    for (const [w, al] of [[0.28, 0.07], [0.18, 0.09], [0.1, 0.11]]) {
      this.tracePath(c, inset, cs * (w * 0.5 + 0.01), cs * (w * 0.5 + 0.02));
      c.lineWidth = cs * w; c.strokeStyle = rgba(col.light, al); c.stroke();
    }
    // zachte binnenrand als verloop, zonder harde omlijning
    for (const [w, al] of [[0.34, 0.045], [0.24, 0.055], [0.15, 0.07], [0.07, 0.09]]) {
      this.tracePath(c, inset);
      c.lineWidth = cs * w; c.strokeStyle = rgba(col.dark, al); c.stroke();
    }
    c.restore();
  }

  // De kop (met pootjes, blosjes en wangpluis), met (0,0) als middelpunt van de kop.
  paintHead(c) {
    const cs = this.cs, col = this.color, f = this.facing, r = cs * 0.44, seed = this.seed + 77;
    const headCol = col.pattern === 'siamese' ? mix(col.base, col.dark, 0.55) : col.base;
    const light = col.pattern === 'siamese' ? mix(col.light, col.dark, 0.3) : col.light;
    const edgeDark = mix(headCol, col.dark, 0.35);

    // pootjes (alleen als de kop niet omhoog kijkt)
    if (f.y >= 0) {
      const py = r * 0.95 + f.y * r * 0.15;
      const pawCol = col.pattern === 'tuxedo' ? '#fff8f0' : headCol;
      const pawLight = mix(pawCol, '#ffffff', 0.5), pawDark = mix(pawCol, col.dark, 0.5);
      [-1, 1].forEach((sgn, j) => {
        const px = sgn * r * 0.42, rx = r * 0.23, ry = r * 0.17;
        furEdge(c, ellipseSamples(px, py, rx, ry, cs * 0.035), { dark: pawDark, base: pawCol, light: pawLight }, seed + j * 31, cs, { scale: 0.5 });
        c.fillStyle = pawCol; c.beginPath(); c.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); c.fill();
        c.save(); c.clip();
        const pg = c.createLinearGradient(0, py - ry, 0, py + ry);
        pg.addColorStop(0, rgba(col.dark, 0.3)); pg.addColorStop(0.6, rgba(col.dark, 0)); pg.addColorStop(1, rgba(col.dark, 0.18));
        c.fillStyle = pg; c.fillRect(px - rx, py - ry, rx * 2, ry * 2);
        c.restore();
        // teentjes
        c.strokeStyle = rgba(col.dark, 0.3); c.lineWidth = r * 0.045; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(px, py + r * 0.02); c.lineTo(px, py + r * 0.14);
        c.moveTo(px + r * 0.08, py + r * 0.02); c.lineTo(px + r * 0.1, py + r * 0.13);
        c.moveTo(px - r * 0.08, py + r * 0.02); c.lineTo(px - r * 0.1, py + r * 0.13);
        c.stroke();
      });
    }

    // waas en plukjes om de kop; op de wangen langer en voller
    c.fillStyle = rgba(headCol, 0.3); c.beginPath(); c.ellipse(0, 0, r * 1.06 + cs * 0.05, r + cs * 0.05, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgba(headCol, 0.55); c.beginPath(); c.ellipse(0, 0, r * 1.06 + cs * 0.025, r + cs * 0.025, 0, 0, Math.PI * 2); c.fill();
    const hs = ellipseSamples(0, 0, r * 1.06, r, cs * 0.028);
    furEdge(c, hs, { dark: edgeDark, base: headCol, light }, seed, cs, {
      len: s => {
        const cheek = Math.pow(Math.abs(s.nx), 4) * (s.ny > -0.15 && s.ny < 0.8 ? 1 : 0.3);
        return 0.8 + 1.7 * cheek;
      },
    });
    // de kop zelf
    c.save();
    c.beginPath(); c.ellipse(0, 0, r * 1.06, r, 0, 0, Math.PI * 2);
    c.fillStyle = headCol; c.fill(); c.clip();
    const g = c.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.3);
    g.addColorStop(0, rgba(light, col.pattern === 'siamese' ? 0.45 : 0.7));
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(1, rgba(col.dark, 0.3));
    c.fillStyle = g; c.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
    if (col.pattern === 'tabby') {
      // zachte voorhoofdstreepjes
      c.lineCap = 'round';
      [-0.22, 0, 0.22].forEach(off => {
        for (const [w, al] of [[0.16, 0.16], [0.09, 0.3]]) {
          c.strokeStyle = rgba(col.dark, al); c.lineWidth = r * w;
          c.beginPath(); c.moveTo(off * r, -r * 0.95); c.lineTo(off * r * 1.2, -r * 0.55); c.stroke();
        }
      });
    }
    if (col.pattern === 'tuxedo') {
      const g2 = c.createRadialGradient(0, r * 0.45, r * 0.1, 0, r * 0.45, r * 0.6);
      g2.addColorStop(0, 'rgba(255,248,240,0.95)'); g2.addColorStop(0.7, 'rgba(255,248,240,0.9)'); g2.addColorStop(1, 'rgba(255,248,240,0)');
      c.fillStyle = g2; c.fillRect(-r, -r, r * 2, r * 2);
    }
    if (col.pattern === 'siamese') {
      const g2 = c.createRadialGradient(0, r * 0.2, r * 0.1, 0, r * 0.2, r * 0.75);
      g2.addColorStop(0, rgba(col.dark, 0.35)); g2.addColorStop(1, rgba(col.dark, 0));
      c.fillStyle = g2; c.fillRect(-r, -r, r * 2, r * 2);
    }
    // haartjes, van het midden af; niet op het snoetje
    const items = [];
    for (let k = 0; k < 130; k++) {
      const r1 = seeded(seed + k * 3.7), r2 = seeded(seed + k * 8.3 + 1), r3 = seeded(seed + k * 1.9 + 2), r4 = seeded(seed + k * 6.1 + 3);
      const x = (r1 - 0.5) * 2 * r * 1.06, y = (r2 - 0.5) * 2 * r;
      if ((x / (r * 1.06)) ** 2 + (y / r) ** 2 > 1) continue;
      if (Math.abs(x) < r * 0.4 && y > r * 0.15) continue;
      const ang = Math.atan2((y + r * 0.3) / r + 0.5, x / r) + (r3 - 0.5) * 0.8;
      const len = r * (0.1 + 0.1 * r4);
      items.push({ x, y, dx: Math.cos(ang) * len, dy: Math.sin(ang) * len, light: y < -r * 0.1 });
    }
    hairs(c, items, cs, light, col.dark, 0.2, 0.09);
    c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.35;
    c.fillStyle = furGrain(c); c.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    c.restore();
    // lichtrandje linksboven en een zachte binnenrand
    for (const [w, al] of [[0.3, 0.07], [0.2, 0.09], [0.1, 0.11]]) {
      c.beginPath(); c.ellipse(r * (w * 0.5 + 0.01), r * (w * 0.5 + 0.03), r * 1.06, r, 0, 0, Math.PI * 2);
      c.lineWidth = r * w; c.strokeStyle = rgba(light, al); c.stroke();
    }
    for (const [w, al] of [[0.4, 0.04], [0.26, 0.05], [0.14, 0.07]]) {
      c.beginPath(); c.ellipse(0, 0, r * 1.06, r, 0, 0, Math.PI * 2);
      c.lineWidth = r * w; c.strokeStyle = rgba(col.dark, al); c.stroke();
    }
    c.restore();

    // blosjes
    [-1, 1].forEach(sgn => {
      const bx = sgn * r * 0.66, by = r * 0.4;
      const bg = c.createRadialGradient(bx, by, 0, bx, by, r * 0.26);
      bg.addColorStop(0, 'rgba(243,120,145,0.32)'); bg.addColorStop(1, 'rgba(243,120,145,0)');
      c.fillStyle = bg; c.beginPath(); c.ellipse(bx, by, r * 0.26, r * 0.18, 0, 0, Math.PI * 2); c.fill();
    });
  }

  drawTail(ctx, t) {
    const cs = this.cs, a = this.anim, col = this.color;
    const tc = this.cellCenter(this.cells[this.tailIdx]);
    const d = this.tailDir, p = { x: -d.y, y: d.x };
    const sleeping = this.state === 'sleeping';
    const T = this.tail;
    const rest = clamp(sleeping ? T.curl * 1.15 : T.curl, -3.4, 3.4);
    const flick = a.tailFlick > 0 ? Math.sin((1 - a.tailFlick) * Math.PI) * 0.5 * Math.sign(T.curl) : 0;
    // vaste lengte: de staart buigt (krul, zwaaien, achter de beweging aan slepen), maar rekt nooit
    const sideVel = this.vel.x * p.x + this.vel.y * p.y;
    const lag = clamp(-sideVel * 0.0022, -0.9, 0.9);
    const bend = rest * (1 - a.tailAct * 0.45) + Math.sin(a.tailPhase) * (0.8 + a.wag * 0.3) * a.tailAct + flick + lag;
    const L = cs * 0.95 * T.len, N = 18, pts = [];
    let x = tc.x + d.x * cs * 0.28, y = tc.y + d.y * cs * 0.28;
    const th0 = Math.atan2(d.y, d.x);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      // mollig naar de punt toe: iets smaller in het midden, dan een zacht pluizig bolletje
      let plump = clamp((u - 0.5) / 0.42, 0, 1); plump = plump * plump * (3 - 2 * plump);
      pts.push({ x, y, w: cs * (0.085 - 0.025 * u + 0.05 * plump) * T.thick });
      const uu = (i + 0.5) / N;
      const th = th0 + bend * Math.pow(uu, T.k) + T.wave * Math.sin(uu * Math.PI * 1.6) * (1 - a.tailAct * 0.5);
      x += Math.cos(th) * L / N; y += Math.sin(th) * L / N;
    }
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const q = pts[Math.min(i + 1, N)], o = pts[Math.max(i - 1, 0)];
      let nx = -(q.y - o.y), ny = q.x - o.x; const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      left.push({ x: pts[i].x + nx * pts[i].w, y: pts[i].y + ny * pts[i].w });
      right.push({ x: pts[i].x - nx * pts[i].w, y: pts[i].y - ny * pts[i].w });
    }
    const tip = pts[N], tipW = tip.w;
    const capA0 = Math.atan2(left[N].y - tip.y, left[N].x - tip.x), capA1 = Math.atan2(right[N].y - tip.y, right[N].x - tip.x);
    const tracePoly = () => {
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (let i = 1; i <= N; i++) ctx.lineTo(left[i].x, left[i].y);
      ctx.arc(tip.x, tip.y, tipW, capA0, capA1, true);
      for (let i = N; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
      ctx.closePath();
    };
    const tipCol = col.pattern === 'siamese' ? col.dark : (col.pattern === 'tuxedo' || col.pattern === 'calico' ? '#fff8f0' : col.light);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // zachte pluizige rand: een donkere waas, een waas in de basiskleur en losse plukjes
    tracePoly();
    ctx.lineWidth = cs * 0.07; ctx.strokeStyle = rgba(col.dark, 0.16); ctx.stroke();
    ctx.lineWidth = cs * 0.045; ctx.strokeStyle = rgba(col.base, 0.5); ctx.stroke();
    ctx.fillStyle = rgba(col.base, 0.7); ctx.beginPath();
    for (const fz of T.fuzz) {
      const fi = fz.u * N, i = Math.floor(fi), fr = fi - i, j = Math.min(i + 1, N);
      const side = fz.side > 0 ? left : right;
      const ex = lerp(side[i].x, side[j].x, fr), ey = lerp(side[i].y, side[j].y, fr);
      const cx = lerp(pts[i].x, pts[j].x, fr), cy = lerp(pts[i].y, pts[j].y, fr);
      let nx = ex - cx, ny = ey - cy; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const w = lerp(pts[i].w, pts[j].w, fr);
      tuft(ctx, ex - nx * w * 0.3, ey - ny * w * 0.3, nx, ny, w * (0.45 + 0.5 * fz.len), w * 0.6 * fz.w, fz.bend * w * 0.5);
    }
    ctx.fill();
    // pluizig puntje
    let da = capA1 - capA0; while (da > 0) da -= Math.PI * 2;
    ctx.fillStyle = rgba(tipCol, 0.6); ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const ang = capA0 + da * (k + 0.5) / 9, cx = Math.cos(ang), cy = Math.sin(ang);
      const r1 = seeded(this.seed + k * 4.3), r2 = seeded(this.seed + k * 2.7 + 1);
      tuft(ctx, tip.x + cx * tipW * 0.6, tip.y + cy * tipW * 0.6, cx, cy, tipW * (0.65 + 0.3 * r1), tipW * 0.75, (r2 - 0.5) * tipW * 0.4);
    }
    ctx.fill();
    tracePoly();
    ctx.fillStyle = col.base; ctx.fill();
    ctx.save(); ctx.clip();
    // schaduwkant en lichtkant
    ctx.lineWidth = cs * 0.06; ctx.strokeStyle = rgba(col.dark, 0.22);
    ctx.beginPath(); ctx.moveTo(right[0].x, right[0].y); for (let i = 1; i <= N; i++) ctx.lineTo(right[i].x, right[i].y); ctx.stroke();
    ctx.lineWidth = cs * 0.045; ctx.strokeStyle = rgba(col.light, 0.55);
    ctx.beginPath(); ctx.moveTo((pts[0].x + left[0].x) / 2, (pts[0].y + left[0].y) / 2);
    for (let i = 1; i <= N; i++) ctx.lineTo((pts[i].x + left[i].x) / 2, (pts[i].y + left[i].y) / 2); ctx.stroke();
    // ringetjes, zacht
    const ring = (u, color, wf) => {
      const i = Math.round(u * N); ctx.lineWidth = pts[i].w * wf; ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(left[i].x, left[i].y); ctx.lineTo(right[i].x, right[i].y); ctx.stroke();
    };
    if (col.pattern === 'tabby') {
      [0.3, 0.5, 0.7].forEach(u => { ring(u, rgba(col.dark, 0.16), 0.95); ring(u, rgba(col.dark, 0.3), 0.5); });
    } else if (col.pattern !== 'siamese') {
      ring(0.62, rgba(col.light, 0.3), 0.7);
    }
    // puntje
    const tg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, tipW * 2.6);
    tg.addColorStop(0, tipCol); tg.addColorStop(0.55, tipCol); tg.addColorStop(1, rgba(col.base, 0));
    ctx.fillStyle = tg; ctx.fillRect(tip.x - tipW * 3, tip.y - tipW * 3, tipW * 6, tipW * 6);
    ctx.restore();
  }

  drawBody(ctx) {
    const f = this.ensureFur(this.drawScale);
    ctx.drawImage(f.body, this.pos.x - f.M, this.pos.y - f.M, f.bw, f.bh);
  }

  // Vachtpatroon op het lijfje (wordt in de cache getekend, binnen de clip van het lijfje), zacht van rand.
  drawPattern(ctx) {
    const cs = this.cs, col = this.color;
    const pat = col.pattern;
    ctx.lineCap = 'round';
    if (pat === 'tabby') {
      this.cells.forEach((c, i) => {
        if (i === this.headIdx && this.cells.length > 1) return;
        const cc = this.cellCenter(c);
        const n = 2 + Math.floor(seeded(this.seed + i) * 2);
        for (let k = 0; k < n; k++) {
          const off = (k - (n - 1) / 2) * cs * 0.26 + (seeded(this.seed + i * 7 + k) - 0.5) * cs * 0.08;
          const len = cs * (0.28 + seeded(this.seed + i * 3 + k) * 0.18);
          for (const [w, al] of [[0.14, 0.16], [0.075, 0.32]]) {
            ctx.strokeStyle = rgba(col.dark, al); ctx.lineWidth = cs * w;
            ctx.beginPath();
            ctx.moveTo(cc.x - len / 2, cc.y + off);
            ctx.quadraticCurveTo(cc.x, cc.y + off - cs * 0.12, cc.x + len / 2, cc.y + off);
            ctx.stroke();
          }
        }
      });
    } else if (pat === 'calico') {
      const cols = ['#f0a35a', '#5b5260', '#f0a35a'];
      this.cells.forEach((c, i) => {
        const cc = this.cellCenter(c);
        const n = 1 + Math.floor(seeded(this.seed + i * 11) * 2);
        for (let k = 0; k < n; k++) {
          const sx = (seeded(this.seed + i * 5 + k) - 0.5) * cs * 0.7;
          const sy = (seeded(this.seed + i * 9 + k * 3) - 0.5) * cs * 0.7;
          const rx = cs * (0.16 + seeded(this.seed + i + k * 13) * 0.14), ry = rx * (0.7 + seeded(i * k + 2) * 0.5);
          // zachte, licht gerafelde lap
          ctx.save();
          ctx.translate(cc.x + sx, cc.y + sy); ctx.rotate(seeded(i + k) * 3); ctx.scale(rx, ry);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.15);
          g.addColorStop(0, rgba(cols[(i + k) % 3], 0.9)); g.addColorStop(0.78, rgba(cols[(i + k) % 3], 0.85)); g.addColorStop(1, rgba(cols[(i + k) % 3], 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1.15, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      });
    } else if (pat === 'tuxedo') {
      const h = this.cellCenter(this.cells[this.headIdx]);
      const px = h.x + this.facing.x * cs * 0.1, py = h.y + cs * 0.3;
      ctx.save();
      ctx.translate(px, py); ctx.scale(cs * 0.28, cs * 0.32);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.15);
      g.addColorStop(0, 'rgba(255,248,240,0.95)'); g.addColorStop(0.75, 'rgba(255,248,240,0.9)'); g.addColorStop(1, 'rgba(255,248,240,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (pat === 'siamese') {
      // donkere 'points' richting de kop en de staart
      const h = this.cellCenter(this.cells[this.headIdx]);
      const g = ctx.createRadialGradient(h.x, h.y, cs * 0.2, h.x, h.y, cs * 1.1);
      g.addColorStop(0, rgba(col.dark, 0.35)); g.addColorStop(1, rgba(col.dark, 0));
      ctx.fillStyle = g; ctx.fillRect(h.x - cs * 1.2, h.y - cs * 1.2, cs * 2.4, cs * 2.4);
    }
  }

  drawHead(ctx, t) {
    const cs = this.cs, a = this.anim, col = this.color;
    const hc = this.cellCenter(this.cells[this.headIdx]);
    const f = this.facing;
    const hx = hc.x + f.x * cs * 0.12 + a.headDx + a.lookX * cs * 0.06;
    const hy = hc.y + f.y * cs * 0.12 + a.headDy - cs * 0.04 + a.lookY * cs * 0.04;
    const r = cs * 0.44;
    const headCol = col.pattern === 'siamese' ? mix(col.base, col.dark, 0.55) : col.base;
    const headDark = col.dark;
    const light = col.pattern === 'siamese' ? mix(col.light, col.dark, 0.3) : col.light;

    // oortjes (live, want ze wiebelen): zacht randje met wat pluis en een pluizige binnenkant
    const drawEar = (sgn, twist) => {
      ctx.save();
      const bx = hx + sgn * r * 0.6, by = hy - r * 0.55;
      ctx.translate(bx, by); ctx.rotate(sgn * twist); ctx.translate(-bx, -by);
      const P0 = [hx + sgn * r * 0.22, hy - r * 0.78], P1 = [hx + sgn * r * 0.75, hy - r * 1.55], P2 = [hx + sgn * r * 0.98, hy - r * 1.2];
      // pluisjes langs de buitenkant
      ctx.fillStyle = rgba(headCol, 0.75); ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const u = (k + 0.5) / 7, v = 1 - u;
        const x = v * v * P0[0] + 2 * v * u * P1[0] + u * u * P2[0], y = v * v * P0[1] + 2 * v * u * P1[1] + u * u * P2[1];
        let tx = v * (P1[0] - P0[0]) + u * (P2[0] - P1[0]), ty = v * (P1[1] - P0[1]) + u * (P2[1] - P1[1]);
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        const nx = sgn * ty, ny = -sgn * tx;
        tuft(ctx, x - nx * r * 0.04, y - ny * r * 0.04, nx, ny, r * (0.09 + 0.07 * seeded(this.seed + k * 3.3 + sgn)), r * 0.13, (seeded(this.seed + k * 1.7) - 0.5) * r * 0.06);
      }
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(P0[0], P0[1]);
      ctx.quadraticCurveTo(P1[0], P1[1], P2[0], P2[1]);
      ctx.quadraticCurveTo(hx + sgn * r * 1.05, hy - r * 0.9, hx + sgn * r * 0.9, hy - r * 0.35);
      ctx.closePath();
      ctx.fillStyle = headCol; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(headDark, 0.22); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + sgn * r * 0.42, hy - r * 0.78);
      ctx.quadraticCurveTo(hx + sgn * r * 0.75, hy - r * 1.3, hx + sgn * r * 0.86, hy - r * 1.08);
      ctx.quadraticCurveTo(hx + sgn * r * 0.9, hy - r * 0.85, hx + sgn * r * 0.78, hy - r * 0.55);
      ctx.closePath();
      ctx.fillStyle = 'rgba(243,160,175,0.8)'; ctx.fill();
      // zachte haartjes in het oor
      ctx.strokeStyle = rgba(light, 0.7); ctx.lineWidth = r * 0.035; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const u = 0.25 + k * 0.25;
        const x0 = hx + sgn * r * (0.45 + 0.3 * u), y0 = hy - r * (0.66 + 0.1 * u);
        ctx.moveTo(x0, y0); ctx.lineTo(x0 + sgn * r * 0.1, y0 - r * (0.22 + 0.08 * (1 - u)));
      }
      ctx.stroke();
      ctx.restore();
    };
    drawEar(-1, Math.sin(a.earL * Math.PI) * 0.3 + a.grump * 0.7);
    drawEar(1, Math.sin(Math.max(a.earR, a.earTwitch) * Math.PI) * 0.35 + a.grump * 0.7);

    // kop met vacht uit de cache
    const fur = this.ensureFur(this.drawScale);
    ctx.drawImage(fur.head, hx - fur.hr, hy - fur.hr, fur.hr * 2, fur.hr * 2);

    // oogjes: groot, laag in het gezicht, dicht bij elkaar; de kijkrichting schuift beide oogjes dezelfde kant op
    const sleeping = this.state === 'sleeping';
    const ex = r * (0.36 + (seeded(this.seed + 5) - 0.5) * 0.04), eyeShift = f.x * r * 0.05;
    const ey = hy + r * 0.06 + f.y * r * 0.05;
    const blink = sleeping ? 1 : a.blink;
    const openness = sleeping ? 0 : clamp(1 - Math.sin(blink * Math.PI) * 1.2, 0.05, 1) * (1 - a.grump * 0.45);
    if (openness < 0.12) {
      ctx.strokeStyle = rgba(headDark, 0.9); ctx.lineWidth = r * 0.085; ctx.lineCap = 'round';
      [-1, 1].forEach(sgn => {
        ctx.beginPath();
        ctx.arc(hx + sgn * ex + eyeShift, ey + r * 0.1, r * 0.18, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      });
    } else {
      const er = r * 0.23 * (1 + a.lift * 0.1);
      const gaze = { x: f.x * r * 0.03 + clamp(this.vel.x * 0.00005, -0.03, 0.03) * r + a.lookX * er * 0.3, y: f.y * r * 0.03 + a.lookY * er * 0.25 };
      [-1, 1].forEach(sgn => {
        const cx = hx + sgn * ex + eyeShift, cy = ey;
        const eh = er * openness;
        ctx.save();
        ctx.beginPath(); ctx.ellipse(cx, cy, er, eh, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = col.eye; ctx.fillRect(cx - er, cy - eh, er * 2, eh * 2);
        const eg = ctx.createRadialGradient(cx, cy + eh * 0.6, 0, cx, cy, er * 1.1);
        eg.addColorStop(0, 'rgba(255,255,255,0.4)'); eg.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = eg; ctx.fillRect(cx - er, cy - eh, er * 2, eh * 2);
        ctx.fillStyle = '#2a2230';
        ctx.beginPath(); ctx.ellipse(cx + gaze.x, cy + gaze.y + eh * 0.1, er * 0.62 * (1 + a.lift * 0.2), eh * 0.78, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.ellipse(cx - er * 0.28, cy - eh * 0.1, er * 0.3, eh * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + er * 0.38, cy + eh * 0.42, er * 0.14, eh * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // randje
        ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(headDark, 0.55);
        ctx.beginPath(); ctx.ellipse(cx, cy, er, eh, 0, 0, Math.PI * 2); ctx.stroke();
      });
    }

    // neusje en lachend mondje
    const sniffAmt = Math.sin(a.sniff * Math.PI) * Math.sin(a.sniffPhase);
    const nx = hx + f.x * r * 0.04, ny = hy + r * 0.38 - sniffAmt * r * 0.018;
    ctx.fillStyle = '#e88aa0';
    ctx.beginPath();
    ctx.moveTo(nx - r * 0.1, ny - r * 0.05); ctx.lineTo(nx + r * 0.1, ny - r * 0.05);
    ctx.quadraticCurveTo(nx + r * 0.06, ny + r * 0.09, nx, ny + r * 0.09);
    ctx.quadraticCurveTo(nx - r * 0.06, ny + r * 0.09, nx - r * 0.1, ny - r * 0.05);
    ctx.fill();
    ctx.strokeStyle = rgba(headDark, 0.85); ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(nx, ny + r * 0.09); ctx.lineTo(nx, ny + r * 0.17);
    const g = a.grump, cyM = ny + r * (0.34 - 0.2 * g), eyM = ny + r * (0.2 + 0.07 * g);
    ctx.moveTo(nx, ny + r * 0.17);
    ctx.quadraticCurveTo(nx - r * 0.12, cyM, nx - r * 0.28, eyM);
    ctx.moveTo(nx, ny + r * 0.17);
    ctx.quadraticCurveTo(nx + r * 0.12, cyM, nx + r * 0.28, eyM);
    ctx.stroke();
    if (g > 0.05) {
      // boze wenkbrauwtjes
      ctx.save(); ctx.globalAlpha = g; ctx.strokeStyle = rgba(headDark, 0.85); ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
      [-1, 1].forEach(sgn => {
        ctx.beginPath();
        ctx.moveTo(hx + sgn * r * 0.2, hy - r * 0.3 + g * r * 0.05);
        ctx.lineTo(hx + sgn * r * 0.55, hy - r * 0.42 - g * r * 0.04);
        ctx.stroke();
      });
      ctx.restore();
    }

    // tongetje
    if (a.tongue > 0.02) {
      const tw = r * 0.15, tl = r * 0.2 * a.tongue;
      const tx = nx + a.tongueX * r * 0.12, ty = ny + r * 0.17;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(tx - tw / 2, ty - r * 0.02); ctx.lineTo(tx + tw / 2, ty - r * 0.02);
      ctx.lineTo(tx + tw / 2, ty + tl - tw / 2); ctx.arc(tx, ty + tl - tw / 2, tw / 2, 0, Math.PI); ctx.closePath();
      ctx.fillStyle = '#f28ba6'; ctx.fill();
      ctx.strokeStyle = rgba(headDark, 0.45); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(200,80,110,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, ty + r * 0.02); ctx.lineTo(tx, ty + tl - tw * 0.35); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(tx - tw * 0.2, ty + tl * 0.5, tw * 0.15, Math.max(0.5, tl * 0.25), 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // snorharen
    ctx.strokeStyle = hexToRgb(col.base).reduce((s, v) => s + v, 0) > 450 ? rgba(headDark, 0.45) : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.3;
    const fan = a.attn * 0.16 + sniffAmt * 0.035 + Math.sin(a.sniff * Math.PI) * 0.08;   // in radialen: naar voren (omlaag op het scherm)
    [-1, 1].forEach(sgn => {
      for (let k = -1; k <= 1; k++) {
        const x0 = hx + sgn * r * 0.45, y0 = ny - r * 0.02 + k * r * 0.08;
        const dx = sgn * r * 0.8, dy = -r * 0.1 + k * r * 0.14;
        const ang = Math.atan2(dy, dx) + sgn * fan, len = Math.hypot(dx, dy);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * 0.55, y0 + Math.sin(ang) * len * 0.55 - r * 0.02, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len + r * 0.03);
        ctx.stroke();
      }
    });

    // tekstwolkje
    if (this.bubble) {
      const alpha = clamp(Math.min(this.bubble.t * 3, (this.bubble.max - this.bubble.t) * 4), 0, 1);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.font = `700 ${Math.round(cs * 0.3)}px "Nunito","Segoe UI",sans-serif`;
      const w = ctx.measureText(this.bubble.text).width + cs * 0.4;
      const bx = hx + r * 0.9, by = hy - r * 1.9;
      ctx.fillStyle = 'rgba(255,250,243,0.95)';
      ctx.beginPath(); rr(ctx, bx, by - cs * 0.24, w, cs * 0.48, cs * 0.24); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + cs * 0.15, by + cs * 0.2); ctx.lineTo(bx + cs * 0.05, by + cs * 0.42); ctx.lineTo(bx + cs * 0.38, by + cs * 0.22); ctx.fill();
      ctx.fillStyle = '#7a4f4f'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(this.bubble.text, bx + cs * 0.2, by + 1);
      ctx.restore();
    }
  }
}
