// Creación de demos a partir de las plantillas de plantilla-demo/.
//
// Lo usan los scripts de Antigravity (por ejemplo `npm run demo:nueva`) y los
// tests de tests/unit/demo.test.js. No necesita internet: copia la plantilla,
// las fuentes y GSAP desde node_modules y cambia los marcadores ({{MARCA}}...)
// por los datos del negocio.
//
// Uso básico:
//   import { crearDemo, listarEstilos } from './lib/demo.mjs';
//   listarEstilos();                         // [{ id: 'clasico', ... }, ...]
//   await crearDemo({
//     slug: 'peluqueria-rocio',
//     estilo: 'clasico',
//     datos: { marca: 'Rocío', negocio: 'Peluquería Rocío', sector: 'peluquería',
//              eslogan: '', telefono: '+34600112233', direccion: 'Calle Real 3, 11201 Algeciras',
//              municipio: 'Algeciras', negocioId: null },
//   });

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  enlaceMaps,
  enlaceTelefono,
  enlaceWhatsApp,
  formatearTelefono,
  normalizarTelefono,
  slugify,
  tipoTelefono,
} from '../../crm/js/reglas.js';

export const PLANTILLA_VERSION = 1;
export const CARPETA_PLANTILLAS = 'plantilla-demo';
export const CARPETA_DEMOS = 'demos';
export const CARPETA_COMUN = '_comun';
export const TEXTO_WHATSAPP_POR_DEFECTO = 'Hola, he visto vuestra web y me gustaría pedir información.';

/** Marcadores que entienden las plantillas, entre dobles llaves. */
export const MARCADORES = [
  'MARCA',
  'NEGOCIO',
  'SECTOR',
  'ESLOGAN',
  'TELEFONO_VISIBLE',
  'TEL_URL',
  'WHATSAPP_URL',
  'DIRECCION',
  'MUNICIPIO',
  'MAPA_URL',
  'ANIO',
  'SLUG',
];

// Archivos de texto en los que se cambian los marcadores.
const EXTENSIONES_CON_MARCADORES = new Set(['.html', '.css', '.js', '.json', '.svg', '.webmanifest']);
// Archivos de la plantilla que no van a la demo.
const NO_COPIAR = new Set(['estilo.json', '.DS_Store', 'Thumbs.db', 'desktop.ini']);
// Carpeta de la demo que nunca se borra al rehacerla (dibujos originales de Valentina).
const CARPETA_ORIGINALES = 'originales';

const LIMITES = {
  marca: 60,
  negocio: 100,
  sector: 60,
  eslogan: 140,
  direccion: 160,
  municipio: 60,
  whatsappTexto: 300,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOMBRE_FUENTE = /^[a-z0-9-]+\.woff2$/;
const NOMBRE_GSAP = /^[A-Za-z0-9]+\.min\.js$/;
const PAQUETE_FUENTE = /^@fontsource\/[a-z0-9-]+$/;

// ---------------------------------------------------------------------------
// Marcadores
// ---------------------------------------------------------------------------

const ESCAPES_HTML = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  // Las llaves también se escapan para que un dato nunca pueda parecer un marcador.
  '{': '&#123;',
  '}': '&#125;',
};

/** Escapa un texto para meterlo en HTML o SVG (contenido o atributo). */
export function escaparHtml(valor) {
  return String(valor).replace(/[&<>"'{}]/g, (c) => ESCAPES_HTML[c]);
}

/** Escapa un texto para meterlo dentro de una cadena JSON ("..."). */
export function escaparJson(valor) {
  return JSON.stringify(String(valor))
    .slice(1, -1)
    .replace(/[<>&{}]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * Cambia cada {{MARCADOR}} por su valor ya escapado.
 * - Los valores vacíos, null o undefined se cambian por '' (nunca queda {{...}}).
 * - Los marcadores desconocidos también se cambian por ''.
 * - modo 'html' (por defecto) escapa & < > " ' ; modo 'json' escapa para JSON.
 */
export function reemplazarMarcadores(texto, valores = {}, { modo = 'html' } = {}) {
  const escapar = modo === 'json' ? escaparJson : escaparHtml;
  return String(texto ?? '').replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_todo, clave) => {
    const valor = Object.prototype.hasOwnProperty.call(valores, clave) ? valores[clave] : '';
    if (valor === undefined || valor === null) return '';
    return escapar(valor);
  });
}

// ---------------------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------------------

/** true si el slug sirve como nombre de carpeta: minúsculas, números y guiones (3 a 48). */
export function esSlugValido(slug) {
  return typeof slug === 'string' && slug.length >= 3 && slug.length <= 48 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** Devuelve el slug si es válido; si no, lanza un error que se entiende. */
export function validarSlug(slug) {
  if (esSlugValido(slug)) return slug;
  const visto = typeof slug === 'string' ? `"${slug}"` : String(slug);
  const sugerencia = typeof slug === 'string' && slug ? slugify(slug) : '';
  throw new Error(
    `El nombre de carpeta (slug) ${visto} no es válido. Usa solo letras minúsculas sin tildes, ` +
      'números y guiones, entre 3 y 48 caracteres, sin guion al principio ni al final ' +
      `(por ejemplo "peluqueria-rocio").${esSlugValido(sugerencia) ? ` Prueba con "${sugerencia}".` : ''}`,
  );
}

function limpiarTexto(valor, campo) {
  if (valor === undefined || valor === null) return '';
  const texto = String(valor)
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const max = LIMITES[campo];
  if (max && texto.length > max) {
    throw new Error(`El campo "${campo}" es demasiado largo (${texto.length} caracteres, máximo ${max}).`);
  }
  return texto;
}

const quitarTildes = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function fechaMadrid(fecha) {
  // 'en-CA' da el formato AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/**
 * Normaliza los datos del negocio y calcula los valores de todos los
 * marcadores. Exportada para poder probarla.
 */
export function prepararValores(datos = {}, { slug = '', fecha = new Date() } = {}) {
  const d = {};
  for (const campo of ['marca', 'negocio', 'sector', 'eslogan', 'direccion', 'municipio', 'whatsappTexto']) {
    d[campo] = limpiarTexto(datos[campo], campo);
  }
  if (!d.marca && !d.negocio) {
    throw new Error('Falta el nombre: indica al menos "marca" o "negocio".');
  }
  if (!d.marca) d.marca = d.negocio;
  if (!d.negocio) d.negocio = d.marca;
  if (d.marca.length > LIMITES.marca) {
    throw new Error(`La marca es demasiado larga (máximo ${LIMITES.marca} caracteres). Indica una marca más corta.`);
  }

  // Teléfono: se acepta en formato internacional (+34600112233) o en cualquier
  // formato que entienda normalizarTelefono (600 11 22 33...).
  const crudo = datos.telefono === undefined || datos.telefono === null ? '' : String(datos.telefono).trim();
  const telefono = crudo ? normalizarTelefono(crudo) : '';
  if (crudo && !telefono) {
    throw new Error(`El teléfono "${crudo}" no es válido. Escríbelo como +34600112233 o déjalo vacío.`);
  }

  const negocioId = datos.negocioId ?? null;
  if (negocioId !== null && negocioId !== '' && !UUID.test(String(negocioId))) {
    throw new Error(`El negocioId "${negocioId}" no es un identificador válido (uuid) ni null.`);
  }

  // Si no hay eslogan, uno neutro y verdadero: "Barbería en Algeciras".
  let eslogan = d.eslogan;
  if (!eslogan) {
    const sector = d.sector ? d.sector.charAt(0).toUpperCase() + d.sector.slice(1) : '';
    if (sector && d.municipio) eslogan = `${sector} en ${d.municipio}`;
    else if (sector) eslogan = sector;
    else if (d.municipio) eslogan = `En ${d.municipio}`;
    else eslogan = 'Te esperamos';
  }

  // Dirección para Google Maps sin repetir el municipio si ya va incluido.
  let lugar = d.direccion;
  if (d.municipio && !quitarTildes(lugar).includes(quitarTildes(d.municipio))) {
    lugar = [lugar, d.municipio].filter(Boolean).join(', ');
  }

  // WhatsApp solo para móviles (un fijo normalmente no tiene WhatsApp).
  const conWhatsApp = telefono && tipoTelefono(telefono) !== 'fijo';
  const textoWhatsApp = d.whatsappTexto || TEXTO_WHATSAPP_POR_DEFECTO;

  return {
    MARCA: d.marca,
    NEGOCIO: d.negocio,
    SECTOR: d.sector,
    ESLOGAN: eslogan,
    TELEFONO_VISIBLE: formatearTelefono(telefono),
    TEL_URL: enlaceTelefono(telefono),
    WHATSAPP_URL: conWhatsApp ? enlaceWhatsApp(telefono, textoWhatsApp) : '',
    DIRECCION: d.direccion,
    MUNICIPIO: d.municipio,
    MAPA_URL: lugar ? enlaceMaps(d.negocio, lugar) : '',
    ANIO: fechaMadrid(fecha).slice(0, 4),
    SLUG: slug,
    // Datos extra que no son marcadores pero se guardan en demo.json.
    _negocioId: negocioId || null,
    _creada: fechaMadrid(fecha),
  };
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

function rutaPlantillas(raiz) {
  return path.join(raiz, CARPETA_PLANTILLAS);
}

function leerEstiloJson(raiz, id) {
  const archivo = path.join(rutaPlantillas(raiz), id, 'estilo.json');
  let estilo;
  try {
    estilo = JSON.parse(readFileSync(archivo, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer ${path.relative(raiz, archivo)}: ${error.message}`);
  }
  if (estilo.id !== id) {
    throw new Error(`${path.relative(raiz, archivo)}: el "id" (${estilo.id}) tiene que ser igual que el nombre de la carpeta (${id}).`);
  }
  return estilo;
}

function idsDeEstilos(raiz) {
  const carpeta = rutaPlantillas(raiz);
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta, { withFileTypes: true })
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((id) => existsSync(path.join(carpeta, id, 'estilo.json')))
    .sort();
}

/** Lista los estilos disponibles: [{ id, nombre, descripcion, ideal_para }]. */
export function listarEstilos(raiz = process.cwd()) {
  return idsDeEstilos(raiz).map((id) => {
    const { nombre, descripcion, ideal_para: idealPara } = leerEstiloJson(raiz, id);
    return { id, nombre, descripcion, ideal_para: Array.isArray(idealPara) ? idealPara : [] };
  });
}

// ---------------------------------------------------------------------------
// Copia de archivos
// ---------------------------------------------------------------------------

async function copiarCarpeta(origen, destino, base = destino, copiados = []) {
  await fs.mkdir(destino, { recursive: true });
  const entradas = await fs.readdir(origen, { withFileTypes: true });
  for (const entrada of entradas) {
    if (NO_COPIAR.has(entrada.name) || entrada.name.startsWith('.') || entrada.name === CARPETA_ORIGINALES) continue;
    const de = path.join(origen, entrada.name);
    const a = path.join(destino, entrada.name);
    const info = await fs.stat(de); // stat sigue los enlaces simbólicos
    if (info.isDirectory()) {
      await copiarCarpeta(de, a, base, copiados);
    } else if (info.isFile()) {
      await fs.copyFile(de, a);
      copiados.push(path.relative(base, a));
    }
  }
  return copiados;
}

async function listarArchivos(carpeta, base = carpeta) {
  const salida = [];
  for (const entrada of await fs.readdir(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await listarArchivos(ruta, base)));
    else salida.push(path.relative(base, ruta).split(path.sep).join('/'));
  }
  return salida.sort();
}

function primeraLineaLicencia(texto) {
  return (
    texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? ''
  );
}

async function copiarVendor({ raiz, estilo, carpetaDemo }) {
  const modulos = path.join(raiz, 'node_modules');
  const vendor = path.join(carpetaDemo, 'vendor');
  const lineasFuentes = [];

  // Fuentes (solo los archivos .woff2 que pide estilo.json).
  await fs.mkdir(path.join(vendor, 'fonts'), { recursive: true });
  for (const { paquete, archivos } of estilo.fuentes ?? []) {
    if (!PAQUETE_FUENTE.test(paquete ?? '')) throw new Error(`estilo.json: paquete de fuente no válido: ${paquete}`);
    const carpetaPaquete = path.join(modulos, paquete);
    if (!existsSync(carpetaPaquete)) {
      throw new Error(`Falta la fuente ${paquete} en node_modules. Ejecuta "npm install" y vuelve a probar.`);
    }
    for (const archivo of archivos ?? []) {
      if (!NOMBRE_FUENTE.test(archivo)) throw new Error(`estilo.json: archivo de fuente no válido: ${archivo}`);
      const origen = path.join(carpetaPaquete, 'files', archivo);
      if (!existsSync(origen)) throw new Error(`No existe la fuente ${paquete}/files/${archivo}.`);
      await fs.copyFile(origen, path.join(vendor, 'fonts', archivo));
    }
    const familia = paquete.replace('@fontsource/', '');
    const licencia = path.join(carpetaPaquete, 'LICENSE');
    let copyright = '';
    if (existsSync(licencia)) {
      const texto = await fs.readFile(licencia, 'utf8');
      copyright = primeraLineaLicencia(texto);
      // La licencia OFL pide que el texto completo acompañe a la fuente.
      await fs.writeFile(path.join(vendor, 'fonts', `OFL-${familia}.txt`), texto);
    }
    lineasFuentes.push(`- ${familia} (${paquete}): ${copyright || 'ver licencia del paquete'}`);
  }

  // GSAP (solo los archivos que pide estilo.json).
  await fs.mkdir(path.join(vendor, 'gsap'), { recursive: true });
  const archivosGsap = estilo.gsap ?? [];
  for (const archivo of archivosGsap) {
    if (!NOMBRE_GSAP.test(archivo)) throw new Error(`estilo.json: archivo de GSAP no válido: ${archivo}`);
    const origen = path.join(modulos, 'gsap', 'dist', archivo);
    if (!existsSync(origen)) throw new Error(`No existe node_modules/gsap/dist/${archivo}. Ejecuta "npm install".`);
    await fs.copyFile(origen, path.join(vendor, 'gsap', archivo));
  }
  let versionGsap = '';
  try {
    versionGsap = JSON.parse(await fs.readFile(path.join(modulos, 'gsap', 'package.json'), 'utf8')).version;
  } catch {
    versionGsap = '';
  }

  const licencias = [
    'LICENCIAS DE TERCEROS INCLUIDAS EN ESTA DEMO',
    '===========================================',
    '',
    `GSAP ${versionGsap} (carpeta vendor/gsap/: ${archivosGsap.join(', ')})`,
    "  Copyright GreenSock (Webflow). Licencia estándar \"no charge\" de GSAP (GSAP Standard License):",
    '  https://gsap.com/standard-license',
    '  Uso gratuito, incluidos los plugins (ScrollTrigger, SplitText, DrawSVGPlugin...).',
    '  No se modifica el código: los archivos son los originales minificados.',
    '',
    'Fuentes tipográficas (carpeta vendor/fonts/): SIL Open Font License 1.1 (OFL)',
    '  https://openfontlicense.org',
    '  El texto completo de cada licencia está en vendor/fonts/OFL-<familia>.txt',
    ...lineasFuentes.map((l) => `  ${l}`),
    '',
    'Dibujos y decoraciones de img/: originales de Mavie IA Solutions.',
    '',
  ].join('\n');
  await fs.writeFile(path.join(vendor, 'LICENCIAS.txt'), licencias);
}

async function reemplazarEnCarpeta(carpeta, valores) {
  for (const relativo of await listarArchivos(carpeta)) {
    if (relativo.startsWith('vendor/') || relativo.startsWith(`${CARPETA_ORIGINALES}/`)) continue;
    const extension = path.extname(relativo).toLowerCase();
    if (!EXTENSIONES_CON_MARCADORES.has(extension)) continue;
    const archivo = path.join(carpeta, relativo);
    const original = await fs.readFile(archivo, 'utf8');
    const modo = extension === '.json' || extension === '.webmanifest' ? 'json' : 'html';
    const nuevo = reemplazarMarcadores(original, valores, { modo });
    if (/\{\{\s*[A-Z0-9_]+\s*\}\}/.test(nuevo)) {
      throw new Error(`Han quedado marcadores sin cambiar en ${relativo}.`);
    }
    if (nuevo !== original) await fs.writeFile(archivo, nuevo);
  }
}

// ---------------------------------------------------------------------------
// Crear demo
// ---------------------------------------------------------------------------

/**
 * Crea demos/<slug>/ con el estilo elegido y los datos del negocio.
 *
 * @param {object} opciones
 * @param {string} [opciones.slug] Nombre de la carpeta (si falta, sale del nombre del negocio).
 * @param {string} opciones.estilo 'clasico' | 'editorial' | 'vibrante' (ver listarEstilos()).
 * @param {object} opciones.datos { marca, negocio, sector, eslogan, telefono, direccion, municipio, negocioId, whatsappTexto }
 * @param {string} [opciones.raiz] Carpeta raíz del proyecto (por defecto, la actual).
 * @param {boolean} [opciones.sobrescribir] Rehacer la demo si ya existe (se conserva originales/).
 * @param {Date} [opciones.fecha] Fecha de creación (para tests).
 * @returns {Promise<{ carpeta: string, archivos: string[] }>} carpeta absoluta y archivos (rutas relativas).
 */
export async function crearDemo({ slug, estilo, datos = {}, raiz = process.cwd(), sobrescribir = false, fecha = new Date() } = {}) {
  raiz = path.resolve(raiz);
  const slugFinal = validarSlug(slug === undefined || slug === null || slug === '' ? slugify(datos.negocio || datos.marca || '') : slug);

  const disponibles = idsDeEstilos(raiz);
  if (!disponibles.length) throw new Error(`No hay estilos en ${CARPETA_PLANTILLAS}/. ¿Estás en la carpeta del proyecto?`);
  if (!disponibles.includes(estilo)) {
    throw new Error(`El estilo "${estilo}" no existe. Estilos disponibles: ${disponibles.join(', ')}.`);
  }
  const definicion = leerEstiloJson(raiz, estilo);
  const valores = prepararValores(datos, { slug: slugFinal, fecha });

  const carpetaDemos = path.join(raiz, CARPETA_DEMOS);
  const carpetaDemo = path.join(carpetaDemos, slugFinal);
  const yaExiste = existsSync(carpetaDemo);
  if (yaExiste && !sobrescribir) {
    throw new Error(
      `Ya existe la demo ${CARPETA_DEMOS}/${slugFinal}/. No se toca para no perder cambios. ` +
        'Si quieres rehacerla desde cero, usa sobrescribir: true (se conserva la carpeta originales/).',
    );
  }

  // Se monta en una carpeta temporal y al final se cambia de nombre: así nunca
  // queda una demo a medias si algo falla.
  await fs.mkdir(carpetaDemos, { recursive: true });
  const temporal = await fs.mkdtemp(path.join(carpetaDemos, `.${slugFinal}-nueva-`));
  try {
    await copiarCarpeta(path.join(rutaPlantillas(raiz), CARPETA_COMUN), temporal);
    await copiarCarpeta(path.join(rutaPlantillas(raiz), estilo), temporal);
    await copiarVendor({ raiz, estilo: definicion, carpetaDemo: temporal });
    await reemplazarEnCarpeta(temporal, valores);

    const ficha = {
      slug: slugFinal,
      estilo,
      negocio_id: valores._negocioId,
      marca: valores.MARCA,
      negocio: valores.NEGOCIO,
      sector: valores.SECTOR,
      municipio: valores.MUNICIPIO,
      creada: valores._creada,
      plantilla_version: PLANTILLA_VERSION,
    };
    await fs.writeFile(path.join(temporal, 'demo.json'), `${JSON.stringify(ficha, null, 2)}\n`);
  } catch (error) {
    await fs.rm(temporal, { recursive: true, force: true });
    throw error;
  }

  if (!yaExiste) {
    await fs.rename(temporal, carpetaDemo);
  } else {
    // Rehacer: la demo vieja se aparta, se pone la nueva y se recuperan los
    // originales de Valentina (dibujos de la tableta). Si algo falla, se
    // deja todo como estaba.
    const vieja = `${temporal}-vieja`;
    await fs.rename(carpetaDemo, vieja);
    try {
      await fs.rename(temporal, carpetaDemo);
    } catch (error) {
      await fs.rename(vieja, carpetaDemo);
      await fs.rm(temporal, { recursive: true, force: true });
      throw error;
    }
    const originales = path.join(vieja, CARPETA_ORIGINALES);
    if (existsSync(originales)) await fs.rename(originales, path.join(carpetaDemo, CARPETA_ORIGINALES));
    await fs.rm(vieja, { recursive: true, force: true });
  }

  const archivos = (await listarArchivos(carpetaDemo)).filter((a) => !a.startsWith(`${CARPETA_ORIGINALES}/`));
  return { carpeta: carpetaDemo, archivos };
}
