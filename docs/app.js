import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import ManifoldModule from "manifold-3d";

import { maquetar, lineasAUnicode } from "./braille.js";
import { DEFAULTS, layoutPlate, buildPlate } from "./plate.js";

// ---------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------

const el = (id) => document.getElementById(id);
const statusEl = el("status");
const generateBtn = el("generate-btn");
const downloadBtn = el("download-btn");
const statsEl = el("stats");
const textoEl = el("texto");
const previewEl = el("braille-preview");
const warnEl = el("warn");

const NUM_FIELDS = [
  "maxCells", "thickness", "margin", "cornerRadius", "holeDiameter",
  "dotDiameter", "dotHeight", "dotSpacing", "cellSpacing", "lineSpacing",
];

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function applyDefaultsToUI() {
  for (const k of NUM_FIELDS) el(k).value = DEFAULTS[k];
  el("holes").checked = DEFAULTS.holes;
  syncHoleField();
}

function syncHoleField() {
  el("holeDiameter").disabled = !el("holes").checked;
}

function readParams() {
  const p = { ...DEFAULTS };
  for (const k of NUM_FIELDS) {
    const v = Number(el(k).value);
    p[k] = Number.isFinite(v) ? v : DEFAULTS[k];
  }
  p.holes = el("holes").checked;
  // límites de seguridad para no generar mallas rotas
  p.dotDiameter = Math.max(0.5, p.dotDiameter);
  p.dotHeight = Math.max(0.2, Math.min(p.dotHeight, p.dotDiameter));
  p.thickness = Math.max(0.6, p.thickness);
  p.maxCells = Math.max(0, Math.floor(p.maxCells));
  return p;
}

function updateBraillePreview() {
  const p = readParams();
  const { lines, unknown } = maquetar(textoEl.value, { maxCells: p.maxCells });
  const unicode = lineasAUnicode(lines).replace(/⠀/g, "⠀");
  previewEl.textContent = unicode.trim() ? unicode : "—";
  warnEl.textContent = unknown.length
    ? `Sin equivalente braille (se omiten): ${unknown.join(" ")}`
    : "";
  return { p, lines };
}

// ---------------------------------------------------------------------
// Three.js
// ---------------------------------------------------------------------

const holder = el("canvas-holder");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1115);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
holder.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x30302a, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(40, 120, 90);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(-80, 40, -30);
scene.add(fill);

const material = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.55, metalness: 0.05 });

// El modelo está en XY (Z arriba); lo giramos para que Z quede arriba en pantalla.
const displayGroup = new THREE.Group();
displayGroup.rotation.x = -Math.PI / 2;
scene.add(displayGroup);

let currentMesh = null;

function resizeRenderer() {
  const w = holder.clientWidth, h = holder.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeRenderer);
resizeRenderer();

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();

function frameCamera(width, height, thickness) {
  // Centra la placa en el origen y encuadra todo el cartel (vista frontal, algo inclinada)
  displayGroup.position.set(-width / 2, 0, height / 2);
  controls.target.set(0, thickness / 2, 0);
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const dist = Math.max(height / 2 / Math.tan(vFov / 2), width / 2 / Math.tan(hFov / 2)) * 1.25 + 10;
  camera.position.set(0, dist * 0.82, dist * 0.57);
  camera.updateProjectionMatrix();
}

function showPreview(vertProperties, triVerts) {
  if (currentMesh) {
    displayGroup.remove(currentMesh);
    currentMesh.geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertProperties, 3));
  geometry.setIndex(new THREE.BufferAttribute(triVerts, 1));
  geometry.computeVertexNormals();
  currentMesh = new THREE.Mesh(geometry, material);
  displayGroup.add(currentMesh);
}

// ---------------------------------------------------------------------
// STL binario
// ---------------------------------------------------------------------

function buildBinarySTL(vertProperties, triVerts) {
  const triCount = triVerts.length / 3;
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triCount, true);

  const gv = (i) => [vertProperties[i * 3], vertProperties[i * 3 + 1], vertProperties[i * 3 + 2]];

  let offset = 84;
  for (let t = 0; t < triCount; t++) {
    const a = gv(triVerts[t * 3]), b = gv(triVerts[t * 3 + 1]), c = gv(triVerts[t * 3 + 2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    view.setFloat32(offset, nx, true); view.setFloat32(offset + 4, ny, true); view.setFloat32(offset + 8, nz, true);
    offset += 12;
    for (const pt of [a, b, c]) {
      view.setFloat32(offset, pt[0], true); view.setFloat32(offset + 4, pt[1], true); view.setFloat32(offset + 8, pt[2], true);
      offset += 12;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "model/stl" });
}

let lastSTLBlob = null;

downloadBtn.addEventListener("click", () => {
  if (!lastSTLBlob) return;
  const url = URL.createObjectURL(lastSTLBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cartel-braille.stl";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

// ---------------------------------------------------------------------
// Motor booleano (manifold-3d / WASM)
// ---------------------------------------------------------------------

let ManifoldCls = null;

async function initManifold() {
  const wasm = await ManifoldModule();
  wasm.setup();
  ManifoldCls = wasm.Manifold;
}

let generating = false;
let pending = false;

async function generate() {
  if (!ManifoldCls) return;
  if (generating) { pending = true; return; }
  generating = true;
  generateBtn.disabled = true;

  const { p, lines } = updateBraillePreview();
  let toDelete = [];

  try {
    const hasDots = lines.some((l) => l.some((c) => c.length > 0));
    if (!hasDots) {
      setStatus("Escribe algún texto para generar el cartel.");
      return;
    }
    setStatus("Construyendo la placa y los puntos…");
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

    const layout = layoutPlate(lines, p);
    const built = buildPlate(ManifoldCls, layout, p);
    toDelete = built.toDelete;

    const outMesh = built.solid.getMesh();
    const vertProperties = outMesh.vertProperties;
    const triVerts = outMesh.triVerts;

    showPreview(vertProperties, triVerts);
    frameCamera(layout.width, layout.height, p.thickness);
    lastSTLBlob = buildBinarySTL(vertProperties, triVerts);
    downloadBtn.disabled = false;

    statsEl.innerHTML =
      `${layout.width.toFixed(1)} × ${layout.height.toFixed(1)} × ${(p.thickness + p.dotHeight).toFixed(1)} mm<br>` +
      `${layout.dots.length} puntos · ${(triVerts.length / 3).toLocaleString("es-ES")} triángulos`;
    setStatus("Listo. Puedes rotar la vista y descargar el STL.");
  } catch (err) {
    console.error(err);
    setStatus("Error al generar: " + (err?.message || err), true);
  } finally {
    for (const m of toDelete) {
      try { m.delete(); } catch (_) { /* ya liberado */ }
    }
    generating = false;
    generateBtn.disabled = false;
    if (pending) { pending = false; generate(); }
  }
}

// ---------------------------------------------------------------------
// Eventos y arranque
// ---------------------------------------------------------------------

let debounce = null;
function scheduleGenerate() {
  updateBraillePreview();
  clearTimeout(debounce);
  debounce = setTimeout(generate, 450);
}

textoEl.addEventListener("input", scheduleGenerate);
for (const k of NUM_FIELDS) el(k).addEventListener("input", scheduleGenerate);
el("holes").addEventListener("change", () => { syncHoleField(); scheduleGenerate(); });
el("reset-btn").addEventListener("click", () => { applyDefaultsToUI(); scheduleGenerate(); });
generateBtn.addEventListener("click", generate);

applyDefaultsToUI();
updateBraillePreview();

(async () => {
  try {
    setStatus("Cargando el motor 3D (WASM)…");
    await initManifold();
    setStatus("Listo.");
    generateBtn.disabled = false;
    generate();
  } catch (err) {
    console.error(err);
    setStatus("No se pudo cargar el motor 3D: " + (err?.message || err), true);
  }
})();
