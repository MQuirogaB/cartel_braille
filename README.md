# Cartel braille

Generador online de **carteles con braille en relieve**, listos para imprimir en 3D.
Escribes un texto, ves la placa en 3D y descargas el `.stl`. Todo ocurre en el
navegador: no se sube nada a ningún servidor.

- Braille **español, grado 1** (letra a letra): mayúsculas (`⠠`, y `⠠⠠` para
  palabras enteras en mayúsculas), números (signo `⠼`), `ñ`, vocales acentuadas,
  `ü` y puntuación habitual.
- Medidas por defecto **Marburg Medium**: punto de 1,5 mm, 2,5 mm entre puntos,
  6 mm entre celdas y 10 mm entre líneas. Todas se pueden ajustar.
- Placa con esquinas redondeadas opcionales y **dos agujeros de fijación**
  opcionales.
- Ajuste automático de línea (celdas máximas por línea) y saltos de línea propios.

## Uso

Abre `docs/index.html` servido por HTTP (por ejemplo `npx serve docs`) o publica
la carpeta `docs/` con GitHub Pages (*Settings → Pages → Branch: main, /docs*).

## Tests

```bash
npm install
npm test
```

Comprueba la tabla braille, el ajuste de línea y que la malla generada es válida
(sin asas inesperadas y con la altura esperada).

## Limitaciones

- Solo grado 1: no hay abreviaturas (grado 2).
- Tras un número, una letra de la `a` a la `j` no lleva signo de letra intermedio.
- Los caracteres sin equivalente (por ejemplo `€`) se omiten y se avisa en la página.

## Estructura

- `docs/braille.js`: texto → celdas braille y maquetación.
- `docs/plate.js`: medidas, posición de los puntos y construcción del sólido.
- `docs/app.js`: interfaz, vista previa 3D y exportación STL.
