'use strict';
const Room = (() => {
  const W = 1280, H = 800, WALL_Y = 205;
  const CARPET_COLORS = [
    { base: '#e4a7a1', border: '#c7807e', cell: '#faf0e2', fringe: '#f3dccb' },
    { base: '#a9c7b3', border: '#7fa58d', cell: '#f7f3e4', fringe: '#e5ead9' },
    { base: '#aac4dd', border: '#7f9fc0', cell: '#f6f4ec', fringe: '#e0e8f2' },
    { base: '#c9b6dc', border: '#a08bbd', cell: '#f8f2f6', fringe: '#e9e0f0' },
    { base: '#e9c08f', border: '#c99a63', cell: '#fcf5e6', fringe: '#f3e2c8' },
  ];
  // Plekken waar liever geen poes wordt neergezet (plant, krabpaal, bakje).
  const PROPS = [
    { x: 20, y: 560, w: 170, h: 230 },
    { x: 1120, y: 250, w: 150, h: 380 },
    { x: 1040, y: 690, w: 120, h: 90 },
  ];
  const SUN = { x1: 230, x2: 470, y1: 235, dx: 60, h: 190 }; // lichtvlek op de vloer

  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); rr(ctx, x, y, w, h, r); }

  function drawWall(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, WALL_Y);
    g.addColorStop(0, '#f9e9db'); g.addColorStop(1, '#f1d7c3');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, WALL_Y);
    // behangstipjes
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let y = 18; y < WALL_Y - 20; y += 36) for (let x = ((y / 36) % 2) * 18 + 12; x < W; x += 36) {
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // raam
    const wx = 170, wy = 22, ww = 270, wh = 165;
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; rrect(ctx, wx - 4, wy + 6, ww + 8, wh + 8, 14); ctx.fill();
    ctx.fillStyle = '#fff6ea'; rrect(ctx, wx - 10, wy - 10, ww + 20, wh + 20, 14); ctx.fill();
    const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#b9dff7'); sky.addColorStop(1, '#e8f5fb');
    ctx.fillStyle = sky; rrect(ctx, wx, wy, ww, wh, 6); ctx.fill();
    ctx.save(); rrect(ctx, wx, wy, ww, wh, 6); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    [[wx + 60, wy + 55, 30], [wx + 85, wy + 45, 38], [wx + 115, wy + 58, 28], [wx + 200, wy + 100, 24], [wx + 225, wy + 92, 30], [wx + 250, wy + 104, 20]].forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(wx + 60, wy + 60, 80, 22); ctx.fillRect(wx + 200, wy + 104, 72, 18);
    // zonnetje
    const sun = ctx.createRadialGradient(wx + 215, wy + 40, 2, wx + 215, wy + 40, 60);
    sun.addColorStop(0, 'rgba(255,245,200,1)'); sun.addColorStop(0.3, 'rgba(255,230,150,0.9)'); sun.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = sun; ctx.fillRect(wx, wy, ww, wh);
    ctx.restore();
    ctx.fillStyle = '#fff6ea';
    ctx.fillRect(wx + ww / 2 - 5, wy, 10, wh); ctx.fillRect(wx, wy + wh / 2 - 5, ww, 10);
    // gordijnen
    [[wx - 34, 1], [wx + ww + 34, -1]].forEach(([cx, sgn]) => {
      ctx.fillStyle = '#f2b5b0';
      ctx.beginPath();
      ctx.moveTo(cx - sgn * 28, wy - 16); ctx.lineTo(cx + sgn * 30, wy - 16);
      ctx.quadraticCurveTo(cx + sgn * 10, wy + wh * 0.5, cx + sgn * 18, wy + wh + 30);
      ctx.lineTo(cx - sgn * 36, wy + wh + 30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(cx - sgn * (6 + k * 10), wy - 10);
        ctx.quadraticCurveTo(cx - sgn * (2 + k * 8), wy + wh * 0.5, cx - sgn * (8 + k * 9), wy + wh + 24); ctx.stroke();
      }
    });
    // vensterbank
    ctx.fillStyle = '#fff1e2'; rrect(ctx, wx - 24, wy + wh + 8, ww + 48, 14, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(wx - 24, wy + wh + 22, ww + 48, 5);
    // lijstje met visje
    const fx = 900, fy = 55, fw = 120, fh = 90;
    ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(fx + 3, fy + 6, fw, fh);
    ctx.fillStyle = '#c99a6a'; ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = '#fff8ec'; ctx.fillRect(fx + 9, fy + 9, fw - 18, fh - 18);
    ctx.fillStyle = '#8fc3e0';
    ctx.beginPath(); ctx.ellipse(fx + 56, fy + 46, 26, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(fx + 80, fy + 46); ctx.lineTo(fx + 100, fy + 32); ctx.lineTo(fx + 100, fy + 60); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.arc(fx + 42, fy + 42, 2.5, 0, Math.PI * 2); ctx.fill();
    // plankje met boekjes en plantje
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(1062, 118, 180, 6);
    ctx.fillStyle = '#e0b78f'; rrect(ctx, 1060, 108, 180, 12, 3); ctx.fill();
    [['#f6b7c3', 14, 46], ['#a9c7b3', 12, 38], ['#aac4dd', 16, 52], ['#f3d58a', 11, 42]].forEach(([c, w, h], i) => {
      const bx = 1075 + i * 17; ctx.fillStyle = c; rrect(ctx, bx, 108 - h, w, h, 2); ctx.fill();
    });
    ctx.fillStyle = '#d98a74'; rrect(ctx, 1178, 80, 34, 28, 5); ctx.fill();
    ctx.fillStyle = '#7bb77a';
    [[1182, 66, 10, 18, -0.4], [1196, 60, 10, 20, 0.1], [1208, 68, 9, 16, 0.5]].forEach(([x, y, rx, ry, rot]) => {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
    });
    // plint
    ctx.fillStyle = '#e9cdb6'; ctx.fillRect(0, WALL_Y - 16, W, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, WALL_Y - 16, W, 3);
  }

  function drawFloor(ctx) {
    ctx.fillStyle = '#d9a975'; ctx.fillRect(0, WALL_Y, W, H - WALL_Y);
    const plank = 46;
    for (let y = WALL_Y, row = 0; y < H; y += plank, row++) {
      ctx.fillStyle = row % 2 ? '#d6a46f' : '#dcae7a';
      ctx.fillRect(0, y, W, plank);
      ctx.fillStyle = 'rgba(90,50,20,0.18)'; ctx.fillRect(0, y, W, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, y + 2, W, 2);
      const off = (row * 173) % 300;
      for (let x = off; x < W; x += 300) { ctx.fillStyle = 'rgba(90,50,20,0.2)'; ctx.fillRect(x, y, 2, plank); }
      // nerf
      ctx.strokeStyle = 'rgba(120,70,30,0.08)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); const yy = y + 8 + k * 13 + (row % 3) * 3;
        ctx.moveTo(0, yy); ctx.bezierCurveTo(W * 0.3, yy + 4, W * 0.6, yy - 4, W, yy + 2); ctx.stroke();
      }
    }
    // schaduw onder de muur en zachte vignet
    const ao = ctx.createLinearGradient(0, WALL_Y, 0, WALL_Y + 110);
    ao.addColorStop(0, 'rgba(70,35,20,0.22)'); ao.addColorStop(1, 'rgba(70,35,20,0)');
    ctx.fillStyle = ao; ctx.fillRect(0, WALL_Y, W, 110);
    const vg = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.6, H * 0.95);
    vg.addColorStop(0, 'rgba(60,30,30,0)'); vg.addColorStop(1, 'rgba(60,30,30,0.25)');
    ctx.fillStyle = vg; ctx.fillRect(0, WALL_Y, W, H - WALL_Y);
    // zonlicht door het raam
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(SUN.x1, SUN.y1); ctx.lineTo(SUN.x2, SUN.y1); ctx.lineTo(SUN.x2 + SUN.dx, SUN.y1 + SUN.h); ctx.lineTo(SUN.x1 + SUN.dx, SUN.y1 + SUN.h); ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,240,190,0.32)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(200,140,80,0.18)';
    const mx = (SUN.x1 + SUN.x2) / 2, my = SUN.y1 + SUN.h / 2;
    ctx.beginPath(); ctx.moveTo(mx - 5, SUN.y1); ctx.lineTo(mx + 5, SUN.y1); ctx.lineTo(mx + 5 + SUN.dx, SUN.y1 + SUN.h); ctx.lineTo(mx - 5 + SUN.dx, SUN.y1 + SUN.h); ctx.fill();
    ctx.fillRect(SUN.x1, my - 5, SUN.x2 - SUN.x1 + SUN.dx, 10);
    ctx.restore();
  }

  function drawProps(ctx) {
    // plant linksonder
    ctx.save();
    ctx.fillStyle = 'rgba(70,35,45,0.2)'; ctx.beginPath(); ctx.ellipse(105, 770, 70, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d98a74'; ctx.beginPath(); ctx.moveTo(60, 700); ctx.lineTo(150, 700); ctx.lineTo(138, 775); ctx.lineTo(72, 775); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e39a82'; rrect(ctx, 54, 690, 102, 20, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(66, 712, 10, 55);
    const leaf = (x, y, rx, ry, rot, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); };
    leaf(70, 630, 22, 48, -0.6, '#6aa96b'); leaf(140, 625, 22, 50, 0.6, '#5f9f63'); leaf(105, 605, 24, 60, 0, '#79b877');
    leaf(85, 650, 18, 36, -0.2, '#84c283'); leaf(128, 655, 18, 36, 0.25, '#6fae6f');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(105, 660); ctx.lineTo(105, 560); ctx.stroke();
    ctx.restore();

    // krabpaal rechts
    ctx.save();
    ctx.fillStyle = 'rgba(70,35,45,0.2)'; ctx.beginPath(); ctx.ellipse(1195, 625, 68, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c9a3'; rrect(ctx, 1135, 600, 120, 26, 12); ctx.fill();
    ctx.fillStyle = '#d6b08a'; ctx.fillRect(1180, 380, 30, 230);
    ctx.strokeStyle = 'rgba(120,80,40,0.25)'; ctx.lineWidth = 3;
    for (let y = 390; y < 600; y += 11) { ctx.beginPath(); ctx.moveTo(1180, y); ctx.lineTo(1210, y + 5); ctx.stroke(); }
    ctx.fillStyle = '#e8c9a3'; rrect(ctx, 1140, 356, 110, 30, 14); ctx.fill();
    ctx.fillStyle = '#f6b7c3'; rrect(ctx, 1150, 340, 90, 22, 11); ctx.fill();
    ctx.fillStyle = '#d6b08a'; ctx.fillRect(1152, 270, 22, 72);
    ctx.fillStyle = '#e8c9a3'; rrect(ctx, 1128, 250, 72, 24, 12); ctx.fill();
    // speelmuisje aan een touwtje
    ctx.strokeStyle = '#a07a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1240, 372); ctx.lineTo(1240, 440); ctx.stroke();
    ctx.fillStyle = '#b8b2c6'; ctx.beginPath(); ctx.ellipse(1240, 452, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f3a0af'; ctx.beginPath(); ctx.arc(1234, 446, 3.5, 0, Math.PI * 2); ctx.arc(1246, 446, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // etensbakje met visje
    ctx.save();
    ctx.fillStyle = 'rgba(70,35,45,0.2)'; ctx.beginPath(); ctx.ellipse(1100, 752, 48, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8fc3e0'; rrect(ctx, 1056, 722, 88, 30, 12); ctx.fill();
    ctx.fillStyle = '#a9d3ea'; ctx.beginPath(); ctx.ellipse(1100, 724, 44, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b06b'; ctx.beginPath(); ctx.ellipse(1096, 724, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(1100, 717, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // bolletje wol
    ctx.save();
    ctx.fillStyle = 'rgba(70,35,45,0.2)'; ctx.beginPath(); ctx.ellipse(1010, 650, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    const yg = ctx.createRadialGradient(1000, 622, 2, 1008, 630, 26);
    yg.addColorStop(0, '#fbd4dd'); yg.addColorStop(1, '#e8a0b4');
    ctx.fillStyle = yg; ctx.beginPath(); ctx.arc(1008, 630, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2.5;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(1008, 630, 22, 22, 0.5 + k * 0.25, 0.2, 2.8); ctx.stroke(); }
    ctx.strokeStyle = '#e8a0b4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(1026, 642); ctx.bezierCurveTo(1060, 650, 1040, 690, 1080, 690); ctx.stroke();
    ctx.restore();
  }

  function renderBackground(scale) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W * scale); cv.height = Math.ceil(H * scale);
    const ctx = cv.getContext('2d'); ctx.scale(scale, scale);
    drawWall(ctx); drawFloor(ctx); drawProps(ctx);
    return cv;
  }

  function carpetRect(grid, pad = 34) {
    return { x: grid.x - pad, y: grid.y - pad, w: grid.cols * grid.cs + 2 * pad, h: grid.rows * grid.cs + 2 * pad };
  }

  function drawCarpet(ctx, grid, colorIdx) {
    const col = CARPET_COLORS[colorIdx % CARPET_COLORS.length];
    const r = carpetRect(grid), cs = grid.cs;
    ctx.save();
    const S = ctx.getTransform ? ctx.getTransform().a : 1;
    ctx.shadowColor = 'rgba(70,35,45,0.3)'; ctx.shadowBlur = 16 * S; ctx.shadowOffsetY = 6 * S;
    ctx.fillStyle = col.base; rrect(ctx, r.x, r.y, r.w, r.h, 26); ctx.fill();
    ctx.restore();
    // franje
    ctx.strokeStyle = col.fringe; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let y = r.y + 12; y < r.y + r.h - 6; y += 10) {
      ctx.beginPath(); ctx.moveTo(r.x + 2, y); ctx.lineTo(r.x - 12, y + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r.x + r.w - 2, y); ctx.lineTo(r.x + r.w + 12, y + 3); ctx.stroke();
    }
    // geweven structuur en rand
    ctx.save(); rrect(ctx, r.x, r.y, r.w, r.h, 26); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 2;
    for (let d = -r.h; d < r.w; d += 9) { ctx.beginPath(); ctx.moveTo(r.x + d, r.y); ctx.lineTo(r.x + d + r.h, r.y + r.h); ctx.stroke(); }
    ctx.strokeStyle = col.border; ctx.lineWidth = 8;
    rrect(ctx, r.x + 11, r.y + 11, r.w - 22, r.h - 22, 18); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    rrect(ctx, r.x + 11, r.y + 11, r.w - 22, r.h - 22, 18); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // de vorm die gevuld moet worden
    const inset = 3, rad = 10;
    const has = (x, y) => grid.target.has(Levels.key(x, y));
    ctx.beginPath();
    for (const k of grid.target) {
      const [x, y] = k.split(',').map(Number);
      const px = grid.x + x * cs, py = grid.y + y * cs;
      rr(ctx, px + inset, py + inset, cs - 2 * inset, cs - 2 * inset, rad);
      if (has(x + 1, y)) ctx.rect(px + cs / 2, py + inset, cs, cs - 2 * inset);
      if (has(x, y + 1)) ctx.rect(px + inset, py + cs / 2, cs - 2 * inset, cs);
    }
    ctx.save();
    ctx.fillStyle = 'rgba(80,40,40,0.12)'; ctx.translate(0, 3); ctx.fill(); ctx.translate(0, -3);
    ctx.fillStyle = col.cell; ctx.fill();
    ctx.clip();
    // vakjeslijntjes
    ctx.strokeStyle = rgba(col.border, 0.35); ctx.lineWidth = 2;
    for (const k of grid.target) {
      const [x, y] = k.split(',').map(Number);
      const px = grid.x + x * cs, py = grid.y + y * cs;
      if (has(x + 1, y)) { ctx.beginPath(); ctx.moveTo(px + cs, py + 6); ctx.lineTo(px + cs, py + cs - 6); ctx.stroke(); }
      if (has(x, y + 1)) { ctx.beginPath(); ctx.moveTo(px + 6, py + cs); ctx.lineTo(px + cs - 6, py + cs); ctx.stroke(); }
      // pootafdrukje in het midden
      ctx.fillStyle = rgba(col.border, 0.18);
      ctx.beginPath(); ctx.ellipse(px + cs / 2, py + cs / 2 + 4, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
      [[-8, -6], [-3, -10], [3, -10], [8, -6]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(px + cs / 2 + dx, py + cs / 2 + dy, 2.6, 0, Math.PI * 2); ctx.fill(); });
    }
    ctx.restore();
  }

  return { W, H, WALL_Y, CARPET_COLORS, PROPS, SUN, renderBackground, drawCarpet, carpetRect };
})();
