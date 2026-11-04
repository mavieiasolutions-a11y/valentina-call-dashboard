// Tests de scripts/lib/demo.mjs (creación de demos desde plantilla-demo/).
// Se ejecutan con `npm test` (node --test). Las demos de prueba se crean en
// una carpeta temporal del sistema, nunca en demos/ del proyecto.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MARCADORES,
  crearDemo,
  esSlugValido,
  listarEstilos,
  prepararValores,
  reemplazarMarcadores,
  validarSlug,
} from '../../scripts/lib/demo.mjs';

const RAIZ_PROYECTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FECHA = new Date('2026-03-15T10:00:00Z');

const DATOS_EJEMPLO = {
  marca: 'El Faro',
  negocio: 'Barbería El Faro (ejemplo)',
  sector: 'barbería',
  eslogan: 'Cortes clásicos y ambiente de barrio',
  telefono: '+34600000000',
  direccion: 'Calle Ejemplo 1, 11201 Algeciras',
  municipio: 'Algeciras',
  negocioId: null,
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

let raizTemporal;

async function listarRecursivo(carpeta, base = carpeta) {
  const salida = [];
  for (const entrada of await fs.readdir(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await listarRecursivo(ruta, base)));
    else salida.push(path.relative(base, ruta).split(path.sep).join('/'));
  }
  return salida;
}

const leer = (carpeta, relativo) => fs.readFile(path.join(carpeta, relativo), 'utf8');

/** Revisa el HTML con las mismas reglas que el comprobador de seguridad. */
function revisarHtml(html) {
  const problemas = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const atributos = m[1];
    if (!/\bsrc\s*=/.test(atributos)) problemas.push('script en línea');
    if (!/\bdefer\b/.test(atributos)) problemas.push(`script sin defer: ${m[0]}`);
  }
  if (/\son[a-z]+\s*=/i.test(html)) problemas.push('manejador de eventos en línea (onclick=...)');
  if (/\sstyle\s*=/i.test(html)) problemas.push('atributo style=');
  if (/<style\b/i.test(html)) problemas.push('bloque <style>');
  if (/<(iframe|form|object|embed)\b/i.test(html)) problemas.push('iframe/form/object/embed');
  if (/\beval\s*\(|new Function/.test(html)) problemas.push('eval');
  for (const m of html.matchAll(/\s(src|href)\s*=\s*"([^"]*)"/gi)) {
    const [, atributo, valor] = m;
    const esExterno = /^[a-z][a-z0-9+.-]*:/i.test(valor) || valor.startsWith('//');
    if (!esExterno) continue;
    if (atributo.toLowerCase() === 'src') problemas.push(`src externo: ${valor}`);
    else if (!/^(https:\/\/wa\.me\/|tel:\+|https:\/\/www\.google\.com\/maps\/)/.test(valor)) problemas.push(`enlace externo no permitido: ${valor}`);
  }
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const etiqueta = m[0];
    if (/target\s*=\s*"_blank"/.test(etiqueta) && !/rel\s*=\s*"[^"]*noopener[^"]*noreferrer[^"]*"/.test(etiqueta)) {
      problemas.push(`target=_blank sin rel="noopener noreferrer": ${etiqueta}`);
    }
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/href\s*=\s*"(https?:)?\/\//i.test(m[0])) problemas.push(`link externo: ${m[0]}`);
  }
  return problemas;
}

before(async () => {
  // Raíz falsa: plantilla-demo y node_modules enlazados, demos/ vacía.
  raizTemporal = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-test-'));
  const tipo = process.platform === 'win32' ? 'junction' : 'dir';
  await fs.symlink(path.join(RAIZ_PROYECTO, 'plantilla-demo'), path.join(raizTemporal, 'plantilla-demo'), tipo);
  await fs.symlink(path.join(RAIZ_PROYECTO, 'node_modules'), path.join(raizTemporal, 'node_modules'), tipo);
  await fs.mkdir(path.join(raizTemporal, 'demos'));
});

after(async () => {
  if (raizTemporal) await fs.rm(raizTemporal, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// reemplazarMarcadores
// ---------------------------------------------------------------------------

describe('reemplazarMarcadores', () => {
  test('cambia los marcadores por sus valores', () => {
    const texto = '<h1>{{MARCA}}</h1><p>{{ MUNICIPIO }} · {{ANIO}}</p>';
    assert.equal(
      reemplazarMarcadores(texto, { MARCA: 'El Faro', MUNICIPIO: 'Algeciras', ANIO: '2026' }),
      '<h1>El Faro</h1><p>Algeciras · 2026</p>',
    );
  });

  test('escapa & < > " \' para HTML', () => {
    const resultado = reemplazarMarcadores('<a title="{{MARCA}}">{{MARCA}}</a>', { MARCA: `Tom & Jerry's <b>"Bar"</b>` });
    assert.equal(
      resultado,
      '<a title="Tom &amp; Jerry&#39;s &lt;b&gt;&quot;Bar&quot;&lt;/b&gt;">Tom &amp; Jerry&#39;s &lt;b&gt;&quot;Bar&quot;&lt;/b&gt;</a>',
    );
  });

  test('un script dentro de un dato nunca llega como HTML', () => {
    const resultado = reemplazarMarcadores('<p>{{ESLOGAN}}</p>', { ESLOGAN: '<script>alert(1)</script>' });
    assert.ok(!resultado.includes('<script>'));
    assert.ok(resultado.includes('&lt;script&gt;'));
  });

  test('los valores que faltan (vacío, null, undefined) se quedan en blanco', () => {
    const texto = '[{{MARCA}}][{{SECTOR}}][{{DIRECCION}}][{{MUNICIPIO}}]';
    assert.equal(reemplazarMarcadores(texto, { MARCA: '', SECTOR: null, DIRECCION: undefined }), '[][][][]');
  });

  test('los marcadores desconocidos también desaparecen', () => {
    assert.equal(reemplazarMarcadores('a{{NO_EXISTE}}b', {}), 'ab');
  });

  test('un dato que parece un marcador no se vuelve a sustituir ni deja {{', () => {
    const resultado = reemplazarMarcadores('{{MARCA}}', { MARCA: '{{NEGOCIO}}', NEGOCIO: 'X' });
    assert.ok(!resultado.includes('{{'));
    assert.ok(!resultado.includes('X'));
  });

  test('números y otros tipos se convierten a texto', () => {
    assert.equal(reemplazarMarcadores('{{ANIO}}', { ANIO: 2026 }), '2026');
  });

  test('modo json escapa comillas y caracteres peligrosos', () => {
    const resultado = reemplazarMarcadores('{"name":"{{MARCA}}"}', { MARCA: 'Bar "Pepe" </script>' }, { modo: 'json' });
    const datos = JSON.parse(resultado);
    assert.equal(datos.name, 'Bar "Pepe" </script>');
    assert.ok(!resultado.includes('</script>'));
  });
});

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

describe('validarSlug', () => {
  test('acepta slugs correctos', () => {
    for (const slug of ['abc', 'peluqueria-rocio', 'bar-2', 'a1b', 'x'.repeat(48)]) {
      assert.equal(esSlugValido(slug), true, slug);
      assert.equal(validarSlug(slug), slug);
    }
  });

  test('rechaza slugs incorrectos con un error en español', () => {
    const malos = ['ab', '', 'Peluqueria', 'con espacio', 'peluquería', 'año', '-abc', 'abc-', 'a--b', 'a_b', 'x'.repeat(49), '../etc', null, undefined, 42];
    for (const slug of malos) {
      assert.equal(esSlugValido(slug), false, String(slug));
      assert.throws(() => validarSlug(slug), /no es válido/, String(slug));
    }
  });

  test('sugiere un slug corregido', () => {
    assert.throws(() => validarSlug('Peluquería Rocío'), /peluqueria-rocio/);
  });
});

// ---------------------------------------------------------------------------
// prepararValores
// ---------------------------------------------------------------------------

describe('prepararValores', () => {
  test('calcula teléfono, WhatsApp, mapa y año', () => {
    const v = prepararValores(DATOS_EJEMPLO, { slug: 'ejemplo-barberia', fecha: FECHA });
    assert.equal(v.TELEFONO_VISIBLE, '600 000 000');
    assert.equal(v.TEL_URL, 'tel:+34600000000');
    assert.match(v.WHATSAPP_URL, /^https:\/\/wa\.me\/34600000000\?text=Hola/);
    assert.match(v.MAPA_URL, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    // El municipio ya va en la dirección: no se repite.
    assert.equal(decodeURIComponent(v.MAPA_URL.split('query=')[1]), 'Barbería El Faro (ejemplo), Calle Ejemplo 1, 11201 Algeciras');
    assert.equal(v.ANIO, '2026');
    assert.equal(v.SLUG, 'ejemplo-barberia');
    for (const marcador of MARCADORES) assert.ok(marcador in v, marcador);
  });

  test('usa el texto de WhatsApp indicado', () => {
    const v = prepararValores({ ...DATOS_EJEMPLO, whatsappTexto: 'Quiero cita' });
    assert.ok(v.WHATSAPP_URL.endsWith('?text=Quiero%20cita'));
  });

  test('un teléfono fijo no tiene WhatsApp', () => {
    const v = prepararValores({ ...DATOS_EJEMPLO, telefono: '+34956000000' });
    assert.equal(v.WHATSAPP_URL, '');
    assert.equal(v.TEL_URL, 'tel:+34956000000');
  });

  test('si falta el eslogan se crea uno neutro', () => {
    assert.equal(prepararValores({ ...DATOS_EJEMPLO, eslogan: '' }).ESLOGAN, 'Barbería en Algeciras');
    assert.equal(prepararValores({ marca: 'X' }).ESLOGAN, 'Te esperamos');
  });

  test('marca y negocio se completan entre sí', () => {
    assert.equal(prepararValores({ negocio: 'Bar Pepe' }).MARCA, 'Bar Pepe');
    assert.equal(prepararValores({ marca: 'Pepe' }).NEGOCIO, 'Pepe');
    assert.throws(() => prepararValores({}), /Falta el nombre/);
  });

  test('rechaza un teléfono o un negocioId no válidos', () => {
    assert.throws(() => prepararValores({ ...DATOS_EJEMPLO, telefono: '123' }), /teléfono/);
    assert.throws(() => prepararValores({ ...DATOS_EJEMPLO, negocioId: 'no-es-uuid' }), /negocioId/);
  });

  test('rechaza textos demasiado largos', () => {
    assert.throws(() => prepararValores({ ...DATOS_EJEMPLO, marca: 'x'.repeat(61) }), /demasiado larg/);
  });
});

// ---------------------------------------------------------------------------
// listarEstilos
// ---------------------------------------------------------------------------

describe('listarEstilos', () => {
  test('devuelve los tres estilos con sus datos', () => {
    const estilos = listarEstilos(RAIZ_PROYECTO);
    assert.deepEqual(
      estilos.map((e) => e.id),
      ['clasico', 'editorial', 'vibrante'],
    );
    for (const e of estilos) {
      assert.deepEqual(Object.keys(e).sort(), ['descripcion', 'id', 'ideal_para', 'nombre']);
      assert.ok(e.nombre && e.descripcion);
      assert.ok(Array.isArray(e.ideal_para) && e.ideal_para.length >= 3);
    }
  });

  test('una carpeta sin plantillas da una lista vacía', () => {
    assert.deepEqual(listarEstilos(os.tmpdir()), []);
  });
});

// ---------------------------------------------------------------------------
// crearDemo
// ---------------------------------------------------------------------------

describe('crearDemo', () => {
  for (const estilo of ['clasico', 'editorial', 'vibrante']) {
    test(`crea una demo completa y segura con el estilo ${estilo}`, async () => {
      const slug = `prueba-${estilo}`;
      const { carpeta, archivos } = await crearDemo({ slug, estilo, datos: DATOS_EJEMPLO, raiz: raizTemporal, fecha: FECHA });
      assert.equal(carpeta, path.join(raizTemporal, 'demos', slug));
      const enDisco = (await listarRecursivo(carpeta)).sort();
      assert.deepEqual([...archivos].sort(), enDisco);

      // Archivos básicos y nada de estilo.json.
      for (const archivo of ['index.html', 'css/base.css', 'css/estilos.css', 'js/base.js', 'js/animaciones.js', 'img/dibujo.svg', 'demo.json', 'vendor/LICENCIAS.txt']) {
        assert.ok(enDisco.includes(archivo), `falta ${archivo}`);
      }
      assert.ok(!enDisco.some((a) => a.endsWith('estilo.json')), 'no debe copiarse estilo.json');

      // Fuentes y GSAP de estilo.json copiados.
      const definicion = JSON.parse(await leer(path.join(RAIZ_PROYECTO, 'plantilla-demo', estilo), 'estilo.json'));
      for (const { archivos: fuentes } of definicion.fuentes) {
        for (const f of fuentes) assert.ok(existsSync(path.join(carpeta, 'vendor', 'fonts', f)), `falta la fuente ${f}`);
      }
      for (const g of definicion.gsap) assert.ok(existsSync(path.join(carpeta, 'vendor', 'gsap', g)), `falta ${g}`);
      const licencias = await leer(carpeta, 'vendor/LICENCIAS.txt');
      assert.match(licencias, /GSAP/);
      assert.match(licencias, /standard-license/);
      assert.match(licencias, /Open Font License/);

      // Ningún marcador sin cambiar en ningún archivo de texto.
      for (const archivo of enDisco.filter((a) => /\.(html|css|js|json|svg|txt)$/.test(a) && !a.startsWith('vendor/gsap/'))) {
        const contenido = await leer(carpeta, archivo);
        assert.ok(!contenido.includes('{{'), `quedan marcadores en ${archivo}`);
      }

      // Las fuentes que pide el CSS existen.
      const css = await leer(carpeta, 'css/estilos.css');
      const fuentesCss = [...css.matchAll(/url\('?\.\.\/vendor\/fonts\/([^')]+)'?\)/g)].map((m) => m[1]);
      assert.ok(fuentesCss.length >= 3);
      for (const f of fuentesCss) assert.ok(existsSync(path.join(carpeta, 'vendor', 'fonts', f)), `el CSS pide ${f} y no está`);
      assert.match(css, /--color-primario:/);
      assert.match(css, /font-display:\s*swap/);

      // HTML: datos puestos, seguridad y referencias locales que existen.
      const html = await leer(carpeta, 'index.html');
      assert.deepEqual(revisarHtml(html), []);
      assert.match(html, /<html lang="es">/);
      assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
      assert.match(html, /<meta name="referrer" content="no-referrer">/);
      assert.ok(
        html.includes(
          `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">`,
        ),
      );
      assert.ok(html.includes('Web de muestra preparada por Mavie IA Solutions para Barbería El Faro (ejemplo). Textos e imágenes de ejemplo.'));
      assert.ok(html.includes('href="tel:+34600000000"'));
      assert.ok(html.includes('href="https://wa.me/34600000000?text='));
      assert.ok(html.includes('href="https://www.google.com/maps/search/?api=1&amp;query='));
      assert.ok(html.includes('600 000 000'));
      assert.ok(html.includes('data-dibujo="img/dibujo.svg"'));
      for (const m of html.matchAll(/\s(?:src|href)="(?![a-z][a-z0-9+.-]*:)([^"#][^"]*)"/gi)) {
        assert.ok(existsSync(path.join(carpeta, m[1])), `el HTML pide ${m[1]} y no existe`);
      }

      // JS y SVG sin cosas peligrosas.
      for (const archivo of enDisco.filter((a) => (a.startsWith('js/') && a.endsWith('.js')) || a.endsWith('.svg'))) {
        const contenido = await leer(carpeta, archivo);
        assert.ok(!/\beval\s*\(|new Function|innerHTML|document\.write/.test(contenido), `código peligroso en ${archivo}`);
        if (archivo.endsWith('.svg')) assert.ok(!/<script|\son[a-z]+=|\sstyle=/i.test(contenido), `SVG inseguro: ${archivo}`);
      }

      // Ninguna imagen de más de 300 KB.
      for (const archivo of enDisco.filter((a) => /\.(svg|png|jpe?g|webp|avif|gif)$/.test(a))) {
        const { size } = await fs.stat(path.join(carpeta, archivo));
        assert.ok(size < 300 * 1024, `${archivo} pesa ${size} bytes`);
      }

      // Ficha de la demo.
      const ficha = JSON.parse(await leer(carpeta, 'demo.json'));
      assert.deepEqual(ficha, {
        slug,
        estilo,
        negocio_id: null,
        marca: 'El Faro',
        negocio: 'Barbería El Faro (ejemplo)',
        sector: 'barbería',
        municipio: 'Algeciras',
        creada: '2026-03-15',
        plantilla_version: 1,
      });
    });
  }

  test('con datos que faltan, la página sigue limpia y oculta lo vacío', async () => {
    const { carpeta } = await crearDemo({
      slug: 'prueba-sin-datos',
      estilo: 'clasico',
      datos: { negocio: 'Floristería Margarita (ejemplo)', telefono: '', direccion: '', municipio: '' },
      raiz: raizTemporal,
    });
    const html = await leer(carpeta, 'index.html');
    assert.ok(!html.includes('{{'));
    assert.deepEqual(revisarHtml(html), []);
    // Los botones de llamar y WhatsApp quedan marcados como vacíos (los oculta el CSS).
    assert.match(html, /href="" data-si=""/);
    // Ningún enlace a teléfono, WhatsApp ni Google Maps (se mira el servidor de cada enlace, no el texto).
    const enlaces = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    const servidores = enlaces.map((h) => {
      try {
        return new URL(h).hostname;
      } catch {
        return '';
      }
    });
    assert.ok(!enlaces.some((h) => h.startsWith('tel:')));
    assert.ok(!servidores.includes('wa.me'));
    assert.ok(!servidores.some((h) => h === 'google.com' || h.endsWith('.google.com')));
    // Y aparece el texto alternativo neutro.
    assert.match(html, /data-no="">Aquí irán la dirección y el botón para llegar en Google Maps\./);
    assert.match(await leer(carpeta, 'css/base.css'), /\[data-si=''\]/);
    const ficha = JSON.parse(await leer(carpeta, 'demo.json'));
    assert.equal(ficha.marca, 'Floristería Margarita (ejemplo)');
    assert.equal(ficha.municipio, '');
  });

  test('escapa los datos peligrosos en el HTML', async () => {
    const { carpeta } = await crearDemo({
      slug: 'prueba-escape',
      estilo: 'editorial',
      datos: { ...DATOS_EJEMPLO, marca: '<script>alert(1)</script>', eslogan: 'Bar "Pepe" & Co' },
      raiz: raizTemporal,
    });
    const html = await leer(carpeta, 'index.html');
    assert.ok(!html.includes('<script>alert'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('Bar &quot;Pepe&quot; &amp; Co'));
    assert.deepEqual(revisarHtml(html), []);
  });

  test('no sobrescribe una demo existente salvo que se pida (y conserva originales/)', async () => {
    const opciones = { slug: 'prueba-repetida', estilo: 'vibrante', datos: DATOS_EJEMPLO, raiz: raizTemporal };
    const { carpeta } = await crearDemo(opciones);
    await fs.mkdir(path.join(carpeta, 'originales'));
    await fs.writeFile(path.join(carpeta, 'originales', 'mi-dibujo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await fs.writeFile(path.join(carpeta, 'index.html'), 'cambiado a mano');

    await assert.rejects(() => crearDemo(opciones), /Ya existe la demo/);
    assert.equal(await leer(carpeta, 'index.html'), 'cambiado a mano');

    await crearDemo({ ...opciones, estilo: 'clasico', sobrescribir: true });
    assert.notEqual(await leer(carpeta, 'index.html'), 'cambiado a mano');
    assert.ok(existsSync(path.join(carpeta, 'originales', 'mi-dibujo.svg')), 'se han perdido los originales');
    assert.equal(JSON.parse(await leer(carpeta, 'demo.json')).estilo, 'clasico');
    // No quedan carpetas temporales.
    const restos = (await fs.readdir(path.join(raizTemporal, 'demos'))).filter((n) => n.startsWith('.'));
    assert.deepEqual(restos, []);
  });

  test('errores claros: slug, estilo y datos', async () => {
    await assert.rejects(() => crearDemo({ slug: 'Mal Slug', estilo: 'clasico', datos: DATOS_EJEMPLO, raiz: raizTemporal }), /slug/);
    await assert.rejects(() => crearDemo({ slug: 'prueba-estilo', estilo: 'no-existe', datos: DATOS_EJEMPLO, raiz: raizTemporal }), /no existe.*clasico, editorial, vibrante/);
    await assert.rejects(() => crearDemo({ slug: 'prueba-datos', estilo: 'clasico', datos: { ...DATOS_EJEMPLO, telefono: 'abc' }, raiz: raizTemporal }), /teléfono/);
    assert.ok(!existsSync(path.join(raizTemporal, 'demos', 'prueba-datos')));
  });

  test('sin slug lo saca del nombre del negocio', async () => {
    const { carpeta } = await crearDemo({ estilo: 'clasico', datos: { negocio: 'Peluquería Rocío & Co' }, raiz: raizTemporal });
    assert.equal(path.basename(carpeta), 'peluqueria-rocio-y-co');
  });
});
