'use strict';
// Alle geluiden worden live gemaakt met WebAudio: geen bestanden nodig.
const Sound = (() => {
  let ctx = null, master = null, enabled = true;
  let purr = null, noiseBuf = null;
  let ambient = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.7 : 0.0001;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const now = () => ctx.currentTime;
  function osc(type, freq, dest) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    if (dest) o.connect(dest); return o;
  }
  function gain(v, dest) {
    const g = ctx.createGain(); g.gain.value = v;
    if (dest) g.connect(dest); return g;
  }
  function filter(type, freq, q, dest) {
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (dest) f.connect(dest); return f;
  }
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // --- Spinnen -------------------------------------------------------------
  function purrStart(pitch = 1) {
    if (!ensure()) return;
    purrStop(0.15);
    const t = now();
    const out = gain(0.0001, master);
    const mod = gain(0.5, out);                 // wordt gepulseerd door de lfo
    const lfo = osc('sine', 26 * pitch);
    const lfoG = gain(0.5, mod.gain); lfo.connect(lfoG);
    const breath = osc('sine', 0.9);            // zacht in- en uitademen
    const breathG = gain(0.1, out.gain); breath.connect(breathG);

    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const lp = filter('lowpass', 280 * pitch, 1.2, mod);
    src.connect(lp);
    const sub = osc('sine', 48 * pitch);
    const subG = gain(0.55, mod); sub.connect(subG);
    const sub2 = osc('triangle', 96 * pitch);
    const sub2G = gain(0.12, mod); sub2.connect(sub2G);

    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.32, t + 0.5);
    [lfo, breath, src, sub, sub2].forEach(n => n.start(t));
    purr = { out, nodes: [lfo, breath, src, sub, sub2] };
  }
  function purrStop(fade = 0.5) {
    if (!purr || !ctx) return;
    const p = purr; purr = null;
    const t = now();
    p.out.gain.cancelScheduledValues(t);
    p.out.gain.setValueAtTime(Math.max(p.out.gain.value, 0.0001), t);
    p.out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    p.nodes.forEach(n => { try { n.stop(t + fade + 0.05); } catch (e) {} });
  }

  // --- Miauwtjes -----------------------------------------------------------
  function mrrp(pitch = 1, kind = 'hi') {
    if (!ensure()) return;
    const t = now();
    const curves = {
      hi:   [[0, 330], [0.10, 640], [0.22, 520], [0.34, 390]],
      q:    [[0, 300], [0.12, 470], [0.32, 760]],
      down: [[0, 460], [0.08, 560], [0.28, 320]],
      yawn: [[0, 260], [0.25, 420], [0.7, 240]],
    };
    const pts = curves[kind] || curves.hi;
    const dur = pts[pts.length - 1][0] + 0.08;
    const out = gain(0.0001, master);
    const bp = filter('bandpass', 1000 * pitch, 1.1, out);
    const o1 = osc('triangle', pts[0][1] * pitch, bp);
    const o2 = osc('sawtooth', pts[0][1] * pitch);
    const g2 = gain(0.2, bp); o2.connect(g2);
    const vib = osc('sine', 7); const vibG = gain(6 * pitch, o1.frequency); vib.connect(vibG);
    for (const [dt, hz] of pts) {
      if (dt === 0) { o1.frequency.setValueAtTime(hz * pitch, t); o2.frequency.setValueAtTime(hz * pitch, t); }
      else { o1.frequency.exponentialRampToValueAtTime(hz * pitch, t + dt); o2.frequency.exponentialRampToValueAtTime(hz * pitch, t + dt); }
    }
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.14, t + 0.05);
    out.gain.setValueAtTime(0.14, t + dur - 0.1);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [o1, o2, vib].forEach(n => { n.start(t); n.stop(t + dur + 0.05); });
  }

  // --- Plofje bij neerleggen ----------------------------------------------
  function plop(pitch = 1) {
    if (!ensure()) return;
    const t = now();
    const out = gain(0.0001, master);
    const o = osc('sine', 340 * pitch, out);
    o.frequency.exponentialRampToValueAtTime(110 * pitch, t + 0.14);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.start(t); o.stop(t + 0.2);
    const n = ctx.createBufferSource(); n.buffer = getNoise();
    const ng = gain(0.0001, master);
    const nf = filter('lowpass', 900, 0.7, ng); n.connect(nf);
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.start(t); n.stop(t + 0.1);
  }

  // --- Draai-tikje -----------------------------------------------------------
  function pop(pitch = 1) {
    if (!ensure()) return;
    const t = now();
    const out = gain(0.0001, master);
    const o = osc('sine', 520 * pitch, out);
    o.frequency.exponentialRampToValueAtTime(880 * pitch, t + 0.07);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.start(t); o.stop(t + 0.12);
  }

  // --- Belletjes bij een voltooide puzzel ---------------------------------
  function chime() {
    if (!ensure()) return;
    const t = now();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    notes.forEach((hz, i) => {
      const t0 = t + i * 0.13;
      const out = gain(0.0001, master);
      const o = osc('sine', hz, out);
      const o2 = osc('triangle', hz * 2); const g2 = gain(0.12, out); o2.connect(g2);
      out.gain.setValueAtTime(0.0001, t0);
      out.gain.exponentialRampToValueAtTime(0.16, t0 + 0.015);
      out.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      [o, o2].forEach(n => { n.start(t0); n.stop(t0 + 1.7); });
    });
  }

  // --- Sprankeltje --------------------------------------------------------
  function sparkle() {
    if (!ensure()) return;
    const t = now();
    [1318.5, 1760].forEach((hz, i) => {
      const out = gain(0.0001, master);
      const o = osc('sine', hz, out);
      const t0 = t + i * 0.06;
      out.gain.setValueAtTime(0.0001, t0);
      out.gain.exponentialRampToValueAtTime(0.06, t0 + 0.01);
      out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.start(t0); o.stop(t0 + 0.55);
    });
  }

  // --- Zachte achtergrondmuziek --------------------------------------------
  const CHORDS = [
    [130.81, 196.00, 246.94, 329.63],   // Cmaj7
    [110.00, 164.81, 220.00, 261.63],   // Am7
    [87.31, 130.81, 174.61, 220.00],    // Fmaj7
    [98.00, 146.83, 196.00, 246.94],    // G6
  ];
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.5];
  function ambientStart() {
    if (!ensure() || ambient) return;
    const out = gain(0.0001, master);
    const lp = filter('lowpass', 520, 0.6, out);
    const voices = CHORDS[0].map(hz => {
      const g = gain(0.045, lp);
      const a = osc('triangle', hz, g);
      const b = osc('sine', hz * 1.003); const bg = gain(0.5, g); b.connect(bg);
      a.start(); b.start();
      return { a, b };
    });
    out.gain.exponentialRampToValueAtTime(1, now() + 4);
    let ci = 0;
    const chordTimer = setInterval(() => {
      ci = (ci + 1) % CHORDS.length;
      const t = now();
      CHORDS[ci].forEach((hz, i) => {
        voices[i].a.frequency.exponentialRampToValueAtTime(hz, t + 2.5);
        voices[i].b.frequency.exponentialRampToValueAtTime(hz * 1.003, t + 2.5);
      });
    }, 9000);
    let melodyTimer = null;
    const melody = () => {
      const t = now();
      const hz = PENTA[Math.floor(Math.random() * PENTA.length)];
      const g = gain(0.0001, master);
      const o = osc('sine', hz, g);
      const o2 = osc('sine', hz * 2); const g2 = gain(0.15, g); o2.connect(g2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      [o, o2].forEach(n => { n.start(t); n.stop(t + 2.3); });
      melodyTimer = setTimeout(melody, 2500 + Math.random() * 4500);
    };
    melodyTimer = setTimeout(melody, 3000);
    ambient = { out, chordTimer, stop: () => { clearInterval(chordTimer); clearTimeout(melodyTimer); } };
  }

  function setEnabled(on) {
    enabled = on;
    if (!ctx) return;
    const t = now();
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.exponentialRampToValueAtTime(on ? 0.7 : 0.0001, t + 0.3);
  }
  const isEnabled = () => enabled;

  return { ensure, purrStart, purrStop, mrrp, plop, pop, chime, sparkle, ambientStart, setEnabled, isEnabled };
})();
