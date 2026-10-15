import assert from "node:assert/strict";
import Module from "manifold-3d";
import { palabraACeldas, maquetar, lineasAUnicode } from "../docs/braille.js";
import { DEFAULTS, layoutPlate, buildPlate } from "../docs/plate.js";

const uni = (w) => palabraACeldas(w).cells.map((c) => String.fromCodePoint(0x2800 + c.reduce((b, d) => b | 1 << (d - 1), 0))).join("");

// --- braille ---
assert.equal(uni("hola"), "⠓⠕⠇⠁");
assert.equal(uni("Hola"), "⠠⠓⠕⠇⠁");           // mayúscula inicial
assert.equal(uni("ONCE"), "⠠⠠⠕⠝⠉⠑");          // palabra en mayúsculas
assert.equal(uni("2026"), "⠼⠃⠚⠃⠋");           // número
assert.equal(uni("1.250,5"), "⠼⠁⠄⠃⠑⠚⠂⠑");    // miles y decimales dentro del número
assert.equal(uni("año"), "⠁⠻⠕");              // ñ
assert.equal(uni("¿Qué?"), "⠢⠠⠟⠥⠮⠢");          // ¿ ? y é
assert.equal(uni("pingüino"), "⠏⠊⠝⠛⠳⠊⠝⠕");    // ü
assert.deepEqual(palabraACeldas("a€b").unknown, ["€"]);

// --- maquetación ---
let m = maquetar("Hola mundo\nSegunda", { maxCells: 0 });
assert.equal(m.lines.length, 2);
assert.equal(m.lines[0].length, 4 + 1 + 6);
m = maquetar("uno dos tres cuatro", { maxCells: 8 });
assert.ok(m.lines.every((l) => l.length <= 8), "ninguna línea pasa de maxCells");
m = maquetar("supercalifragilistico", { maxCells: 6 });
assert.ok(m.lines.every((l) => l.length <= 6) && m.lines.length >= 4);
console.log("braille OK");
console.log(lineasAUnicode(maquetar("Hola, mundo 2026", { maxCells: 12 }).lines));

// --- geometría con manifold ---
const wasm = await Module(); wasm.setup();
for (const variante of [{}, { holes: true }, { cornerRadius: 0 }]) {
  const p = { ...DEFAULTS, ...variante };
  const { lines } = maquetar("Hola, mundo 2026", { maxCells: p.maxCells });
  const lay = layoutPlate(lines, p);
  const { solid, toDelete } = buildPlate(wasm.Manifold, lay, p);
  const vol = solid.volume();
  const genus = solid.genus();
  const mesh = solid.getMesh();
  const bb = solid.boundingBox();
  const plateVol = lay.width * lay.height * p.thickness;
  console.log(JSON.stringify(variante), "→ placa", lay.width.toFixed(1), "x", lay.height.toFixed(1),
    "mm | puntos", lay.dots.length, "| tris", mesh.triVerts.length / 3,
    "| genus", genus, "| zmax", bb.max[2].toFixed(2), "| vol extra", (vol - plateVol * (variante.cornerRadius === 0 ? 1 : 1)).toFixed(1));
  assert.ok(!solid.isEmpty());
  assert.ok(Math.abs(bb.max[2] - (p.thickness + p.dotHeight)) < 0.01, "altura total = grosor + punto");
  assert.equal(genus, p.holes ? 2 : 0, "sin asas inesperadas");
  assert.ok(Math.abs(bb.max[0] - lay.width) < 0.01 && Math.abs(bb.max[1] - lay.height) < 0.01);
  toDelete.forEach((t) => { try { t.delete(); } catch {} });
}
console.log("geometría OK");
