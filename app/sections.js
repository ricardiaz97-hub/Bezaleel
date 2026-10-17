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
    let d; try { d = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) { throw new Error('Ese archivo no es una canción de Arpa (.arp).'); }
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
    // Before the first marker (a count-in or a free intro) counts as a soft start.
    if (sections.length && sections[0].t > .5) sections.unshift({ t: 0, end: sections[0].t, name: 'Inicio', typ: 'intro', level: 'suave', color: null });
    // A single marker that just names the song tells us nothing about its parts.
    const useful = sections.length > 1 ? sections : [];
    // Lyrics as Arpa keeps them: one line each, with the second it starts
    const lyrics = cleanLyrics((d.lyrics || []).map(l => ({ t: +l.t, text: l.text })));
    return { name: d.name || '', beats, sections: useful, lyrics, src: 'arpa' };
  }

  // Sorted lines with text and a time; each line also gets where it ends (the next line, at most 8 s later).
  function cleanLyrics(list) {
    const L = (list || []).filter(l => l && isFinite(+l.t) && String(l.text || '').trim()).map(l => ({ t: +(+l.t).toFixed(3), text: String(l.text).replace(/\s+/g, ' ').trim() })).sort((a, b) => a.t - b.t);
    L.forEach((l, i) => { const nx = L[i + 1]; l.end = +Math.min(nx ? nx.t : l.t + 6, l.t + 8).toFixed(3); });
    return L;
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

  /* ---------- Arpa song packages (.arp that is a ZIP with song.arp + stems/) ---------- */
  // Reads the ZIP's directory from the end of the file and returns its entries as lazy slices of the file,
  // so a 350 MB package is never loaded whole.
  async function zipEntries(file) {
    const tail = new DataView(await file.slice(Math.max(0, file.size - 65558)).arrayBuffer());
    let eo = -1; for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eo = i; break; }
    if (eo < 0) throw new Error('El paquete de Arpa está incompleto (no se encontró el índice del ZIP).');
    let count = tail.getUint16(eo + 10, true), cdSize = tail.getUint32(eo + 12, true), cdOff = tail.getUint32(eo + 16, true);
    if (cdOff === 0xFFFFFFFF || count === 0xFFFF) { // ZIP64
      const base = Math.max(0, file.size - 65558), lo = eo - 20;
      if (lo >= 0 && tail.getUint32(lo, true) === 0x07064b50) {
        const z64 = Number(tail.getBigUint64(lo + 8, true)), r = new DataView(await file.slice(z64, z64 + 56).arrayBuffer());
        count = Number(r.getBigUint64(32, true)); cdSize = Number(r.getBigUint64(40, true)); cdOff = Number(r.getBigUint64(48, true));
      } else void base;
    }
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), dec = new TextDecoder();
    const out = [];
    for (let p = 0, k = 0; k < count && p + 46 <= cd.byteLength; k++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const method = cd.getUint16(p + 10, true); let csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true);
      const nl = cd.getUint16(p + 28, true), xl = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true); let lho = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl));
      // ZIP64 sizes and offsets live in the extra field
      for (let x = p + 46 + nl; x + 4 <= p + 46 + nl + xl;) {
        const id = cd.getUint16(x, true), sz = cd.getUint16(x + 2, true);
        if (id === 1) { let q = x + 4; if (usize === 0xFFFFFFFF) { usize = Number(cd.getBigUint64(q, true)); q += 8; } if (csize === 0xFFFFFFFF) { csize = Number(cd.getBigUint64(q, true)); q += 8; } if (lho === 0xFFFFFFFF) lho = Number(cd.getBigUint64(q, true)); }
        x += 4 + sz;
      }
      out.push({ name, method, csize, usize, lho });
      p += 46 + nl + xl + cl;
    }
    const data = async e => {
      const h = new DataView(await file.slice(e.lho, e.lho + 30).arrayBuffer());
      const start = e.lho + 30 + h.getUint16(26, true) + h.getUint16(28, true);
      const raw = file.slice(start, start + e.csize);
      if (e.method === 0) return raw;
      if (e.method === 8 && typeof DecompressionStream !== 'undefined') return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      throw new Error('El paquete de Arpa usa una compresión que Bezaleel no puede abrir.');
    };
    return { entries: out, data };
  }
  const isZip = async file => { const b = new Uint8Array(await file.slice(0, 4).arrayBuffer()); return b[0] === 0x50 && b[1] === 0x4B && b[2] === 3 && b[3] === 4; };
  // Opens what Arpa saves or exports: a plain .arp, or a song package with its audio.
  // Returns { text, stems: [{ name, blob, role, gain, mute }] } (stems only from a package).
  async function openArpa(file) {
    if (!(await isZip(file))) return { text: (await file.text()).replace(/^\uFEFF/, ''), stems: [] };
    const z = await zipEntries(file);
    const songE = z.entries.find(e => /(^|\/)song\.arp$/i.test(e.name)) || z.entries.find(e => /\.arp$/i.test(e.name));
    if (!songE) throw new Error('El paquete no tiene la canción de Arpa (song.arp).');
    const text = (await (await z.data(songE)).text()).replace(/^\uFEFF/, '');
    let meta = {}; try { meta = (JSON.parse(text).stems) || {}; } catch (e) { /* fromArpa reports it */ }
    const stems = [];
    for (const e of z.entries) {
      if (!/\.(wav|mp3|m4a|aac|flac|ogg|aif|aiff)$/i.test(e.name)) continue;
      const base = e.name.split('/').pop(), info = meta[base] || {};
      stems.push({ name: base, role: info.role || 'tracks', gain: info.gain != null ? +info.gain : 1, mute: !!info.mute, blob: await z.data(e) });
    }
    return { text, stems };
  }
  // The song for the video: every stem except click and guide, mixed with Arpa's levels, as one 16-bit stereo WAV.
  // A single stem is used as it is.
  async function mixStems(stems, onProgress) {
    const use = stems.filter(s => !s.mute && s.role !== 'click' && s.role !== 'guide');
    if (!use.length) return null;
    if (use.length === 1) return { blob: use[0].blob, name: use[0].name };
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, SR = 48000;
    let L = null, R = null, len = 0, peak = 0;
    for (let i = 0; i < use.length; i++) {
      const s = use[i];
      if (onProgress) onProgress(i, use.length);
      let buf;
      try { const ab = await s.blob.arrayBuffer(); buf = await new Promise((res, rej) => { const p = new OAC(2, SR, SR).decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); }); }
      catch (e) { continue; }
      if (!L) { len = buf.length; L = new Float32Array(len); R = new Float32Array(len); }
      const a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a, g = s.gain, n = Math.min(len, buf.length);
      for (let k = 0; k < n; k++) { L[k] += a[k] * g; R[k] += b[k] * g; }
    }
    if (!L) return null;
    for (let k = 0; k < len; k++) { const v = Math.max(Math.abs(L[k]), Math.abs(R[k])); if (v > peak) peak = v; }
    const norm = peak > .98 ? .98 / peak : 1, parts = [], CH = 1 << 18;
    const hdr = new DataView(new ArrayBuffer(44)), wr = (o, t) => { for (let i = 0; i < t.length; i++) hdr.setUint8(o + i, t.charCodeAt(i)); };
    wr(0, 'RIFF'); hdr.setUint32(4, 36 + len * 4, true); wr(8, 'WAVE'); wr(12, 'fmt '); hdr.setUint32(16, 16, true); hdr.setUint16(20, 1, true); hdr.setUint16(22, 2, true);
    hdr.setUint32(24, SR, true); hdr.setUint32(28, SR * 4, true); hdr.setUint16(32, 4, true); hdr.setUint16(34, 16, true); wr(36, 'data'); hdr.setUint32(40, len * 4, true);
    parts.push(hdr.buffer);
    for (let o = 0; o < len; o += CH) {
      const n = Math.min(CH, len - o), pcm = new Int16Array(n * 2);
      for (let k = 0; k < n; k++) { pcm[2 * k] = Math.max(-1, Math.min(1, L[o + k] * norm)) * 32767; pcm[2 * k + 1] = Math.max(-1, Math.min(1, R[o + k] * norm)) * 32767; }
      parts.push(pcm.buffer);
    }
    return { blob: new Blob(parts, { type: 'audio/wav' }), name: 'mezcla.wav' };
  }

  const levelAt = (secs, t) => { let l = 'medio'; for (const s of secs || []) if (t >= s.t - 1e-3 && t < s.end) l = s.level; return l; };
  window.BezaleelSections = { detect, fromArpa, openArpa, mixStems, cleanLyrics, sectionType, levelAt, LEVELS };
})();
