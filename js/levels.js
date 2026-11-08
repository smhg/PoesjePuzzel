'use strict';
// Vormen voor het kleedje. '#' is een vakje dat gevuld moet worden.
const LEVELS = [
  { name: 'Blokje', min: 2, max: 4, rows: [
    '###',
    '###',
    '###'] },
  { name: 'Kussen', min: 3, max: 4, rows: [
    '####',
    '####',
    '####'] },
  { name: 'Bolletje wol', min: 3, max: 4, rows: [
    '..###..',
    '.#####.',
    '#######',
    '.#####.',
    '..###..'] },
  { name: 'Botje', min: 3, max: 5, rows: [
    '##....##',
    '########',
    '########',
    '##....##'] },
  { name: 'Paddenstoel', min: 3, max: 5, rows: [
    '..###..',
    '.#####.',
    '#######',
    '..###..',
    '..###..',
    '..###..'] },
  { name: 'Hartje', min: 3, max: 5, rows: [
    '.##.##.',
    '#######',
    '#######',
    '.#####.',
    '..###..',
    '...#...'] },
  { name: 'Visje', min: 3, max: 5, rows: [
    '.####...',
    '######.#',
    '########',
    '######.#',
    '.####...'] },
  { name: 'Ster', min: 3, max: 5, rows: [
    '...#...',
    '..###..',
    '#######',
    '.#####.',
    '..###..',
    '.##.##.',
    '.#...#.'] },
  { name: 'Bloem', min: 3, max: 5, rows: [
    '.##.##.',
    '#######',
    '.#####.',
    '#######',
    '.##.##.',
    '...#...',
    '...#...'] },
  { name: 'Huisje', min: 3, max: 5, rows: [
    '...#...',
    '..###..',
    '.#####.',
    '#######',
    '.#####.',
    '.#####.',
    '.#####.'] },
  { name: 'Poezenkop', min: 3, max: 5, rows: [
    '#......#',
    '##....##',
    '########',
    '########',
    '########',
    '.######.',
    '..####..'] },
  { name: 'Dekentje', min: 4, max: 5, rows: [
    '########',
    '########',
    '########',
    '########',
    '########',
    '########'] },
];

const Levels = (() => {
  const key = (x, y) => x + ',' + y;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function parse(level) {
    const cells = [];
    level.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => { if (ch === '#') cells.push({ x, y }); });
    });
    const cols = Math.max(...level.rows.map(r => r.length));
    const rows = level.rows.length;
    return { cells, cols, rows };
  }

  // Verdeel de vorm in samenhangende stukjes (de poezen) van min..max vakjes.
  function partitionOnce(cells, min, max) {
    const free = new Map(cells.map(c => [key(c.x, c.y), c]));
    const pieces = [];
    const freeNeighbours = c => DIRS.filter(([dx, dy]) => free.has(key(c.x + dx, c.y + dy))).length;
    while (free.size) {
      // begin bij een vakje met weinig vrije buren, zodat er geen losse vakjes achterblijven
      let best = null, bestScore = 1e9;
      for (const c of free.values()) {
        const s = freeNeighbours(c) + Math.random() * 1.5;
        if (s < bestScore) { bestScore = s; best = c; }
      }
      const target = rndInt(min, max);
      const piece = [best]; free.delete(key(best.x, best.y));
      while (piece.length < target) {
        const cands = [];
        for (const p of piece) for (const [dx, dy] of DIRS) {
          const c = free.get(key(p.x + dx, p.y + dy));
          if (c && !cands.includes(c)) cands.push(c);
        }
        if (!cands.length) break;
        let pickC = null, ps = 1e9;
        for (const c of cands) {
          const s = freeNeighbours(c) + Math.random() * 2.2;
          if (s < ps) { ps = s; pickC = c; }
        }
        piece.push(pickC); free.delete(key(pickC.x, pickC.y));
      }
      pieces.push(piece);
    }
    // kleine stukjes samenvoegen met een buurstuk als dat niet te groot wordt
    const owner = new Map();
    pieces.forEach((p, i) => p.forEach(c => owner.set(key(c.x, c.y), i)));
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (!p || p.length >= min) continue;
      const neighbourIdx = new Set();
      p.forEach(c => DIRS.forEach(([dx, dy]) => {
        const o = owner.get(key(c.x + dx, c.y + dy));
        if (o !== undefined && o !== i && pieces[o]) neighbourIdx.add(o);
      }));
      let bestJ = -1, bestLen = 1e9;
      for (const j of neighbourIdx) if (pieces[j].length < bestLen) { bestLen = pieces[j].length; bestJ = j; }
      if (bestJ >= 0 && bestLen + p.length <= max + 1) {
        pieces[bestJ].push(...p);
        p.forEach(c => owner.set(key(c.x, c.y), bestJ));
        pieces[i] = null;
      }
    }
    return pieces.filter(Boolean);
  }

  function partition(cells, min, max) {
    let best = null, bestScore = 1e9;
    for (let i = 0; i < 40; i++) {
      const p = partitionOnce(cells, min, max);
      let score = 0;
      for (const piece of p) {
        if (piece.length === 1) score += 6;
        else if (piece.length < min) score += 3;
        if (piece.length > max) score += 4 * (piece.length - max);
      }
      if (score < bestScore) { bestScore = score; best = p; }
      if (score === 0) break;
    }
    return best;
  }

  return { parse, partition, rnd, rndInt, pick, key, DIRS };
})();
