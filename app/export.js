/* Bezaleel frame-by-frame export.
 *
 * The real-time export records the screen while the project plays, so a slow moment on the computer drops frames.
 * This one never hurries: for every frame it decodes the exact picture each video needs (WebCodecs, in order, with
 * Mediabunny reading the files), draws the frame with the same code as the preview, and hands it to the encoder.
 * It can take longer or shorter than the video itself, and nothing is skipped.
 *
 * Mediabunny is loaded only when exporting (vendor/mediabunny, MPL-2.0).
 */
(function () {
  'use strict';
  let MBP = null;
  const load = () => (MBP || (MBP = import('./vendor/mediabunny/mediabunny.min.js').catch(e => { MBP = null; throw e; })));
  const supported = () => typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined' && typeof AudioEncoder !== 'undefined';

  // The best file this computer can write: MP4 with H.264 (plays everywhere), else WEBM.
  async function pickFormat(W, H, fps, bitrate) {
    if (!supported()) return null;
    let MB; try { MB = await load(); } catch (e) { console.warn('Bezaleel export: mediabunny', e); return null; }
    const vopt = { width: W, height: H, bitrate, frameRate: fps };
    try {
      if (await MB.canEncodeVideo('avc', vopt)) {
        const ac = await MB.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000, bitrate: 192000 });
        return { MB, container: 'mp4', ext: 'mp4', mime: 'video/mp4', vcodec: 'avc', acodec: ac, label: ac === 'aac' ? 'MP4 (H.264 + AAC)' : 'MP4 (H.264)' };
      }
      const vc = await MB.getFirstEncodableVideoCodec(['vp9', 'vp8'], vopt);
      if (vc) {
        const ac = await MB.canEncodeAudio('opus', { numberOfChannels: 2, sampleRate: 48000, bitrate: 192000 }) ? 'opus' : null;
        return { MB, container: 'webm', ext: 'webm', mime: 'video/webm', vcodec: vc, acodec: ac, label: 'WEBM (' + vc.toUpperCase() + ')' };
      }
    } catch (e) { console.warn('Bezaleel export: codecs', e); }
    return null;
  }

  /* Frame sources: one decoder per clip, walking forward through the times that clip needs. */
  class Frames {
    constructor(MB) { this.MB = MB; this.inputs = new Map(); this.open = new Map(); }
    async track(mediaId, blob) {
      let p = this.inputs.get(mediaId);
      if (!p) {
        p = (async () => {
          const input = new this.MB.Input({ source: new this.MB.BlobSource(blob), formats: this.MB.ALL_FORMATS });
          const tr = await input.getPrimaryVideoTrack();
          if (!tr || !(await tr.canDecode())) return null;
          return { input, tr };
        })().catch(e => { console.warn('Bezaleel export: cannot read video', e); return null; });
        this.inputs.set(mediaId, p);
      }
      return p;
    }
    // times: the source time of every frame this clip appears in, in order.
    async start(key, mediaId, blob, times, w, h) {
      const t = await this.track(mediaId, blob); if (!t) return false;
      const sink = new this.MB.VideoSampleSink(t.tr);
      const it = sink.samplesAtTimestamps(times)[Symbol.asyncIterator]();
      const cnv = document.createElement('canvas'); cnv.width = w; cnv.height = h;
      this.open.set(key, { it, cnv, ctx: cnv.getContext('2d'), left: times.length });
      return true;
    }
    has(key) { return this.open.has(key); }
    // Draws this clip's next frame into its own canvas and returns the canvas (or null if the video ended early).
    async next(key) {
      const o = this.open.get(key); if (!o) return null;
      const r = await o.it.next(); o.left--;
      const s = r.done ? null : r.value;
      if (s) { try { s.drawWithFit(o.ctx, { fit: 'fill' }); } finally { s.close(); } o.any = true; }
      return o.any ? o.cnv : null;
    }
    async stop(key) { const o = this.open.get(key); if (!o) return; this.open.delete(key); try { await o.it.return(); } catch (e) {} }
    async close() { for (const k of [...this.open.keys()]) await this.stop(k); for (const p of this.inputs.values()) { try { const t = await p; if (t && t.input.dispose) t.input.dispose(); } catch (e) {} } this.inputs.clear(); }
  }

  /* The encoder side: canvas frames + rendered audio into one file in memory. */
  async function makeOutput(fmt, canvas, fps, bitrate) {
    const MB = fmt.MB;
    const output = new MB.Output({ format: fmt.container === 'mp4' ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const video = new MB.CanvasSource(canvas, { codec: fmt.vcodec, bitrate, keyFrameInterval: 2, latencyMode: 'quality' });
    output.addVideoTrack(video, { frameRate: fps });
    let audio = null;
    if (fmt.acodec) { audio = new MB.AudioBufferSource({ codec: fmt.acodec, bitrate: 192000 }); output.addAudioTrack(audio); }
    await output.start();
    return {
      addFrame: (t, d) => video.add(t, d),
      addAudio: buf => (audio ? audio.add(buf) : Promise.resolve()),
      async finish() { await output.finalize(); return new Blob([output.target.buffer], { type: fmt.mime }); },
      async cancel() { try { await output.cancel(); } catch (e) {} }
    };
  }

  window.BezaleelExport = { supported, load, pickFormat, Frames, makeOutput };
})();
