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
  // Een echte spin is een reeks zachte pulsjes (~24 per seconde) die in een warme borstkas
  // resoneren, met een langzaam in- en uitademen eroverheen.
  let pulseCurve = null;
  function getPulseCurve() {
    if (pulseCurve) return pulseCurve;
    pulseCurve = new Float32Array(512);
    for (let i = 0; i < 512; i++) { const x = i / 511; pulseCurve[i] = Math.pow(x, 3); }
    return pulseCurve;
  }
  function purrStart(pitch = 1) {
    if (!ensure()) return;
    purrStop(0.15);
    const t = now();
    const out = gain(0.0001, master);
    const breathG = gain(0.75, out);                      // ademhaling: volume golft mee

    // borstkas: pulstrein door een resonerend filter
    const rate = 24 * pitch;
    const saw = osc('sawtooth', rate);
    const body = filter('lowpass', 150 * pitch, 5);
    const body2 = filter('lowpass', 320 * pitch, 0.8, breathG);
    const bodyG = gain(0.55, body2);
    saw.connect(body); body.connect(bodyG);
    const sub = osc('sine', rate * 2);                  // zachte warme ondertoon
    const subG = gain(0.18, breathG); sub.connect(subG);

    // een beetje lucht, gepulseerd in hetzelfde ritme
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const air = filter('bandpass', 520 * pitch, 0.9);
    const airMod = gain(0, breathG);
    const airG = gain(0.07, airMod); src.connect(air); air.connect(airG);
    const lfo = osc('sine', rate);
    const shaper = ctx.createWaveShaper(); shaper.curve = getPulseCurve();
    lfo.connect(shaper); shaper.connect(airMod.gain);

    // ademen: ~0,8 Hz, verandert volume, tempo en klankkleur een beetje
    const breath = osc('sine', 0.8);
    const bG = gain(0.22, breathG.gain); breath.connect(bG);
    const rG = gain(1.6 * pitch, saw.frequency); breath.connect(rG);
    const lG = gain(1.6 * pitch, lfo.frequency); breath.connect(lG);
    const fG = gain(30 * pitch, body.frequency); breath.connect(fG);

    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.42, t + 0.6);
    const nodes = [saw, sub, src, lfo, breath];
    nodes.forEach(n => n.start(t));
    purr = { out, nodes };
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
      grr:  [[0, 150], [0.15, 125], [0.55, 105], [0.7, 118]],
    };
    const pts = curves[kind] || curves.hi;
    const dur = pts[pts.length - 1][0] + 0.08;
    const out = gain(0.0001, master);
    const bp = filter('bandpass', (kind === 'grr' ? 380 : 1000) * pitch, kind === 'grr' ? 0.8 : 1.1, out);
    const o1 = osc('triangle', pts[0][1] * pitch, bp);
    const o2 = osc('sawtooth', pts[0][1] * pitch);
    const g2 = gain(kind === 'grr' ? 0.6 : 0.2, bp); o2.connect(g2);
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
  // Een vrolijk, licht wiegend deuntje in C-majeur: pad, zachte bas en een speeldoos-melodie.
  const NOTE = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77, C6: 1046.50, D6: 1174.66, E6: 1318.51 };
  const BEAT = 0.44, BAR_BEATS = 8;                       // 8 tellen per maat, ~ 3,5 s
  const BARS = [
    { bass: NOTE.C4 / 2, pad: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.D5] },   // C add9
    { bass: NOTE.F4 / 2, pad: [NOTE.F4, NOTE.A4, NOTE.C5, NOTE.E5] },   // Fmaj7
    { bass: NOTE.G4 / 2, pad: [NOTE.G4, NOTE.B4, NOTE.D5, NOTE.E5] },   // G6
    { bass: NOTE.C4 / 2, pad: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.A4] },   // C6
  ];
  // melodie per maat: [tel, noot]; null = rust
  const MELODY = [
    [[0, 'E5'], [1, 'G5'], [2, 'A5'], [3, 'G5'], [4, 'E5'], [6, 'D5']],
    [[0, 'C5'], [1, 'E5'], [2, 'F5'], [3, 'A5'], [4, 'G5'], [6, 'E5']],
    [[0, 'D5'], [1, 'G5'], [2, 'B5'], [3, 'A5'], [4, 'G5'], [5, 'E5'], [6, 'D5']],
    [[0, 'E5'], [1, 'G5'], [2, 'C6'], [4, 'G5'], [6, 'C5']],
  ];
  const SPARK = ['C6', 'D6', 'E6', 'G5', 'A5'];
  function bell(hz, t0, vol, dec = 1.2) {
    const g = gain(0.0001, master);
    const o = osc('sine', hz, g);
    const o2 = osc('sine', hz * 2); const g2 = gain(0.18, g); o2.connect(g2);
    const o3 = osc('sine', hz * 3); const g3 = gain(0.05, g); o3.connect(g3);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dec);
    [o, o2, o3].forEach(n => { n.start(t0); n.stop(t0 + dec + 0.05); });
  }
  function bass(hz, t0, vol) {
    const g = gain(0.0001, master);
    const o = osc('sine', hz, g);
    const o2 = osc('triangle', hz); const g2 = gain(0.25, g); o2.connect(g2);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    [o, o2].forEach(n => { n.start(t0); n.stop(t0 + 0.55); });
  }
  // zacht getokkeld akkoord (kalimba-achtig), noten iets na elkaar
  function pluckChord(freqs, t0, vol) {
    freqs.forEach((hz, i) => {
      const g = gain(0.0001, master);
      const o = osc('triangle', hz, g);
      const o2 = osc('sine', hz * 2); const g2 = gain(0.12, g); o2.connect(g2);
      const ts = t0 + i * 0.035;
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.exponentialRampToValueAtTime(vol, ts + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.7);
      [o, o2].forEach(n => { n.start(ts); n.stop(ts + 0.75); });
    });
  }
  function ambientStart() {
    if (!ensure() || ambient) return;
    // geen lang aangehouden tonen: alles is kort getokkeld, zodat het licht en luchtig blijft
    let bar = 0, round = 0;
    const playBar = () => {
      const t0 = now() + 0.1;
      const B = BARS[bar];
      bass(B.bass, t0, 0.08);
      bass(B.bass * 1.5, t0 + 4 * BEAT, 0.05);
      pluckChord(B.pad, t0, 0.028);
      pluckChord(B.pad.slice(1), t0 + 3 * BEAT, 0.018);
      pluckChord(B.pad, t0 + 5 * BEAT, 0.022);
      const quiet = round % 2 === 1;
      MELODY[bar].forEach(([beat, name], i) => {
        if (quiet && i % 2 === 1) return;
        const accent = beat % 4 === 0 ? 0.05 : 0.036;
        bell(NOTE[name], t0 + beat * BEAT, accent, 0.9);
      });
      if (!quiet && Math.random() < 0.5) bell(NOTE[SPARK[Math.floor(Math.random() * SPARK.length)]], t0 + 7 * BEAT, 0.025, 1.0);
      bar = (bar + 1) % BARS.length;
      if (bar === 0) round++;
    };
    playBar();
    const barTimer = setInterval(playBar, BAR_BEATS * BEAT * 1000);
    ambient = { stop: () => clearInterval(barTimer) };
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
