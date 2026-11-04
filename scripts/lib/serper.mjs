// Serper.dev: una API que devuelve los resultados de Google (y de Google Maps).
// Cada búsqueda gasta 1 crédito. Al registrarte te dan 2.500 gratis.
// Documentación: https://serper.dev  (pestaña "Playground" para probar sin código)

// Solo para las pruebas automáticas se puede apuntar a un servidor local falso.
const PRUEBAS = process.env.SERPER_URL_PRUEBAS ?? '';
const BASE = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(PRUEBAS) ? PRUEBAS : 'https://google.serper.dev';

async function llamar(ruta, cuerpo, clave) {
  const respuesta = await fetch(`${BASE}/${ruta}`, {
    method: 'POST',
    headers: { 'X-API-KEY': clave, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new Error('Serper rechaza la clave (SERPER_API_KEY). Cópiala otra vez desde serper.dev → API Key.');
  }
  if (respuesta.status === 429) throw new Error('Serper dice que no quedan créditos o que vas muy rápido. Mira tu saldo en serper.dev.');
  if (!respuesta.ok) throw new Error(`Serper ha respondido con un error ${respuesta.status}.`);
  return respuesta.json();
}

/** Busca negocios en Google Maps. Gasta 1 crédito por página (unos 10-20 resultados). */
export async function buscarEnMaps({ consulta, municipio, pagina = 1, clave }) {
  const datos = await llamar('places', { q: `${consulta} en ${municipio}`, gl: 'es', hl: 'es', page: pagina }, clave);
  return { sitios: datos.places ?? [], creditos: 1 };
}

const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'en', 'del', 'centro', 'bar', 'taller', 'peluqueria', 'barberia', 'tienda']);

/**
 * Busca en Google si el negocio tiene una web propia que no sale en Maps.
 * Gasta 1 crédito. Devuelve la URL encontrada o ''.
 */
export async function buscarWebPropia({ nombre, municipio, clave, clasificarWeb }) {
  const datos = await llamar('search', { q: `"${nombre}" ${municipio}`, gl: 'es', hl: 'es', num: 10 }, clave);
  const fichas = (nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
    .filter((p) => !PALABRAS_VACIAS.has(p));
  for (const r of datos.organic ?? []) {
    if (clasificarWeb(r.link) !== 'propia') continue;
    const host = new URL(r.link).hostname.replace(/^www\./, '');
    if (fichas.some((f) => host.includes(f))) return { url: r.link, creditos: 1 };
  }
  return { url: '', creditos: 1 };
}
