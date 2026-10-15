// Geometría de la placa braille: medidas, posiciones de los puntos y
// construcción del sólido con manifold-3d.
//
// Sistema de coordenadas (mm): X a la derecha, Y hacia arriba, Z hacia arriba.
// La placa ocupa X 0..ancho, Y 0..alto, Z 0..grosor. Los puntos sobresalen
// por la cara superior (Z = grosor).

// Valores por defecto: braille "Marburg Medium", el estándar habitual para
// impresión 3D y rotulación (punto 1,5 mm, separación 2,5 mm, celda 6 mm,
// línea 10 mm).
export const DEFAULTS = {
  dotDiameter: 1.5,   // diámetro de la base del punto
  dotHeight: 0.6,     // altura del punto sobre la placa
  dotSpacing: 2.5,    // separación entre puntos de una misma celda
  cellSpacing: 6.0,   // distancia entre el inicio de una celda y la siguiente
  lineSpacing: 10.0,  // distancia entre líneas
  margin: 6.0,        // margen alrededor del texto
  thickness: 2.0,     // grosor de la placa
  cornerRadius: 2.0,  // radio de las esquinas (0 = esquinas vivas)
  holes: false,       // dos agujeros de fijación en los lados
  holeDiameter: 3.5,
  maxCells: 12,       // celdas máximas por línea (0 = sin límite)
};

const DOT_COL = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1 };
const DOT_ROW = { 1: 0, 2: 1, 3: 2, 4: 0, 5: 1, 6: 2 };

/**
 * Calcula el tamaño de la placa y la posición (x, y) de cada punto a partir
 * de las líneas de celdas.
 */
export function layoutPlate(lines, p) {
  const cols = Math.max(1, ...lines.map((l) => l.length));
  const rows = Math.max(1, lines.length);

  const blockW = (cols - 1) * p.cellSpacing + p.dotSpacing;
  const blockH = (rows - 1) * p.lineSpacing + 2 * p.dotSpacing;

  const holeSide = p.holes ? p.holeDiameter + 4 : 0; // espacio extra a cada lado
  const marginX = p.margin + holeSide;
  const width = blockW + 2 * marginX;
  let height = blockH + 2 * p.margin;
  if (p.holes) height = Math.max(height, p.holeDiameter + 6);

  // El bloque de texto se centra verticalmente si la placa creció por los agujeros
  const offsetY = (height - (blockH + 2 * p.margin)) / 2;

  const dots = [];
  lines.forEach((cells, r) => {
    cells.forEach((cell, c) => {
      for (const d of cell) {
        dots.push([
          marginX + c * p.cellSpacing + DOT_COL[d] * p.dotSpacing,
          height - p.margin - offsetY - r * p.lineSpacing - DOT_ROW[d] * p.dotSpacing,
        ]);
      }
    });
  });

  const holes = p.holes
    ? [2, width - 2].map((edge, i) => [i === 0 ? edge + p.holeDiameter / 2 : edge - p.holeDiameter / 2, height / 2])
    : [];

  return { width, height, dots, holes, cols, rows };
}

/**
 * Construye el sólido (Manifold) de la placa con sus puntos en relieve.
 * `M` es la clase Manifold de manifold-3d. Devuelve { solid, toDelete }.
 */
export function buildPlate(M, layout, p) {
  const toDelete = [];
  const track = (m) => { toDelete.push(m); return m; };

  // --- placa (rectángulo con esquinas redondeadas) ---
  const cr = Math.min(p.cornerRadius, layout.width / 2 - 0.01, layout.height / 2 - 0.01);
  let plate;
  if (cr > 0.05) {
    const seg = 32;
    const corners = [
      [cr, cr], [layout.width - cr, cr],
      [cr, layout.height - cr], [layout.width - cr, layout.height - cr],
    ].map(([x, y]) => track(M.cylinder(p.thickness, cr, cr, seg, false).translate([x, y, 0])));
    plate = track(M.hull(corners));
  } else {
    plate = track(M.cube([layout.width, layout.height, p.thickness], false));
  }

  // --- agujeros de fijación ---
  for (const [x, y] of layout.holes) {
    const hole = track(M.cylinder(p.thickness + 2, p.holeDiameter / 2, p.holeDiameter / 2, 40, false).translate([x, y, -1]));
    plate = track(plate.subtract(hole));
  }

  // --- punto: casquete esférico de base `dotDiameter` y altura `dotHeight` ---
  const r = p.dotDiameter / 2;
  const h = p.dotHeight;
  const R = (r * r + h * h) / (2 * h);
  const sphere = track(M.sphere(R, 28));
  const sink = 0.3; // el punto se hunde un poco en la placa para unirse bien
  const dome = track(sphere
    .translate([0, 0, p.thickness + h - R])
    .intersect(track(M.cube([2 * R + 1, 2 * R + 1, h + sink], true).translate([0, 0, p.thickness - sink + (h + sink) / 2]))));

  const parts = [plate];
  for (const [x, y] of layout.dots) parts.push(track(dome.translate([x, y, 0])));

  const solid = track(M.union(parts));
  return { solid, toDelete };
}
