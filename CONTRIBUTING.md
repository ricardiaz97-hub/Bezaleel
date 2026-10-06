# Contributing to Bezaleel

Thank you for helping churches tell their stories.

1. **Read [docs/STANDARDS.md](docs/STANDARDS.md).** A change that breaks one of the promises won't be merged.
2. **Open an issue first** for anything bigger than a small fix, so we can agree on the approach.
3. **Test with real video** on a machine close to the reference hardware, and say in the pull request what you tested and on what.
4. **Keep old projects opening.** If you change how projects are saved, older projects must still load.
5. **Write the interface in plain language,** in Spanish and English.
6. **Add no paid services, trackers or required accounts.**

## Adding an effect or transition

Effects and transitions live in `app/engine.js`, and each one is a short GLSL function. To add an effect, add an entry to `FX` with its name, its parameters and the shader body. To add a transition, add an entry to `TRX`. The comment at the top of the file explains the inputs each shader gets. New entries show up in the editor's menus automatically, with a rendered preview.

By contributing, you agree that your contribution is licensed under the GPL-3.0-or-later, like the rest of the project.
