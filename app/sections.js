/* Bezaleel sections: where the song changes (intro, verse, chorus…) and how strong each part is.
 *
 * Two sources:
 * - Arpa: a song's .arp file already has named markers and the exact beat grid of its click track.
 *   Each marker's strength is its own setting ("int") or comes from its name, with the same rules Arpa uses
 *   for its backgrounds (CORO = fuerte, PRECORO = medio, VERSO = suave…).
 * - Listening: with no .arp, the song is cut into bars (from the detected beats), each bar gets a sound
 *   fingerprint (harmony + tone color + loudness), and a section starts where the fingerprint of the bars
 *   before and after a bar line differ the most. Strength is the section's loudness against the rest of the song.
 *
 * Strength levels match Arpa's backgrounds: 'suave', 'medio', 'fuerte'.
 */
(function () {
  'use strict';
  const LEVELS = ['suave', 'medio', 'fuerte'];

  /* ---------- Arpa (.arp) ---------- */
  const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Same order and rules as SECTION_TYPES in Arpa's engine.
  const TYPES = [
    [/pre[\s_-]*(coro|chorus)/, 'precoro', 'medio'], [/(coro|chorus)/, 'coro', 'fuerte'], [/(puente|bridge)/, 'puente', 'medio'],
    [/(intro)/, 'intro', 'suave'], [/(verso|verse|estrofa)/, 'verso', 'suave'], [/(final|outro|ending|cierre|tag)/, 'final', 'suave'],
    [/(interludio|instrumental|inter|solo|break)/, 'inter', 'medio'], [/(cl[i]max|climax|explosi)/, 'coro', 'fuerte']
  ];
  function sectionType(name) {
    const n = strip(name);
    for (const [rx, typ, lvl] of TYPES) if (new RegExp('(^|[^a-z])' + rx.source).test(n)) return { typ, level: lvl };
    return { typ: 'verso', level: 'medio' };
  }
  // Reads an Arpa song file. Returns { name, beats: {bpm, times, down, sig, conf, arpa}, sections: [...] } or throws.
  function fromArpa(text, duration) {
    let d; try { d = JSON.parse(text); } catch (e) { throw new Error('Ese archivo no es una canción de Arpa (.arp).'); }
    if (!d || d.format !== 'arpa-song') throw new Error('Ese archivo no es una canción de Arpa (.arp).');
    const g = d.grid || {}, sig = Math.max(1, Math.min(12, +g.sig || 4));
    const times = (g.beats || []).map(Number).filter(isFinite).sort((a, b) => a - b);
    const beats = times.length >= 4 ? { bpm: +g.bpm || 60 / median(diffs(times)), times: times.map(x => +x.toFixed(4)), down: ((+g.bar1 || 0) % sig + sig) % sig, sig, conf: 1, arpa: true } : null;
    const mk = (d.markers || []).filter(m => isFinite(+m.t)).sort((a, b) => a.t - b.t);
    const end = duration || (times.length ? times[times.length - 1] + 1 : 0);
    const sections = mk.map((m, i) => {
      const st = sectionType(m.name), lvl = LEVELS.includes(m.int) ? m.int : st.level;
      return { t: +(+m.t).toFixed(4), end: +((i + 1 < mk.length ? +mk[i + 1].t : end)).toFixed(4), name: String(m.name || '').trim() || 'Sección', typ: st.typ, level: lvl, color: m.color || null };
    }).filter(s => s.end - s.t > .05);
    // A single marker that just names the song tells us nothing about its parts.
    const useful = sections.length > 1 ? sections : [];
    return { name: d.name || '', beats, sections: useful, src: 'arpa' };
  }

  /* ---------- listening ---------- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  function diffs(a) { const o = []; for (let i = 1; i < a.length; i++) o.push(a[i] - a[i - 1]); return o; }
  function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }
  function quantile(a, q) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; }

  const N = 2048, NB = 16, DIM = 12 + NB;
  // One fingerprint per ~93 ms frame: 12 pitch classes (harmony), 16 log bands (tone color), and loudness.
  function frames(x, sr) {
    const hop = N / 2, n = Math.max(0, Math.floor((x.length - N) / hop)), win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1));
    const re = new Float32Array(N), im = new Float32Array(N);
    const pc = new Int8Array(N / 2), band = new Int8Array(N / 2);
    const fmin = 40, fmax = Math.min(10000, sr / 2);
    for (let k = 1; k < N / 2; k++) {
      const f = k * sr / N;
      pc[k] = f >= 55 && f <= 5000 ? ((Math.round(12 * Math.log2(f / 440)) % 12) + 12) % 12 : -1;
      band[k] = f >= fmin && f < fmax ? Math.min(NB - 1, Math.floor(NB * Math.log(f / fmin) / Math.log(fmax / fmin))) : -1;
    }
    const feat = new Float32Array(n * DIM), rms = new Float32Array(n);
    for (let fr = 0; fr < n; fr++) {
      const o = fr * hop; let ss = 0;
      for (let i = 0; i < N; i++) { const v = x[o + i]; ss += v * v; re[i] = v * win[i]; im[i] = 0; }
      rms[fr] = Math.sqrt(ss / N);
      fft(re, im);
      const row = fr * DIM;
      for (let k = 1; k < N / 2; k++) {
        const p = re[k] * re[k] + im[k] * im[k];
        if (pc[k] >= 0) feat[row + pc[k]] += p;
        if (band[k] >= 0) feat[row + 12 + band[k]] += p;
      }
      let cs = 0; for (let j = 0; j < 12; j++) cs += feat[row + j];
      for (let j = 0; j < 12; j++) feat[row + j] = cs > 0 ? feat[row + j] / cs : 0;
      for (let j = 12; j < DIM; j++) feat[row + j] = Math.log10(1e-9 + feat[row + j]);
    }
    return { feat, rms, fps: sr / hop, n };
  }

  // Finds sections from mono samples and the song's beats ({times, down, sig}).
  // Works beat by beat (not bar by bar) so a section starts on the real "1" even where the detected bar grid drifts;
  // the editor counts bars from each section's start.
  function detect(x, sr, beats) {
    if (!beats || !beats.times || beats.times.length < 32) return [];
    const dur = x.length / sr, T = beats.times, NBt = T.length;
    const F = frames(x, sr);
    const bf = new Float32Array(NBt * DIM), be = new Float32Array(NBt);
    for (let b = 0; b < NBt; b++) {
      const a = Math.floor(T[b] * F.fps), z = Math.max(a + 1, Math.floor((b + 1 < NBt ? T[b + 1] : T[b] + (T[b] - T[b - 1])) * F.fps));
      let cnt = 0, e = 0;
      for (let fr = a; fr < Math.min(z, F.n); fr++) { cnt++; e += F.rms[fr] * F.rms[fr]; for (let j = 0; j < DIM; j++) bf[b * DIM + j] += F.feat[fr * DIM + j]; }
      if (cnt) for (let j = 0; j < DIM; j++) bf[b * DIM + j] /= cnt;
      be[b] = Math.sqrt(e / Math.max(1, cnt));
    }
    for (let j = 0; j < DIM; j++) {
      let s = 0, q = 0; for (let b = 0; b < NBt; b++) s += bf[b * DIM + j]; const m = s / NBt;
      for (let b = 0; b < NBt; b++) { const d = bf[b * DIM + j] - m; q += d * d; } const sd = Math.sqrt(q / NBt) || 1;
      for (let b = 0; b < NBt; b++) bf[b * DIM + j] = (bf[b * DIM + j] - m) / sd;
    }
    const eDb = Array.from(be, v => 20 * Math.log10(v + 1e-6));
    // Ward clustering of neighbors (like librosa's agglomerative segmentation): start with one segment per beat and keep
    // joining the two touching segments that sound most alike, until about one section per 22 s is left.
    const eZ = (() => { const m = eDb.reduce((s, v) => s + v, 0) / NBt; const sd = Math.sqrt(eDb.reduce((s, v) => s + (v - m) * (v - m), 0) / NBt) || 1; return eDb.map(v => (v - m) / sd); })();
    const D2 = DIM + 1, EW = 2.5;
    let segs = [];
    for (let b = 0; b < NBt; b++) { const m = new Float64Array(D2); for (let j = 0; j < DIM; j++) m[j] = bf[b * DIM + j]; m[DIM] = eZ[b] * EW; segs.push({ a: b, n: 1, m }); }
    const cost = (p, q) => { let d = 0; for (let j = 0; j < D2; j++) { const v = p.m[j] - q.m[j]; d += v * v; } return p.n * q.n / (p.n + q.n) * d; };
    const want = Math.max(8, Math.round(dur / 14)); // a little finer than the real parts: neighbors of equal strength are joined below
    const costs = []; for (let i = 0; i + 1 < segs.length; i++) costs.push(cost(segs[i], segs[i + 1]));
    while (segs.length > want) {
      let bi = 0; for (let i = 1; i < costs.length; i++) if (costs[i] < costs[bi]) bi = i;
      const p = segs[bi], q = segs[bi + 1], n = p.n + q.n, m = new Float64Array(D2);
      for (let j = 0; j < D2; j++) m[j] = (p.m[j] * p.n + q.m[j] * q.n) / n;
      segs.splice(bi, 2, { a: p.a, n, m }); costs.splice(bi, 1);
      if (bi > 0) costs[bi - 1] = cost(segs[bi - 1], segs[bi]);
      if (bi < segs.length - 1) costs[bi] = cost(segs[bi], segs[bi + 1]);
    }
    // drop slivers (under 3 bars) into their neighbor
    let picked = segs.map(s => s.a).filter(b => b > 0);
    // a section starts on a "1": move each start to the nearest bar line of the song's grid (up to 2 beats away)
    const sig = beats.sig || 4, isDown = b => ((b - (beats.down || 0)) % sig + sig) % sig === 0;
    picked = picked.map(b => { for (const o of [0, 1, -1, 2, -2]) if (b + o > 0 && b + o < NBt && isDown(b + o)) return b + o; return b; });
    picked = [...new Set(picked)].sort((a, b) => a - b).filter((b, i, arr) => b - (i ? arr[i - 1] : 0) >= 12 && T[b] < dur - 4);
    const starts = [0, ...picked];
    // strength: loudness of each beat (smoothed over 2 bars) against the whole song, ignoring silence
    const L = eDb.map((_, i) => { let a2 = 0, c = 0; for (let k = Math.max(0, i - 4); k < Math.min(NBt, i + 4); k++) { a2 += eDb[k]; c++; } return a2 / c; });
    const top = Math.max(...L), live = L.filter(v => v > top - 30);
    const q1 = quantile(live, .36), q2 = quantile(live, .7);
    let secs = [];
    for (let i = 0; i < starts.length; i++) {
      const b0 = starts[i], b1 = i + 1 < starts.length ? starts[i + 1] : NBt;
      const med = median(L.slice(b0, b1));
      secs.push({ t: i === 0 ? 0 : +T[b0].toFixed(4), end: +(i + 1 < starts.length ? T[b1] : dur).toFixed(4), med, level: med < q1 ? 'suave' : med < q2 ? 'medio' : 'fuerte' });
    }
    // join neighbors of the same strength
    const merged = [];
    for (const x of secs) { const p2 = merged[merged.length - 1]; if (p2 && p2.level === x.level) p2.end = x.end; else merged.push(Object.assign({}, x)); }
    secs = merged;
    const names = { suave: 'Suave', medio: 'Medio', fuerte: 'Fuerte' };
    secs.forEach((x, i) => { x.name = `${names[x.level]} ${i + 1}`; x.typ = ''; delete x.med; });
    return secs;
  }

  const levelAt = (secs, t) => { let l = 'medio'; for (const s of secs || []) if (t >= s.t - 1e-3 && t < s.end) l = s.level; return l; };
  window.BezaleelSections = { detect, fromArpa, sectionType, levelAt, LEVELS };
})();
