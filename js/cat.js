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
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Tekent de buitenrand van een groep vakjes als één vloeiende, afgeronde vorm.
// Bolle hoeken worden rond met rOut, holle hoeken met rIn; inset trekt de rand naar binnen.
function outlinePath(ctx, cells, cs, ox, oy, inset, rOut, rIn) {
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
    const N = verts.length;
    if (N < 3) continue;
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
    this.anim = {
      sx: 1, sy: 1, squash: 0, squashV: 0, lift: 0, headDx: 0, headDy: 0,
      earTwitch: 0, blink: 0, nextBlink: Levels.rnd(1, 5), tailPhase: Levels.rnd(0, 6.28),
      walkPhase: 0, rot: 0, wag: 0, stretch: 0,
    };
    this.walkTarget = null;
    this.bubble = null;
    this.zzzTimer = 0;
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
    this.anim.squash = 0.2; this.anim.squashV = 1.5;
    this.anim.earTwitch = 1;
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
    this.anim.squash = -0.15; this.anim.squashV = 0;
  }
  drop() {
    this.held = false; this.state = 'idle'; this.stateTime = 0; this.idleTime = 0;
    this.sleepAfter = Levels.rnd(18, 45);
    this.anim.squash = 0.28; this.anim.squashV = 0;
  }
  walkTo(target, withStretch = false) {
    this.walkTarget = target; this.placed = false; this.idleTime = 0;
    this.state = withStretch ? 'stretching' : 'walking'; this.stateTime = 0;
  }
  say(text, dur = 1.6) { this.bubble = { text, t: dur, max: dur }; }
  wake() {
    if (this.state === 'sleeping') { this.state = 'idle'; this.stateTime = 0; }
    this.idleTime = 0; this.sleepAfter = Levels.rnd(18, 45);
  }

  update(dt, t, game) {
    const a = this.anim;
    this.stateTime += dt;
    // snelheid
    const vx = (this.pos.x - this.prev.x) / Math.max(dt, 1e-3), vy = (this.pos.y - this.prev.y) / Math.max(dt, 1e-3);
    this.vel.x = lerp(this.vel.x, vx, Math.min(1, dt * 12));
    this.vel.y = lerp(this.vel.y, vy, Math.min(1, dt * 12));
    this.prev.x = this.pos.x; this.prev.y = this.pos.y;
    const speed = Math.hypot(this.vel.x, this.vel.y);

    // wiebelen bij bewegen: uitrekken in de bewegingsrichting
    const k = 0.00012;
    let tsx = 1 + Math.abs(this.vel.x) * k - Math.abs(this.vel.y) * k * 0.5;
    let tsy = 1 + Math.abs(this.vel.y) * k - Math.abs(this.vel.x) * k * 0.5;
    tsx = clamp(tsx, 0.88, 1.18); tsy = clamp(tsy, 0.88, 1.18);
    a.sx = lerp(a.sx, tsx, Math.min(1, dt * 8));
    a.sy = lerp(a.sy, tsy, Math.min(1, dt * 8));
    const hd = this.cs * 0.14;
    a.headDx = lerp(a.headDx, clamp(-this.vel.x * 0.025, -hd, hd), Math.min(1, dt * 7));
    a.headDy = lerp(a.headDy, clamp(-this.vel.y * 0.025, -hd, hd), Math.min(1, dt * 7));
    a.wag = lerp(a.wag, clamp(speed / 600, 0, 1), Math.min(1, dt * 4));
    a.tailPhase += dt * (1.3 + a.wag * 1.4 + (this.held ? 0.5 : 0)) * (this.state === 'sleeping' ? 0.35 : 1);

    // veertje voor het pletten/stuiteren
    a.squashV += (-a.squash * 160 - a.squashV * 8) * dt;
    a.squash += a.squashV * dt;

    a.lift = lerp(a.lift, this.held ? 1 : 0, Math.min(1, dt * 9));

    // knipperen & oortjes
    a.nextBlink -= dt;
    if (a.nextBlink <= 0) { a.blink = 1; a.nextBlink = Levels.rnd(2.5, 6.5); }
    a.blink = Math.max(0, a.blink - dt * 7);
    if (Math.random() < dt * 0.25) a.earTwitch = 1;
    a.earTwitch = Math.max(0, a.earTwitch - dt * 4);

    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }

    // toestanden
    if (this.state === 'stretching') {
      a.stretch = Math.sin(Math.min(1, this.stateTime / 0.9) * Math.PI);
      if (this.stateTime > 0.9) { a.stretch = 0; this.state = 'walking'; this.stateTime = 0; }
    } else if (this.state === 'walking' && this.walkTarget) {
      const dx = this.walkTarget.x - this.pos.x, dy = this.walkTarget.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      const sp = 95 * dt;
      if (d <= sp) {
        this.pos.x = this.walkTarget.x; this.pos.y = this.walkTarget.y;
        this.walkTarget = null; this.state = 'idle'; this.stateTime = 0;
        a.squash = 0.15; a.rot = 0;
      } else {
        this.pos.x += dx / d * sp; this.pos.y += dy / d * sp;
        a.walkPhase += dt * 11;
        a.rot = Math.sin(a.walkPhase) * 0.05;
        a.sy *= 1 + Math.sin(a.walkPhase * 2) * 0.035;
      }
    } else if (this.state === 'idle') {
      a.rot = lerp(a.rot, 0, Math.min(1, dt * 6));
      this.idleTime += dt;
      if (this.idleTime > this.sleepAfter) { this.state = 'sleeping'; this.stateTime = 0; this.zzzTimer = 0.5; }
    } else if (this.state === 'sleeping') {
      a.sy *= 1 + Math.sin(this.stateTime * 1.6) * 0.012;
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
    const a = this.anim, lift = a.lift;
    // schaduw-offsets zijn in apparaatpixels, dus meeschalen met de huidige transformatie
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
    this.drawShadow(ctx);

    ctx.save();
    const sq = a.squash;
    const stretch = a.stretch || 0;
    const s = 1 + a.lift * 0.08;
    ctx.translate(c.x, c.y - a.lift * 14);
    ctx.rotate(a.rot);
    ctx.scale(a.sx * s * (1 - sq * 0.6) * (1 + stretch * 0.12), a.sy * s * (1 + sq) * (1 - stretch * 0.06));
    ctx.translate(-c.x, -c.y);

    this.drawTail(ctx, t);
    this.drawBody(ctx);
    this.drawHead(ctx, t);
    ctx.restore();
  }

  drawTail(ctx, t) {
    const cs = this.cs, a = this.anim, col = this.color;
    const tc = this.cellCenter(this.cells[this.tailIdx]);
    const d = this.tailDir, p = { x: -d.y, y: d.x };
    const sleeping = this.state === 'sleeping';
    const amp = sleeping ? 0.25 : 0.55 + a.wag * 0.2 + (this.state === 'held' ? 0.1 : 0);
    const sway = Math.sin(a.tailPhase) * amp + (sleeping ? 0.5 : 0);
    // de staart sleept een beetje achter de beweging aan
    const lagX = clamp(-this.vel.x * 0.05, -cs * 0.45, cs * 0.45);
    const lagY = clamp(-this.vel.y * 0.05, -cs * 0.45, cs * 0.45);
    const L = cs * 1.2;
    const base = { x: tc.x + d.x * cs * 0.28, y: tc.y + d.y * cs * 0.28 };
    const c1 = { x: base.x + d.x * L * 0.42 + p.x * sway * L * 0.08 + lagX * 0.2, y: base.y + d.y * L * 0.42 + p.y * sway * L * 0.08 + lagY * 0.2 };
    const c2 = { x: base.x + d.x * L * 0.78 + p.x * sway * L * 0.5 + lagX * 0.6, y: base.y + d.y * L * 0.78 + p.y * sway * L * 0.5 + lagY * 0.6 };
    const end = { x: base.x + d.x * L * 0.66 + p.x * sway * L * 0.95 + lagX, y: base.y + d.y * L * 0.66 + p.y * sway * L * 0.95 + lagY };
    const N = 16, pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, v = 1 - u;
      pts.push({
        x: v * v * v * base.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * end.x,
        y: v * v * v * base.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * end.y,
        w: cs * (0.105 - 0.05 * u),
      });
    }
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const q = pts[Math.min(i + 1, N)], o = pts[Math.max(i - 1, 0)];
      let nx = -(q.y - o.y), ny = q.x - o.x; const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      left.push({ x: pts[i].x + nx * pts[i].w, y: pts[i].y + ny * pts[i].w });
      right.push({ x: pts[i].x - nx * pts[i].w, y: pts[i].y - ny * pts[i].w });
    }
    const tip = pts[N], tipW = tip.w;
    const tracePoly = () => {
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (let i = 1; i <= N; i++) ctx.lineTo(left[i].x, left[i].y);
      ctx.arc(tip.x, tip.y, tipW, Math.atan2(left[N].y - tip.y, left[N].x - tip.x), Math.atan2(right[N].y - tip.y, right[N].x - tip.x), true);
      for (let i = N; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
      ctx.closePath();
    };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    tracePoly();
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(col.dark, 0.5); ctx.stroke();
    ctx.fillStyle = col.base; ctx.fill();
    ctx.save(); ctx.clip();
    // schaduwkant en lichtkant
    ctx.lineWidth = cs * 0.06; ctx.strokeStyle = rgba(col.dark, 0.22);
    ctx.beginPath(); ctx.moveTo(right[0].x, right[0].y); for (let i = 1; i <= N; i++) ctx.lineTo(right[i].x, right[i].y); ctx.stroke();
    ctx.lineWidth = cs * 0.045; ctx.strokeStyle = rgba(col.light, 0.55);
    ctx.beginPath(); ctx.moveTo((pts[0].x + left[0].x) / 2, (pts[0].y + left[0].y) / 2);
    for (let i = 1; i <= N; i++) ctx.lineTo((pts[i].x + left[i].x) / 2, (pts[i].y + left[i].y) / 2); ctx.stroke();
    if (col.pattern === 'tabby') {
      ctx.strokeStyle = rgba(col.dark, 0.45);
      [0.35, 0.55, 0.75].forEach(u => {
        const i = Math.round(u * N); ctx.lineWidth = pts[i].w * 0.5;
        ctx.beginPath(); ctx.moveTo(left[i].x, left[i].y); ctx.lineTo(right[i].x, right[i].y); ctx.stroke();
      });
    }
    // puntje
    const tipCol = col.pattern === 'siamese' ? col.dark : (col.pattern === 'tuxedo' || col.pattern === 'calico' ? '#fff8f0' : col.light);
    const tg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, tipW * 3);
    tg.addColorStop(0, tipCol); tg.addColorStop(0.6, tipCol); tg.addColorStop(1, rgba(col.base, 0));
    ctx.fillStyle = tg; ctx.fillRect(tip.x - tipW * 3, tip.y - tipW * 3, tipW * 6, tipW * 6);
    ctx.restore();
  }

  drawBody(ctx) {
    const cs = this.cs, col = this.color;
    const inset = cs * 0.06;
    ctx.save();
    this.tracePath(ctx, inset);
    ctx.fillStyle = col.base; ctx.fill();
    ctx.clip();
    // volume per vakje
    for (const c of this.cells) {
      const cc = this.cellCenter(c);
      const g = ctx.createRadialGradient(cc.x - cs * 0.14, cc.y - cs * 0.2, cs * 0.05, cc.x, cc.y, cs * 0.72);
      g.addColorStop(0, rgba(col.light, 0.5));
      g.addColorStop(0.65, rgba(col.light, 0.08));
      g.addColorStop(1, rgba(col.light, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cc.x - cs, cc.y - cs, cs * 2, cs * 2);
    }
    // donkerder naar onderen
    const bb = this.bbox();
    const lg = ctx.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
    lg.addColorStop(0, rgba(col.dark, 0));
    lg.addColorStop(1, rgba(col.dark, 0.28));
    ctx.fillStyle = lg; ctx.fillRect(bb.x - 10, bb.y - 10, bb.w + 20, bb.h + 20);
    this.drawPattern(ctx);
    // binnenrand
    this.tracePath(ctx, inset);
    ctx.lineWidth = cs * 0.2; ctx.strokeStyle = rgba(col.dark, 0.2); ctx.stroke();
    ctx.restore();
    // dunne omlijning
    this.tracePath(ctx, inset);
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(col.dark, 0.5); ctx.stroke();
  }

  drawPattern(ctx) {
    const cs = this.cs, col = this.color;
    const pat = col.pattern;
    ctx.lineCap = 'round';
    if (pat === 'tabby') {
      ctx.strokeStyle = rgba(col.dark, 0.42); ctx.lineWidth = cs * 0.075;
      this.cells.forEach((c, i) => {
        if (i === this.headIdx && this.cells.length > 1) return;
        const cc = this.cellCenter(c);
        const n = 2 + Math.floor(seeded(this.seed + i) * 2);
        for (let k = 0; k < n; k++) {
          const off = (k - (n - 1) / 2) * cs * 0.26 + (seeded(this.seed + i * 7 + k) - 0.5) * cs * 0.08;
          const len = cs * (0.28 + seeded(this.seed + i * 3 + k) * 0.18);
          ctx.beginPath();
          ctx.moveTo(cc.x - len / 2, cc.y + off);
          ctx.quadraticCurveTo(cc.x, cc.y + off - cs * 0.12, cc.x + len / 2, cc.y + off);
          ctx.stroke();
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
          ctx.fillStyle = rgba(cols[(i + k) % 3], 0.85);
          ctx.beginPath(); ctx.ellipse(cc.x + sx, cc.y + sy, rx, ry, seeded(i + k) * 3, 0, Math.PI * 2); ctx.fill();
        }
      });
    } else if (pat === 'tuxedo') {
      const h = this.cellCenter(this.cells[this.headIdx]);
      ctx.fillStyle = 'rgba(255,248,240,0.95)';
      ctx.beginPath(); ctx.ellipse(h.x + this.facing.x * cs * 0.1, h.y + cs * 0.3, cs * 0.26, cs * 0.3, 0, 0, Math.PI * 2); ctx.fill();
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
    const hx = hc.x + f.x * cs * 0.12 + a.headDx;
    const hy = hc.y + f.y * cs * 0.12 + a.headDy - cs * 0.04;
    const r = cs * 0.44;
    const headCol = col.pattern === 'siamese' ? mix(col.base, col.dark, 0.55) : col.base;
    const headDark = col.dark;
    const light = col.pattern === 'siamese' ? mix(col.light, col.dark, 0.3) : col.light;

    // pootjes (alleen als de kop niet omhoog kijkt)
    if (f.y >= 0) {
      const py = hy + r * 0.95 + f.y * r * 0.15;
      ctx.fillStyle = col.pattern === 'tuxedo' ? '#fff8f0' : (col.pattern === 'siamese' ? headCol : col.base);
      [-1, 1].forEach(sgn => {
        ctx.beginPath(); ctx.ellipse(hx + sgn * r * 0.42, py, r * 0.22, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(headDark, 0.5); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = rgba(headDark, 0.35); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx + sgn * r * 0.42, py + r * 0.02); ctx.lineTo(hx + sgn * r * 0.42, py + r * 0.14);
        ctx.moveTo(hx + sgn * r * 0.5, py + r * 0.02); ctx.lineTo(hx + sgn * r * 0.52, py + r * 0.13);
        ctx.moveTo(hx + sgn * r * 0.34, py + r * 0.02); ctx.lineTo(hx + sgn * r * 0.32, py + r * 0.13);
        ctx.stroke();
      });
    }

    // oortjes
    const drawEar = (sgn, twist) => {
      ctx.save();
      const bx = hx + sgn * r * 0.6, by = hy - r * 0.55;
      ctx.translate(bx, by); ctx.rotate(sgn * twist); ctx.translate(-bx, -by);
      ctx.beginPath();
      ctx.moveTo(hx + sgn * r * 0.22, hy - r * 0.78);
      ctx.quadraticCurveTo(hx + sgn * r * 0.75, hy - r * 1.55, hx + sgn * r * 0.98, hy - r * 1.2);
      ctx.quadraticCurveTo(hx + sgn * r * 1.05, hy - r * 0.9, hx + sgn * r * 0.9, hy - r * 0.35);
      ctx.closePath();
      ctx.fillStyle = headCol; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = rgba(headDark, 0.5); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + sgn * r * 0.42, hy - r * 0.78);
      ctx.quadraticCurveTo(hx + sgn * r * 0.75, hy - r * 1.3, hx + sgn * r * 0.86, hy - r * 1.08);
      ctx.quadraticCurveTo(hx + sgn * r * 0.9, hy - r * 0.85, hx + sgn * r * 0.78, hy - r * 0.55);
      ctx.closePath();
      ctx.fillStyle = 'rgba(243,160,175,0.85)'; ctx.fill();
      ctx.restore();
    };
    drawEar(-1, a.earTwitch > 0.5 ? 0 : 0);
    drawEar(1, Math.sin(a.earTwitch * Math.PI) * 0.35);

    // kop
    ctx.beginPath(); ctx.ellipse(hx, hy, r * 1.06, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = headCol; ctx.fill();
    ctx.save(); ctx.clip();
    const g = ctx.createRadialGradient(hx - r * 0.35, hy - r * 0.45, r * 0.1, hx, hy, r * 1.3);
    g.addColorStop(0, rgba(light.startsWith('#') ? light : col.light, light.startsWith('#') ? 0.7 : 0.45));
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(1, rgba(headDark, 0.3));
    ctx.fillStyle = g; ctx.fillRect(hx - r * 1.5, hy - r * 1.5, r * 3, r * 3);
    if (col.pattern === 'tabby') {
      ctx.strokeStyle = rgba(headDark, 0.45); ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
      [-0.22, 0, 0.22].forEach(off => {
        ctx.beginPath(); ctx.moveTo(hx + off * r, hy - r * 0.95); ctx.lineTo(hx + off * r * 1.2, hy - r * 0.55); ctx.stroke();
      });
    }
    if (col.pattern === 'tuxedo') {
      ctx.fillStyle = 'rgba(255,248,240,0.95)';
      ctx.beginPath(); ctx.ellipse(hx, hy + r * 0.45, r * 0.5, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (col.pattern === 'siamese') {
      const g2 = ctx.createRadialGradient(hx, hy + r * 0.2, r * 0.1, hx, hy + r * 0.2, r * 0.75);
      g2.addColorStop(0, rgba(col.dark, 0.35)); g2.addColorStop(1, rgba(col.dark, 0));
      ctx.fillStyle = g2; ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(headDark, 0.5);
    ctx.beginPath(); ctx.ellipse(hx, hy, r * 1.06, r, 0, 0, Math.PI * 2); ctx.stroke();

    // wangetjes
    ctx.fillStyle = 'rgba(240,120,140,0.22)';
    [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.ellipse(hx + sgn * r * 0.6, hy + r * 0.3, r * 0.2, r * 0.13, 0, 0, Math.PI * 2); ctx.fill(); });

    // oogjes
    const sleeping = this.state === 'sleeping';
    const ex = r * 0.4 + f.x * r * 0.04, ey = hy - r * 0.02 + f.y * r * 0.05;
    const blink = sleeping ? 1 : a.blink;
    const openness = sleeping ? 0 : clamp(1 - Math.sin(blink * Math.PI) * 1.2, 0.05, 1);
    if (openness < 0.12) {
      ctx.strokeStyle = rgba(headDark, 0.9); ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
      [-1, 1].forEach(sgn => {
        ctx.beginPath();
        if (sleeping) ctx.arc(hx + sgn * ex, ey + r * 0.08, r * 0.17, Math.PI * 1.15, Math.PI * 1.85);
        else { ctx.moveTo(hx + sgn * ex - r * 0.16, ey); ctx.lineTo(hx + sgn * ex + r * 0.16, ey); }
        ctx.stroke();
      });
    } else {
      const er = r * 0.2 * (1 + a.lift * 0.12);
      const gaze = { x: f.x * r * 0.03 + clamp(this.vel.x * 0.00005, -0.03, 0.03) * r, y: f.y * r * 0.03 };
      [-1, 1].forEach(sgn => {
        const cx = hx + sgn * ex, cy = ey;
        ctx.beginPath(); ctx.ellipse(cx, cy, er * 0.95, er * openness, 0, 0, Math.PI * 2);
        ctx.fillStyle = col.eye; ctx.fill();
        ctx.save(); ctx.clip();
        const eg = ctx.createRadialGradient(cx, cy + er * 0.5, 0, cx, cy, er);
        eg.addColorStop(0, 'rgba(255,255,255,0.35)'); eg.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = eg; ctx.fillRect(cx - er, cy - er, er * 2, er * 2);
        ctx.fillStyle = '#2a2230';
        ctx.beginPath(); ctx.ellipse(cx + gaze.x, cy + gaze.y, er * 0.52 * (1 + a.lift * 0.3), er * 0.85 * openness, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.ellipse(cx - er * 0.3, cy - er * 0.35 * openness, er * 0.26, er * 0.3 * openness, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + er * 0.35, cy + er * 0.3 * openness, er * 0.12, er * 0.14 * openness, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(headDark, 0.6);
        ctx.beginPath(); ctx.ellipse(cx, cy, er * 0.95, er * openness, 0, 0, Math.PI * 2); ctx.stroke();
      });
    }

    // neusje en mondje
    const nx = hx + f.x * r * 0.04, ny = hy + r * 0.3;
    ctx.fillStyle = '#e88aa0';
    ctx.beginPath();
    ctx.moveTo(nx - r * 0.11, ny - r * 0.05); ctx.lineTo(nx + r * 0.11, ny - r * 0.05);
    ctx.quadraticCurveTo(nx + r * 0.06, ny + r * 0.1, nx, ny + r * 0.1);
    ctx.quadraticCurveTo(nx - r * 0.06, ny + r * 0.1, nx - r * 0.11, ny - r * 0.05);
    ctx.fill();
    ctx.strokeStyle = rgba(headDark, 0.8); ctx.lineWidth = r * 0.055; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(nx, ny + r * 0.1);
    ctx.quadraticCurveTo(nx - r * 0.02, ny + r * 0.26, nx - r * 0.2, ny + r * 0.22);
    ctx.moveTo(nx, ny + r * 0.1);
    ctx.quadraticCurveTo(nx + r * 0.02, ny + r * 0.26, nx + r * 0.2, ny + r * 0.22);
    ctx.stroke();

    // snorharen
    ctx.strokeStyle = hexToRgb(col.base).reduce((s, v) => s + v, 0) > 450 ? rgba(headDark, 0.45) : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.3;
    [-1, 1].forEach(sgn => {
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(hx + sgn * r * 0.45, ny + r * 0.05 + k * r * 0.08);
        ctx.lineTo(hx + sgn * r * 1.25, ny - r * 0.05 + k * r * 0.22);
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
