// Comprueba que el revisor de seguridad detecta lo que tiene que detectar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REVISOR = resolve('scripts/revisar-seguridad.mjs');

function revisar(archivos) {
  const dir = mkdtempSync(join(tmpdir(), 'revisor-'));
  try {
    for (const [ruta, contenido] of Object.entries(archivos)) {
      mkdirSync(join(dir, ruta, '..'), { recursive: true });
      writeFileSync(join(dir, ruta), contenido);
    }
    const r = spawnSync(process.execPath, [REVISOR], { cwd: dir, encoding: 'utf8' });
    return { codigo: r.status, salida: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CABECERAS = { 'crm/_headers': '/*\n  Content-Security-Policy: default-src \'self\'\n', 'demos/_headers': '/*\n  Content-Security-Policy: default-src \'self\'\n' };
const DEMO_BUENA = `<!doctype html><html lang="es"><head>
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'">
<!-- aquí no va <script> ni onclick="x" -->
<script src="js/a.js" defer></script></head><body>
<a href="https://wa.me/34600000000" target="_blank" rel="noopener noreferrer">WhatsApp</a></body></html>`;

test('una demo correcta pasa', () => {
  const r = revisar({ ...CABECERAS, 'demos/bien/index.html': DEMO_BUENA, 'demos/bien/demo.json': '{"slug":"bien"}', 'demos/bien/js/a.js': 'console.log(1)' });
  assert.equal(r.codigo, 0, r.salida);
});

test('detecta PHP, claves y archivos .env', () => {
  const r = revisar({
    ...CABECERAS,
    'api/contacto.php': '<?php echo 1;',
    '.env': 'X=1',
    'scripts/x.mjs': `const k = 'sb_secret_${'a'.repeat(20)}';`,
    'notas.md': `clave ghp_${'b'.repeat(36)}`,
  });
  assert.equal(r.codigo, 1);
  assert.match(r.salida, /archivo de servidor/);
  assert.match(r.salida, /archivo de claves/);
  assert.match(r.salida, /sb_secret_/);
  assert.match(r.salida, /token de GitHub/);
});

test('detecta demos inseguras', () => {
  const mala = `<html><head></head><body style="color:red">
<script>alert(1)</script><script src="https://cdn.ejemplo.com/x.js"></script>
<button onclick="hacer()">x</button><iframe src="https://maps.google.com"></iframe>
<a href="https://x.com" target="_blank">x</a><form action="https://x.com"></form>
<p>[PENDIENTE: horario]</p><p>{{MARCA}}</p></body></html>`;
  const r = revisar({ ...CABECERAS, 'demos/mala/index.html': mala, 'demos/mala/demo.json': '{"slug":"otra"}', 'demos/mala/js/a.js': 'eval("1")' });
  assert.equal(r.codigo, 1);
  for (const esperado of ['<script> escrito dentro', 'carga un script de fuera', 'eventos en el HTML', 'estilos en línea', '<iframe>',
    'rel="noopener noreferrer"', 'formulario', '[PENDIENTE]', 'marcadores {{...}}', 'Content-Security-Policy', 'noindex', 'no coincide', 'eval']) {
    assert.ok(r.salida.includes(esperado), `debería avisar de: ${esperado}\n${r.salida}`);
  }
});

test('no se deja engañar con trucos de HTML', () => {
  const trucos = {
    // El navegador cierra el comentario en "<!-->": el script de después SÍ se ejecuta.
    'demos/t1/index.html': `${DEMO_BUENA}<!--> <script>alert(1)</script> -->`,
    // Cierre de script con espacio
    'demos/t2/index.html': `${DEMO_BUENA}<script>alert(2)</script >`,
    // Evento sin comillas y escondido detrás de un ">" dentro de otro atributo
    'demos/t3/index.html': `${DEMO_BUENA}<a title="a>b" onclick=alert(3) href="#">x</a>`,
    // Script en línea sin cerrar
    'demos/t4/index.html': `${DEMO_BUENA}<script>alert(4)`,
    // Script de fuera sin protocolo y con mayúsculas
    'demos/t5/index.html': `${DEMO_BUENA}<SCRIPT SRC="//cdn.ejemplo.com/x.js"></SCRIPT>`,
    // Un "<!--" dentro de un script no abre un comentario: el segundo script se ejecuta.
    'demos/t6/index.html': `${DEMO_BUENA}<script src="js/a.js">/* <!-- */</script><script>alert(6)</script><!-- -->`,
  };
  const archivos = { ...CABECERAS };
  for (const [ruta, html] of Object.entries(trucos)) {
    archivos[ruta] = html;
    archivos[ruta.replace('index.html', 'demo.json')] = JSON.stringify({ slug: ruta.split('/')[1] });
  }
  const r = revisar(archivos);
  assert.equal(r.codigo, 1);
  for (const n of ['t1', 't2', 't4', 't6']) assert.match(r.salida, new RegExp(`demos/${n}/index.html: tiene un <script> escrito`), n);
  assert.match(r.salida, /demos\/t3\/index.html: <a> tiene eventos/);
  assert.match(r.salida, /demos\/t5\/index.html: carga un script de fuera/);
});

test('textos enormes y raros no cuelgan el revisor', () => {
  const raro = `${DEMO_BUENA}<A !=${'!/ !='.repeat(20000)}>${'<a title="'.repeat(5000)}`;
  const inicio = Date.now();
  revisar({ ...CABECERAS, 'demos/raro/index.html': raro, 'demos/raro/demo.json': '{"slug":"raro"}' });
  assert.ok(Date.now() - inicio < 5000, 'debe terminar en segundos');
});

test('el CRM no puede usar innerHTML', () => {
  const r = revisar({ ...CABECERAS, 'crm/js/x.js': 'nodo.innerHTML = datos.nombre;' });
  assert.equal(r.codigo, 1);
  assert.match(r.salida, /innerHTML/);
});
