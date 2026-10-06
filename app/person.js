/* Bezaleel person detection: finds the people in a frame so text can go behind them and the
 * background can be blurred or replaced without a green screen.
 *
 * It uses Google's MediaPipe selfie segmenter (Apache 2.0), bundled in app/vendor/mediapipe and run
 * entirely on this computer. Nothing loads until a project first uses it.
 *
 * mask(source) returns a small canvas whose alpha is the person (opaque) and the background
 * (transparent). Callers stretch it over the frame; the low resolution gives naturally soft edges.
 */
(function () {
  'use strict';
  let seg = null, loading = null, failed = false;
  let mk = null, mx = null, img = null, prev = null, small = null, sx = null;

  function script(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  }
  function load() {
    if (seg) return Promise.resolve(true);
    if (failed) return Promise.resolve(false);
    if (!loading) loading = (async () => {
      try {
        if (!window.Vision) await script('vendor/mediapipe/vision_bundle.js');
        const V = window.Vision, base = new URL('vendor/mediapipe/', document.baseURI).href;
        const files = await V.FilesetResolver.forVisionTasks(base + 'wasm');
        const opts = delegate => ({ baseOptions: { modelAssetPath: base + 'selfie_segmenter.tflite', delegate }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
        try { seg = await V.ImageSegmenter.createFromOptions(files, opts('GPU')); }
        catch (e) { seg = await V.ImageSegmenter.createFromOptions(files, opts('CPU')); }
        return true;
      } catch (e) { console.warn('Bezaleel person:', e); failed = true; return false; }
    })();
    return loading;
  }

  // smooth: blend with the previous mask while playing, which steadies the outline between frames.
  function mask(source, smooth) {
    if (!seg) return null;
    // The model looks at 256 px anyway: shrink the frame first so a 1080p frame costs the same as a thumbnail.
    const sw = source.videoWidth || source.width, sh = source.videoHeight || source.height; if (!sw || !sh) return null;
    const k = Math.min(1, 320 / Math.max(sw, sh)), w0 = Math.max(1, Math.round(sw * k)), h0 = Math.max(1, Math.round(sh * k));
    if (!small) { small = document.createElement('canvas'); sx = small.getContext('2d', { willReadFrequently: false }); }
    if (small.width !== w0 || small.height !== h0) { small.width = w0; small.height = h0; }
    sx.clearRect(0, 0, w0, h0); sx.drawImage(source, 0, 0, w0, h0);
    let res = null;
    try { res = seg.segment(small); } catch (e) { console.warn('Bezaleel person:', e); return null; }
    const m = res && res.confidenceMasks && res.confidenceMasks[0];
    if (!m) { if (res && res.close) res.close(); return null; }
    const w = m.width, h = m.height, data = m.getAsFloat32Array();
    if (!mk || mk.width !== w || mk.height !== h) {
      mk = document.createElement('canvas'); mk.width = w; mk.height = h; mx = mk.getContext('2d');
      img = mx.createImageData(w, h); prev = null;
      for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; }
    }
    if (!prev || prev.length !== data.length) prev = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const v = smooth ? prev[i] * .45 + data[i] * .55 : data[i]; prev[i] = v;
      img.data[i * 4 + 3] = Math.max(0, Math.min(255, (v - .3) / .4 * 255));
    }
    mx.putImageData(img, 0, 0);
    if (res.close) res.close();
    return mk;
  }

  window.BezaleelPerson = { load, mask, ready: () => !!seg, failed: () => failed };
})();
