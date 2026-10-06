/* Bezaleel rhythm analysis: finds the beats of a song, entirely on this computer.
 *
 * 1. Onset strength: how much new sound starts in each ~12 ms frame (log spectral flux up to ~2.7 kHz,
 *    where kicks, snares and strums live).
 * 2. Tempo: the autocorrelation of that envelope, weighted toward common worship tempos, picks the beat period.
 * 3. Beat tracking: dynamic programming (Ellis, 2007) places beats on strong onsets while keeping them
 *    close to that period, so the grid follows a live band that drifts a little.
 * 4. Downbeats: the beat phase (of four) with the most low-frequency energy is taken as beat 1.
 *
 * Soft songs without drums give a weak envelope; `conf` reports that so the editor can suggest tapping the beat.
 */
(function () {
  'use strict';

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

  const N = 1024, HOP = 128, BINS = 256;
  function onsets(x, sr) {
    const f = Math.max(1, Math.round(sr / 11025)), rate = sr / f, n = Math.floor(x.length / f), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < f; j++) s += x[i * f + j]; y[i] = s / f; }
    const frames = Math.max(0, Math.floor((n - N) / HOP)), win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1));
    const re = new Float32Array(N), im = new Float32Array(N), prev = new Float32Array(BINS);
    const raw = new Float32Array(frames), low = new Float32Array(frames);
    for (let fr = 0; fr < frames; fr++) {
      const o = fr * HOP;
      for (let i = 0; i < N; i++) { re[i] = y[o + i] * win[i]; im[i] = 0; }
      fft(re, im);
      let flux = 0, lo = 0;
      for (let k = 1; k < BINS; k++) {
        const m = Math.log1p(100 * Math.hypot(re[k], im[k])), d = m - prev[k];
        if (d > 0) { flux += d; if (k < 12) lo += d; }
        prev[k] = m;
      }
      raw[fr] = flux; low[fr] = lo;
    }
    // Subtract a 0.4 s moving average and keep only rises, so sustained chords don't count as beats.
    const fps = rate / HOP, w = Math.max(1, Math.round(fps * .4)), env = new Float32Array(frames);
    const pre = new Float64Array(frames + 1); for (let i = 0; i < frames; i++) pre[i + 1] = pre[i] + raw[i];
    let sum = 0, sq = 0;
    for (let i = 0; i < frames; i++) {
      const a = Math.max(0, i - w), b = Math.min(frames, i + w + 1), avg = (pre[b] - pre[a]) / (b - a);
      env[i] = Math.max(0, raw[i] - avg); sum += env[i]; sq += env[i] * env[i];
    }
    const mean = sum / (frames || 1), sd = Math.sqrt(Math.max(1e-12, sq / (frames || 1) - mean * mean));
    for (let i = 0; i < frames; i++) env[i] /= sd;
    // A beat registers once its attack is past the middle of the window: shift times to the attack itself.
    return { env, low, fps, offset: (N / 2 + 2 * HOP) / rate };
  }

  function tempo(env, fps) {
    const minLag = Math.max(2, Math.round(fps * 60 / 200)), maxLag = Math.round(fps * 60 / 55);
    const ac = new Float32Array(maxLag * 2 + 2);
    for (let l = minLag; l <= Math.min(maxLag * 2, env.length - 1); l++) {
      let s = 0; for (let i = l; i < env.length; i++) s += env[i] * env[i - l];
      ac[l] = s / (env.length - l);
    }
    let best = -Infinity, bl = minLag, total = 0, count = 0;
    for (let l = minLag; l <= maxLag; l++) {
      const bpm = 60 * fps / l;
      const prior = Math.exp(-.5 * Math.pow(Math.log2(bpm / 115) / .9, 2));
      const s = (ac[l] + .5 * ac[2 * l]) * prior;
      total += ac[l]; count++;
      if (s > best) { best = s; bl = l; }
    }
    const a = ac[bl - 1] || 0, b = ac[bl], c = ac[bl + 1] || 0, den = a - 2 * b + c;
    const d = den ? (a - c) / (2 * den) : 0, lag = bl + (Math.abs(d) < 1 ? d : 0);
    const mean = total / (count || 1);
    const conf = Math.max(0, Math.min(1, (b / (mean || 1e-9) - 1) / 1.5));
    return { period: lag, bpm: 60 * fps / lag, conf };
  }

  function track(env, period, tight) {
    const n = env.length, score = new Float32Array(n), back = new Int32Array(n).fill(-1);
    const lo = Math.max(1, Math.round(period / 2)), hi = Math.round(period * 2);
    for (let i = 0; i < n; i++) {
      let best = 0, bi = -1;
      for (let j = Math.max(0, i - hi); j <= i - lo; j++) {
        const r = Math.log((i - j) / period), s = score[j] - tight * r * r;
        if (bi < 0 || s > best) { best = s; bi = j; }
      }
      if (bi >= 0 && best > 0) { score[i] = env[i] + best; back[i] = bi; } else score[i] = env[i];
    }
    let end = n - 1, top = -Infinity;
    for (let i = Math.max(0, n - Math.round(period)); i < n; i++) if (score[i] > top) { top = score[i]; end = i; }
    const beats = []; for (let i = end; i >= 0; i = back[i]) { beats.push(i); if (back[i] < 0) break; }
    return beats.reverse();
  }

  // Detects beats in mono samples. Returns { bpm, times (seconds), down (index of a beat 1), conf 0..1 }.
  function detect(samples, sr) {
    const o = onsets(samples, sr);
    if (o.env.length < o.fps * 4) return null;
    const t = tempo(o.env, o.fps);
    const frames = track(o.env, t.period, 100);
    const times = frames.map(f => f / o.fps + o.offset);
    let down = 0, bestLow = -1;
    for (let k = 0; k < 4; k++) { let s = 0; for (let i = k; i < frames.length; i += 4) s += o.low[frames[i]] || 0; if (s > bestLow) { bestLow = s; down = k; } }
    return { bpm: t.bpm, times, down, conf: t.conf };
  }

  // A steady grid: beats every `period` seconds through `phase`, across `duration` seconds.
  // `phase` is a beat 1, so the returned `down` points at it.
  function grid(period, phase, duration) {
    period = Math.max(.15, period);
    const first = phase - Math.floor(phase / period) * period;
    const times = []; for (let t = first; t < duration; t += period) times.push(+t.toFixed(4));
    const down = ((Math.round((phase - first) / period) % 4) + 4) % 4;
    return { bpm: 60 / period, times, down, conf: 1, manual: true };
  }

  // Turns tapped beat times (seconds in the song) into a steady grid. The first tap is beat 1.
  function fromTaps(taps, duration) {
    if (taps.length < 4) return null;
    const iv = []; for (let i = 1; i < taps.length; i++) { const d = taps[i] - taps[i - 1]; if (d > .2 && d < 2) iv.push(d); }
    if (iv.length < 3) return null;
    iv.sort((a, b) => a - b);
    let per = iv[iv.length >> 1];
    // least squares on beat numbers: tap_i ≈ phase + per * k_i
    const k = taps.map(x => Math.round((x - taps[0]) / per)); let n = 0, sk = 0, st = 0, skk = 0, skt = 0;
    taps.forEach((x, i) => { n++; sk += k[i]; st += x; skk += k[i] * k[i]; skt += k[i] * x; });
    const den = n * skk - sk * sk; if (den > 0) per = (n * skt - sk * st) / den;
    const phase = (st - per * sk) / n;
    return grid(per, phase, duration);
  }

  window.BezaleelRhythm = { detect, grid, fromTaps };
})();
