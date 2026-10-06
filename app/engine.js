/* Bezaleel effects engine.
 *
 * The editor draws each clip with the 2D canvas as before. When a clip has effects, a LUT,
 * or a shader transition, it is drawn into a full-frame layer instead, and this engine runs
 * that layer through WebGL 2 shaders on the graphics card. The result is drawn back into
 * the main canvas, so preview and export see exactly the same pixels.
 *
 * Adding an effect: add an entry to FX with its parameters and a GLSL body that writes `o`
 * (premultiplied RGBA) from the input layer sampled with S(uv). Parameters become uniforms
 * named u_<key>. `uT` is seconds since the clip started, `uR` the frame size in pixels.
 * An effect with an `amt` parameter can also follow the music: the editor scales `amt` on each beat.
 *
 * Adding a transition: add an entry to TRX. Its body mixes SA(uv) (outgoing) and SB(uv)
 * (incoming) using progress uP from 0 to 1. A solo clip's entrance has no A; its exit no B.
 */
(function () {
  'use strict';
  const PCT = v => Math.round(v * 100) + '%';
  const amt = (def, n) => ({ n: n || 'Intensidad', min: 0, max: 1, step: .01, def, f: PCT });
  const spd = def => ({ n: 'Velocidad', min: 0, max: 1, step: .01, def, f: PCT });

  /* ---------- clip and adjustment effects ---------- */
  // `beat: 1` marks effects meant to hit on the music: they start with "Al ritmo" switched on.
  const FX = {
    punch: { n: 'Pulso de zoom', beat: 1, p: { amt: amt(.5) }, g: `
      vec2 q = v - .5; vec4 acc = vec4(0.);
      for (int i = 0; i < 10; i++) acc += S(q * (1. - float(i) * u_amt * .012) / (1. + u_amt * .22) + .5);
      o = acc / 10.;` },
    flash: { n: 'Destello', beat: 1, p: { amt: amt(.6), col: { n: 'Color', t: 'color', def: '#FFFFFF' } }, g: `
      vec4 c = S(v); o = vec4(mix(c.rgb, u_col * c.a, u_amt * .85), c.a);` },
    ab: { n: 'Aberración cromática', p: { amt: amt(.5) }, g: `
      vec2 d = (v - .5) * u_amt * .035;
      vec4 r = S(v + d), c = S(v), b = S(v - d);
      o = vec4(r.r, c.g, b.b, max(c.a, max(r.a, b.a)));` },
    rgbshake: { n: 'Sacudida RGB', p: { amt: amt(.5), spd: spd(.5) }, g: `
      float t = uT * (2. + u_spd * 18.);
      vec2 sh = (vec2(n1(t), n1(t + 17.)) - .5) * u_amt * .08;
      vec2 uv = (v - .5) / (1. + u_amt * .08) + .5 + sh;
      vec2 sp = vec2((n1(t + 5.) - .5) * u_amt * .06, (n1(t + 9.) - .5) * u_amt * .02);
      vec4 c = S(uv);
      o = vec4(S(uv + sp).r, c.g, S(uv - sp).b, c.a);` },
    shake: { n: 'Sacudida de cámara', p: { amt: amt(.4), spd: spd(.5) }, g: `
      float t = uT * (1. + u_spd * 14.);
      vec2 sh = (vec2(n1(t), n1(t + 31.)) - .5) * u_amt * .07;
      float a = (n1(t + 57.) - .5) * u_amt * .08;
      vec2 asp = vec2(uR.x / uR.y, 1.);
      vec2 q = (v - .5) * asp;
      q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q / asp;
      o = S(q / (1. + u_amt * .12) + .5 + sh);` },
    warp: { n: 'Pulso warp', p: { amt: amt(.5), spd: spd(.35) }, g: `
      float t = uT * (.4 + u_spd * 3.);
      float k = pow(.5 + .5 * sin(t * 6.2832), 6.) * u_amt;
      vec2 q = v - .5; vec4 acc = vec4(0.);
      for (int i = 0; i < 14; i++) acc += S(q * (1. - float(i) * k * .014) / (1. + k * .14) + .5);
      o = acc / 14.;` },
    zoomblur: { n: 'Desenfoque de zoom', p: { amt: amt(.35) }, g: `
      vec2 q = v - .5; vec4 acc = vec4(0.);
      for (int i = 0; i < 16; i++) acc += S(q * (1. - float(i) * u_amt * .012) + .5);
      o = acc / 16.;` },
    glitch: { n: 'Glitch', p: { amt: amt(.5), spd: spd(.5) }, g: `
      float t = floor(uT * (4. + u_spd * 26.));
      float row = floor(v.y * mix(6., 40., h1(t)));
      float on = step(1. - u_amt * .7, h1(row + t * 13.1));
      float off = (h1(row * 7.3 + t) - .5) * .25 * u_amt * on;
      vec2 uv = vec2(fract(v.x + off), v.y);
      float sp = u_amt * .025 * (on + .25);
      vec4 c = S(uv);
      c = vec4(S(uv + vec2(sp, 0.)).r, c.g, S(uv - vec2(sp, 0.)).b, c.a);
      float blk = step(.985 - u_amt * .04, h2(floor(v * vec2(16., 9.)) + t));
      c.rgb = mix(c.rgb, vec3(c.a) - c.rgb, blk * .8);
      o = c;` },
    flicker: { n: 'Parpadeo', p: { amt: amt(.5), spd: spd(.5) }, g: `
      float t = uT * (4. + u_spd * 30.);
      float f = 1. + (n1(t) - .5) * u_amt * 1.1 - step(.9, h1(floor(t))) * u_amt * .7;
      vec4 c = S(v); o = vec4(c.rgb * max(f, 0.), c.a);` },
    vhs: { n: 'VHS', p: { amt: amt(.6) }, g: `
      float line = floor(v.y * uR.y * .5);
      vec2 uv = v;
      uv.x += sin(v.y * 90. + uT * 6.) * .0016 * u_amt + (h1(line + floor(uT * 24.)) - .5) * .004 * u_amt;
      float band = smoothstep(0., .02, abs(fract(v.y - uT * .12) - .5) - .47);
      uv.x += (1. - band) * .02 * u_amt;
      float sp = .006 * u_amt;
      vec4 g0 = S(uv);
      vec3 c = vec3(S(uv + vec2(sp, 0.)).r, g0.g, S(uv - vec2(sp, 0.)).b);
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(c, vec3(l), .25 * u_amt);
      c *= .92 + .08 * sin(v.y * uR.y * 1.5);
      c += (h2(v * uR + uT * 60.) - .5) * .12 * u_amt * g0.a;
      o = vec4(clamp(c, 0., g0.a), g0.a);` },
    grain: { n: 'Grano de película', p: { amt: amt(.4) }, g: `
      vec4 c = S(v); float n = h2(floor(v * uR) + fract(uT * 24.) * 91.) - .5;
      o = vec4(clamp(c.rgb + n * u_amt * .32 * c.a, 0., c.a), c.a);` },
    vignette: { n: 'Viñeta', p: { amt: amt(.6) }, g: `
      vec4 c = S(v); vec2 asp = vec2(uR.x / uR.y, 1.);
      float d = length((v - .5) * asp) / length(asp * .5);
      o = vec4(c.rgb * (1. - u_amt * smoothstep(.35, 1., d)), c.a);` },
    glow: { n: 'Resplandor', p: { amt: amt(.5), rad: { n: 'Tamaño', min: 0, max: 1, step: .01, def: .5, f: PCT } }, g: `
      vec4 c = S(v); vec3 acc = vec3(0.); float r = (2. + u_rad * 14.) / uR.y;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * .5236; vec2 d = vec2(cos(a), sin(a)) * r * vec2(uR.y / uR.x, 1.);
        acc += max(S(v + d).rgb - .55, 0.) + max(S(v + d * 2.).rgb - .55, 0.);
      }
      o = vec4(min(c.rgb + acc / 24. * u_amt * 3., vec3(max(c.a, .0001))), c.a);` },
    sharpen: { n: 'Enfocar', p: { amt: amt(.5) }, g: `
      vec2 px = 1. / uR; vec4 c = S(v);
      vec4 b = (S(v + vec2(px.x, 0.)) + S(v - vec2(px.x, 0.)) + S(v + vec2(0., px.y)) + S(v - vec2(0., px.y))) * .25;
      o = vec4(clamp(c.rgb + (c.rgb - b.rgb) * u_amt * 2.5, 0., c.a), c.a);` },
    pixel: { n: 'Pixelado', p: { size: { n: 'Tamaño de los cuadros', min: 2, max: 120, step: 1, def: 24, f: v => Math.round(v) + ' px' } }, g: `
      vec2 cell = max(1., u_size) / uR; o = S((floor(v / cell) + .5) * cell);` },
    mirror: { n: 'Espejo', p: { mode: { n: 'Tipo', t: 'sel', o: ['Izquierda a derecha', 'Arriba a abajo', 'Cuatro', 'Caleidoscopio'], def: 0 } }, g: `
      vec2 uv = v; int m = int(u_mode + .5);
      if (m == 0) uv.x = uv.x > .5 ? 1. - uv.x : uv.x;
      else if (m == 1) uv.y = uv.y < .5 ? 1. - uv.y : uv.y;
      else if (m == 2) uv = 1. - abs(1. - 2. * uv);
      else {
        vec2 asp = vec2(uR.x / uR.y, 1.); vec2 q = (v - .5) * asp;
        float a = atan(q.y, q.x), r = length(q), seg = 6.2832 / 6.;
        a = mod(a, seg); a = abs(a - seg * .5);
        uv = vec2(cos(a), sin(a)) * r / asp + .5;
      }
      o = S(uv);` },
    duotone: { n: 'Duotono', p: { c1: { n: 'Sombras', t: 'color', def: '#1F1147' }, c2: { n: 'Luces', t: 'color', def: '#F7C948' }, amt: amt(1) }, g: `
      vec4 c = S(v); vec3 u = unp(c); float l = dot(u, vec3(.299, .587, .114));
      o = vec4(mix(u, mix(u_c1, u_c2, l), u_amt) * c.a, c.a);` },
    key: { n: 'Pantalla verde', p: { color: { n: 'Color a quitar', t: 'color', def: '#00FF00' }, tol: { n: 'Tolerancia', min: 0, max: 1, step: .01, def: .3, f: PCT }, soft: { n: 'Suavizado', min: 0, max: 1, step: .01, def: .15, f: PCT }, spill: { n: 'Quitar reflejo verde', min: 0, max: 1, step: .01, def: .5, f: PCT } }, g: `
      vec4 c = S(v); vec3 u = unp(c);
      vec2 cb = vec2(dot(u, vec3(-.169, -.331, .5)), dot(u, vec3(.5, -.419, -.081)));
      vec2 kb = vec2(dot(u_color, vec3(-.169, -.331, .5)), dot(u_color, vec3(.5, -.419, -.081)));
      float m = smoothstep(u_tol * .5, u_tol * .5 + u_soft * .3 + .001, distance(cb, kb));
      vec3 s = u;
      if (u_color.g >= u_color.r && u_color.g >= u_color.b) s.g = mix(u.g, min(u.g, max(u.r, u.b)), u_spill);
      else if (u_color.b >= u_color.r) s.b = mix(u.b, min(u.b, max(u.r, u.g)), u_spill);
      float a = c.a * m; o = vec4(s * a, a);` }
  };

  /* ---------- transitions (A = outgoing, B = incoming) ---------- */
  const TRX = {
    dissolve: { n: 'Disolver', g: `o = mix(SA(v), SB(v), uP);` },
    dip: { n: 'Fundido a negro', g: `
      vec4 a = SA(v), b = SB(v);
      o = uP < .5 ? vec4(a.rgb * (1. - uP * 2.), a.a) : vec4(b.rgb * (uP * 2. - 1.), b.a);` },
    flash: { n: 'Destello', g: `
      vec4 c = mix(SA(v), SB(v), smoothstep(.35, .65, uP));
      float w = pow(1. - abs(uP - .5) * 2., 2.);
      o = vec4(mix(c.rgb, vec3(c.a), w), c.a);` },
    warp: { n: 'Zoom warp', g: `
      float s = sin(uP * 3.1416); vec2 q = v - .5; vec4 a = vec4(0.), b = vec4(0.);
      float za = 1. + uP * 1.6, zb = 1. + (1. - uP) * 1.6;
      for (int i = 0; i < 14; i++) { float f = 1. - float(i) * s * .02; a += SA(q * f / za + .5); b += SB(q * f / zb + .5); }
      o = mix(a / 14., b / 14., smoothstep(.42, .58, uP));` },
    rgbshake: { n: 'Sacudida RGB', g: `
      float s = sin(uP * 3.1416), t = uP * 40.;
      vec2 sh = (vec2(n1(t), n1(t + 17.)) - .5) * .12 * s;
      vec2 sp = vec2((n1(t + 5.) - .5) * .08 * s, 0.);
      vec2 uv = (v - .5) / (1. + s * .1) + .5 + sh;
      vec4 a = SA(uv), b = SB(uv);
      a = vec4(SA(uv + sp).r, a.g, SA(uv - sp).b, a.a);
      b = vec4(SB(uv + sp).r, b.g, SB(uv - sp).b, b.a);
      o = mix(a, b, smoothstep(.4, .6, uP));` },
    chroma: { n: 'Aberración', g: `
      vec2 d = (v - .5) * sin(uP * 3.1416) * .08;
      vec4 a = SA(v), b = SB(v);
      a = vec4(SA(v + d).r, a.g, SA(v - d).b, a.a);
      b = vec4(SB(v + d).r, b.g, SB(v - d).b, b.a);
      o = mix(a, b, smoothstep(.3, .7, uP));` },
    glitch: { n: 'Glitch', g: `
      float s = sin(uP * 3.1416), t = floor(uP * 30.);
      float row = floor(v.y * mix(8., 30., h1(t)));
      float off = (h1(row * 7.3 + t) - .5) * .3 * s * step(.5, h1(row + t * 3.));
      vec2 uv = vec2(fract(v.x + off), v.y); float sp = .03 * s;
      vec4 a = SA(uv), b = SB(uv);
      a = vec4(SA(uv + vec2(sp, 0.)).r, a.g, SA(uv - vec2(sp, 0.)).b, a.a);
      b = vec4(SB(uv + vec2(sp, 0.)).r, b.g, SB(uv - vec2(sp, 0.)).b, b.a);
      o = mix(a, b, step(.5, uP + (h1(row + t) - .5) * s * .6));` },
    zoom: { n: 'Zoom', g: `
      vec2 q = v - .5;
      o = mix(SA(q / (1. + uP * .8) + .5), SB(q / (.6 + .4 * uP) + .5), smoothstep(.2, .8, uP));` },
    push: { n: 'Empujar', g: `
      float e = uP * uP * (3. - 2. * uP);
      o = SA(v + vec2(e, 0.)) + SB(v - vec2(1. - e, 0.));` },
    up: { n: 'Subir', g: `
      float e = uP * uP * (3. - 2. * uP);
      o = SA(v - vec2(0., e)) + SB(v + vec2(0., 1. - e));` },
    whip: { n: 'Látigo', g: `
      float e = smoothstep(0., 1., uP), blur = sin(uP * 3.1416) * .15; vec4 acc = vec4(0.);
      for (int i = 0; i < 14; i++) { float k = (float(i) / 13. - .5) * blur; acc += SA(v + vec2(e + k, 0.)) + SB(v - vec2(1. - e - k, 0.)); }
      o = acc / 14.;` },
    wipe: { n: 'Barrido', g: `
      float e = uP * 1.1 - .05; o = mix(SA(v), SB(v), 1. - smoothstep(e - .04, e + .04, v.x));` },
    circle: { n: 'Círculo', g: `
      vec2 asp = vec2(uR.x / uR.y, 1.); float r = uP * length(asp) * .53;
      o = mix(SA(v), SB(v), 1. - smoothstep(r - .01, r + .01, length((v - .5) * asp)));` },
    pixel: { n: 'Pixelado', g: `
      vec2 cell = max(1., sin(uP * 3.1416) * 60.) / uR; vec2 uv = (floor(v / cell) + .5) * cell;
      o = mix(SA(uv), SB(uv), smoothstep(.4, .6, uP));` },
    blur: { n: 'Desenfoque', g: `
      float s = sin(uP * 3.1416) * .012; vec4 a = vec4(0.), b = vec4(0.);
      for (int i = 0; i < 12; i++) {
        float ang = float(i) * .5236; vec2 d = vec2(cos(ang), sin(ang)) * s * vec2(uR.y / uR.x, 1.);
        a += SA(v + d) + SA(v + d * 2.); b += SB(v + d) + SB(v + d * 2.);
      }
      o = mix(a / 24., b / 24., smoothstep(.3, .7, uP));` },
    leak: { n: 'Fuga de luz', g: `
      vec4 c = mix(SA(v), SB(v), smoothstep(.2, .8, uP));
      vec2 q = v - vec2(mix(-.2, 1.2, uP), .6);
      float l = exp(-dot(q, q) * 3.) * sin(uP * 3.1416);
      vec3 col = mix(vec3(1., .45, .1), vec3(1., .85, .4), n2(v * 3. + uP * 2.));
      o = vec4(min(c.rgb + col * l * 1.3 * c.a, vec3(c.a)), c.a);` },
    burn: { n: 'Quemado de película', g: `
      vec2 asp = vec2(uR.x / uR.y, 1.);
      float n = n2(v * asp * 4.) * .6 + n2(v * 20.) * .4, th = uP * 1.25 - .1;
      vec4 c = mix(SA(v), SB(v), 1. - smoothstep(th - .03, th, n));
      float edge = (1. - smoothstep(0., .08, abs(n - th))) * sin(uP * 3.1416);
      o = vec4(min(c.rgb + vec3(1., .5, .1) * edge * 1.6 * c.a, vec3(c.a)), c.a);` }
  };

  /* ---------- LUTs ---------- */
  // Built-in looks, generated as 33×33×33 LUTs so they behave exactly like imported .cube files.
  const luma = (r, g, b) => .299 * r + .587 * g + .114 * b;
  const sat = (r, g, b, k) => { const l = luma(r, g, b); return [l + (r - l) * k, l + (g - l) * k, l + (b - l) * k]; };
  const curve = (x, k) => x + (x * x * (3 - 2 * x) - x) * k;
  const LUT_LOOKS = [
    { id: 'b:teal', n: 'Teal & Orange', f: (r, g, b) => { const l = luma(r, g, b); let [R, G, B] = sat(r, g, b, 1.15); const s = Math.max(0, .55 - l), h = Math.max(0, l - .45); return [curve(R - s * .25 + h * .22, .3), curve(G + s * .05 + h * .06, .3), curve(B + s * .25 - h * .22, .3)]; } },
    { id: 'b:cine', n: 'Cine', f: (r, g, b) => { let [R, G, B] = sat(r, g, b, .85); return [curve(R * .97 + .03, .5), curve(G * .97 + .035, .5), curve(B * .95 + .05, .5)]; } },
    { id: 'b:calido', n: 'Cálido', f: (r, g, b) => [curve(r * 1.06 + .02, .15), g * 1.01 + .005, b * .88] },
    { id: 'b:dorado', n: 'Hora dorada', f: (r, g, b) => { let [R, G, B] = sat(r, g, b, 1.2); const l = luma(r, g, b); return [R * 1.08 + l * .06, G * 1.02 + l * .03, B * .82]; } },
    { id: 'b:frio', n: 'Frío', f: (r, g, b) => [r * .9, g * .99 + .01, b * 1.08 + .03] },
    { id: 'b:noche', n: 'Noche azul', f: (r, g, b) => { const [R, G, B] = sat(r, g, b, .7); return [R * .78, G * .86, B * .95 + .05]; } },
    { id: 'b:mate', n: 'Mate', f: (r, g, b) => { const [R, G, B] = sat(r, g, b, .9); return [.08 + R * .84, .08 + G * .84, .09 + B * .82]; } },
    { id: 'b:vintage', n: 'Vintage', f: (r, g, b) => { const sr = .393 * r + .769 * g + .189 * b, sg = .349 * r + .686 * g + .168 * b, sb = .272 * r + .534 * g + .131 * b; return [.06 + (r * .6 + sr * .4) * .88, .05 + (g * .6 + sg * .4) * .86, .07 + (b * .6 + sb * .4) * .8]; } },
    { id: 'b:vivo', n: 'Vivo', f: (r, g, b) => { const [R, G, B] = sat(r, g, b, 1.35); return [curve(R, .25), curve(G, .25), curve(B, .25)]; } },
    { id: 'b:bn', n: 'Blanco y negro cine', f: (r, g, b) => { const l = curve(luma(r, g, b), .7); return [l, l, l * .98]; } }
  ];
  function buildLut(look, N = 33) {
    const data = new Uint8Array(N * N * N * 4); let i = 0;
    for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
      const out = look.f(r / (N - 1), g / (N - 1), b / (N - 1));
      data[i++] = Math.round(Math.min(1, Math.max(0, out[0])) * 255);
      data[i++] = Math.round(Math.min(1, Math.max(0, out[1])) * 255);
      data[i++] = Math.round(Math.min(1, Math.max(0, out[2])) * 255);
      data[i++] = 255;
    }
    return { id: look.id, n: look.n, size: N, data, builtin: true };
  }
  // Parses an Adobe/Resolve .cube 3D LUT. Throws an Error with a message for the user.
  function parseCube(text, name) {
    let N = 0, min = [0, 0, 0], max = [1, 1, 1], title = '';
    const vals = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim(); if (!line || line[0] === '#') continue;
      const up = line.toUpperCase();
      if (up.startsWith('TITLE')) { title = line.replace(/^TITLE\s*/i, '').replace(/^"|"$/g, ''); continue; }
      if (up.startsWith('LUT_1D_SIZE')) throw new Error('Es un LUT 1D. Bezaleel usa LUTs 3D (.cube con LUT_3D_SIZE).');
      if (up.startsWith('LUT_3D_SIZE')) { N = parseInt(line.split(/\s+/)[1], 10); continue; }
      if (up.startsWith('DOMAIN_MIN')) { min = line.split(/\s+/).slice(1, 4).map(Number); continue; }
      if (up.startsWith('DOMAIN_MAX')) { max = line.split(/\s+/).slice(1, 4).map(Number); continue; }
      if (/^[A-Z_]/.test(up)) continue;
      const p = line.split(/\s+/); if (p.length >= 3) vals.push(+p[0], +p[1], +p[2]);
    }
    if (!(N >= 2 && N <= 129)) throw new Error('No se encontró el tamaño del LUT (LUT_3D_SIZE).');
    if (vals.length !== N * N * N * 3) throw new Error(`El archivo está incompleto: se esperaban ${N * N * N} colores y tiene ${vals.length / 3 | 0}.`);
    const data = new Uint8Array(N * N * N * 4);
    for (let i = 0, j = 0; i < vals.length; i += 3, j += 4) {
      for (let c = 0; c < 3; c++) { const x = (vals[i + c] - min[c]) / ((max[c] - min[c]) || 1); data[j + c] = Math.round(Math.min(1, Math.max(0, isFinite(x) ? x : 0)) * 255); }
      data[j + 3] = 255;
    }
    return { n: title || name || 'LUT', size: N, data };
  }

  /* ---------- WebGL 2 engine ---------- */
  const HELP = `
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.), f * f * (3. - 2. * f)); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + 1.), f.x), f.y); }
vec3 unp(vec4 c) { return c.a > 0. ? c.rgb / c.a : vec3(0.); }
bool outside(vec2 uv) { return uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.; }`;
  const HEAD = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 v; out vec4 o; uniform vec2 uR; uniform float uT;`;
  const fxSource = d => `${HEAD}
uniform sampler2D T;
${Object.entries(d.p).map(([k, p]) => `uniform ${p.t === 'color' ? 'vec3' : 'float'} u_${k};`).join('\n')}
${HELP}
vec4 S(vec2 uv) { return outside(uv) ? vec4(0.) : texture(T, uv); }
void main() {${d.g}
}`;
  const trSource = d => `${HEAD}
uniform sampler2D A; uniform sampler2D B; uniform float uP, uHA, uHB;
${HELP}
vec4 SA(vec2 uv) { return (uHA < .5 || outside(uv)) ? vec4(0.) : texture(A, uv); }
vec4 SB(vec2 uv) { return (uHB < .5 || outside(uv)) ? vec4(0.) : texture(B, uv); }
void main() {${d.g}
}`;
  const LUT_FS = `${HEAD}
uniform sampler2D T; uniform sampler3D L; uniform float uN, uMix;
${HELP}
void main() { vec4 c = texture(T, v); vec3 u = unp(c);
  vec3 l = texture(L, clamp(u, 0., 1.) * (uN - 1.) / uN + .5 / uN).rgb;
  o = vec4(mix(u, l, uMix) * c.a, c.a); }`;
  /* Primary color grade, in the order a colorist works: white balance and exposure, levels (blacks and whites),
     contrast around a pivot, shadows and highlights, lift / gamma / gain wheels, saturation and vibrance, then the
     curves (master, then red, green and blue, baked into one 256-wide lookup texture). Works on unpremultiplied color. */
  const GRADE_FS = `${HEAD}
uniform sampler2D T; uniform sampler2D C; uniform float uCurve;
uniform float uExp, uTemp, uTint, uCon, uPiv, uHi, uSh, uWh, uBl, uSat, uVib;
uniform vec3 uLift, uGamma, uGain;
${HELP}
float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
void main() { vec4 s = texture(T, v); vec3 c = unp(s);
  c *= vec3(1. + .16 * uTemp + .06 * uTint, 1. - .12 * uTint, 1. - .16 * uTemp + .06 * uTint);
  c *= exp2(uExp);
  float bp = -.1 * uBl, wp = 1. - .14 * uWh; c = (c - bp) / max(.05, wp - bp);
  c = (c - uPiv) * (1. + uCon) + uPiv;
  float L = luma(clamp(c, 0., 1.)), ws = 1. - smoothstep(0., .55, L), wh = smoothstep(.45, 1., L);
  float nL = max(0., L + .28 * uSh * ws + .28 * uHi * wh); c *= L > 1e-4 ? nL / L : 1.; c += (L > 1e-4 ? 0. : nL);
  c = c + uLift * (1. - clamp(c, 0., 1.));
  c = c * (1. + uGain);
  c = pow(max(c, 0.), 1. / max(vec3(.05), 1. + uGamma));
  float Y = luma(c), sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(Y), c, (1. + uSat) * (1. + uVib * (1. - clamp(sat, 0., 1.))));
  c = clamp(c, 0., 1.);
  if (uCurve > .5) { vec3 q = c * 255. / 256. + .5 / 256.; c = vec3(texture(C, vec2(q.r, .5)).r, texture(C, vec2(q.g, .5)).g, texture(C, vec2(q.b, .5)).b); }
  o = vec4(c * s.a, s.a); }`;
  const COPY_FS = `${HEAD}
uniform sampler2D T; void main() { o = texture(T, v); }`;
  const VS = `#version 300 es
in vec2 p; out vec2 v; void main() { v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  const hexRGB = h => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  function makeEngine() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
    let gl = null;
    try { gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true, antialias: false }); } catch (e) { gl = null; }
    const api = { ok: !!gl, canvas, errors: [] };
    if (!gl) return api;
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    const progs = new Map();
    function compile(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { api.errors.push(gl.getShaderInfoLog(s)); console.warn('Bezaleel shader:', gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    function program(key, src) {
      if (progs.has(key)) return progs.get(key);
      let pr = null; const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, src);
      if (vs && fs) {
        const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
        if (gl.getProgramParameter(p, gl.LINK_STATUS)) pr = { p, loc: {} }; else { api.errors.push(gl.getProgramInfoLog(p)); console.warn('Bezaleel link:', gl.getProgramInfoLog(p)); }
      }
      progs.set(key, pr); return pr;
    }
    const U = (pr, n) => (n in pr.loc ? pr.loc[n] : (pr.loc[n] = gl.getUniformLocation(pr.p, n)));
    function texParams(target) {
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (target === gl.TEXTURE_3D) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const blank = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blank); texParams(gl.TEXTURE_2D);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    let W = 0, H = 0, used = 0; const pool = [];
    function slot() {
      if (used >= pool.length) {
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); texParams(gl.TEXTURE_2D);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        pool.push({ tex, fb, w: W, h: H });
      }
      const s = pool[used++];
      if (s.w !== W || s.h !== H) { gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); s.w = W; s.h = H; }
      return s;
    }
    function run(pr, inputs, setU, toScreen) {
      const s = toScreen ? null : slot();
      gl.bindFramebuffer(gl.FRAMEBUFFER, s ? s.fb : null); gl.viewport(0, 0, W, H); gl.useProgram(pr.p);
      for (const x of inputs) { gl.activeTexture(gl.TEXTURE0 + x.unit); gl.bindTexture(x.d3 ? gl.TEXTURE_3D : gl.TEXTURE_2D, x.t); gl.uniform1i(U(pr, x.u), x.unit); }
      gl.uniform2f(U(pr, 'uR'), W, H);
      if (setU) setU(pr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return s ? s.tex : null;
    }
    api.begin = (w, h) => { if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; } used = 0; };
    api.upload = src => {
      const s = slot(); gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      s.w = src.width; s.h = src.height; return s.tex;
    };
    api.fx = (tex, e, t) => {
      const d = FX[e.k]; if (!d) return tex;
      const pr = program('fx:' + e.k, fxSource(d)); if (!pr) return tex;
      return run(pr, [{ u: 'T', t: tex, unit: 0 }], p => {
        gl.uniform1f(U(p, 'uT'), t);
        for (const [k, pd] of Object.entries(d.p)) {
          const val = e[k] != null ? e[k] : pd.def;
          if (pd.t === 'color') { const c = hexRGB(val); gl.uniform3f(U(p, 'u_' + k), c[0], c[1], c[2]); } else gl.uniform1f(U(p, 'u_' + k), +val);
        }
      });
    };
    const luts = new Map();
    api.lut = (tex, lut, mix) => {
      const pr = program('lut', LUT_FS); if (!pr || !lut) return tex;
      let lt = luts.get(lut);
      if (!lt) {
        lt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, lt); texParams(gl.TEXTURE_3D);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, lut.size, lut.size, lut.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut.data);
        luts.set(lut, lt);
      }
      return run(pr, [{ u: 'T', t: tex, unit: 0 }, { u: 'L', t: lt, unit: 2, d3: true }], p => { gl.uniform1f(U(p, 'uN'), lut.size); gl.uniform1f(U(p, 'uMix'), mix); });
    };
    // g: the clip's grade; curve: a 256 x 1 RGBA table (or null for straight curves), cached by its key
    const curves = new Map();
    api.grade = (tex, gr, curve) => {
      const pr = program('grade', GRADE_FS); if (!pr) return tex;
      let ct = blank;
      if (curve) {
        ct = curves.get(curve.key);
        if (!ct) {
          if (curves.size > 24) { for (const t of curves.values()) gl.deleteTexture(t); curves.clear(); }
          ct = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, ct); texParams(gl.TEXTURE_2D);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, curve.data); curves.set(curve.key, ct);
        }
      }
      const n = k => +gr[k] || 0, v3 = (a, y) => [0, 1, 2].map(i => ((a && +a[i]) || 0) + (+y || 0));
      return run(pr, [{ u: 'T', t: tex, unit: 0 }, { u: 'C', t: ct, unit: 3 }], p => {
        gl.uniform1f(U(p, 'uCurve'), curve ? 1 : 0);
        for (const [u, k] of [['uExp', 'exp'], ['uTemp', 'temp'], ['uTint', 'tint'], ['uCon', 'con'], ['uHi', 'hi'], ['uSh', 'sh'], ['uWh', 'wh'], ['uBl', 'bl'], ['uSat', 'sat'], ['uVib', 'vib']]) gl.uniform1f(U(p, u), n(k));
        gl.uniform1f(U(p, 'uPiv'), gr.piv != null ? +gr.piv : .435);
        const L = v3(gr.lift, gr.liftY).map(x => x * .25), G = v3(gr.gamma, gr.gammaY).map(x => x * .5), N = v3(gr.gain, gr.gainY).map(x => x * .5);
        gl.uniform3f(U(p, 'uLift'), L[0], L[1], L[2]); gl.uniform3f(U(p, 'uGamma'), G[0], G[1], G[2]); gl.uniform3f(U(p, 'uGain'), N[0], N[1], N[2]);
      });
    };
    api.mix = (a, b, k, p) => {
      const d = TRX[k]; const pr = d && program('tr:' + k, trSource(d)); if (!pr) return b || a;
      return run(pr, [{ u: 'A', t: a || blank, unit: 0 }, { u: 'B', t: b || blank, unit: 1 }], q => {
        gl.uniform1f(U(q, 'uP'), p); gl.uniform1f(U(q, 'uHA'), a ? 1 : 0); gl.uniform1f(U(q, 'uHB'), b ? 1 : 0);
      });
    };
    api.present = tex => { const pr = program('copy', COPY_FS); if (pr) run(pr, [{ u: 'T', t: tex, unit: 0 }], null, true); return canvas; };
    // Compiles every shader up front so a broken one shows up immediately, not mid-export.
    api.warm = () => {
      for (const k of Object.keys(FX)) program('fx:' + k, fxSource(FX[k]));
      for (const k of Object.keys(TRX)) program('tr:' + k, trSource(TRX[k]));
      program('lut', LUT_FS); program('copy', COPY_FS); program('grade', GRADE_FS);
      return api.errors.length === 0;
    };
    return api;
  }

  window.BezaleelFX = { FX, TRX, LUT_LOOKS, buildLut, parseCube, makeEngine };
})();
