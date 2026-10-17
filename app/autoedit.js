/* Bezaleel automatic edit: a song + some videos in, a beat-cut edit out.
 *
 * The result is ordinary Bezaleel clips (video clips with joins, effect clips, a title and the song), so everything
 * it makes can be changed by hand afterwards. Nothing here touches the editor: build() returns plain objects.
 *
 * How it decides:
 * - Strength of each part (suave / medio / fuerte, from Arpa or from listening) sets how often it cuts:
 *   suave every 2 bars, medio every bar (sometimes every 2 beats), fuerte every 2 beats with bursts of one cut per beat
 *   at the end of each 4-bar phrase.
 * - The bar before a change into fuerte is a build-up: one cut per beat, the last beat split in two, the picture
 *   creeping closer and darker. The first beat of fuerte is the drop: flash, zoom hit, shake and color split.
 * - Every shot gets its own framing (a point of the picture to center on, a zoom, a slow push, pull or pan) so a few
 *   videos give many different shots. Videos named "suave", "medio" or "fuerte" are kept for those parts.
 */
(function () {
  'use strict';
  const LV = ['suave', 'medio', 'fuerte'];
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
  const levelAt = (secs, t) => { for (const s of secs) if (t >= s.t - 1e-3 && t < s.end - 1e-3) return s.level; return secs.length ? secs[secs.length - 1].level : 'medio'; };
  const tagOf = name => { const n = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return LV.find(l => n.includes(l)) || null; };

  // Beat list with bar positions counted from each section's start, so bars follow the music's structure.
  function grid(beats, secs) {
    const T = beats.times, sig = beats.sig || 4;
    return T.map((t, i) => {
      let s0 = null; for (const s of secs) if (t >= s.t - .03) s0 = s;
      let k;
      if (s0) { const b0 = T.findIndex(x => x >= s0.t - .03); k = (((i - b0) % sig) + sig) % sig; }
      else k = (((i - (beats.down || 0)) % sig) + sig) % sig;
      return { t, i, k, sig };
    });
  }
  function drops(secs) { return secs.filter((s, i) => i > 0 && s.level === 'fuerte' && secs[i - 1].level !== 'fuerte').map(s => s.t); }

  // Picks where the edit starts and ends in the song. target: seconds, or 0 for the whole song.
  // from: 'first' (first chorus), 'last' (last chorus) or 'start'.
  function chooseWindow(beats, secs, duration, target, from) {
    if (!target || target >= duration - 1) return { t0: 0, t1: duration };
    const G = grid(beats, secs), downs = G.filter(b => b.k === 0).map(b => b.t), per = beats.times.length > 1 ? (beats.times[beats.times.length - 1] - beats.times[0]) / (beats.times.length - 1) : .5;
    const bar = per * (beats.sig || 4) * (60 / per >= 130 ? 2 : 1); // fast grids are edited in half time
    const dr = drops(secs).filter(t => t > 6);
    let anchor = 0;
    if (from !== 'start') {
      if (dr.length) anchor = from === 'last' ? dr[dr.length - 1] : dr[0];
      else { const f = secs.filter(s => s.level === 'fuerte'); anchor = f.length ? (from === 'last' ? f[f.length - 1].t : f[0].t) : 0; }
    }
    const lead = target <= 20 ? 2 : target <= 40 ? 4 : 8;
    const near = t => downs.reduce((b, d) => (Math.abs(d - t) < Math.abs(b - t) ? d : b), downs[0] || 0);
    let t0 = anchor ? near(anchor - lead * bar) : 0; if (t0 < 0) t0 = 0;
    if (anchor && anchor - lead * bar < 0) t0 = 0;
    let t1 = near(t0 + target);
    // end at the end of a section when one is close
    const ends = secs.map(s => s.end).filter(e => e > t0 + target * .75 && e < t0 + target * 1.25);
    if (ends.length) t1 = ends.reduce((b, e) => (Math.abs(e - (t0 + target)) < Math.abs(b - (t0 + target)) ? e : b), ends[0]);
    t1 = Math.min(duration, Math.max(t1, t0 + Math.min(target, 4)));
    return { t0: +t0.toFixed(4), t1: +t1.toFixed(4) };
  }

  // opts: { beats:{times,down,sig}, sections, duration, t0, t1, videos:[{id,kind,duration,w,h,name}], W, H, seed, title }
  function build(opts) {
    const r = rng(opts.seed || 7);
    const secs = (opts.sections && opts.sections.length) ? opts.sections : [{ t: 0, end: opts.duration, level: 'medio', name: '' }];
    const { t0, t1, W, H } = opts;
    // Fast grids (130 BPM and up, like a 69 BPM song counted in eighths) are edited in half time: the cuts and hits
    // follow the beat people feel, not every click.
    const bt0 = opts.beats, per0 = bt0.times.length > 1 ? (bt0.times[bt0.times.length - 1] - bt0.times[0]) / (bt0.times.length - 1) : .5;
    const half = 60 / per0 >= 130, down0 = bt0.down || 0;
    const beats = half ? { times: bt0.times.filter((_, i) => ((i - down0) % 2 + 2) % 2 === 0), down: 0, sig: bt0.sig || 4 } : bt0;
    if (half) beats.down = Math.max(0, beats.times.indexOf(bt0.times[down0]));
    const G = grid(beats, secs), per = per0 * (half ? 2 : 1);
    // how a hit "every edit beat" is written for the editor, whose beats are the song's grid
    const every = n => Math.min(4, n * (half ? 2 : 1));
    const inWin = G.filter(b => b.t >= t0 - 1e-3 && b.t < t1 - 1e-3);
    const D = inWin.filter(b => b.k === 0);
    const dr = drops(secs).filter(t => t > t0 + .05 && t < t1 - .05);
    const isDrop = t => dr.some(d => Math.abs(d - t) < .06);

    /* ---- cut points ---- */
    let cuts = [t0];
    D.forEach((d, i) => {
      const nxt = i + 1 < D.length ? D[i + 1].t : t1, lvl = levelAt(secs, d.t + .01);
      const bb = inWin.filter(b => b.t >= d.t - 1e-3 && b.t < nxt - 1e-3);
      const preDrop = dr.some(x => Math.abs(x - nxt) < .06);
      const nBar = D.filter(x => x.t <= d.t && levelAt(secs, x.t + .01) === lvl && x.t >= (secs.find(s => d.t >= s.t - 1e-3 && d.t < s.end) || { t: 0 }).t - 1e-3).length;
      if (preDrop) { bb.forEach((b, k) => { cuts.push(b.t); if (k === bb.length - 1) cuts.push(b.t + per / 2); }); }
      else if (lvl === 'suave') { if (nBar % 2 === 1) cuts.push(d.t); }
      else if (lvl === 'medio') { cuts.push(d.t); if (nBar % 2 === 0 && bb.length > 2) cuts.push(bb[2].t); }
      else if (nBar % 4 === 0) cuts.push(...bb.map(b => b.t));
      else { cuts.push(d.t); if (bb.length > 2) cuts.push(bb[2].t); }
    });
    for (const d of dr) cuts.push(d);
    cuts = cuts.filter(c => c >= t0 - 1e-3 && c < t1 - .2).sort((a, b) => a - b);
    const cs = []; for (const c of cuts) if (!cs.length || c - cs[cs.length - 1] > .12) cs.push(c);
    cs[0] = t0; cs.push(t1); cuts = cs;

    /* ---- shots ---- */
    const vids = opts.videos.filter(v => v && (v.kind === 'video' || v.kind === 'image'));
    if (!vids.length) return null;
    const pools = {}; for (const l of LV) { const tagged = vids.filter(v => tagOf(v.name) === l); pools[l] = tagged.length ? tagged : vids; }
    const out = { shots: [], fx: [], text: [], song: { in: t0, dur: t1 - t0 } };
    const P = t => +(t - t0).toFixed(4);
    let last = '';
    const motions = { suave: ['in', 'out', 'pl', 'pr'], medio: ['in', 'out', 'pl', 'pr', 'in'], fuerte: ['in', 'out', 'in', 'pl', 'pr'] };
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1], dur = b - a, lvl = levelAt(secs, a + .01), drop = isDrop(a);
      let v, fx, key;
      for (let tries = 0; tries < 12; tries++) {
        v = pick(r, r() < .8 ? pools[lvl] : vids); fx = pick(r, [.32, .5, .68]) + (r() - .5) * .06; key = v.id + ':' + fx.toFixed(1);
        if (key !== last) break;
      }
      last = key;
      const sw = v.w || 1920, sh = v.h || 1080, rc = Math.max(W / sw, H / sh), bw = sw * rc, bh = sh * rc;
      const zoom = { suave: .08, medio: .12, fuerte: .16 }[lvl];
      let sc = 1 + (r() * .08) + (drop ? .04 : 0);
      const km = drop ? 'out' : pick(r, motions[lvl]);
      const kba = drop ? .35 : +(zoom * (.7 + r() * .6)).toFixed(3);
      const sMin = sc * (km === 'pl' || km === 'pr' ? 1 + kba : 1);
      const roomX = Math.max(0, (bw * sMin / W - 1) / 2), roomY = Math.max(0, (bh * sMin / H - 1) / 2);
      let x = .5 - (fx - .5) * bw * sc / W; x = Math.max(.5 - roomX, Math.min(.5 + roomX, x));
      const y = .5 + (r() - .5) * 2 * roomY * .5;
      let speed = 1;
      if (v.kind === 'video') {
        if (lvl === 'suave') speed = .75;
        else if (lvl === 'fuerte' && dur > per * 1.8 && r() < .3) speed = .5; // cámara lenta en algunas tomas largas
      }
      const need = dur * speed + .6, vd = v.duration || 10;
      const inPt = v.kind === 'video' ? +(Math.max(0, r() * Math.max(0, vd - need))).toFixed(3) : 0;
      // transition into this shot (a join with the previous shot, centered on the cut)
      let join = null;
      if (i > 0 && !drop) {
        const prevLen = a - cuts[i - 1], short = dur < per * 1.1 || prevLen < per * 1.1;
        const onPhrase = D.some((d, j) => j % 4 === 0 && Math.abs(d.t - a) < .03);
        let t;
        if (lvl === 'fuerte') t = onPhrase ? pick(r, ['whip', 'warp', 'spin']) : short ? (r() < .25 ? 'glitch' : null) : pick(r, ['whip', 'warp', 'spin', 'rgbshake', null]);
        else if (lvl === 'medio') t = short ? null : pick(r, ['warp', 'whip', 'blur', 'leak']);
        else t = pick(r, ['blur', 'dissolve', 'leak']);
        if (t) {
          const d = t === 'blur' || t === 'dissolve' || t === 'leak' ? Math.min(.9, per * 1.4) : t === 'glitch' ? .22 : Math.min(.4, per * .62);
          join = { t, d: +Math.min(d, dur * .9, prevLen * .9).toFixed(2) };
        }
      }
      // effects that belong to the shot: a hit on hard cuts (it starts with the shot), the drop, the beat pulse
      const efx = [];
      if (drop) efx.push({ k: 'impact', amt: 1 }, { k: 'shake', amt: .55, spd: .6, beat: 4, decay: .35 }, { k: 'ab', amt: .8, beat: 4, decay: .28 }, { k: 'flash', amt: .3, col: '#FF8A3D', beat: 4, decay: .7 });
      else if (i > 0 && !join && lvl !== 'suave') efx.push({ k: 'impact', amt: lvl === 'fuerte' ? .55 : .35 });
      // every shot moves with the music: a zoom pulse on each beat in fuerte, every 2 beats in medio, every bar in suave
      if (lvl === 'fuerte') efx.push({ k: 'punch', amt: .34, beat: every(1), decay: .11 });
      else if (lvl === 'medio') efx.push({ k: 'punch', amt: .2, beat: every(2), decay: .14 });
      else efx.push({ k: 'punch', amt: .12, beat: 4, decay: .22 });
      out.shots.push({ mediaId: v.id, kind: v.kind, start: P(a), dur: +(dur).toFixed(4), in: inPt, speed, x: +x.toFixed(4), y: +y.toFixed(4), sc: +sc.toFixed(3), kbm: km, kba, join, efx, level: lvl, drop });
    }
    const first = out.shots[0], lastS = out.shots[out.shots.length - 1];
    first.tin = { t: 'fade', d: .5 }; lastS.tout = { t: 'fade', d: Math.min(1.3, lastS.dur) };

    /* ---- effect layers ---- */
    // build-ups: two bars that creep closer and darker before each drop (track Efectos)
    for (const d of dr) {
      const st = Math.max(t0, d - 8 * per);
      out.fx.push({ track: 'f1', start: P(st), dur: +(d - st).toFixed(4), efx: [{ k: 'riser', amt: .8 }], role: 'riser' });
    }
    // the look of the whole edit, on top of everything (track Acabado)
    out.fx.push({ track: 'f2', start: 0, dur: +(t1 - t0).toFixed(4), efx: [{ k: 'glow', amt: .12, rad: .5 }, { k: 'vignette', amt: .42 }, { k: 'grain', amt: .18 }], lut: { id: 'b:teal', mix: .45 }, role: 'look' });

    /* ---- title ---- */
    if (opts.title && opts.title.trim()) {
      const vertical = H > W, lines = opts.title.trim().split(/\n/);
      const big = lines.length > 1 ? lines.slice(1).join(' ') : lines[0], small = lines.length > 1 ? lines[0] : '';
      const at = Math.min(.35, (t1 - t0) / 10), len = Math.min(3.8, (t1 - t0) * .4);
      out.text.push({ s: big, start: at + .3, dur: len - .3, y: vertical ? .16 : .3, style: { font: 'Bebas Neue', size: vertical ? 200 : 170, w: 400, up: true, shadow: true }, tin: { t: 'blur', d: .7 }, tout: { t: 'blur', d: .5 } });
      if (small) out.text.push({ s: small, start: at, dur: len, y: vertical ? .095 : .19, style: { font: 'Montserrat', size: vertical ? 54 : 46, w: 800, up: true, shadow: true }, tin: { t: 'up', d: .7 }, tout: { t: 'fade', d: .5 } });
    }
    /* ---- lyrics: each line from when it is sung until the next one, big and clean ---- */
    out.lyrics = [];
    if (opts.lyrics && opts.lyrics.length && opts.lyricPos) {
      const vertical = H > W, low = opts.lyricPos === 'low';
      for (const l of opts.lyrics) {
        const a = Math.max(t0, l.t - .08), b = Math.min(t1 - .05, (l.end || l.t + 5) - .12);
        if (b - a < .5 || l.t >= t1 || (l.end || l.t + 5) <= t0) continue;
        const strong = levelAt(secs, l.t + .01) === 'fuerte';
        out.lyrics.push({ s: l.text, start: P(a), dur: +(b - a).toFixed(3), y: low ? (vertical ? .74 : .84) : .5,
          style: { font: strong ? 'Bebas Neue' : 'Montserrat', size: strong ? (vertical ? 118 : 104) : (vertical ? 70 : 64), w: strong ? 400 : 800, up: strong, shadow: true, align: 'center' },
          tin: { t: strong ? 'pop' : 'blur', d: Math.min(.45, (b - a) / 3) }, tout: { t: 'fade', d: Math.min(.25, (b - a) / 4) } });
      }
      // the title gives way to the first line: keep only its big line, and end it before the lyrics start
      if (out.lyrics.length && out.text.length) {
        const first = out.lyrics[0].start;
        out.text = out.text.filter(t => t.style.font === 'Bebas Neue' || t.start + t.dur <= first);
        for (const t of out.text) if (t.start < first && t.start + t.dur > first) t.dur = Math.max(.6, first - t.start - .1);
      }
    }
    out.cuts = cuts.length - 1; out.drops = dr.length; out.half = half;
    return out;
  }

  window.BezaleelAutoEdit = { build, chooseWindow, tagOf, drops };
})();
