# Bezaleel

**A free, open-source video editor for churches and worship teams.**
Reels first, ready for the occasional long-form shoot. No subscriptions, no watermarks, no features locked behind paywalls.

> *"And he has filled him with the Spirit of God, with skill, with intelligence, with knowledge, and with all craftsmanship, to devise artistic designs."* (Exodus 35:31–32)

*Español abajo.*

## Use it

- **Web app (installable):** https://ricardiaz97-hub.github.io/Ricardo-Vega/. Open it in Chrome or Edge and choose **Instalar app**. It works offline and updates itself.
- **Windows program:** download `Bezaleel-Setup-<version>.exe` from [Releases](https://github.com/ricardiaz97-hub/Ricardo-Vega/releases/latest). It updates itself. Windows shows "Windows protected your PC" because the installer isn't code-signed: choose **More info → Run anyway**.

Your videos never leave your computer. Projects are stored locally on each machine.

## What's in it today

- Multitrack timeline: two video tracks, two text tracks, music and voice
- Cuts, trims, speed from 0.25× to 4×, undo and redo
- Title styles for worship: lyrics, scripture, lower thirds, credits
- An **Efectos** menu with 16 shader effects (chromatic aberration, RGB shake, warp pulse, glitch, flicker, VHS, film grain, green screen and more), applied to one clip or, on the Efectos track, to everything below it
- 17 transitions (zoom warp, RGB shake, glitch, light leak, film burn, whip and more) at the start or end of a clip, or at the joint between two clips
- LUTs: 10 built-in looks plus `.cube` import
- Gradual zoom in and out on any clip
- Rhythm: automatic beat detection for the song on the Música track (or tap the beat by hand), beat markers and snapping, effects that hit on every beat, 2 beats or bar, and **Cortar al ritmo** to cut a clip on the beat with transitions
- Audio: 5-band equalizer with presets, background noise reduction (RNNoise), voice enhancement, lowering the music when someone speaks, and volume normalizing
- Color filters, audio fades and crossfades, detaching audio from video
- 16:9, 9:16, 1:1 and 4:5 formats
- Export to MP4

See [docs/STANDARDS.md](docs/STANDARDS.md) for the mission, the promises the project keeps, the hardware we build for and the roadmap.

## Project layout

| Path | What it is |
|---|---|
| `app/index.html` | The editor |
| `app/engine.js` | The effects engine: every effect, transition and built-in LUT, as WebGL 2 shaders |
| `app/rhythm.js` | Beat detection and tap tempo |
| `app/vendor/rnnoise/` | The noise reduction model and its worklet (third-party, see NOTICE) |
| `app/` (other files) | Manifest, offline service worker, fonts and icons |
| `electron/` | The Windows program, which wraps `app/` and handles automatic updates |
| `.github/workflows/pages.yml` | Publishes `app/` to GitHub Pages on every push to `main` |
| `.github/workflows/desktop.yml` | Builds the Windows installer and publishes it to Releases on every push to `main` |

## Develop

```
npm ci
npm start          # opens the Windows program from source
```

To work on the web app, serve `app/` with any static server, for example `npx serve app`. It must run on `http://localhost` for the offline service worker to register.

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

Bezaleel is free software under the [GNU General Public License v3.0 or later](LICENSE). Anyone can use, study, share and improve it, and every version anyone distributes must stay free and open too.

The bundled fonts are under the SIL Open Font License 1.1; see [NOTICE.md](NOTICE.md).

---

## Español

**Editor de video gratis y de código abierto para iglesias y equipos de alabanza.**

- **App web instalable:** https://ricardiaz97-hub.github.io/Ricardo-Vega/. Ábrela en Chrome o Edge y toca **Instalar app**.
- **Programa para Windows:** descarga el instalador en [Releases](https://github.com/ricardiaz97-hub/Ricardo-Vega/releases/latest). Se actualiza solo. Si Windows dice "Windows protegió su PC", toca **Más información → Ejecutar de todas formas**.

Tus videos nunca salen de tu computadora. La misión, los estándares y el plan están en [docs/STANDARDS.md](docs/STANDARDS.md).
