'use strict';
(() => {
  const W = Room.W, H = Room.H, CS = 58, WALL_Y = Room.WALL_Y;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const levelEl = document.getElementById('level');
  const hintEl = document.getElementById('hint');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const btnStart = document.getElementById('btn-start');
  const btnSound = document.getElementById('btn-sound');

  let scale = 1, dpr = 1, bg = null;
  let levelIdx = 0, cats = [], grid = null, carpetColor = 0;
  let held = null, grabOff = { x: 0, y: 0 }, dragStart = null, moved = false, lastP = { x: 640, y: 400 };
  let downTime = 0, carried = false, lastKeyTime = -1e9;   // carried: poes wordt gedragen zonder de knop ingedrukt te houden
  let particles = [], motes = [];
  let complete = false, completeTimer = 0, walkTimer = 60, started = false;
  let lastT = 0, hintTimer = 0, wheelCooldown = 0, pendingHint = '';

  const { rnd, rndInt, pick, key } = Levels;

  // --- grootte ------------------------------------------------------------
  function resize() {
    scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    dpr = window.devicePixelRatio || 1;
    stage.style.width = W * scale + 'px';
    stage.style.height = H * scale + 'px';
    stage.style.fontSize = 16 * scale + 'px';
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    bg = Room.renderBackground(scale * dpr);
  }
  window.addEventListener('resize', resize);
  resize();
  for (let i = 0; i < 26; i++) motes.push(newMote(true));

  function newMote(anywhere) {
    const S = Room.SUN;
    const fy = anywhere ? Math.random() : 1;
    const y = S.y1 + fy * S.h;
    const x = S.x1 + Math.random() * (S.x2 - S.x1) + (y - S.y1) / S.h * S.dx;
    return { x, y, vx: rnd(-4, 4), vy: rnd(-9, -3), r: rnd(1.2, 2.6), phase: rnd(0, 6.28) };
  }

  // --- levels -------------------------------------------------------------
  function loadLevel(i) {
    const L = LEVELS[i % LEVELS.length];
    const { cells, cols, rows } = Levels.parse(L);
    grid = {
      cols, rows, cs: CS,
      x: Math.round(640 - cols * CS / 2), y: Math.round(502 - rows * CS / 2),
      target: new Set(cells.map(c => key(c.x, c.y))), occupied: new Map(),
    };
    carpetColor = i % Room.CARPET_COLORS.length;
    const pieces = Levels.partition(cells, L.min, L.max);
    const order = CAT_COLORS.map((_, k) => k).sort(() => Math.random() - 0.5);
    cats = pieces.map((p, k) => new Cat(p, order[k % order.length], CS));
    scatter(cats);
    complete = false; completeTimer = 0; particles = [];
    walkTimer = rnd(45, 80);
    held = null;
    levelEl.textContent = `Puzzel ${i + 1} · ${L.name}`;
    pendingHint = i === 0 ? 'Klik op een poesje om het op te pakken, klik nog eens om het neer te leggen 🐾' : i <= 2 ? 'Spatiebalk draait de poes die je vasthoudt ↻' : '';
    if (started) { showHint(pendingHint, 9); pendingHint = ''; }
  }

  function showHint(text, secs) {
    if (!text) { hintEl.classList.remove('show'); return; }
    hintEl.textContent = text; hintEl.classList.add('show'); hintTimer = secs;
  }

  function intersects(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function overlapArea(a, b) {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function spotScore(cat, x, y, others, near) {
    const bb = { x, y, w: cat.width, h: cat.height };
    let s = Math.random() * 40;
    const cr = Room.carpetRect(grid, 48);
    if (intersects(bb, cr)) s += 1000;
    for (const p of Room.PROPS) s += overlapArea(bb, p) / (CS * CS) * 40;
    for (const o of others) if (o !== cat) s += overlapArea(bb, o.bbox(-4)) / (CS * CS) * 400;
    if (near) s += Math.hypot(x - near.x, y - near.y) * 0.25;
    return s;
  }
  // Zoekt een vrije plek op de vloer: alle posities op een rooster afgaan, met een beetje toeval.
  function findSpot(cat, others, near) {
    let best = null, bs = 1e18;
    const step = 14;
    for (let y = WALL_Y + 4; y <= H - 6 - cat.height; y += step) {
      for (let x = 6; x <= W - 6 - cat.width; x += step) {
        const jx = x + rnd(-5, 5), jy = y + rnd(-5, 5);
        const s = spotScore(cat, jx, jy, others, near);
        if (s < bs) { bs = s; best = { x: Math.round(jx), y: Math.round(jy) }; }
      }
    }
    return best || { x: 20, y: WALL_Y + 20 };
  }
  function scatter(list) {
    const placedSoFar = [];
    for (const cat of list) {
      const p = findSpot(cat, placedSoFar, null);
      cat.pos = p; cat.prev = { ...p };
      placedSoFar.push(cat);
    }
  }

  // --- plaatsen -----------------------------------------------------------
  function snapCoords(cat) {
    return { gx: Math.round((cat.pos.x - grid.x) / CS), gy: Math.round((cat.pos.y - grid.y) / CS) };
  }
  function isValid(cat, gx, gy) {
    return cat.cells.every(c => {
      const k = key(gx + c.x, gy + c.y);
      return grid.target.has(k) && !grid.occupied.has(k);
    });
  }
  function touchesGrid(cat, gx, gy) {
    return cat.cells.some(c => gx + c.x >= 0 && gx + c.x < grid.cols && gy + c.y >= 0 && gy + c.y < grid.rows);
  }
  function freeCells(cat) { for (const [k, v] of [...grid.occupied]) if (v === cat) grid.occupied.delete(k); }
  function place(cat, gx, gy) {
    cat.placed = true; cat.gx = gx; cat.gy = gy;
    cat.pos = { x: grid.x + gx * CS, y: grid.y + gy * CS };
    cat.cells.forEach(c => grid.occupied.set(key(gx + c.x, gy + c.y), cat));
    Sound.plop(cat.pitch); Sound.sparkle();
    const c = cat.center();
    burst(c.x, c.y, 5, 'heart'); burst(c.x, c.y, 6, 'spark');
    checkComplete();
  }
  function trySnap(cat) {
    const { gx, gy } = snapCoords(cat);
    if (isValid(cat, gx, gy)) { place(cat, gx, gy); return true; }
    return false;
  }
  function nudgeOff(cat, sayIt = true) {
    const target = findSpot(cat, cats, cat.pos);
    if (sayIt) { cat.say(pick(['mrrp?', 'miauw', 'prrr~'])); Sound.mrrp(cat.pitch, 'q'); }
    cat.walkTo(target);
  }
  function needsNudge(cat) {
    const bb = cat.bbox(CS * 0.25);
    if (intersects(bb, Room.carpetRect(grid, 6))) return true;
    if (cat.pos.y < WALL_Y - CS * 0.35) return true;
    if (cat.pos.x < -cat.width * 0.4 || cat.pos.x + cat.width > W + cat.width * 0.4 || cat.pos.y + cat.height > H + cat.height * 0.4) return true;
    return false;
  }
  function checkComplete() {
    for (const k of grid.target) if (!grid.occupied.has(k)) return;
    complete = true; completeTimer = 0;
    Sound.chime();
    cats.forEach((c, i) => {
      c.idleTime = 0; c.sleepAfter = rnd(1.5, 4); c.state = 'idle';
      const cc = c.center();
      setTimeout(() => burst(cc.x, cc.y - 20, 6, 'heart'), i * 120);
    });
    showHint(pick(['Wat een lieve poesjes!', 'Alle poesjes liggen lekker!', 'Spinnend tevreden!', 'Knus hoor!']), 20);
  }

  // --- deeltjes -----------------------------------------------------------
  function burst(x, y, n, type) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(30, 90);
      particles.push({
        type, x: x + rnd(-20, 20), y: y + rnd(-20, 20), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
        life: 0, max: rnd(0.9, 1.6), size: rnd(8, 15), rot: rnd(0, 6.28),
        color: pick(['#f28ca6', '#f6b7c3', '#ffd1dc', '#f9c784']),
      });
    }
  }
  function spawnZzz(x, y) {
    particles.push({ type: 'z', x, y, vx: rnd(6, 14), vy: -18, life: 0, max: 2.2, size: rnd(10, 15) });
  }
  function heartPath(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s / 4);
    ctx.bezierCurveTo(x - s / 2, y + s / 2, x, y + s * 0.75, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.75, x + s / 2, y + s / 2, x + s / 2, y + s / 4);
    ctx.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3);
    ctx.closePath();
  }
  function drawParticles(t) {
    for (const p of particles) {
      const f = p.life / p.max, alpha = f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8;
      ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
      if (p.type === 'heart') {
        ctx.fillStyle = p.color; heartPath(p.x, p.y, p.size * (1 - f * 0.3)); ctx.fill();
      } else if (p.type === 'spark') {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot + t * 3);
        ctx.fillStyle = '#fff2b0';
        const s = p.size * 0.6 * (1 - f * 0.5);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.35 : s; const a = k * Math.PI / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
      } else if (p.type === 'z') {
        ctx.fillStyle = '#7a4f4f'; ctx.font = `800 ${Math.round(p.size + f * 6)}px "Nunito","Segoe UI",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('z', p.x + Math.sin(p.life * 3) * 4, p.y);
      }
      ctx.restore();
    }
  }
  function drawMotes(t) {
    const S = Room.SUN;
    for (const m of motes) {
      const a = 0.25 + 0.25 * Math.sin(t * 1.3 + m.phase);
      ctx.fillStyle = `rgba(255,250,220,${a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // --- invoer -------------------------------------------------------------
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function sortedCats() {
    const s = cats.slice().sort((a, b) => a.bottom - b.bottom);
    if (held) { const i = s.indexOf(held); if (i >= 0) { s.splice(i, 1); s.push(held); } }
    return s;
  }
  function topCatAt(p) {
    const s = sortedCats();
    for (let i = s.length - 1; i >= 0; i--) if (s[i].containsPoint(p.x, p.y)) return s[i];
    return null;
  }
  let wasPlaced = null;
  function pickUp(cat, p) {
    wasPlaced = cat.placed ? { gx: cat.gx, gy: cat.gy } : null;
    if (cat.placed) freeCells(cat);
    cat.wake(); cat.pickUp();
    held = cat; grabOff = { x: p.x - cat.pos.x, y: p.y - cat.pos.y }; dragStart = p; moved = false;
    downTime = performance.now(); carried = false;
    Sound.purrStart(cat.pitch);
    if (Math.random() < 0.6) Sound.mrrp(cat.pitch, 'hi');
    const hp = cat.headPos(); burst(hp.x, hp.y - 20, 2, 'heart');
    canvas.style.cursor = 'grabbing';
    if (levelIdx < 4) showHint('Spatie draait · klik om neer te leggen', 5);
  }
  function rotateHeld(times = 1) {
    if (!held) return;
    for (let k = 0; k < times; k++) held.rotate();
    Sound.pop(held.pitch);
    // de poes draait om haar midden; de muis blijft op dezelfde plek vastpakken
    grabOff = { x: lastP.x - held.pos.x, y: lastP.y - held.pos.y };
    moved = true;
  }
  function release(p) {
    const cat = held; held = null; carried = false;
    Sound.purrStop();
    cat.drop();
    if (!trySnap(cat) && needsNudge(cat)) nudgeOff(cat);
    canvas.style.cursor = topCatAt(p) ? 'grab' : 'default';
  }
  // een poes draaien die niet opgepakt is (rechtermuisknop of scrollen boven een poes)
  function rotateInPlace(cat, times = 1) {
    if (cat.placed) {
      const was = { gx: cat.gx, gy: cat.gy };
      freeCells(cat);
      for (let k = 0; k < times; k++) cat.rotate();
      if (isValid(cat, ...Object.values(snapCoords(cat)))) { place(cat, ...Object.values(snapCoords(cat))); Sound.pop(cat.pitch); }
      else { for (let k = 0; k < (4 - times % 4) % 4; k++) cat.rotate(); cat.anim.squash = 0.06; cat.anim.earTwitch = 1; place(cat, was.gx, was.gy); Sound.mrrp(cat.pitch, 'q'); }
    } else {
      for (let k = 0; k < times; k++) cat.rotate();
      Sound.pop(cat.pitch);
      cat.wake(); cat.drop();
      if (needsNudge(cat)) nudgeOff(cat, false);
    }
  }

  canvas.addEventListener('pointerdown', e => {
    if (!started || e.button === 2) return;
    Sound.ensure();
    const p = toLogical(e); lastP = p;
    if (held) { release(p); return; }                    // gedragen poes neerleggen
    const cat = topCatAt(p);
    if (cat) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} pickUp(cat, p); }
  });
  canvas.addEventListener('pointermove', e => {
    const p = toLogical(e); lastP = p;
    if (held) {
      held.pos.x = p.x - grabOff.x; held.pos.y = p.y - grabOff.y;
      if (dragStart && Math.hypot(p.x - dragStart.x, p.y - dragStart.y) > 7) moved = true;
    } else if (started) {
      canvas.style.cursor = topCatAt(p) ? 'grab' : 'default';
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (!held || e.button === 2) return;
    const p = toLogical(e);
    const quick = performance.now() - downTime < 350 && !moved;
    // een korte klik pakt op zonder vast te houden; een loslaten vlak na een toets (bv. touchpad dat
    // uitschakelt tijdens typen) negeren we, zodat de poes niet per ongeluk valt
    if (quick || performance.now() - lastKeyTime < 400) { carried = true; return; }
    release(p);
  });
  canvas.addEventListener('pointercancel', e => { if (held && e.pointerType !== 'mouse') release(toLogical(e)); });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (held) rotateHeld();
    else if (started) { const c = topCatAt(toLogical(e)); if (c) rotateInPlace(c); }
  });
  canvas.addEventListener('wheel', e => {
    if (!started) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelCooldown < 180) return;
    wheelCooldown = now;
    if (held) rotateHeld(e.deltaY < 0 ? 3 : 1);
    else { const c = topCatAt(toLogical(e)); if (c) rotateInPlace(c, e.deltaY < 0 ? 3 : 1); }
  }, { passive: false });
  window.addEventListener('keyup', e => { if (e.key === ' ' && overlay.classList.contains('hidden')) e.preventDefault(); });
  window.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && !overlay.classList.contains('hidden')) { e.preventDefault(); btnStart.click(); return; }
    lastKeyTime = performance.now();
    if (!held) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'r' || e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); rotateHeld(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); rotateHeld(3); }
  });

  btnSound.addEventListener('click', () => {
    const on = !Sound.isEnabled();
    Sound.ensure(); Sound.setEnabled(on);
    btnSound.textContent = on ? '🔊' : '🔇';
    btnSound.classList.toggle('off', !on);
  });
  btnStart.addEventListener('click', () => {
    if (overlay.classList.contains('hidden')) return;   // knop is onzichtbaar: niets doen
    btnStart.blur();                                     // anders 'klikt' de spatiebalk de knop opnieuw
    if (window.Splash) Splash.stop();
    Sound.ensure(); Sound.ambientStart();
    if (!started) { started = true; if (pendingHint) { showHint(pendingHint, 9); pendingHint = ''; } }
    else { levelIdx++; loadLevel(levelIdx); }
    overlay.classList.add('hidden');
  });

  // --- lus ----------------------------------------------------------------
  const gameApi = { spawnZzz };
  function update(dt, t) {
    for (const c of cats) c.update(dt, t, gameApi);
    for (const p of particles) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'heart') { p.vy -= 30 * dt; p.vx *= 0.98; }
      if (p.type === 'spark') { p.vy += 60 * dt; }
    }
    particles = particles.filter(p => p.life < p.max);
    const S = Room.SUN;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i]; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.y < S.y1 + 4) motes[i] = newMote(false);
    }
    if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) hintEl.classList.remove('show'); }

    // heel af en toe staat een poes op en wandelt weg
    if (started && !complete && !held) {
      walkTimer -= dt;
      if (walkTimer <= 0) {
        walkTimer = rnd(50, 95);
        const placed = cats.filter(c => c.placed && c.state !== 'held');
        if (placed.length >= 2 && Math.random() < 0.7) {
          const cat = pick(placed);
          freeCells(cat); cat.wake();
          cat.say(pick(['mrrp!', 'miauw~', 'even strekken...']), 2.2);
          Sound.mrrp(cat.pitch, 'down');
          cat.walkTo(findSpot(cat, cats, cat.pos), true);
        }
      }
    }
    if (complete) {
      completeTimer += dt;
      if (completeTimer > 0.4 && Math.random() < dt * 2.5) {
        const c = pick(cats).center(); burst(c.x, c.y - 10, 1, 'heart');
      }
      if (completeTimer > 2.6 && overlay.classList.contains('hidden')) {
        overlayTitle.textContent = pick(['Alle poesjes liggen lekker!', 'Knus hoor!', 'Spinnend tevreden!']);
        overlayText.innerHTML = pick([
          'De poesjes doen een dutje in de zon.',
          'Zo veel zachte buikjes bij elkaar.',
          'Iedereen heeft een plekje gevonden.',
          'Prrr... wat een fijn kleedje.',
        ]);
        btnStart.textContent = 'Volgende puzzel 🐾';
        overlay.style.display = '';
        overlay.classList.remove('hidden');
      }
    }
  }

  function drawGhost() {
    if (!held || !moved) return;
    const { gx, gy } = snapCoords(held);
    if (!touchesGrid(held, gx, gy)) return;
    const ok = isValid(held, gx, gy);
    ctx.fillStyle = ok ? 'rgba(150,215,160,0.45)' : 'rgba(235,150,165,0.3)';
    for (const c of held.cells) {
      const x = gx + c.x, y = gy + c.y;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) continue;
      ctx.beginPath(); rr(ctx, grid.x + x * CS + 5, grid.y + y * CS + 5, CS - 10, CS - 10, 12); ctx.fill();
    }
  }

  function draw(t) {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    Room.drawCarpet(ctx, grid, carpetColor);
    drawMotes(t);
    drawGhost();
    for (const c of sortedCats()) c.draw(ctx, t);
    drawParticles(t);
  }

  function frame(ms) {
    const t = ms / 1000;
    const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
    update(dt, t);
    draw(t);
    requestAnimationFrame(frame);
  }

  // ?level=3 begint bij puzzel 3, ?nosplash slaat het startscherm over (handig bij ontwikkelen)
  const params = new URLSearchParams(location.search);
  levelIdx = Math.max(0, (parseInt(params.get('level'), 10) || 1) - 1);
  loadLevel(levelIdx);
  if (params.has('debug')) window.PP = { cats: () => cats, held: () => held, grid: () => grid };
  if (params.has('nosplash')) {
    started = true;
    overlay.style.display = 'none'; overlay.classList.add('hidden');
  }
  requestAnimationFrame(frame);
})();
