'use strict';
// De kamer: muur, raam, vloer, plankje, kussen en mandje staan in één keer voorgetekende achtergrond
// (renderBackground). Het kleedje wordt per puzzel in een offscreen canvas getekend en daarna gewoon
// geblit. Plant, bolletje wol, bakje en krabpaal reageren op poezen en worden elk frame getekend.
// Stijl: zacht en 'pluche' zoals de poezen: geen harde lijnen, lagen met verloop, fijne korrel
// (furGrain/furEdge/seeded komen uit cat.js).
const Room = (() => {
  const W = 1280, H = 800, WALL_Y = 205;
  const CARPET_COLORS = [
    { base: '#e4a7a1', border: '#c7807e', cell: '#faf0e2', fringe: '#f3dccb' },
    { base: '#a9c7b3', border: '#7fa58d', cell: '#f7f3e4', fringe: '#e5ead9' },
    { base: '#aac4dd', border: '#7f9fc0', cell: '#f6f4ec', fringe: '#e0e8f2' },
    { base: '#c9b6dc', border: '#a08bbd', cell: '#f8f2f6', fringe: '#e9e0f0' },
    { base: '#e9c08f', border: '#c99a63', cell: '#fcf5e6', fringe: '#f3e2c8' },
  ];
  // Plekken waar liever geen poes wordt neergezet (plant, krabpaal, bakje, bolletje wol (rolt mee), kussen, mandje).
  const PROPS = [
    { x: 20, y: 560, w: 170, h: 230 },
    { x: 1120, y: 250, w: 150, h: 380 },
    { x: 1040, y: 690, w: 120, h: 90 },
    { x: 982, y: 604, w: 52, h: 60 },
    { x: 40, y: 240, w: 160, h: 105 },
    { x: 960, y: 235, w: 150, h: 110 },
  ];
  const SUN = { x1: 230, x2: 470, y1: 235, dx: 60, h: 190 }; // lichtvlek op de vloer

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); rr(ctx, x, y, w, h, r); }
  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
  function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rad(ctx, x, y, r0, r1, stops, x1 = x, y1 = y) { const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  // fijne korrel (soft-light) over een gebied
  function grain(ctx, x, y, w, h, alpha) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = alpha; ctx.fillStyle = furGrain(ctx); ctx.fillRect(x, y, w, h); ctx.restore();
  }
  // zachte schaduw op de vloer (ambient occlusion onder een meubel)
  function softShadow(ctx, cx, cy, rx, ry, alpha) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    ctx.fillStyle = rad(ctx, 0, 0, 0, rx, [[0, `rgba(70,35,45,${alpha})`], [0.55, `rgba(70,35,45,${alpha * 0.6})`], [1, 'rgba(70,35,45,0)']]);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // punten met buitennormaal langs een afgeronde rechthoek (voor pluche randjes via furEdge)
  function rrectSamples(x, y, w, h, r, step) {
    const out = [];
    const seg = (x0, y0, x1, y1, nx, ny) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, nx, ny }); } };
    const arc = (cx, cy, a0, a1) => { const n = Math.max(2, Math.round(r * (a1 - a0) / step)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / n; out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }); } };
    seg(x + r, y, x + w - r, y, 0, -1); arc(x + w - r, y + r, -Math.PI / 2, 0); seg(x + w, y + r, x + w, y + h - r, 1, 0); arc(x + w - r, y + h - r, 0, Math.PI / 2);
    seg(x + w - r, y + h, x + r, y + h, 0, 1); arc(x + r, y + h - r, Math.PI / 2, Math.PI); seg(x, y + h - r, x, y + r, -1, 0); arc(x + r, y + r, Math.PI, Math.PI * 1.5);
    return out;
  }
  // pluche kussentje: verloop, korrel en een pluizige rand
  function plush(ctx, x, y, w, h, r, cols, seed, tuftCs = 50) {
    ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [[0, cols.light], [0.45, cols.base], [1, cols.dark]]);
    rrect(ctx, x, y, w, h, r); ctx.fill();
    ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip(); grain(ctx, x - 2, y - 2, w + 4, h + 4, 0.3); ctx.restore();
    furEdge(ctx, rrectSamples(x, y, w, h, r, 4), cols, seed, tuftCs);
  }
  // een blad: punt omhoog vanaf (0,0), met licht- en schaduwkant, nerf en zachte glans
  function leafShape(ctx, L, Wd, curl) {
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-Wd * 0.55, -L * 0.22, -Wd * 0.62 + curl * 0.4, -L * 0.72, curl, -L);
    ctx.bezierCurveTo(Wd * 0.62 + curl * 0.4, -L * 0.72, Wd * 0.55, -L * 0.22, 0, 0); ctx.closePath();
  }
  function drawLeaf(ctx, L, Wd, curl, c1, c2, c3) {
    ctx.save();
    leafShape(ctx, L, Wd, curl);
    ctx.fillStyle = lin(ctx, 0, 0, curl * 0.5, -L, [[0, c1], [0.55, c2], [1, c3]]); ctx.fill();
    ctx.clip();
    // schaduwkant rechts van de nerf, lichtkant links
    ctx.fillStyle = lin(ctx, -Wd * 0.1, 0, Wd * 0.6, 0, [[0, 'rgba(20,60,30,0)'], [1, 'rgba(20,60,30,0.2)']]); ctx.fillRect(-Wd, -L - 2, Wd * 2, L + 4);
    ctx.fillStyle = rad(ctx, -Wd * 0.18, -L * 0.62, 0, L * 0.35, [[0, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(-Wd, -L - 2, Wd * 2, L + 4);
    // hoofdnerf en zijnerfjes
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(curl * 0.3, -L * 0.55, curl * 0.85, -L * 0.9); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let k = 1; k <= 4; k++) {
      const t = 0.18 + k * 0.16, px = curl * t * 0.6, py = -L * t;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px - Wd * 0.2, py - L * 0.05, px - Wd * 0.4 * (1 - t * 0.6), py - L * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + Wd * 0.2, py - L * 0.05, px + Wd * 0.4 * (1 - t * 0.6), py - L * 0.1); ctx.stroke();
    }
    grain(ctx, -Wd, -L - 2, Wd * 2, L + 4, 0.25);
    ctx.restore();
  }

  // --- muur -------------------------------------------------------------------
  function drawWall(ctx) {
    ctx.fillStyle = lin(ctx, 0, 0, 0, WALL_Y, [[0, '#f8e7d8'], [1, '#f1d6c2']]); ctx.fillRect(0, 0, W, WALL_Y);
    // behangmotief: kleine bloemetjes om en om, met stipjes ertussen
    for (let y = 16; y < WALL_Y - 24; y += 44) for (let x = ((y / 44) % 2) * 22 + 14; x < W; x += 44) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(235,170,160,0.35)'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(215,160,150,0.16)'; ctx.beginPath(); ctx.arc(x + 22, y + 22, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // warm licht rond het raam, iets koeler en donkerder naar rechts
    ctx.fillStyle = rad(ctx, 305, 110, 10, 760, [[0, 'rgba(255,246,228,0.5)'], [0.5, 'rgba(255,246,228,0.18)'], [1, 'rgba(255,246,228,0)']]); ctx.fillRect(0, 0, W, WALL_Y);
    ctx.fillStyle = lin(ctx, 700, 0, W, 0, [[0, 'rgba(170,120,120,0)'], [1, 'rgba(170,120,120,0.1)']]); ctx.fillRect(0, 0, W, WALL_Y);
    grain(ctx, 0, 0, W, WALL_Y, 0.16);
    drawWindow(ctx);
    drawPicture(ctx);
    drawShelf(ctx);
    // plint met een lichte bovenrand en schaduw eronder
    ctx.fillStyle = lin(ctx, 0, WALL_Y - 18, 0, WALL_Y, [[0, '#f3dcc7'], [0.5, '#e9cdb6'], [1, '#dcbba2']]); ctx.fillRect(0, WALL_Y - 18, W, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, WALL_Y - 18, W, 3);
    ctx.fillStyle = 'rgba(90,50,40,0.12)'; ctx.fillRect(0, WALL_Y - 20, W, 2);
  }

  function drawWindow(ctx) {
    const wx = 170, wy = 22, ww = 270, wh = 165;
    // kozijn met zachte schaduw en afgeschuinde rand
    ctx.save(); ctx.shadowColor = 'rgba(90,50,40,0.22)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fff6ea'; rrect(ctx, wx - 14, wy - 14, ww + 28, wh + 28, 16); ctx.fill(); ctx.restore();
    ctx.fillStyle = lin(ctx, wx - 14, wy - 14, wx + ww, wy + wh, [[0, '#fffaf2'], [1, '#f0dcc9']]); rrect(ctx, wx - 14, wy - 14, ww + 28, wh + 28, 16); ctx.fill();
    ctx.fillStyle = 'rgba(120,80,60,0.22)'; rrect(ctx, wx - 5, wy - 5, ww + 10, wh + 10, 8); ctx.fill();     // binnenrand (diepte)
    // lucht
    ctx.save(); rrect(ctx, wx, wy, ww, wh, 6); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, wy, 0, wy + wh, [[0, '#a9d3f1'], [0.6, '#d6ebf8'], [1, '#f2ebdf']]); ctx.fillRect(wx, wy, ww, wh);
    // zonnetje met gloed
    ctx.fillStyle = rad(ctx, wx + 215, wy + 42, 2, 70, [[0, 'rgba(255,248,210,1)'], [0.25, 'rgba(255,236,170,0.95)'], [0.45, 'rgba(255,230,160,0.35)'], [1, 'rgba(255,230,160,0)']]); ctx.fillRect(wx, wy, ww, wh);
    // wolken: zachte bollen met een schaduwkant
    const cloud = (cx, cy, s) => {
      const blobs = [[0, 0, 26], [26, -8, 32], [56, 2, 24], [20, 10, 22], [42, 12, 20]];
      ctx.fillStyle = 'rgba(160,190,220,0.3)'; for (const [dx, dy, r] of blobs) { ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s + 6 * s, r * s, 0, Math.PI * 2); ctx.fill(); }
      for (const [dx, dy, r] of blobs) {
        ctx.fillStyle = rad(ctx, cx + dx * s - r * s * 0.3, cy + dy * s - r * s * 0.4, 0, r * s, [[0, 'rgba(255,255,255,1)'], [0.7, 'rgba(255,255,255,0.97)'], [1, 'rgba(240,246,252,0.9)']]);
        ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
      }
    };
    cloud(wx + 40, wy + 60, 1.0); cloud(wx + 190, wy + 108, 0.75);
    // glans op het glas
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.moveTo(wx + 10, wy + wh); ctx.lineTo(wx + 70, wy); ctx.lineTo(wx + 110, wy); ctx.lineTo(wx + 50, wy + wh); ctx.closePath(); ctx.fill();
    ctx.restore();
    // roeden
    ctx.fillStyle = '#fff6ea'; ctx.fillRect(wx + ww / 2 - 5, wy, 10, wh); ctx.fillRect(wx, wy + wh / 2 - 5, ww, 10);
    ctx.fillStyle = 'rgba(120,80,60,0.14)'; ctx.fillRect(wx + ww / 2 + 3, wy, 2, wh); ctx.fillRect(wx, wy + wh / 2 + 3, ww, 2);
    // gordijnroede
    ctx.fillStyle = lin(ctx, 0, wy - 30, 0, wy - 22, [[0, '#ecc8a4'], [1, '#d4a67c']]); rrect(ctx, wx - 72, wy - 30, ww + 144, 8, 4); ctx.fill();
    ctx.fillStyle = '#d9ae84'; ell(ctx, wx - 74, wy - 26, 7, 7); ctx.fill(); ell(ctx, wx + ww + 74, wy - 26, 7, 7); ctx.fill();
    // gordijnen met plooien: een horizontaal verloop van lichte ribbels en donkere dalen
    [[wx - 36, 1], [wx + ww + 36, -1]].forEach(([cx, sgn]) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - sgn * 36, wy - 24); ctx.lineTo(cx + sgn * 30, wy - 24);
      ctx.quadraticCurveTo(cx + sgn * 14, wy + wh * 0.45, cx + sgn * 6, wy + wh * 0.66);      // ingesnoerd bij het embrasse
      ctx.quadraticCurveTo(cx + sgn * 24, wy + wh * 0.9, cx + sgn * 30, wy + wh + 34);
      ctx.lineTo(cx - sgn * 44, wy + wh + 34); ctx.closePath();
      ctx.clip();
      const x0 = cx - sgn * 44, x1 = cx + sgn * 30, stops = [];
      for (let k = 0; k <= 7; k++) { stops.push([k / 7, k % 2 ? '#e8a09e' : '#f7c3bf']); if (k < 7) stops.push([(k + 0.5) / 7, '#f1b0ad']); }
      ctx.fillStyle = lin(ctx, x0, 0, x1, 0, stops); ctx.fillRect(Math.min(x0, x1) - 10, wy - 30, 90, wh + 80);
      ctx.fillStyle = lin(ctx, 0, wy + wh * 0.6, 0, wy + wh + 34, [[0, 'rgba(120,60,60,0)'], [1, 'rgba(120,60,60,0.16)']]); ctx.fillRect(Math.min(x0, x1) - 10, wy, 90, wh + 60);
      grain(ctx, Math.min(x0, x1) - 10, wy - 30, 90, wh + 80, 0.2);
      ctx.restore();
      // embrasse
      ctx.fillStyle = lin(ctx, 0, wy + wh * 0.6, 0, wy + wh * 0.72, [[0, '#f7d08a'], [1, '#e3b06a']]);
      rrect(ctx, Math.min(cx - sgn * 12, cx + sgn * 14) - 2, wy + wh * 0.6, 30, 12, 6); ctx.fill();
    });
    // vensterbank met dikte en schaduw op de muur
    ctx.fillStyle = lin(ctx, 0, wy + wh + 24, 0, wy + wh + 46, [[0, 'rgba(90,50,40,0.16)'], [1, 'rgba(90,50,40,0)']]); ctx.fillRect(wx - 30, wy + wh + 24, ww + 60, 22);
    ctx.fillStyle = lin(ctx, 0, wy + wh + 8, 0, wy + wh + 24, [[0, '#fff6ea'], [0.6, '#f6e3d0'], [1, '#e5c7ad']]); rrect(ctx, wx - 30, wy + wh + 8, ww + 60, 16, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(wx - 26, wy + wh + 9, ww + 52, 2);
    // vetplantje op de vensterbank
    const sx = wx + ww - 34, sy = wy + wh + 8;
    softShadow(ctx, sx, sy + 1, 16, 4, 0.25);
    ctx.fillStyle = lin(ctx, sx - 12, 0, sx + 12, 0, [[0, '#fff3e4'], [1, '#e8cdb3']]); ctx.beginPath(); ctx.moveTo(sx - 12, sy - 18); ctx.lineTo(sx + 12, sy - 18); ctx.lineTo(sx + 9, sy); ctx.lineTo(sx - 9, sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b4a3a'; ell(ctx, sx, sy - 18, 11, 3); ctx.fill();
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, rr2 = 8 + (k % 2) * 3;
      ctx.fillStyle = k % 2 ? '#8ec48d' : '#a9d6a3'; ell(ctx, sx + Math.cos(a) * rr2 * 0.6, sy - 22 + Math.sin(a) * rr2 * 0.35 - 4, 5.5, 3.2, a); ctx.fill();
    }
    ctx.fillStyle = '#b9dfb0'; ell(ctx, sx, sy - 26, 4.5, 3.5); ctx.fill();
  }

  function drawPicture(ctx) {
    const fx = 900, fy = 52, fw = 120, fh = 92;
    ctx.save(); ctx.shadowColor = 'rgba(90,50,40,0.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#c99a6a'; ctx.fillRect(fx, fy, fw, fh); ctx.restore();
    ctx.fillStyle = lin(ctx, fx, fy, fx + fw, fy + fh, [[0, '#d9ad7d'], [1, '#b8875a']]); ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(fx + 3, fy + 3, fw - 6, fh - 6);
    ctx.fillStyle = 'rgba(70,40,30,0.25)'; ctx.fillRect(fx + 8, fy + 8, fw - 16, fh - 16);
    // passe-partout en prentje: slapend poesje in het gras
    ctx.fillStyle = '#fff8ec'; ctx.fillRect(fx + 10, fy + 10, fw - 20, fh - 20);
    const px = fx + 18, py = fy + 18, pw = fw - 36, ph = fh - 36;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, py, 0, py + ph, [[0, '#cfe6f6'], [1, '#eaf3f8']]); ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = rad(ctx, px + pw - 14, py + 12, 1, 14, [[0, 'rgba(255,240,190,1)'], [1, 'rgba(255,240,190,0)']]); ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#b8dcb0'; ell(ctx, px + pw * 0.5, py + ph + 6, pw * 0.75, 22); ctx.fill();
    ctx.fillStyle = '#a3cf9d'; ell(ctx, px + pw * 0.2, py + ph + 10, pw * 0.5, 16); ctx.fill();
    // poesje: lijfje, kopje, oortjes, dichte oogjes, staartje
    ctx.fillStyle = '#f3c89a'; ell(ctx, px + pw * 0.5, py + ph * 0.66, 20, 10); ctx.fill();
    ctx.beginPath(); ctx.arc(px + pw * 0.36, py + ph * 0.56, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px + pw * 0.36 - 9, py + ph * 0.56 - 5); ctx.lineTo(px + pw * 0.36 - 7, py + ph * 0.56 - 15); ctx.lineTo(px + pw * 0.36 - 1, py + ph * 0.56 - 9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px + pw * 0.36 + 9, py + ph * 0.56 - 5); ctx.lineTo(px + pw * 0.36 + 7, py + ph * 0.56 - 15); ctx.lineTo(px + pw * 0.36 + 1, py + ph * 0.56 - 9); ctx.fill();
    ctx.strokeStyle = '#f3c89a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px + pw * 0.5 + 18, py + ph * 0.7); ctx.quadraticCurveTo(px + pw * 0.5 + 30, py + ph * 0.72, px + pw * 0.5 + 28, py + ph * 0.52); ctx.stroke();
    ctx.strokeStyle = '#8a5a44'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(px + pw * 0.36 - 4, py + ph * 0.58, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(px + pw * 0.36 + 4, py + ph * 0.58, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#e88a9a'; ell(ctx, px + pw * 0.36, py + ph * 0.63, 1.6, 1.2); ctx.fill();
    ctx.fillStyle = '#f3a0af'; ctx.beginPath(); const hx = px + pw * 0.78, hy = py + ph * 0.3;
    ctx.moveTo(hx, hy + 4); ctx.bezierCurveTo(hx - 6, hy - 2, hx - 1, hy - 6, hx, hy - 1); ctx.bezierCurveTo(hx + 1, hy - 6, hx + 6, hy - 2, hx, hy + 4); ctx.fill();
    ctx.restore();
    // glas: zachte glans
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(fx + 10, fy + fh - 10); ctx.lineTo(fx + 50, fy + 10); ctx.lineTo(fx + 72, fy + 10); ctx.lineTo(fx + 32, fy + fh - 10); ctx.closePath(); ctx.fill();
  }

  function drawShelf(ctx) {
    const sx = 1056, sy = 110, sw = 190;
    // schaduw op de muur, plank met dikte
    ctx.fillStyle = lin(ctx, 0, sy + 12, 0, sy + 40, [[0, 'rgba(90,50,40,0.2)'], [1, 'rgba(90,50,40,0)']]); ctx.fillRect(sx - 4, sy + 12, sw + 8, 28);
    ctx.fillStyle = lin(ctx, 0, sy, 0, sy + 14, [[0, '#eac49c'], [0.5, '#dcb48b'], [1, '#c99a6e']]); rrect(ctx, sx, sy, sw, 14, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(sx + 3, sy + 1, sw - 6, 2);
    // steuntjes
    ctx.fillStyle = '#c99a6e'; ctx.beginPath(); ctx.moveTo(sx + 18, sy + 14); ctx.lineTo(sx + 34, sy + 14); ctx.lineTo(sx + 18, sy + 30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx + sw - 18, sy + 14); ctx.lineTo(sx + sw - 34, sy + 14); ctx.lineTo(sx + sw - 18, sy + 30); ctx.fill();
    // boekjes: zachte ruggen met een lichte kant en een leunend boek
    const books = [['#f6b7c3', '#d98a9c', 15, 48], ['#a9c7b3', '#7fa58d', 13, 40], ['#aac4dd', '#7f9fc0', 17, 54], ['#f3d58a', '#cfae5c', 12, 44]];
    let bx = sx + 14;
    books.forEach(([c, d, w, h], i) => {
      ctx.save();
      if (i === 3) { ctx.translate(bx + w, sy); ctx.rotate(-0.22); ctx.translate(-(bx + w), -sy); }
      ctx.fillStyle = 'rgba(70,40,30,0.18)'; ell(ctx, bx + w / 2, sy + 1, w * 0.8, 3); ctx.fill();
      ctx.fillStyle = lin(ctx, bx, 0, bx + w, 0, [[0, mix(c, '#ffffff', 0.3)], [0.4, c], [1, d]]); rrect(ctx, bx, sy - h, w, h + 1, 2.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx + 2, sy - h + 6, 1.5, h - 12);
      ctx.fillStyle = 'rgba(80,40,40,0.25)'; ctx.fillRect(bx + w * 0.3, sy - h + 10, w * 0.4, 1.5); ctx.fillRect(bx + w * 0.3, sy - h + 14, w * 0.4, 1.5);
      ctx.restore();
      bx += w + 3;
    });
    // potje met plantje
    const ppx = sx + 118, ppy = sy;
    ctx.fillStyle = 'rgba(70,40,30,0.18)'; ell(ctx, ppx, ppy + 1, 20, 3.5); ctx.fill();
    ctx.fillStyle = lin(ctx, ppx - 17, 0, ppx + 17, 0, [[0, '#eaa390'], [0.5, '#d98a74'], [1, '#b96e5c']]);
    ctx.beginPath(); ctx.moveTo(ppx - 17, ppy - 26); ctx.lineTo(ppx + 17, ppy - 26); ctx.lineTo(ppx + 13, ppy); ctx.lineTo(ppx - 13, ppy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lin(ctx, 0, ppy - 30, 0, ppy - 22, [[0, '#f0b2a0'], [1, '#d98a74']]); rrect(ctx, ppx - 19, ppy - 30, 38, 8, 3); ctx.fill();
    [[-10, -0.55, 26, 12], [0, 0.05, 32, 13], [10, 0.5, 24, 11], [-4, -0.2, 18, 10], [5, 0.25, 18, 10]].forEach(([dx, a, L, Wd], i) => {
      ctx.save(); ctx.translate(ppx + dx, ppy - 30); ctx.rotate(a);
      drawLeaf(ctx, L, Wd, 0, i % 2 ? '#5f9f63' : '#6aa96b', i % 2 ? '#7cb97b' : '#86c585', '#a5d6a0'); ctx.restore();
    });
    // poezenbeeldje
    const cx = sx + 164, cy = sy;
    ctx.fillStyle = 'rgba(70,40,30,0.18)'; ell(ctx, cx, cy + 1, 13, 3); ctx.fill();
    ctx.fillStyle = lin(ctx, cx - 12, 0, cx + 12, 0, [[0, '#fff5e6'], [0.5, '#f4e2cc'], [1, '#d7bb9c']]);
    ell(ctx, cx, cy - 12, 11, 12); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - 1, cy - 30, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 9, cy - 34); ctx.lineTo(cx - 7, cy - 43); ctx.lineTo(cx - 2, cy - 37); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 7, cy - 34); ctx.lineTo(cx + 5, cy - 43); ctx.lineTo(cx, cy - 37); ctx.fill();
    ctx.strokeStyle = '#e6cfb4'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + 9, cy - 6); ctx.quadraticCurveTo(cx + 19, cy - 8, cx + 16, cy - 20); ctx.stroke();
    ctx.strokeStyle = '#9a7a66'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx - 4, cy - 29, 2, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 2, cy - 29, 2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#e8a0b4'; ell(ctx, cx - 1, cy - 25.5, 1.4, 1); ctx.fill();
  }

  // --- vloer ------------------------------------------------------------------
  function drawFloor(ctx) {
    ctx.fillStyle = '#d9a975'; ctx.fillRect(0, WALL_Y, W, H - WALL_Y);
    const plank = 46;
    for (let y = WALL_Y, row = 0; y < H; y += plank, row++) {
      const off = (row * 173) % 300 - 300;
      for (let x = off, k = 0; x < W; x += 300, k++) {
        const s = seeded(row * 31 + k * 7 + 0.3);
        const tone = mix(row % 2 ? '#d4a26d' : '#dcae7a', s < 0.5 ? '#cf9c66' : '#e2b582', Math.abs(s - 0.5) * 0.8);
        // elke plank een eigen tint met een zachte glans van boven naar beneden
        ctx.fillStyle = lin(ctx, 0, y, 0, y + plank, [[0, mix(tone, '#ffffff', 0.08)], [0.5, tone], [1, mix(tone, '#7a4a28', 0.1)]]);
        ctx.fillRect(x, y, 300, plank);
        // houtnerf: golvende lijntjes, af en toe een noestje
        ctx.lineWidth = 1.2;
        for (let g = 0; g < 5; g++) {
          const yy = y + 6 + g * 8.5 + seeded(row * 11 + k * 3 + g) * 4, amp = 2 + seeded(row + g * 5 + k) * 3;
          ctx.strokeStyle = g % 3 === 1 ? 'rgba(255,240,220,0.12)' : `rgba(110,65,30,${0.06 + seeded(g + k * 2 + row) * 0.05})`;
          ctx.beginPath(); ctx.moveTo(x, yy);
          ctx.bezierCurveTo(x + 80, yy + amp, x + 150, yy - amp, x + 220, yy + amp * 0.6); ctx.quadraticCurveTo(x + 270, yy + amp * 1.2, x + 300, yy - amp * 0.4); ctx.stroke();
        }
        if (seeded(row * 17 + k * 5 + 0.7) < 0.22) {
          const nx = x + 60 + seeded(row + k) * 180, ny = y + 14 + seeded(row * 3 + k) * 18;
          ctx.strokeStyle = 'rgba(110,65,30,0.16)'; ctx.lineWidth = 1.5; ell(ctx, nx, ny, 9, 4.5, 0.1); ctx.stroke(); ell(ctx, nx, ny, 4.5, 2.2, 0.1); ctx.stroke();
          ctx.fillStyle = 'rgba(110,65,30,0.12)'; ell(ctx, nx, ny, 2.2, 1.2); ctx.fill();
        }
        // kopse naad
        ctx.fillStyle = 'rgba(90,50,20,0.22)'; ctx.fillRect(x, y, 2, plank);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 2, y, 1.5, plank);
      }
      ctx.fillStyle = 'rgba(90,50,20,0.2)'; ctx.fillRect(0, y, W, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, y + 2, W, 1.5);
    }
    grain(ctx, 0, WALL_Y, W, H - WALL_Y, 0.2);
    // glans over de vloer, schaduw onder de muur en zachte vignet
    ctx.fillStyle = lin(ctx, 0, WALL_Y, W, H, [[0, 'rgba(255,235,200,0)'], [0.4, 'rgba(255,235,200,0.1)'], [0.6, 'rgba(255,235,200,0.04)'], [1, 'rgba(255,235,200,0)']]); ctx.fillRect(0, WALL_Y, W, H - WALL_Y);
    ctx.fillStyle = lin(ctx, 0, WALL_Y, 0, WALL_Y + 120, [[0, 'rgba(70,35,20,0.26)'], [0.3, 'rgba(70,35,20,0.1)'], [1, 'rgba(70,35,20,0)']]); ctx.fillRect(0, WALL_Y, W, 120);
    ctx.fillStyle = rad(ctx, W / 2, H * 0.6, H * 0.3, H * 0.95, [[0, 'rgba(60,30,30,0)'], [1, 'rgba(60,30,30,0.25)']]); ctx.fillRect(0, WALL_Y, W, H - WALL_Y);
    // zonlicht door het raam, met een zachte rand
    for (let k = 0; k < 4; k++) {
      const ins = k * 7;
      ctx.fillStyle = `rgba(255,240,190,${0.09})`;
      ctx.beginPath(); ctx.moveTo(SUN.x1 + ins, SUN.y1); ctx.lineTo(SUN.x2 - ins, SUN.y1); ctx.lineTo(SUN.x2 + SUN.dx - ins, SUN.y1 + SUN.h - ins * 1.5); ctx.lineTo(SUN.x1 + SUN.dx + ins, SUN.y1 + SUN.h - ins * 1.5); ctx.closePath(); ctx.fill();
    }
    ctx.save();
    ctx.beginPath(); ctx.moveTo(SUN.x1, SUN.y1); ctx.lineTo(SUN.x2, SUN.y1); ctx.lineTo(SUN.x2 + SUN.dx, SUN.y1 + SUN.h); ctx.lineTo(SUN.x1 + SUN.dx, SUN.y1 + SUN.h); ctx.closePath(); ctx.clip();
    ctx.fillStyle = 'rgba(200,140,80,0.16)';
    const mx = (SUN.x1 + SUN.x2) / 2, my = SUN.y1 + SUN.h / 2;
    ctx.beginPath(); ctx.moveTo(mx - 5, SUN.y1); ctx.lineTo(mx + 5, SUN.y1); ctx.lineTo(mx + 5 + SUN.dx, SUN.y1 + SUN.h); ctx.lineTo(mx - 5 + SUN.dx, SUN.y1 + SUN.h); ctx.fill();
    ctx.fillRect(SUN.x1, my - 5, SUN.x2 - SUN.x1 + SUN.dx, 10);
    ctx.restore();
  }

  // --- vaste extra's: rond kussen en rieten mandje (in de achtergrond) ----------
  function drawCushion(ctx) {
    const cx = 120, cy = 298;
    softShadow(ctx, cx, cy + 30, 78, 22, 0.3);
    const cols = { base: '#b9d9c7', light: '#d9ece1', dark: '#8fb8a3' };
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.62);
    ctx.fillStyle = rad(ctx, -14, -18, 4, 70, [[0, cols.light], [0.55, cols.base], [1, cols.dark]]);
    ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.clip(); grain(ctx, -70, -70, 140, 140, 0.3); ctx.restore();
    ctx.restore();
    furEdge(ctx, ellipseSamples(cx, cy, 64, 40, 3), cols, 7, 34);
    // dikke rand en knoopje in het midden
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ell(ctx, cx, cy - 2, 50, 29); ctx.stroke();
    ctx.fillStyle = rad(ctx, cx, cy, 0, 22, [[0, 'rgba(90,130,110,0.22)'], [1, 'rgba(90,130,110,0)']]); ell(ctx, cx, cy, 22, 14); ctx.fill();
    ctx.fillStyle = '#f6b7c3'; ell(ctx, cx, cy, 5, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, cx - 1.5, cy - 1, 1.6, 1.1); ctx.fill();
  }

  function drawBasket(ctx) {
    const bx = 1035, by = 300, bw = 112, bh = 52;
    softShadow(ctx, bx, by + bh / 2 + 4, 70, 16, 0.3);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(bx - bw / 2, by - bh / 2 + 8); ctx.lineTo(bx + bw / 2, by - bh / 2 + 8);
    ctx.quadraticCurveTo(bx + bw / 2, by + bh / 2, bx + bw / 2 - 22, by + bh / 2); ctx.lineTo(bx - bw / 2 + 22, by + bh / 2); ctx.quadraticCurveTo(bx - bw / 2, by + bh / 2, bx - bw / 2, by - bh / 2 + 8); ctx.closePath();
    ctx.fillStyle = lin(ctx, bx - bw / 2, 0, bx + bw / 2, 0, [[0, '#d8ae7c'], [0.3, '#e7c69a'], [1, '#c2946a']]); ctx.fill();
    ctx.clip();
    // vlechtwerk: twee richtingen dunne lijntjes, licht en donker
    ctx.lineWidth = 1.5;
    for (let k = -8; k < 16; k++) {
      ctx.strokeStyle = 'rgba(120,80,40,0.2)'; ctx.beginPath(); ctx.moveTo(bx - bw / 2 + k * 9, by - bh / 2); ctx.lineTo(bx - bw / 2 + k * 9 + 24, by + bh / 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,210,0.22)'; ctx.beginPath(); ctx.moveTo(bx - bw / 2 + k * 9 + 4, by - bh / 2); ctx.lineTo(bx - bw / 2 + k * 9 - 20, by + bh / 2); ctx.stroke();
    }
    for (let yy = by - bh / 2 + 14; yy < by + bh / 2; yy += 7) { ctx.strokeStyle = 'rgba(120,80,40,0.14)'; ctx.beginPath(); ctx.moveTo(bx - bw / 2, yy); ctx.lineTo(bx + bw / 2, yy); ctx.stroke(); }
    ctx.fillStyle = lin(ctx, 0, by, 0, by + bh / 2, [[0, 'rgba(90,50,20,0)'], [1, 'rgba(90,50,20,0.18)']]); ctx.fillRect(bx - bw / 2, by, bw, bh / 2);
    grain(ctx, bx - bw / 2, by - bh / 2, bw, bh, 0.25);
    ctx.restore();
    // dekentje erin (voor de rand, zodat de rand ervoor valt)
    ctx.save(); ell(ctx, bx, by - bh / 2 + 8, bw / 2 - 6, 11); ctx.clip();
    ctx.fillStyle = '#f6c9d1'; ctx.fillRect(bx - bw / 2, by - 40, bw, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; for (let k = -4; k < 5; k++) ctx.fillRect(bx + k * 12 - 2, by - 40, 5, 40);
    ctx.fillStyle = lin(ctx, 0, by - bh / 2 - 4, 0, by - bh / 2 + 20, [[0, 'rgba(120,60,70,0)'], [1, 'rgba(120,60,70,0.25)']]); ctx.fillRect(bx - bw / 2, by - 40, bw, 60);
    ctx.restore();
    // rand (dikke gevlochten band)
    ctx.strokeStyle = '#c99a6e'; ctx.lineWidth = 7; ell(ctx, bx, by - bh / 2 + 8, bw / 2, 11); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 2; ell(ctx, bx, by - bh / 2 + 6, bw / 2, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,40,0.25)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ell(ctx, bx, by - bh / 2 + 8, bw / 2, 11); ctx.stroke(); ctx.setLineDash([]);
  }

  // --- spulletjes die reageren ------------------------------------------------
  // Plant, bolletje wol, etensbakje en krabpaal worden elk frame getekend (niet in de achtergrond),
  // zodat ze kunnen reageren als een poes ertegenaan stoot: bump() geeft een zetje, updateProps()
  // laat alles rustig uitdempen, drawables() levert de tekenlagen (gesorteerd op onderkant, samen
  // met de poezen). Alleen de schaduwen op de vloer blijven in de achtergrond.
  // gedempte veer: s.a = uitwijking (rad), s.v = hoeksnelheid; omega = eigenfrequentie (rad/s), zeta = demping
  function spring(s, dt, omega, zeta, pendulum = false) {
    const acc = -omega * omega * (pendulum ? Math.sin(s.a) : s.a) - 2 * zeta * omega * s.v;
    s.v += acc * dt; s.a += s.v * dt;
  }
  const plant = { sway: { a: 0, v: 0 }, pot: { a: 0, v: 0 }, rustle: 0, bits: [] };
  const yarn = { x: 1008, y: 630, r: 22, vx: 0, vy: 0, rot: 0, unwound: 0, thread: [{ x: 1080, y: 690 }, { x: 1058, y: 676 }, { x: 1034, y: 652 }] };
  const bowl = { rock: { a: 0, v: 0 }, ripple: 0, rippleT: 0, fishSide: -1, fishX: -14, fishFlipAt: -1 };
  const post = { sway: { a: 0, v: 0 }, mouse: { a: 0, v: 0 } };
  const YARN_PROP = PROPS[3];               // leeft mee met het bolletje (voor het verspreiden van poezen)
  const PLANT_PIVOT = { x: 105, y: 696 }, POT_FOOT = { x: 105, y: 775 }, BOWL_FOOT = { x: 1100, y: 752 }, POST_FOOT = { x: 1195, y: 613 }, MOUSE_PIVOT = { x: 1240, y: 372 };
  const YARN_BLOCKERS = [{ x: 40, y: 560, w: 125, h: 220 }, { x: 1050, y: 700, w: 100, h: 60 }, { x: 1128, y: 240, w: 130, h: 390 }, { x: 975, y: 250, w: 125, h: 85 }, { x: 50, y: 250, w: 140, h: 95 }];

  // raakvlakken (logische coördinaten) waar een poes tegenaan kan stoten
  function propRects() {
    return [
      { id: 'plant', x: 48, y: 560, w: 115, h: 212 },
      { id: 'yarn', x: yarn.x - yarn.r, y: yarn.y - yarn.r, w: yarn.r * 2, h: yarn.r * 2 + 6 },
      { id: 'bowl', x: 1056, y: 712, w: 88, h: 44 },
      { id: 'post', x: 1132, y: 250, w: 122, h: 376 },
    ];
  }

  function limitYarnSpeed(max) {
    const sp = Math.hypot(yarn.vx, yarn.vy);
    if (sp > max) { yarn.vx *= max / sp; yarn.vy *= max / sp; }
  }

  // Een zetje: dir = richting waarin de poes beweegt (of naar het voorwerp toe), strength ~0.3 (zacht) .. 1.4 (flink).
  function bump(id, dir, strength = 1) {
    const s = clamp(strength, 0.2, 1.5);
    const len = Math.hypot(dir.x, dir.y) || 1, dx = dir.x / len, dy = dir.y / len;
    const side = Math.abs(dx) < 0.25 ? (Math.random() < 0.5 ? -0.4 : 0.4) : dx;   // van bovenaf: toch een kant kiezen
    if (id === 'plant') {
      plant.sway.v = clamp(plant.sway.v + side * 1.3 * s, -2, 2);
      plant.rustle = Math.min(1, plant.rustle + 0.6 * s);
      if (s > 0.95) plant.pot.v = clamp(plant.pot.v + side * 0.35 * s, -0.6, 0.6);     // pot wiebelt alleen bij een flinke stoot
      const n = s > 0.6 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        plant.bits.push({ x: rnd(65, 145), y: rnd(600, 660), vx: rnd(-6, 6), vy: rnd(16, 28), rot: rnd(0, 6.3), spin: rnd(-2, 2),
          life: 0, max: rnd(1.6, 2.6), size: rnd(2.5, 4.5), phase: rnd(0, 6.3), leaf: Math.random() < 0.6 });
      }
    } else if (id === 'yarn') {
      yarn.vx += dx * 150 * s; yarn.vy += dy * 150 * s;
      limitYarnSpeed(230);
    } else if (id === 'bowl') {
      bowl.rock.v = clamp(bowl.rock.v + side * 0.9 * s, -1.6, 1.6);
      bowl.ripple = Math.min(1, bowl.ripple + 0.7 * s); bowl.rippleT = 0;
      if (bowl.fishFlipAt < 0 || bowl.fishFlipAt > 0.35) { bowl.fishSide = -bowl.fishSide; bowl.fishFlipAt = 0; }
    } else if (id === 'post') {
      post.sway.v = clamp(post.sway.v + side * 0.12 * s, -0.25, 0.25);
      post.mouse.v = clamp(post.mouse.v + side * 2.4 * s, -3, 3);
    }
  }
  // Zachte, aanhoudende duw zolang een poes over het bolletje hangt: het rolt onder haar vandaan.
  function nudge(id, dir, dt) {
    if (id !== 'yarn') return;
    const len = Math.hypot(dir.x, dir.y) || 1;
    yarn.vx += dir.x / len * 700 * dt; yarn.vy += dir.y / len * 700 * dt;
    limitYarnSpeed(200);
  }

  // Houdt het bolletje in de kamer en uit de buurt van kleedje, meubels en liggende poezen (avoid = rechthoeken).
  function keepYarnClear(avoid, dt) {
    const r = yarn.r, maxStep = 260 * dt;
    yarn.x = clamp(yarn.x, r + 8, W - r - 8); yarn.y = clamp(yarn.y, WALL_Y + r + 10, H - r - 6);
    for (const R of YARN_BLOCKERS.concat(avoid)) {
      const l = R.x - r, rt = R.x + R.w + r, tp = R.y - r, bt = R.y + R.h + r;
      if (yarn.x <= l || yarn.x >= rt || yarn.y <= tp || yarn.y >= bt) continue;
      let best = null;
      for (const p of [[l - yarn.x, 0], [rt - yarn.x, 0], [0, tp - yarn.y], [0, bt - yarn.y]]) {
        if (!best || Math.abs(p[0]) + Math.abs(p[1]) < Math.abs(best[0]) + Math.abs(best[1])) best = p;
      }
      const d = Math.hypot(best[0], best[1]) || 1, k = Math.min(1, maxStep / d);
      yarn.x += best[0] * k; yarn.y += best[1] * k;
      if (best[0]) yarn.vx *= -0.2; else yarn.vy *= -0.2;      // zacht terugstuiten
    }
  }

  function updateProps(dt, t, avoid = []) {
    // plant: zwaaiende bladeren, ritselen dat wegebt, pot die heel even wiebelt, vallende blaadjes/stofjes
    spring(plant.sway, dt, 7, 0.12); spring(plant.pot, dt, 15, 0.3);
    plant.rustle *= Math.exp(-dt * 1.6);
    for (const b of plant.bits) { b.life += dt; b.x += (b.vx + Math.sin(t * 2.2 + b.phase) * 10) * dt; b.y += b.vy * dt; b.rot += b.spin * dt; }
    plant.bits = plant.bits.filter(b => b.life < b.max);
    // bakje: schommelt, rimpels, visje schiet naar de andere kant
    spring(bowl.rock, dt, 16, 0.18); bowl.ripple *= Math.exp(-dt * 1.4); bowl.rippleT += dt;
    if (bowl.fishFlipAt >= 0) bowl.fishFlipAt += dt;
    bowl.fishX += (bowl.fishSide * 14 - bowl.fishX) * Math.min(1, dt * 8);
    // krabpaal: wiegt heel licht, muisje slingert als een slinger na
    spring(post.sway, dt, 9, 0.2); spring(post.mouse, dt, 4.2, 0.04, true);
    // bolletje wol: rolt uit met wrijving, draait mee, wikkelt draad af
    const ox = yarn.x, oy = yarn.y;
    if (yarn.vx || yarn.vy) {
      const f = Math.exp(-dt * 2.2); yarn.vx *= f; yarn.vy *= f;
      if (Math.hypot(yarn.vx, yarn.vy) < 4) yarn.vx = yarn.vy = 0;
      yarn.x += yarn.vx * dt; yarn.y += yarn.vy * dt;
    }
    keepYarnClear(avoid, dt);
    const mdx = yarn.x - ox, mdy = yarn.y - oy;
    if (mdx || mdy) {
      yarn.rot += (mdx + mdy * 0.4) / yarn.r;
      const last = yarn.thread[yarn.thread.length - 1];
      if (Math.hypot(yarn.x - last.x, yarn.y - last.y) > 10) {
        yarn.thread.push({ x: yarn.x + rnd(-2, 2), y: yarn.y + rnd(-2, 2) });
        yarn.unwound += 10; yarn.r = Math.max(15, 22 - yarn.unwound * 0.012);     // bolletje wordt heel langzaam kleiner
        if (yarn.thread.length > 150) yarn.thread.splice(1, 1);
      }
    }
    YARN_PROP.x = yarn.x - yarn.r - 4; YARN_PROP.y = yarn.y - yarn.r - 4; YARN_PROP.w = yarn.r * 2 + 8; YARN_PROP.h = yarn.r * 2 + 12;
  }

  function drawStaticShadows(ctx) {
    softShadow(ctx, 105, 772, 84, 20, 0.32);
    softShadow(ctx, 1195, 624, 82, 18, 0.3);
    softShadow(ctx, 1100, 753, 58, 14, 0.3);
  }

  // --- plant --------------------------------------------------------------------
  const LEAVES = [   // [hoek, lengte, breedte, krul, kleuren]  van achter naar voren
    [-0.62, 100, 40, -6, ['#4f8f56', '#6aa96b', '#9ccf96']],
    [0.58, 104, 42, 6, ['#4a8a52', '#5f9f63', '#92c78e']],
    [-0.08, 128, 48, -4, ['#558f58', '#79b877', '#aadca4']],
    [-0.3, 72, 32, -3, ['#6aa96b', '#84c283', '#b4e0ad']],
    [0.34, 74, 32, 3, ['#5f9f63', '#6fae6f', '#a3d59d']],
  ];
  function drawPlant(ctx, t) {
    const S = plant.sway.a;
    ctx.save();
    // pot wiebelt om zijn voet: terracotta met glans, een rand en aarde
    ctx.translate(POT_FOOT.x, POT_FOOT.y); ctx.rotate(plant.pot.a); ctx.translate(-POT_FOOT.x, -POT_FOOT.y);
    ctx.fillStyle = lin(ctx, 60, 0, 150, 0, [[0, '#e9a28c'], [0.35, '#dd8f78'], [0.75, '#cc7d68'], [1, '#b56a58']]);
    ctx.beginPath(); ctx.moveTo(60, 702); ctx.lineTo(150, 702); ctx.lineTo(140, 768); ctx.quadraticCurveTo(138, 776, 130, 776); ctx.lineTo(80, 776); ctx.quadraticCurveTo(72, 776, 70, 768); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.moveTo(60, 702); ctx.lineTo(150, 702); ctx.lineTo(140, 776); ctx.lineTo(70, 776); ctx.closePath(); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, 740, 0, 776, [[0, 'rgba(80,30,20,0)'], [1, 'rgba(80,30,20,0.18)']]); ctx.fillRect(50, 700, 110, 80);
    ctx.fillStyle = 'rgba(255,235,220,0.22)'; ctx.beginPath(); ctx.moveTo(70, 712); ctx.lineTo(82, 712); ctx.lineTo(80, 768); ctx.lineTo(72, 768); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,50,40,0.1)'; ctx.fillRect(56, 724, 100, 5);
    grain(ctx, 50, 700, 110, 80, 0.3);
    ctx.restore();
    ctx.fillStyle = lin(ctx, 0, 688, 0, 710, [[0, '#f0b3a0'], [0.5, '#e39a82'], [1, '#c97a68']]); rrect(ctx, 54, 688, 102, 22, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; rrect(ctx, 60, 690, 60, 4, 2); ctx.fill();
    ctx.fillStyle = lin(ctx, 0, 690, 0, 702, [[0, '#5b3f33'], [1, '#7a5a48']]); ell(ctx, 105, 697, 44, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,200,0.18)'; for (let k = 0; k < 7; k++) { ell(ctx, 72 + k * 11 + (k % 2) * 3, 695 + (k % 3), 1.6, 1); ctx.fill(); }
    // bladeren zwaaien om de potrand, elk blad nog een beetje extra om zijn eigen voet; ritselen = klein trillinkje
    ctx.translate(PLANT_PIVOT.x, PLANT_PIVOT.y); ctx.rotate(S * 0.5); ctx.translate(-PLANT_PIVOT.x, -PLANT_PIVOT.y);
    LEAVES.forEach(([ang, L, Wd, curl, cols], i) => {
      const extra = S * (0.5 + 0.15 * (i % 3)) + Math.sin(t * 9 + i * 1.7) * plant.rustle * 0.035;
      ctx.save(); ctx.translate(PLANT_PIVOT.x + Math.sin(ang) * 6 + (i >= 3 ? Math.sin(ang) * 14 : 0), PLANT_PIVOT.y - 2); ctx.rotate(ang + extra);
      drawLeaf(ctx, L, Wd, curl, cols[0], cols[1], cols[2]); ctx.restore();
    });
    ctx.restore();
    // dwarrelende blaadjes en stofjes
    for (const b of plant.bits) {
      const f = b.life / b.max;
      ctx.save(); ctx.globalAlpha = f < 0.15 ? f / 0.15 : f > 0.7 ? (1 - f) / 0.3 : 1;
      ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.fillStyle = b.leaf ? '#8cc48a' : 'rgba(255,245,225,0.9)';
      ell(ctx, 0, 0, b.leaf ? b.size : b.size * 0.4, b.leaf ? b.size * 0.5 : b.size * 0.4); ctx.fill();
      ctx.restore();
    }
  }

  // --- bolletje wol -------------------------------------------------------------
  // de losse draad ligt op de vloer, dus altijd achter alles
  function drawThread(ctx) {
    const th = yarn.thread;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [col, w, dy] of [['rgba(120,60,80,0.18)', 4, 1.5], ['#e8a0b4', 3, 0], ['rgba(255,255,255,0.35)', 1, -0.6]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(th[0].x, th[0].y + dy);
      for (let i = 1; i < th.length; i++) {
        const p = th[i], q = th[i + 1] || yarn;
        ctx.quadraticCurveTo(p.x, p.y + dy, (p.x + q.x) / 2, (p.y + q.y) / 2 + dy);
      }
      ctx.lineTo(yarn.x, yarn.y + dy); ctx.stroke();
    }
    ctx.restore();
  }
  const YARN_COLS = { base: '#eaa6b9', light: '#fbd6df', dark: '#d58aa2' };
  function drawYarn(ctx) {
    const { x, y, r } = yarn;
    ctx.save();
    softShadow(ctx, x + 2, y + r - 1, r * 1.35, r * 0.42, 0.34);
    ctx.translate(x, y);
    ctx.fillStyle = rad(ctx, -r * 0.35, -r * 0.4, 1, r * 1.15, [[0, '#fde3e9'], [0.4, '#eeadbf'], [0.85, '#dd93aa'], [1, '#cf8099']]);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // gewikkelde draden in twee richtingen, elk met een lichte en een schaduwlijn
    ctx.save(); ctx.rotate(yarn.rot); ctx.beginPath(); ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2); ctx.clip();
    ctx.lineWidth = 2.2;
    for (let k = -3; k <= 3; k++) {
      const a = 0.5 + k * 0.22;
      ctx.strokeStyle = 'rgba(150,70,100,0.16)'; ctx.beginPath(); ctx.ellipse(1, 1.5, r, r * 0.96, a, 0.15, 2.95); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.96, a, 0.15, 2.95); ctx.stroke();
    }
    for (let k = -2; k <= 2; k++) {
      const a = -0.95 + k * 0.3;
      ctx.strokeStyle = 'rgba(150,70,100,0.12)'; ctx.beginPath(); ctx.ellipse(1, 1.5, r * 0.98, r * 0.9, a, 3.4, 6.1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.98, r * 0.9, a, 3.4, 6.1); ctx.stroke();
    }
    grain(ctx, -r, -r, 2 * r, 2 * r, 0.3);
    ctx.restore();
    // zachte pluisrand en een glansje
    furEdge(ctx, ellipseSamples(0, 0, r, r, 3.5), YARN_COLS, 3, 28);
    ctx.fillStyle = rad(ctx, -r * 0.35, -r * 0.4, 0, r * 0.5, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- etensbakje ---------------------------------------------------------------
  function drawBowl(ctx, t) {
    const A = bowl.rock.a, F = BOWL_FOOT;
    ctx.save();
    ctx.translate(F.x, F.y); ctx.rotate(A); ctx.translate(-F.x, -F.y);
    // keramiek: verloop, glans en een pootafdrukje voorop
    ctx.fillStyle = lin(ctx, 0, 722, 0, 752, [[0, '#a8d3ec'], [0.5, '#8fc3e0'], [1, '#6fa6c9']]); rrect(ctx, 1056, 722, 88, 30, 12); ctx.fill();
    ctx.save(); rrect(ctx, 1056, 722, 88, 30, 12); ctx.clip();
    ctx.fillStyle = lin(ctx, 1056, 0, 1144, 0, [[0, 'rgba(255,255,255,0.22)'], [0.25, 'rgba(255,255,255,0)'], [0.8, 'rgba(40,80,120,0)'], [1, 'rgba(40,80,120,0.16)']]); ctx.fillRect(1056, 722, 88, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ell(ctx, 1100, 742, 4, 3.2); ctx.fill(); [[-5, -4], [-2, -7], [2, -7], [5, -4]].forEach(([dx, dy]) => { ell(ctx, 1100 + dx, 742 + dy, 1.6, 1.6); ctx.fill(); });
    grain(ctx, 1056, 722, 88, 30, 0.25);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5; ell(ctx, 1100, 724, 44, 12); ctx.stroke();
    ell(ctx, 1100, 724, 44, 12); ctx.clip();      // binnen de rand van het bakje
    ctx.translate(F.x, F.y); ctx.rotate(-A); ctx.translate(-F.x, -F.y);
    // het water blijft waterpas en klotst een beetje naar de lage kant
    const wx = 1100 + A * 42;
    ctx.fillStyle = rad(ctx, wx + 6, 728, 2, 50, [[0, '#c4e3f4'], [0.6, '#a9d3ea'], [1, '#8dbfdd']]); ell(ctx, wx, 724, 50, 15); ctx.fill();
    ctx.fillStyle = lin(ctx, 0, 712, 0, 724, [[0, 'rgba(30,70,110,0.28)'], [1, 'rgba(30,70,110,0)']]); ctx.fillRect(1040, 708, 120, 20);   // schaduw van de rand in het water
    // rimpels
    if (bowl.ripple > 0.02) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) {
        const f = (bowl.rippleT * 1.5 + k * 0.5) % 1;
        ctx.globalAlpha = (1 - f) * bowl.ripple * 0.7;
        ell(ctx, wx, 724, 6 + 38 * f, 2 + 10 * f); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // visje
    const wig = Math.sin(t * 14) * bowl.ripple * 0.25;
    ctx.save(); ctx.translate(wx + bowl.fishX, 725); ctx.scale(bowl.fishSide, 1); ctx.rotate(wig);
    ctx.fillStyle = lin(ctx, 0, -4, 0, 4, [[0, '#f5c788'], [1, '#dd9e5a']]);
    ell(ctx, 0, 0, 9, 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-14, -4.5); ctx.lineTo(-14, 4.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(ctx, 1, -1.5, 5, 1.4); ctx.fill();
    ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.arc(4.5, -1, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // weerspiegelingen
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(wx - 24, 719); ctx.quadraticCurveTo(wx - 14, 716, wx - 4, 718); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx + 14, 730); ctx.lineTo(wx + 22, 729); ctx.stroke();
    ctx.restore();
  }

  // --- krabpaal -----------------------------------------------------------------
  // het vaste deel (voet, paal, plateaus) wordt één keer per schermschaal getekend en daarna geblit
  let postCache = null;
  function postCanvas(S) {
    if (postCache && postCache.S === S) return postCache.cv;
    const x0 = 1120, y0 = 236, w = 150, h = 400;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * S); cv.height = Math.ceil(h * S);
    const c = cv.getContext('2d'); c.scale(S, S); c.translate(-x0, -y0);
    const cream = { base: '#e8c9a3', light: '#f7e3cb', dark: '#cfa97f' }, pink = { base: '#f6b7c3', light: '#fdd9e0', dark: '#dd93a6' };
    plush(c, 1135, 598, 120, 28, 13, cream, 11);
    // paal met sisal: cilinderverloop en gewikkeld touw (licht/donker)
    c.fillStyle = lin(c, 1180, 0, 1210, 0, [[0, '#c69b74'], [0.3, '#e1bc93'], [0.6, '#d4ae85'], [1, '#b58a62']]); c.fillRect(1180, 380, 30, 230);
    c.save(); c.beginPath(); c.rect(1180, 380, 30, 230); c.clip();
    for (let y = 384; y < 612; y += 6) {
      c.strokeStyle = 'rgba(120,80,40,0.28)'; c.lineWidth = 2; c.beginPath(); c.moveTo(1178, y); c.lineTo(1212, y + 5); c.stroke();
      c.strokeStyle = 'rgba(255,240,210,0.3)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(1178, y + 2.6); c.lineTo(1212, y + 7.6); c.stroke();
    }
    grain(c, 1180, 380, 30, 230, 0.3);
    c.restore();
    plush(c, 1140, 354, 110, 32, 15, cream, 12);
    plush(c, 1150, 338, 90, 24, 12, pink, 13);
    c.fillStyle = lin(c, 1152, 0, 1174, 0, [[0, '#c69b74'], [0.35, '#e1bc93'], [1, '#b58a62']]); c.fillRect(1152, 270, 22, 72);
    for (let y = 274; y < 340; y += 6) { c.strokeStyle = 'rgba(120,80,40,0.25)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(1151, y); c.lineTo(1175, y + 4); c.stroke(); }
    plush(c, 1128, 248, 72, 26, 13, cream, 14);
    postCache = { S, cv, x0, y0, w, h };
    return cv;
  }
  function drawPost(ctx) {
    const F = POST_FOOT, S = ctx.getTransform ? ctx.getTransform().a : 1;
    const cv = postCanvas(S);
    ctx.save();
    ctx.translate(F.x, F.y); ctx.rotate(post.sway.a); ctx.translate(-F.x, -F.y);
    ctx.drawImage(cv, postCache.x0, postCache.y0, postCache.w, postCache.h);
    // speelmuisje aan een touwtje: slingert
    ctx.translate(MOUSE_PIVOT.x, MOUSE_PIVOT.y); ctx.rotate(post.mouse.a);
    ctx.strokeStyle = '#a07a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 70); ctx.stroke();
    ctx.fillStyle = rad(ctx, -4, 76, 1, 14, [[0, '#d8d3e4'], [1, '#a9a2bb']]); ell(ctx, 0, 80, 11, 8); ctx.fill();
    ctx.fillStyle = '#f3a0af'; ell(ctx, -6, 73.5, 3.6, 3.6); ctx.fill(); ell(ctx, 6, 73.5, 3.6, 3.6); ctx.fill();
    ctx.fillStyle = '#2a2230'; ell(ctx, -3.5, 79, 1.1, 1.1); ctx.fill(); ell(ctx, 3.5, 79, 1.1, 1.1); ctx.fill();
    ctx.fillStyle = '#e88a9a'; ell(ctx, 0, 84, 1.6, 1.2); ctx.fill();
    ctx.strokeStyle = '#a9a2bb'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(9, 84); ctx.quadraticCurveTo(18, 88, 16, 96); ctx.stroke();
    ctx.restore();
  }

  // Tekenlagen met hun onderkant, zodat game.js ze samen met de poezen op diepte kan sorteren.
  function drawables() {
    return [
      { bottom: -1, draw: drawThread },
      { bottom: 628, draw: drawPost },
      { bottom: yarn.y + yarn.r + 2, draw: drawYarn },
      { bottom: 754, draw: drawBowl },
      { bottom: 776, draw: drawPlant },
    ];
  }

  function renderBackground(scale) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W * scale); cv.height = Math.ceil(H * scale);
    const ctx = cv.getContext('2d'); ctx.scale(scale, scale);
    drawWall(ctx); drawFloor(ctx); drawStaticShadows(ctx); drawCushion(ctx); drawBasket(ctx);
    postCache = null;
    return cv;
  }

  // --- kleedje --------------------------------------------------------------------
  function carpetRect(grid, pad = 34) {
    return { x: grid.x - pad, y: grid.y - pad, w: grid.cols * grid.cs + 2 * pad, h: grid.rows * grid.cs + 2 * pad };
  }

  // Het kleedje is rijk getextureerd en daarom duur; we tekenen het één keer per puzzel (en per
  // schermschaal) in een offscreen canvas en blitten dat elk frame.
  let carpetCache = null;
  function drawCarpet(ctx, grid, colorIdx) {
    const S = ctx.getTransform ? ctx.getTransform().a : 1;
    const key = `${grid.x},${grid.y},${grid.cols},${grid.rows},${colorIdx},${S},${grid.target.size}`;
    if (!carpetCache || carpetCache.key !== key || carpetCache.grid !== grid) {
      const r = carpetRect(grid), m = 40;
      const cv = document.createElement('canvas'); cv.width = Math.ceil((r.w + 2 * m) * S); cv.height = Math.ceil((r.h + 2 * m) * S);
      const c = cv.getContext('2d'); c.scale(S, S); c.translate(m - r.x, m - r.y);
      paintCarpet(c, grid, colorIdx, S);
      carpetCache = { key, grid, cv, x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
    }
    ctx.drawImage(carpetCache.cv, carpetCache.x, carpetCache.y, carpetCache.w, carpetCache.h);
  }

  function paintCarpet(ctx, grid, colorIdx, S) {
    const col = CARPET_COLORS[colorIdx % CARPET_COLORS.length];
    const r = carpetRect(grid), cs = grid.cs;
    const light = mix(col.base, '#ffffff', 0.35), dark = mix(col.base, col.border, 0.5);
    // zachte schaduw
    ctx.save(); ctx.shadowColor = 'rgba(70,35,45,0.32)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 7;
    ctx.fillStyle = col.base; rrect(ctx, r.x, r.y, r.w, r.h, 26); ctx.fill(); ctx.restore();
    // franje: twee tinten met een klein schaduwtje, een beetje ongelijk
    ctx.lineCap = 'round';
    for (let y = r.y + 14, k = 0; y < r.y + r.h - 8; y += 9, k++) {
      const wob = (seeded(k * 3.1) - 0.5) * 3, len = 12 + seeded(k * 1.7) * 4;
      for (const [x0, sgn] of [[r.x + 2, -1], [r.x + r.w - 2, 1]]) {
        ctx.strokeStyle = 'rgba(70,35,45,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y + 1.5); ctx.lineTo(x0 + sgn * len, y + 4 + wob); ctx.stroke();
        ctx.strokeStyle = col.fringe; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + sgn * len, y + 2.5 + wob); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + sgn * 3, y - 0.5); ctx.lineTo(x0 + sgn * (len - 2), y + 1.5 + wob); ctx.stroke();
      }
    }
    // geweven structuur: verloop, kruisende draadjes, korrel
    ctx.save(); rrect(ctx, r.x, r.y, r.w, r.h, 26); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, r.y, 0, r.y + r.h, [[0, light], [0.5, col.base], [1, dark]]); ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = 1.2;
    for (let d = -r.h; d < r.w; d += 7) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(r.x + d, r.y); ctx.lineTo(r.x + d + r.h, r.y + r.h); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,40,50,0.06)'; ctx.beginPath(); ctx.moveTo(r.x + d + 3, r.y + r.h); ctx.lineTo(r.x + d + r.h + 3, r.y); ctx.stroke();
    }
    grain(ctx, r.x, r.y, r.w, r.h, 0.3);
    // rand: brede band met een lichte en een donkere zoom en kleine ruitjes
    const bi = 12, bw = 9;
    ctx.fillStyle = rgba(col.border, 0.8); rrect(ctx, r.x + bi, r.y + bi, r.w - 2 * bi, r.h - 2 * bi, 18); rr(ctx, r.x + bi + bw, r.y + bi + bw, r.w - 2 * (bi + bw), r.h - 2 * (bi + bw), 12); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.2; rrect(ctx, r.x + bi + 1.5, r.y + bi + 1.5, r.w - 2 * bi - 3, r.h - 2 * bi - 3, 17); ctx.stroke();
    ctx.strokeStyle = rgba(col.border, 0.5); rrect(ctx, r.x + bi + bw + 1, r.y + bi + bw + 1, r.w - 2 * (bi + bw) - 2, r.h - 2 * (bi + bw) - 2, 11); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    const mid = bi + bw / 2;
    for (let x = r.x + 36; x < r.x + r.w - 30; x += 28) { diamond(ctx, x, r.y + mid, 2.6); diamond(ctx, x, r.y + r.h - mid, 2.6); }
    for (let y = r.y + 36; y < r.y + r.h - 30; y += 28) { diamond(ctx, r.x + mid, y, 2.6); diamond(ctx, r.x + r.w - mid, y, 2.6); }
    // bloemetjes in de hoeken
    for (const [cx, cy] of [[r.x + 30, r.y + 30], [r.x + r.w - 30, r.y + 30], [r.x + 30, r.y + r.h - 30], [r.x + r.w - 30, r.y + r.h - 30]]) {
      ctx.fillStyle = rgba(col.cell, 0.75); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ell(ctx, cx + Math.cos(a) * 4.2, cy + Math.sin(a) * 4.2, 3.2, 3.2); ctx.fill(); }
      ctx.fillStyle = rgba(col.border, 0.9); ell(ctx, cx, cy, 2.4, 2.4); ctx.fill();
    }
    ctx.restore();
    // de vorm die gevuld moet worden: doorgestikte lapjes
    const has = (x, y) => grid.target.has(Levels.key(x, y));
    const cells = [...grid.target].map(k => { const [x, y] = k.split(',').map(Number); return { x, y }; });
    const shapePath = () => { ctx.beginPath(); outlinePath(ctx, cells, cs, grid.x, grid.y, 3, 11, 6); };   // één vloeiende buitenrand (cat.js)
    ctx.save();
    shapePath(); ctx.fillStyle = 'rgba(80,40,40,0.14)'; ctx.translate(0, 3); ctx.fill(); ctx.translate(0, -3);
    shapePath(); ctx.fillStyle = col.cell; ctx.fill();
    ctx.clip();
    // elk vakje een bol lapje: zachte lichtkern, schaduw naar de randen
    for (const k of grid.target) {
      const [x, y] = k.split(',').map(Number);
      const cx = grid.x + (x + 0.5) * cs, cy = grid.y + (y + 0.5) * cs;
      // straal tot voorbij de hoeken van het vakje: buiten de buitencirkel tekent Chrome anders zwart
      ctx.fillStyle = rad(ctx, cx - cs * 0.1, cy - cs * 0.12, 0, cs * 0.9, [[0, 'rgba(255,255,255,0.5)'], [0.45, 'rgba(255,255,255,0.12)'], [0.8, rgba(col.border, 0.16)], [1, rgba(col.border, 0.16)]]);
      ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);
    }
    grain(ctx, grid.x, grid.y, grid.cols * cs, grid.rows * cs, 0.28);
    // zachte schaduw langs de binnenrand van de hele vorm (brede vage en smalle wat sterkere lijn), lichte zoom
    shapePath(); ctx.strokeStyle = 'rgba(80,40,40,0.07)'; ctx.lineWidth = 14; ctx.stroke();
    shapePath(); ctx.strokeStyle = 'rgba(80,40,40,0.1)'; ctx.lineWidth = 6; ctx.stroke();
    shapePath(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    // stiksels tussen de vakjes, kuiltjes op de hoeken, pootafdrukje in het midden
    ctx.lineCap = 'round';
    for (const k of grid.target) {
      const [x, y] = k.split(',').map(Number);
      const px = grid.x + x * cs, py = grid.y + y * cs;
      ctx.setLineDash([3, 5]); ctx.strokeStyle = rgba(col.border, 0.32); ctx.lineWidth = 1.3;
      if (has(x + 1, y)) { ctx.beginPath(); ctx.moveTo(px + cs, py + 7); ctx.lineTo(px + cs, py + cs - 7); ctx.stroke(); }
      if (has(x, y + 1)) { ctx.beginPath(); ctx.moveTo(px + 7, py + cs); ctx.lineTo(px + cs - 7, py + cs); ctx.stroke(); }
      ctx.setLineDash([]);
      if (has(x + 1, y) && has(x, y + 1) && has(x + 1, y + 1)) { ctx.fillStyle = rad(ctx, px + cs, py + cs, 0, 5, [[0, 'rgba(80,40,40,0.14)'], [1, 'rgba(80,40,40,0)']]); ell(ctx, px + cs, py + cs, 5, 5); ctx.fill(); }
      ctx.fillStyle = rgba(col.border, 0.13);
      ell(ctx, px + cs / 2, py + cs / 2 + 4, 7, 6); ctx.fill();
      [[-8, -6], [-3, -10], [3, -10], [8, -6]].forEach(([dx, dy]) => { ell(ctx, px + cs / 2 + dx, py + cs / 2 + dy, 2.6, 2.6); ctx.fill(); });
    }
    ctx.restore();
  }
  function diamond(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); }

  return { W, H, WALL_Y, CARPET_COLORS, PROPS, SUN, renderBackground, drawCarpet, carpetRect, propRects, bump, nudge, updateProps, drawables,
    _state: () => ({ plant, yarn, bowl, post }) };
})();
