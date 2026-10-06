# Third-party software

Bezaleel includes these fonts, each under the [SIL Open Font License 1.1](app/fonts/licenses/). The full license and copyright for each font are in `app/fonts/licenses/`.

| Font | License file |
|---|---|
| Archivo | `archivo-OFL.txt` |
| Bebas Neue | `bebasneue-OFL.txt` |
| Caveat | `caveat-OFL.txt` |
| Geist | `geist-OFL.txt` |
| JetBrains Mono | `jetbrainsmono-OFL.txt` |
| Montserrat | `montserrat-OFL.txt` |
| Oswald | `oswald-OFL.txt` |
| Playfair Display | `playfairdisplay-OFL.txt` |

Noise reduction uses [RNNoise](https://github.com/xiph/rnnoise) (Xiph.Org, Mozilla; BSD 3-Clause), compiled to WebAssembly by [rnnoise-wasm](https://github.com/shiguredo/rnnoise-wasm) (Shiguredo; Apache License 2.0) and wrapped as an AudioWorklet by [web-noise-suppressor](https://github.com/sapphi-red/web-noise-suppressor) (MIT). The files and all three licenses are in `app/vendor/rnnoise/`.

Person detection uses Google's [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) and its selfie segmentation model, both under the Apache License 2.0. The files and the license are in `app/vendor/mediapipe/`.

The Windows program is built with [Electron](https://www.electronjs.org/) (MIT License) and uses [electron-updater](https://www.electron.build/) (MIT License).

# Logos

The logos in `app/brand/` (Bezaleel, Philly, Taber Olocuilta, Arca and Arpa) and the app icons in `app/icons/` and `build/` belong to their ministries and projects. They are not covered by the GPL-3.0 license of Bezaleel's code. Forks may keep the files in the history, but should not present themselves as these ministries or projects.
