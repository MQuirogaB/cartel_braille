// Modo por lotes: de un texto grande a una lista de carteles y sus nombres de archivo.

export const SEPARADORES = {
  linea: "linea",   // cada línea = un cartel
  bloque: "bloque", // los carteles se separan con una línea en blanco (cada cartel puede tener varias líneas)
};

/**
 * Parte el texto del lote en carteles.
 * Devuelve [{ numero, texto }] (numero empieza en 1).
 */
export function parsearLote(texto, separador = SEPARADORES.linea) {
  const limpio = texto.replace(/\r\n?/g, "\n");
  let trozos;
  if (separador === SEPARADORES.bloque) {
    trozos = limpio.split(/\n[ \t]*\n+/);
  } else {
    trozos = limpio.split("\n");
  }
  return trozos
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t, i) => ({ numero: i + 1, texto: t }));
}

/** "¡Feliz cumpleaños, Ana!" -> "feliz-cumpleanos-ana" (para nombres de archivo). */
export function slug(texto, max = 40) {
  const s = texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s || "cartel";
}

/**
 * Nombres de archivo únicos y ordenados: "01-hola.stl", "02-adios.stl"…
 * El prefijo numérico evita duplicados y mantiene el orden del lote.
 */
export function nombresArchivo(items) {
  const ancho = String(items.length).length;
  return items.map((it) => `${String(it.numero).padStart(Math.max(2, ancho), "0")}-${slug(it.texto.split("\n")[0])}.stl`);
}
