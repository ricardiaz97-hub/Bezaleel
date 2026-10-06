# Bezaleel: mission, standards and roadmap

## Mission

A complete, free video editor for churches and worship teams. Reels first, and ready for the occasional professional long-form shoot.

Commercial editors are excellent, but they're expensive and put their best transitions, filters and effects behind paywalls. Bezaleel gives every church those tools, without paying anything.

## The promises

Every change has to keep all of these. A feature that breaks one doesn't ship.

1. **Free, all of it, forever.** No paywalls, no premium effects, no watermark, no trial, no ads.
2. **No accounts and no servers.** Bezaleel runs entirely on the user's computer. Nothing in it may depend on a paid service, because a paid service eventually means someone charges.
3. **Your videos never leave your computer** unless you export and share them yourself.
4. **Works offline.** Many churches have unreliable internet.
5. **A volunteer learns it in 10 minutes.** Plain language, no jargon, worship-specific templates.
6. **Nothing ships untested.** Every change is checked with real video before it reaches `main`, because `main` updates every installed copy automatically.
7. **Projects keep opening.** A new version must open projects saved by older versions.

## Hardware we build for

We build for **capable, affordable equipment**: a decent machine a church can reach with a fundraiser, a bake sale or a line in the budget. Not cutting-edge hardware, and not ten-year-old computers either.

**Reference machine**

| | Target |
|---|---|
| Processor | 4 to 6 cores from roughly 2020 or newer: Intel Core i5 10th gen, AMD Ryzen 5 4000, or Apple M1 |
| Memory | 16 GB (8 GB works with shorter projects) |
| Graphics | Integrated graphics are fine (Intel Iris Xe, AMD Radeon, Apple M-series); a dedicated card is a bonus |
| Storage | SSD |
| System | Windows 10/11 or macOS 12+, with an up-to-date Chrome or Edge |

**What the reference machine must do**

- Edit and preview 1080p video at 30 fps smoothly, with effects on.
- Handle 4K camera footage through proxies (phase 4).
- Export a 60-second Reel in less than a minute once fast export lands (phase 4).

Older machines may still work, but we don't hold features back for them.

## Roadmap

1. **Solid foundation.** Test the current editor with the team's real videos and fix everything that breaks. Add Spanish and English, switchable.
2. **Graphics engine + effects library.** Move video drawing to the graphics card (WebGL). Then add:
   - transitions: glitch, whip pan, zoom punch, flash, light leak, film burn, RGB split, shake, spin blur, luma fades
   - filters: flicker, glitch, VHS, film grain, vignette, chromatic aberration, CRT, pixelate, duotone, mirror, kaleidoscope
   - LUTs (`.cube`) with a pack of free looks included
   - green screen
3. **Reels toolkit.** Vertical-first templates, animated word-by-word captions, cutting to the beat, intros and outros, and automatic subtitles that run on the computer itself.
4. **Pro long-form.** Faster-than-real-time export, log footage with camera LUTs, and proxies for 4K.
5. **Team.** Project files that move between computers (USB, Drive, WhatsApp) with no server, plus a shared library of the church's logos, fonts and LUTs.
