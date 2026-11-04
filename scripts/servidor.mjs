// Servidor local para ver el CRM o las demos en tu ordenador.
// Uso: node scripts/servidor.mjs <carpeta> <puerto>
// Solo escucha en 127.0.0.1 (nadie más de tu red puede entrar) y aplica las
// mismas cabeceras de seguridad que Cloudflare (archivo _headers).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';

const carpeta = resolve(process.argv[2] ?? 'crm');
const puerto = Number(process.argv[3] ?? 5500);

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

/** Lee las cabeceras del bloque "/*" del archivo _headers. */
function cabecerasDe(dir) {
  const archivo = join(dir, '_headers');
  if (!existsSync(archivo)) return {};
  const resultado = {};
  let dentro = false;
  for (const linea of readFileSync(archivo, 'utf8').split('\n')) {
    if (/^\S/.test(linea)) dentro = linea.trim() === '/*';
    else if (dentro && linea.includes(':')) {
      const i = linea.indexOf(':');
      resultado[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
    }
  }
  delete resultado['Strict-Transport-Security']; // no tiene sentido en http://localhost
  return resultado;
}

const cabeceras = cabecerasDe(carpeta);

createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let archivo = resolve(join(carpeta, ruta));
  if (archivo !== carpeta && !archivo.startsWith(carpeta + sep)) {
    res.writeHead(403).end('Prohibido');
    return;
  }
  if (existsSync(archivo) && statSync(archivo).isDirectory()) {
    if (!ruta.endsWith('/')) {
      res.writeHead(301, { Location: `${ruta}/` }).end();
      return;
    }
    archivo = join(archivo, 'index.html');
  }
  if (!existsSync(archivo) || /(^|[\\/])(_headers|\.env.*)$/.test(archivo)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
    return;
  }
  res.writeHead(200, { ...cabeceras, 'Content-Type': TIPOS[extname(archivo).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(archivo));
}).listen(puerto, '127.0.0.1', () => {
  console.log(`\nAbriendo ${carpeta} en http://localhost:${puerto}/  (Ctrl+C para parar)\n`);
});
