// Revisión de seguridad del repositorio. Se ejecuta:
//   - a mano:            npm run seguridad
//   - en cada Pull Request, en GitHub Actions (si falla, no se puede aceptar)
//
// Comprueba, entre otras cosas:
//   1. Que no hay PHP ni código de servidor (solo webs estáticas).
//   2. Que no se ha subido ninguna clave o contraseña.
//   3. Que las demos no cargan nada de fuera, no tienen scripts en línea,
//      llevan la política de seguridad (CSP) y "noindex", y pesan poco.
//   4. Que el CRM no usa innerHTML (la puerta de entrada típica de ataques XSS).
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = process.cwd();
const errores = [];
const avisos = [];
const error = (archivo, msg) => errores.push(`${archivo}: ${msg}`);
const aviso = (archivo, msg) => avisos.push(`${archivo}: ${msg}`);

// Se lee cada archivo una sola vez y sin comprobar antes si existe
// (comprobar y luego leer deja un hueco en el que el archivo puede cambiar).
function leerBuffer(ruta) {
  try {
    return readFileSync(ruta);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EISDIR' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}
const leerTexto = (ruta) => leerBuffer(ruta)?.toString('utf8') ?? null;

const IGNORAR = ['node_modules', '.git', 'crm/vendor', 'dist', 'test-results', 'playwright-report'];
const PROHIBIDAS = ['.php', '.phtml', '.phar', '.php3', '.php4', '.php5', '.php7', '.asp', '.aspx', '.jsp', '.cgi', '.pl'];
const TEXTO = ['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json', '.md', '.sql', '.yml', '.yaml', '.txt', '.svg', '.sh', '.toml', '.env', '.example', ''];

/** Lista de archivos: los que sigue git (si hay git) o todos menos los ignorados. */
function listarArchivos() {
  try {
    const salida = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' });
    return salida.split('\n').filter(Boolean);
  } catch {
    const lista = [];
    const recorrer = (dir) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, entrada.name);
        const rel = relative(RAIZ, ruta).split(sep).join('/');
        if (IGNORAR.some((i) => rel === i || rel.startsWith(`${i}/`))) continue;
        if (entrada.isDirectory()) recorrer(ruta);
        else lista.push(rel);
      }
    };
    recorrer(RAIZ);
    return lista;
  }
}

const archivos = listarArchivos().filter((f) => !IGNORAR.some((i) => f === i || f.startsWith(`${i}/`)));

// -----------------------------------------------------------------------------
// 1 y 2. Código de servidor y claves
// -----------------------------------------------------------------------------
const PATRONES_CLAVE = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'clave secreta de Supabase (sb_secret_)'],
  [/sk-(proj-)?[A-Za-z0-9_-]{20,}/, 'clave de OpenAI'],
  [/AIza[0-9A-Za-z_-]{35}/, 'clave de Google'],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, 'token de GitHub'],
  [/github_pat_[A-Za-z0-9_]{40,}/, 'token de GitHub'],
  [/xox[abprs]-[A-Za-z0-9-]{10,}/, 'token de Slack'],
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'clave privada'],
  [/(serper|x-api-key)[^\n]{0,30}['"=:]\s*['"]?[a-f0-9]{40}\b/i, 'clave de Serper'],
  [/AGENTE_PASSWORD\s*=\s*(?!pon-aqui)\S{6,}/, 'contraseña del agente'],
];

for (const f of archivos) {
  const ext = extname(f).toLowerCase();
  const nombre = f.split('/').pop();
  if (PROHIBIDAS.includes(ext)) error(f, 'archivo de servidor (PHP, ASP...). Aquí solo hay webs estáticas.');
  if (/^\.env(\..+)?$/.test(nombre) && nombre !== '.env.example') error(f, 'archivo de claves. Bórralo del repositorio: nunca se sube.');
  if (!TEXTO.includes(ext) || f.startsWith('tests/') || f === 'scripts/revisar-seguridad.mjs') continue;
  const contenido = leerTexto(f);
  if (contenido === null) continue; // borrado pero aún sin confirmar en git
  for (const [patron, descripcion] of PATRONES_CLAVE) {
    if (patron.test(contenido)) error(f, `parece contener una ${descripcion}. Quítala y cámbiala por una nueva (la vieja ya no es segura).`);
  }
  for (const jwt of contenido.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
    try {
      const datos = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
      if (datos.role === 'service_role') error(f, 'contiene la clave service_role de Supabase (secreta).');
    } catch {
      /* no es un JWT válido */
    }
  }
}

// -----------------------------------------------------------------------------
// 3. Demos
// -----------------------------------------------------------------------------
// Lectura de HTML parecida a la del navegador, carácter a carácter y sin
// expresiones regulares complicadas (que con textos raros pueden colgarse):
//  - Comentarios: terminan en "-->" o "--!>"; los cortos "<!-->" y "<!--->"
//    ya están cerrados; si no se cierran, llegan hasta el final.
//  - Etiquetas: se leen sus atributos respetando las comillas, así un ">"
//    dentro de title="a>b" no esconde un onclick que vaya detrás.
//  - Dentro de <script> y <style> no hay etiquetas ni comentarios: se salta
//    hasta su cierre, igual que hace el navegador.

const ESPACIO = new Set([' ', '\t', '\n', '\r', '\f']);
const esLetra = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

function finDeComentario(html, inicio) {
  if (html.startsWith('>', inicio + 4)) return inicio + 5;
  if (html.startsWith('->', inicio + 4)) return inicio + 6;
  const a = html.indexOf('-->', inicio + 4);
  const b = html.indexOf('--!>', inicio + 4);
  const fin = Math.min(a === -1 ? Infinity : a + 3, b === -1 ? Infinity : b + 4);
  return fin === Infinity ? html.length : fin;
}

function cierreDe(html, nombre, desde) {
  const bajo = html.toLowerCase();
  let i = desde;
  for (;;) {
    const pos = bajo.indexOf(`</${nombre}`, i);
    if (pos === -1) return html.length;
    const siguiente = html[pos + nombre.length + 2];
    if (siguiente === undefined || siguiente === '>' || siguiente === '/' || ESPACIO.has(siguiente)) return pos;
    i = pos + 1;
  }
}

/** Etiquetas de apertura (con atributos) y zonas de comentario del HTML. */
function analizarHtml(html) {
  const etiquetas = [];
  const rangos = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      const fin = finDeComentario(html, lt);
      rangos.push([lt, fin]);
      i = fin;
      continue;
    }
    const c = html[lt + 1];
    if (c === '!' || c === '?' || c === '/') {
      // <!DOCTYPE>, <?...>, etiquetas de cierre: hasta el siguiente ">"
      const fin = html.indexOf('>', lt + 1);
      i = fin === -1 ? n : fin + 1;
      continue;
    }
    if (c === undefined || !esLetra(c)) {
      i = lt + 1;
      continue;
    }
    let k = lt + 1;
    while (k < n && html[k] !== '/' && html[k] !== '>' && !ESPACIO.has(html[k])) k++;
    const nombre = html.slice(lt + 1, k).toLowerCase();
    const atributos = {};
    while (k < n) {
      while (k < n && (ESPACIO.has(html[k]) || html[k] === '/')) k++;
      if (k >= n || html[k] === '>') break;
      const a = k;
      k++; // el primer carácter siempre es parte del nombre (aunque sea "=")
      while (k < n && html[k] !== '/' && html[k] !== '>' && html[k] !== '=' && !ESPACIO.has(html[k])) k++;
      const nombreAtributo = html.slice(a, k).toLowerCase();
      let j = k;
      while (j < n && ESPACIO.has(html[j])) j++;
      let valor = '';
      if (html[j] === '=') {
        j++;
        while (j < n && ESPACIO.has(html[j])) j++;
        const comilla = html[j];
        if (comilla === '"' || comilla === "'") {
          const cierre = html.indexOf(comilla, j + 1);
          const finValor = cierre === -1 ? n : cierre;
          valor = html.slice(j + 1, finValor);
          k = finValor + 1;
        } else {
          const b = j;
          while (j < n && html[j] !== '>' && !ESPACIO.has(html[j])) j++;
          valor = html.slice(b, j);
          k = j;
        }
      }
      if (!(nombreAtributo in atributos)) atributos[nombreAtributo] = valor; // como el navegador: vale el primero
    }
    const fin = Math.min(k + 1, n);
    etiquetas.push({ nombre, atributos, fin });
    i = nombre === 'script' || nombre === 'style' ? cierreDe(html, nombre, fin) : fin;
  }
  return { etiquetas, rangos };
}

/** El HTML sin comentarios (para buscar textos visibles). */
function textoSinComentarios(html, rangos) {
  let salida = '';
  let desde = 0;
  for (const [a, b] of rangos) {
    salida += `${html.slice(desde, a)} `;
    desde = b;
  }
  return salida + html.slice(desde);
}

const esExterna = (url = '') => /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url.trim());

function revisarHtml(f, html, { esDemo }) {
  const { etiquetas, rangos } = analizarHtml(html);
  const texto = textoSinComentarios(html, rangos);
  const de = (nombre) => etiquetas.filter((e) => e.nombre === nombre);

  for (const { atributos, fin } of de('script')) {
    if ('src' in atributos) {
      if (esExterna(atributos.src)) error(f, `carga un script de fuera (${atributos.src}). Todo tiene que ser local.`);
      continue;
    }
    const cuerpo = html.slice(fin, cierreDe(html, 'script', fin));
    if (cuerpo.trim() && !/^application\/(ld\+)?json$/i.test(atributos.type ?? '')) {
      error(f, 'tiene un <script> escrito dentro del HTML. Ponlo en un archivo .js aparte.');
    }
  }
  for (const { nombre, atributos } of etiquetas) {
    const nombres = Object.keys(atributos);
    if (nombres.some((n) => n.startsWith('on'))) error(f, `<${nombre}> tiene eventos en el HTML (onclick=...). Van en el archivo .js.`);
    if ('style' in atributos) error(f, `<${nombre}> tiene estilos en línea (style="..."). Van en el archivo .css.`);
    if (['img', 'source', 'video', 'audio', 'track', 'embed', 'object'].includes(nombre)) {
      const urls = [atributos.src, atributos.data, ...(atributos.srcset ?? '').split(',').map((x) => x.trim().split(/\s+/)[0])];
      for (const url of urls.filter(Boolean)) if (esExterna(url)) error(f, `carga una imagen o vídeo de fuera (${url}).`);
    }
  }
  for (const { atributos } of de('link')) {
    if (esExterna(atributos.href)) error(f, `carga un archivo de fuera (${atributos.href}). Descárgalo y ponlo en la carpeta.`);
  }
  if (de('iframe').length || de('frame').length) error(f, 'tiene un <iframe>. Usa un enlace (por ejemplo, botón "Cómo llegar" a Google Maps).');
  for (const { atributos } of de('a')) {
    if ((atributos.target ?? '').toLowerCase() === '_blank' && !/\bnoopener\b/i.test(atributos.rel ?? '')) {
      error(f, 'un enlace con target="_blank" no lleva rel="noopener noreferrer".');
    }
  }
  if (/\{\{[A-Z_]+\}\}/.test(texto)) error(f, 'quedan marcadores {{...}} sin rellenar.');
  if (esDemo) {
    const metas = de('meta');
    if (!metas.some((m) => (m.atributos['http-equiv'] ?? '').toLowerCase() === 'content-security-policy')) {
      error(f, 'falta la política de seguridad <meta http-equiv="Content-Security-Policy">.');
    }
    if (!metas.some((m) => (m.atributos.name ?? '').toLowerCase() === 'robots' && /noindex/i.test(m.atributos.content ?? ''))) {
      error(f, 'falta <meta name="robots" content="noindex, nofollow"> (las demos no deben salir en Google).');
    }
    if (de('form').length) error(f, 'tiene un formulario. Las demos no recogen datos de nadie.');
    if (/\[PENDIENTE/i.test(texto)) error(f, 'quedan textos [PENDIENTE]. Rellénalos o quita esa parte antes de enviarla.');
    if (!de('html').some((h) => /^es\b/i.test(h.atributos.lang ?? ''))) aviso(f, 'falta lang="es" en <html>.');
  }
}

function revisarJs(f, js, { esCrm }) {
  if (/\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/.test(js)) error(f, 'usa eval / new Function / document.write (peligroso).');
  if (/\.(innerHTML|outerHTML)\s*[+]?=|insertAdjacentHTML\s*\(/.test(js)) {
    if (esCrm) error(f, 'usa innerHTML. En el CRM se usa textContent o la función el() de js/dom.js.');
    else aviso(f, 'usa innerHTML: asegúrate de que no mete textos que vengan de fuera.');
  }
}

let carpetasDemo = [];
try {
  carpetasDemo = readdirSync('demos', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
} catch {
  /* aún no hay carpeta demos */
}

for (const slug of carpetasDemo) {
  const base = `demos/${slug}`;
  if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug)) error(base, 'el nombre de la carpeta solo puede tener minúsculas, números y guiones.');
  if (leerBuffer(`${base}/index.html`) === null) error(base, 'falta index.html.');
  const json = leerTexto(`${base}/demo.json`);
  if (json === null) error(base, 'falta demo.json (lo crea npm run demo:nueva).');
  else {
    try {
      const meta = JSON.parse(json);
      if (meta.slug !== slug) error(`${base}/demo.json`, `el slug "${meta.slug}" no coincide con la carpeta.`);
    } catch {
      error(`${base}/demo.json`, 'no es un JSON válido.');
    }
  }
}

let pesoDemos = {};
for (const f of archivos.filter((x) => x.startsWith('demos/'))) {
  const ext = extname(f).toLowerCase();
  const slug = f.split('/')[1];
  const datos = leerBuffer(f);
  if (datos === null) continue;
  const peso = datos.length;
  pesoDemos[slug] = (pesoDemos[slug] ?? 0) + peso;
  if (['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'].includes(ext) && peso > 300 * 1024) {
    error(f, `la imagen pesa ${Math.round(peso / 1024)} KB (máximo 300). Pásala por: npm run imagenes -- demos/${slug}`);
  }
  if (['.mp4', '.mov', '.webm'].includes(ext) && peso > 4 * 1024 * 1024) error(f, 'el vídeo pesa más de 4 MB.');
  if (ext === '.html') revisarHtml(f, datos.toString('utf8'), { esDemo: true });
  if (['.js', '.mjs'].includes(ext) && !f.includes('/vendor/')) revisarJs(f, datos.toString('utf8'), { esCrm: false });
}
for (const [slug, peso] of Object.entries(pesoDemos)) {
  if (peso > 6 * 1024 * 1024) aviso(`demos/${slug}`, `pesa ${(peso / 1024 / 1024).toFixed(1)} MB en total. Las webs ligeras cargan mejor en el móvil.`);
}

// -----------------------------------------------------------------------------
// 4. CRM
// -----------------------------------------------------------------------------
for (const f of archivos.filter((x) => x.startsWith('crm/'))) {
  const ext = extname(f).toLowerCase();
  const contenido = ['.html', '.js'].includes(ext) ? leerTexto(f) : null;
  if (contenido === null) continue;
  if (ext === '.html') revisarHtml(f, contenido, { esDemo: false });
  if (ext === '.js') revisarJs(f, contenido, { esCrm: true });
}
for (const f of ['crm/_headers', 'demos/_headers']) {
  const cabeceras = leerTexto(f);
  if (cabeceras === null) error(f, 'falta el archivo de cabeceras de seguridad.');
  else if (!/Content-Security-Policy/.test(cabeceras)) error(f, 'no define Content-Security-Policy.');
}
const config = leerTexto('crm/config.js');
if (config !== null) {
  if (/sb_secret_|service_role/.test(config)) error('crm/config.js', 'tiene una clave secreta. En la web solo va la clave pública (publishable).');
}

// -----------------------------------------------------------------------------
// Resultado
// -----------------------------------------------------------------------------
console.log(`\nRevisión de seguridad: ${archivos.length} archivos, ${carpetasDemo.length} demos.\n`);
for (const a of avisos) console.log(`  ⚠ ${a}`);
for (const e of errores) console.log(`  ✖ ${e}`);
if (errores.length) {
  console.log(`\n✖ ${errores.length} problema(s) de seguridad. Arréglalos antes de publicar.\n`);
  process.exitCode = 1;
} else {
  console.log(`${avisos.length ? '\n' : ''}✔ Todo correcto.\n`);
}
