# Arca Estudio

Editor de video para el equipo de medios: cortes, títulos, transiciones, filtros, audio y exportación a MP4.

Hay dos formas de usarlo. Las dos usan el mismo editor, que está en la carpeta `app/`.

## App web instalable

Se publica gratis con GitHub Pages y se instala desde Chrome o Edge.

1. **Activa GitHub Pages una sola vez.** En GitHub, abre este proyecto y entra a **Settings → Pages**. En **Source**, elige **GitHub Actions**.
2. **Publica.** Cada cambio que llega a la rama `main` dentro de `app/` publica la app sola (pestaña **Actions → Publicar app web**).
3. **Abre la dirección** `https://ricardiaz97-hub.github.io/Ricardo-Vega/` en Chrome o Edge y toca **Instalar app**, en la página de inicio o en el ícono de la barra de direcciones.

Una vez instalada, abre en su propia ventana, funciona sin internet y se actualiza sola.

## Programa para Windows (.exe)

Cada cambio que llega a `main` arma el instalador en GitHub (pestaña **Actions → Programa para Windows**) y lo publica en **Releases**:

`https://github.com/ricardiaz97-hub/Ricardo-Vega/releases/latest`

Descarga `ArcaEstudio-Setup-<versión>.exe` y ábrelo. Windows mostrará "Windows protegió su PC" porque el programa no tiene firma digital: toca **Más información → Ejecutar de todas formas**.

Para sacar una versión nueva del instalador, sube el número de `version` en `package.json`.

## Probarlo en tu computadora

```
npm install
npm start
```

## Dónde quedan los datos

Los videos y el proyecto se guardan en el navegador, o en el programa, de esa computadora. No se suben a ningún servidor.
