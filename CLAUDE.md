# Bezaleel · Ficha de contexto

*Actualizada el 10 de octubre de 2026 (versión publicada: v1.0.16).*

## 1. Qué es y para quién
Editor de video gratis y de código abierto (GPL-3.0) para iglesias y equipos de alabanza, pensado primero para Reels y listo para videos largos.
Lo usa el equipo de medios de Ricardo Vega (familia Philly, Taber Olocuilta, Arca, Arpa) y cualquier iglesia que lo instale.

## 2. Dónde vive
- **App web instalable:** https://ricardiaz97-hub.github.io/Bezaleel/ (GitHub Pages)
- **Repositorio:** https://github.com/ricardiaz97-hub/Bezaleel (rama `main`, cuenta de GitHub `ricardiaz97-hub`)
- **Programa para Windows:** https://github.com/ricardiaz97-hub/Bezaleel/releases/latest (`Bezaleel-Setup-<versión>.exe`)
- **No usa** Vercel, Google Drive, base de datos ni servidores propios: todo corre en la computadora del usuario.

## 3. Cómo está hecho
- HTML, CSS y JavaScript sin frameworks ni paso de compilación. WebGL 2 para efectos, Canvas 2D, Web Audio. Exporta cuadro por cuadro con WebCodecs y Mediabunny (MP4 H.264; WEBM si no hay codificador H.264) o en tiempo real con MediaRecorder.
- Proyectos en IndexedDB (`bezaleel`, versión 2); preferencias en `localStorage` (`bezaleel.*`).
- `app/index.html` (el editor y la página de inicio) · `app/engine.js` (efectos `FX`, transiciones `TRX`, LUTs, corrección de color `GRADE_FS`) · `app/rhythm.js` (detección de ritmo) · `app/sections.js` (partes de la canción: lee `.arp` de Arpa o las detecta escuchando; niveles suave/medio/fuerte) · `app/autoedit.js` (Edit automático: canción + videos → clips normales) · `app/export.js` (exportación cuadro por cuadro) · `app/vendor/mediabunny/` (MPL-2.0) · `app/person.js` (MediaPipe) · `app/sw.js` (modo sin internet) · `electron/main.js` (programa de Windows y actualizaciones) · `docs/STANDARDS.md` (misión, promesas y plan).
- **Publicación:** cada push a `main` dispara `.github/workflows/pages.yml` (app web) y `desktop.yml` (instalador `1.0.<número de build>` en Releases). Las copias instaladas se actualizan solas, así que **`main` es producción**.
- **Regla:** al cambiar un archivo de `app/`, sube `VERSION` en `app/sw.js` y agrega archivos nuevos a `SHELL`.

## 4. Decisiones ya tomadas (no rediscutir)
- **Las 7 promesas** de `docs/STANDARDS.md`: todo gratis, sin cuentas ni servidores, los videos no salen de la computadora, funciona sin internet, un voluntario lo aprende en 10 minutos, nada llega a `main` sin probar con video real, los proyectos viejos siempre abren.
- **Diseño "vidrio líquido" cálido:** fondo carbón `#0D0C0B`, un solo acento naranja `#FF6B1A`, texto crema `#F5F0E8`, grano solo en el fondo (nunca sobre el video), `backdrop-filter` solo donde pasa contenido debajo. Letra Geist. Logo B de Bezaleel. El estilo neón se descartó.
- Interfaz en español sencillo; textos sin rótulos encima del título ni guiones largos.
- En teléfono (≤ 900 px): estilo CapCut, cabezal centrado, la vista previa nunca queda tapada.
- Hardware de referencia: computadora de 2020 en adelante, 16 GB, gráficos integrados, Chrome o Edge.
- Los logos de los ministerios no están bajo la GPL.

## 5. Qué ya funciona
Línea de tiempo multipista (2 de video, 2 de texto, música y voz), cortes, velocidad 0,25×–4×, deshacer; títulos para letras, citas y créditos; 16 efectos y 17 transiciones; LUTs (10 incluidos y `.cube`); zoom gradual; ritmo automático o a mano, efectos al ritmo y "Cortar al ritmo"; **Edit automático** (botón arriba: canción + videos → edit al ritmo, con subida e impacto en el coro, todo editable) con partes de Arpa (`.arp`) o detectadas; partes de la canción en la pista Música; exportación cuadro por cuadro; paneo lento; ecualizador, reducción de ruido (RNNoise), mejora de voz y bajar música al hablar; texto detrás de la persona y fondo borroso o reemplazado; corrección de color profesional (ruedas, curvas, osciloscopios, HSL con cuentagotas); formatos 16:9, 9:16, 1:1 y 4:5; editor para teléfono; programa de Windows con actualización automática.

## 6. Pendiente, en orden de prioridad
0. Probar el Edit automático y la exportación cuadro por cuadro en la PC de Ricardo (Chrome/Edge y el programa de Windows) con videos reales, medir la velocidad y fusionar la rama `claude/edit-automatico`.
1. Probar con archivos reales y fusionar el **PR #17** (importar LUTs: `.zip`, DaVinci, 1D, teléfonos), rama `claude/claimcredit-wvni6i`.
2. Confirmar en un iPhone real que la importación de video funciona (el arreglo del PR #10 no se pudo probar en Safari).
3. Interfaz en español e inglés, intercambiable (fase 1).
4. Kit de Reels (fase 3): plantillas verticales, subtítulos animados palabra por palabra, subtítulos automáticos en la computadora, intros y cierres.
5. Video largo (fase 4): exportar más rápido que en tiempo real, proxies para 4K, LUTs de cámara log.
6. Equipo (fase 5): proyectos que se mueven entre computadoras sin servidor y biblioteca compartida de logos, letras y LUTs.
7. Limpieza: borrar el archivo suelto `help` de la raíz; firmar el instalador si algún día hay certificado.

## 7. Problemas conocidos y cómo se resolvieron
- **Windows no tomaba las actualizaciones** (revisaba cada 4 h y descargaba en silencio) → ahora revisa al abrir, cada 30 min y al volver a la ventana, y muestra el progreso (PR #11).
- **iPhone no importaba videos** → video de prueba `muted` + `playsinline`, plan B a los 4 s y mensaje con la causa (PR #10).
- **Editar en teléfono era incómodo** → diseño tipo CapCut (PR #14).
- **Los `.cube` no se importaban** → arreglado en el PR #17, aún sin fusionar.
- **Cambio de nombre Arca Estudio → Bezaleel** cambió el `appId`: una copia vieja 1.0.2 debe desinstalarse e instalar Bezaleel.
- **Windows avisa "protegió su PC"** porque el instalador no está firmado: "Más información → Ejecutar de todas formas".
- **La exportación en tiempo real** graba la pantalla: hay que dejar la pestaña abierta y visible, y si la computadora se atrasa se pierden cuadros. Por eso existe la exportación **cuadro por cuadro** (opción por defecto cuando el navegador tiene WebCodecs).
- **Buscar cuadro por cuadro con el `<video>` es lentísimo** cuando el video tiene pocos fotogramas clave (los fondos de Leonardo tienen uno solo en 10 s): cada búsqueda decodifica desde el principio. La exportación exacta decodifica en orden con Mediabunny; solo usa el `<video>` si Mediabunny no puede leer el archivo.
- **Arpa exporta canciones como paquete:** el `.arp` exportado es un ZIP (sin comprimir) con `song.arp` y `stems/*.wav`. Bezaleel lo abre sin cargarlo entero (`openArpa` en `sections.js`), mezcla las pistas que no son click ni guía con los niveles de Arpa (`mixStems`) y las importa como la canción. Antes decía "no es una canción de Arpa" porque solo leía el `.arp` suelto.
- **Arpa:** cada canción guarda `songs/<canción>/<canción>.arp` (JSON `arpa-song`): `markers` [{t, name, int}] y `grid` {bpm, sig, beats, bar1}. La fuerza de cada parte es `int` o sale del nombre con las mismas reglas que `SECTION_TYPES` de `stageline_engine.py`.
- GitHub Pages necesita **Settings → Pages → Source: GitHub Actions** (ya está hecho).
