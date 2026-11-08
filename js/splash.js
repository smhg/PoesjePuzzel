'use strict';
// Startscherm: een klein tafereeltje met knusse poesjes op een kleedje.
// Gebruikt de Cat-klasse uit cat.js. Splash.start() begint met animeren,
// Splash.stop() stopt de lus en haalt de 'splash'-klasse van #overlay af.
const Splash = (() => {
  const LW = 480, LH = 200;            // logische grootte van het tafereel
  const overlay = document.getElementById('overlay');
  const canvas = document.getElementById('splash-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const { rnd, pick } = Levels;

  let raf = 0, running = false, lastT = 0, cssW = 0, dpr = 1;
  let cats = [], particles = [], heartTimer = 1.2, bounceTimer = 4;
  let start = 0;

  // Zachte schaduw die wel meeschaalt (de schaduw in cat.js rekent in schermpixels).
  function softShadow(cat, c) {
    c.save();
    const supportsFilter = 'filter' in c;
    if (supportsFilter) c.filter = 'blur(5px)';
    c.fillStyle = 'rgba(90,45,55,0.28)';
    cat.tracePath(c, cat.cs * 0.1, 3, 8);
    c.fill();
    if (!supportsFilter) {
      c.fillStyle = 'rgba(90,45,55,0.12)';
      cat.tracePath(c, cat.cs * 0.02, 5, 12); c.fill();
    }
    c.restore();
  }

  function makeCat(cells, colorIdx, cs, x, y, opts = {}) {
    const cat = new Cat(cells, colorIdx, cs);
    cat.headIdx = opts.head ?? cat.headIdx;
    cat.facing = { x: 0, y: 1 };                     // kijkt ons aan
    cat.tailIdx = opts.tail ?? cat.tailIdx;
    cat.tailDir = opts.tailDir || cat.tailDir;
    cat.pos = { x, y }; cat.prev = { x, y };
    cat.sleepAfter = 1e9;                            // zelf regelen wie slaapt
    if (opts.sleep) { cat.state = 'sleeping'; cat.zzzTimer = rnd(0.5, 1.5); }
    cat.drawShadow = function (c) { softShadow(this, c); };
    cat.breath = rnd(0, 6.28);
    cat.bobPhase = rnd(0, 6.28);
    return cat;
  }

  function setup() {
    cats = [
      // oranje tabby, lang uitgestrekt, links
      makeCat([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 0, 52, 36, 118, { head: 2, tail: 0, tailDir: { x: -1, y: 0 } }),
      // roze poesje, slaapt in het midden
      makeCat([{ x: 0, y: 0 }], 7, 66, 210, 104, { sleep: true, tailDir: { x: 1, y: 0 } }),
      // lila poesje, rechts, staartje omhoog
      makeCat([{ x: 0, y: 0 }, { x: 1, y: 0 }], 9, 54, 302, 116, { head: 1, tail: 0, tailDir: { x: 0, y: -1 } }),
    ];
    particles = [];
  }

  const splashApi = {
    spawnZzz(x, y) {
      particles.push({ type: 'z', x, y, vx: rnd(4, 9), vy: -12, life: 0, max: 2.6, size: rnd(9, 12) });
    },
  };

  function heartPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.3);
    c.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s / 4);
    c.bezierCurveTo(x - s / 2, y + s / 2, x, y + s * 0.75, x, y + s);
    c.bezierCurveTo(x, y + s * 0.75, x + s / 2, y + s / 2, x + s / 2, y + s / 4);
    c.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3);
    c.closePath();
  }

  function resizeIfNeeded() {
    const w = canvas.clientWidth;
    const d = window.devicePixelRatio || 1;
    if (w === cssW && d === dpr && canvas.width) return;
    cssW = w; dpr = d;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(w * dpr * LH / LW));
  }

  function drawBackdrop(c, t) {
    // muurtje en vloer in zachte pasteltinten
    const wall = c.createLinearGradient(0, 0, 0, LH * 0.62);
    wall.addColorStop(0, '#fbeee3'); wall.addColorStop(1, '#f4dccb');
    c.fillStyle = wall; c.fillRect(0, 0, LW, LH);
    // zonnige gloed rechtsboven
    const sun = c.createRadialGradient(LW * 0.8, -20, 10, LW * 0.8, -20, 190);
    sun.addColorStop(0, 'rgba(255,240,200,0.75)'); sun.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = sun; c.fillRect(0, 0, LW, LH);
    // behangstipjes
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (let y = 14; y < LH * 0.6 - 10; y += 26) for (let x = ((y / 26) % 2) * 13 + 10; x < LW; x += 26) {
      c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
    }
    // plint
    const fy = LH * 0.62;
    c.fillStyle = '#eccfb8'; c.fillRect(0, fy - 9, LW, 9);
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(0, fy - 9, LW, 2);
    // vloer
    c.fillStyle = '#dcae7a'; c.fillRect(0, fy, LW, LH - fy);
    for (let y = fy, row = 0; y < LH; y += 22, row++) {
      c.fillStyle = row % 2 ? '#d7a670' : '#deb07c'; c.fillRect(0, y, LW, 22);
      c.fillStyle = 'rgba(90,50,20,0.14)'; c.fillRect(0, y, LW, 1.5);
    }
    const ao = c.createLinearGradient(0, fy, 0, fy + 40);
    ao.addColorStop(0, 'rgba(70,35,20,0.18)'); ao.addColorStop(1, 'rgba(70,35,20,0)');
    c.fillStyle = ao; c.fillRect(0, fy, LW, 40);
    // het kleedje
    const rx = 28, ry = fy - 36, rw = LW - 56, rh = LH - ry - 10;
    c.save();
    c.shadowColor = 'rgba(70,35,45,0.28)'; c.shadowBlur = 10 * dpr * (cssW / LW); c.shadowOffsetY = 4 * dpr * (cssW / LW);
    c.fillStyle = '#e4a7a1'; c.beginPath(); rr(c, rx, ry, rw, rh, 22); c.fill();
    c.restore();
    c.strokeStyle = '#f3dccb'; c.lineWidth = 2.2; c.lineCap = 'round';
    for (let y = ry + 10; y < ry + rh - 4; y += 8) {
      c.beginPath(); c.moveTo(rx + 1, y); c.lineTo(rx - 8, y + 2); c.stroke();
      c.beginPath(); c.moveTo(rx + rw - 1, y); c.lineTo(rx + rw + 8, y + 2); c.stroke();
    }
    c.save(); c.beginPath(); rr(c, rx, ry, rw, rh, 22); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 1.5;
    for (let d = -rh; d < rw; d += 8) { c.beginPath(); c.moveTo(rx + d, ry); c.lineTo(rx + d + rh, ry + rh); c.stroke(); }
    c.strokeStyle = '#c7807e'; c.lineWidth = 6; c.beginPath(); rr(c, rx + 9, ry + 9, rw - 18, rh - 18, 15); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.setLineDash([5, 5]);
    c.beginPath(); rr(c, rx + 9, ry + 9, rw - 18, rh - 18, 15); c.stroke(); c.setLineDash([]);
    c.restore();
    // bolletje wol, rechts op het kleedje
    const wx = 438, wy = 150;
    c.fillStyle = 'rgba(70,35,45,0.18)'; c.beginPath(); c.ellipse(wx, wy + 14, 16, 5, 0, 0, Math.PI * 2); c.fill();
    const yg = c.createRadialGradient(wx - 5, wy - 6, 1, wx, wy, 15);
    yg.addColorStop(0, '#fbd4dd'); yg.addColorStop(1, '#e8a0b4');
    c.fillStyle = yg; c.beginPath(); c.arc(wx, wy, 13, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.6;
    for (let k = -1; k <= 1; k++) { c.beginPath(); c.ellipse(wx, wy, 13, 13, 0.5 + k * 0.35, 0.3, 2.7); c.stroke(); }
    c.strokeStyle = '#e8a0b4'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(wx + 10, wy + 8); c.bezierCurveTo(wx + 28, wy + 12, wx + 14, wy + 30, wx + 34, wy + 30); c.stroke();
  }

  function drawParticles(c) {
    for (const p of particles) {
      const f = p.life / p.max, alpha = f < 0.25 ? f / 0.25 : 1 - (f - 0.25) / 0.75;
      c.save(); c.globalAlpha = Math.max(0, alpha) * 0.9;
      if (p.type === 'heart') {
        c.fillStyle = p.color; heartPath(c, p.x + Math.sin(p.life * 1.4 + p.phase) * 4, p.y, p.size); c.fill();
      } else {
        c.fillStyle = '#7a4f4f'; c.font = `800 ${Math.round(p.size + f * 5)}px "Nunito","Ubuntu","Segoe UI",sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('z', p.x + Math.sin(p.life * 2.2) * 3, p.y);
      }
      c.restore();
    }
  }

  function update(dt, t) {
    for (const cat of cats) cat.update(dt, t, splashApi);
    heartTimer -= dt;
    if (heartTimer <= 0) {
      heartTimer = rnd(2.2, 3.8);
      const cat = pick(cats), hp = cat.headPos();
      particles.push({
        type: 'heart', x: hp.x + rnd(-18, 18), y: hp.y - cat.cs * 0.7, vx: 0, vy: rnd(-16, -11),
        life: 0, max: rnd(3, 4.2), size: rnd(7, 11), phase: rnd(0, 6.28),
        color: pick(['#f28ca6', '#f6b7c3', '#ffd1dc', '#f9c784']),
      });
    }
    bounceTimer -= dt;
    if (bounceTimer <= 0) {
      bounceTimer = rnd(6, 10);
      const awake = cats.filter(c => c.state !== 'sleeping');
      const cat = pick(awake);
      cat.anim.squash = 0.14; cat.anim.earTwitch = 1;
    }
    for (const p of particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    particles = particles.filter(p => p.life < p.max);
  }

  function draw(t) {
    const s = canvas.width / LW;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawBackdrop(ctx, t);
    const sorted = cats.slice().sort((a, b) => a.bottom - b.bottom);
    for (const cat of sorted) {
      // rustig ademen en een heel zacht wiegen, vanuit de onderkant van het lijfje
      const asleep = cat.state === 'sleeping';
      const b = Math.sin(t * (asleep ? 1.1 : 1.6) + cat.breath) * (asleep ? 0.014 : 0.02);
      const bob = Math.sin(t * 0.9 + cat.bobPhase) * 1.2;
      const c = cat.center(), base = cat.bottom;
      ctx.save();
      ctx.translate(c.x, base + bob);
      ctx.scale(1 - b * 0.6, 1 + b);
      ctx.translate(-c.x, -base);
      cat.draw(ctx, t);
      ctx.restore();
    }
    drawParticles(ctx);
  }

  function frame(ms) {
    if (!running) return;
    const t = ms / 1000;
    if (!start) { start = t; lastT = t; }
    const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
    resizeIfNeeded();
    update(dt, t - start);
    draw(t - start);
    raf = requestAnimationFrame(frame);
  }

  function startSplash() {
    if (!canvas || running) return;
    overlay.classList.add('splash');
    if (!cats.length) setup();
    running = true; start = 0;
    raf = requestAnimationFrame(frame);
  }
  function stopSplash() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    overlay.classList.remove('splash');
  }

  return { start: startSplash, stop: stopSplash };
})();

// ?nosplash (zie game.js) slaat het startscherm over
if (new URLSearchParams(location.search).has('nosplash')) Splash.stop(); else Splash.start();
