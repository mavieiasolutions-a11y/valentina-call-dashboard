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
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = process.cwd();
const errores = [];
const avisos = [];
const error = (archivo, msg) => errores.push(`${archivo}: ${msg}`);
const aviso = (archivo, msg) => avisos.push(`${archivo}: ${msg}`);

const IGNORAR = ['node_modules', '.git', 'crm/vendor', 'dist', 'test-results', 'playwright-report'];
const PROHIBIDAS = ['.php', '.phtml', '.phar', '.php3', '.php4', '.php5', '.php7', '.asp', '.aspx', '.jsp', '.cgi', '.pl'];
const TEXTO = ['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json', '.md', '.sql', '.yml', '.yaml', '.txt', '.svg', '.sh', '.toml', '.env', '.example', ''];

/** Lista de archivos: los que sigue git (si hay git) o todos menos los ignorados. */
function listarArchivos() {
  try {
    const salida = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' });
    return salida.split('\n').filter(Boolean).filter((f) => existsSync(f));
  } catch {
    const lista = [];
    const recorrer = (dir) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        const rel = relative(RAIZ, ruta).split(sep).join('/');
        if (IGNORAR.some((i) => rel === i || rel.startsWith(`${i}/`))) continue;
        if (statSync(ruta).isDirectory()) recorrer(ruta);
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
  const contenido = readFileSync(f, 'utf8');
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
const CSP_DEMO = /<meta\s+http-equiv=["']Content-Security-Policy["']/i;

function revisarHtml(f, htmlOriginal, { esDemo }) {
  // Los comentarios <!-- ... --> no se ejecutan: se quitan antes de revisar.
  const html = htmlOriginal.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, atributos, cuerpo] = m;
    if (!/\bsrc=/.test(atributos) && cuerpo.trim() && !/type=["']application\/(ld\+)?json["']/.test(atributos)) {
      error(f, 'tiene un <script> escrito dentro del HTML. Ponlo en un archivo .js aparte.');
    }
    const src = /src=["']([^"']+)["']/.exec(atributos)?.[1] ?? '';
    if (/^(https?:)?\/\//i.test(src)) error(f, `carga un script de fuera (${src}). Todo tiene que ser local.`);
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) error(f, 'tiene eventos en el HTML (onclick=...). Van en el archivo .js.');
  if (/\sstyle\s*=\s*["']/i.test(html)) error(f, 'tiene estilos en línea (style="..."). Van en el archivo .css.');
  for (const m of html.matchAll(/<link\b[^>]*href=["']((?:https?:)?\/\/[^"']+)["'][^>]*>/gi)) {
    error(f, `carga un archivo de fuera (${m[1]}). Descárgalo y ponlo en la carpeta.`);
  }
  for (const m of html.matchAll(/<(img|source|video|audio)\b[^>]*\ssrcset?=["']((?:https?:)?\/\/[^"']+)["']/gi)) {
    error(f, `carga una imagen o vídeo de fuera (${m[2]}).`);
  }
  if (/<iframe\b/i.test(html)) error(f, 'tiene un <iframe>. Usa un enlace (por ejemplo, botón "Cómo llegar" a Google Maps).');
  for (const m of html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) {
    if (!/rel=["'][^"']*noopener/i.test(m[0])) error(f, 'un enlace con target="_blank" no lleva rel="noopener noreferrer".');
  }
  if (/\{\{[A-Z_]+\}\}/.test(html)) error(f, 'quedan marcadores {{...}} sin rellenar.');
  if (esDemo) {
    if (!CSP_DEMO.test(html)) error(f, 'falta la política de seguridad <meta http-equiv="Content-Security-Policy">.');
    if (!/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) error(f, 'falta <meta name="robots" content="noindex, nofollow"> (las demos no deben salir en Google).');
    if (/<form\b/i.test(html)) error(f, 'tiene un formulario. Las demos no recogen datos de nadie.');
    if (/\[PENDIENTE/i.test(html)) error(f, 'quedan textos [PENDIENTE]. Rellénalos o quita esa parte antes de enviarla.');
    if (!/lang=["']es/i.test(html)) aviso(f, 'falta lang="es" en <html>.');
  }
}

function revisarJs(f, js, { esCrm }) {
  if (/\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/.test(js)) error(f, 'usa eval / new Function / document.write (peligroso).');
  if (/\.(innerHTML|outerHTML)\s*[+]?=|insertAdjacentHTML\s*\(/.test(js)) {
    if (esCrm) error(f, 'usa innerHTML. En el CRM se usa textContent o la función el() de js/dom.js.');
    else aviso(f, 'usa innerHTML: asegúrate de que no mete textos que vengan de fuera.');
  }
}

const carpetasDemo = existsSync('demos')
  ? readdirSync('demos').filter((d) => statSync(join('demos', d)).isDirectory())
  : [];

for (const slug of carpetasDemo) {
  const base = `demos/${slug}`;
  if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug)) error(base, 'el nombre de la carpeta solo puede tener minúsculas, números y guiones.');
  if (!existsSync(`${base}/index.html`)) error(base, 'falta index.html.');
  if (!existsSync(`${base}/demo.json`)) error(base, 'falta demo.json (lo crea npm run demo:nueva).');
  else {
    try {
      const meta = JSON.parse(readFileSync(`${base}/demo.json`, 'utf8'));
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
  const peso = statSync(f).size;
  pesoDemos[slug] = (pesoDemos[slug] ?? 0) + peso;
  if (['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'].includes(ext) && peso > 300 * 1024) {
    error(f, `la imagen pesa ${Math.round(peso / 1024)} KB (máximo 300). Pásala por: npm run imagenes -- demos/${slug}`);
  }
  if (['.mp4', '.mov', '.webm'].includes(ext) && peso > 4 * 1024 * 1024) error(f, 'el vídeo pesa más de 4 MB.');
  if (ext === '.html') revisarHtml(f, readFileSync(f, 'utf8'), { esDemo: true });
  if (['.js', '.mjs'].includes(ext) && !f.includes('/vendor/')) revisarJs(f, readFileSync(f, 'utf8'), { esCrm: false });
}
for (const [slug, peso] of Object.entries(pesoDemos)) {
  if (peso > 6 * 1024 * 1024) aviso(`demos/${slug}`, `pesa ${(peso / 1024 / 1024).toFixed(1)} MB en total. Las webs ligeras cargan mejor en el móvil.`);
}

// -----------------------------------------------------------------------------
// 4. CRM
// -----------------------------------------------------------------------------
for (const f of archivos.filter((x) => x.startsWith('crm/'))) {
  const ext = extname(f).toLowerCase();
  if (ext === '.html') revisarHtml(f, readFileSync(f, 'utf8'), { esDemo: false });
  if (ext === '.js') revisarJs(f, readFileSync(f, 'utf8'), { esCrm: true });
}
for (const f of ['crm/_headers', 'demos/_headers']) {
  if (!existsSync(f)) error(f, 'falta el archivo de cabeceras de seguridad.');
  else if (!/Content-Security-Policy/.test(readFileSync(f, 'utf8'))) error(f, 'no define Content-Security-Policy.');
}
if (existsSync('crm/config.js')) {
  const config = readFileSync('crm/config.js', 'utf8');
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
