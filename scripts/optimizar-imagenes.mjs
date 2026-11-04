#!/usr/bin/env node
// Optimiza las imágenes de una demo para que la web cargue rápido.
//
// Uso:
//   node scripts/optimizar-imagenes.mjs demos/peluqueria-rocio
//   (o: npm run imagenes -- demos/peluqueria-rocio)
//
// Cómo se usa en el día a día:
//   1. Exporta tus dibujos de Krita como PNG (o JPG) y los de Inkscape como
//      "SVG normal".
//   2. Ponlos en la carpeta originales/ de la demo, por ejemplo
//      demos/peluqueria-rocio/originales/. Esa carpeta NO se sube a GitHub.
//   3. Ejecuta este script. Las versiones ligeras aparecen en img/:
//        - foto.png  -> img/foto.webp (máx. 1600 px de ancho) e img/foto-800.webp
//        - dibujo.svg -> img/dibujo.svg (limpio y más pequeño)
//      Si llamas a tu dibujo "dibujo.svg", sustituye al dibujo animado de la
//      portada (la "firma") y se dibujará solo.
//
// Se procesa un archivo cada vez para no agotar la memoria de un portátil
// de 8 GB.

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { optimize } from 'svgo';

import { slugify } from '../crm/js/reglas.js';

export const ANCHO_MAXIMO = 1600;
export const ANCHO_PEQUENO = 800;
export const CALIDAD_WEBP = 78;
export const LIMITE_BYTES = 300 * 1024; // las demos no deben tener imágenes de más de 300 KB

const RASTER = new Set(['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff']);
const VECTOR = new Set(['.svg']);

// Poca memoria y un solo hilo: va bien en portátiles modestos.
sharp.cache(false);
sharp.concurrency(1);

/** Configuración de SVGO: limpia el SVG pero deja lo que necesita la animación. */
export const CONFIG_SVGO = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // El viewBox se conserva siempre (en SVGO 4 ya no se quita por defecto).
          // Cada trazo debe seguir siendo un trazo separado para que se
          // dibujen uno detrás de otro.
          mergePaths: false,
          // No tocar stroke/fill: los necesita DrawSVG para "dibujar".
          removeUselessStrokeAndFill: false,
          // Pasar los <style> de Inkscape a cada elemento (para el paso siguiente).
          inlineStyles: { onlyMatchedOnce: false },
        },
      },
    },
    // La web no permite estilos en línea (style="..."): se pasan a atributos.
    'convertStyleToAttrs',
    'removeStyleElement',
    // Seguridad: fuera scripts y fotos incrustadas.
    'removeScripts',
    'removeRasterImages',
    // Tamaño adaptable (se queda el viewBox).
    'removeDimensions',
  ],
};

export function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2).replace('.', ',')} MB`;
}

function nombreLimpio(archivo) {
  const base = path.basename(archivo, path.extname(archivo));
  return slugify(base) || 'imagen';
}

async function rasterAWebp(origen /* Buffer con la imagen */, destino, ancho) {
  // Si pasa de 300 KB, se baja la calidad poco a poco.
  for (const calidad of [CALIDAD_WEBP, 70, 62, 54, 46]) {
    const datos = await sharp(origen, { limitInputPixels: 268402689 })
      .rotate() // respeta la orientación de las fotos del móvil
      .resize({ width: ancho, withoutEnlargement: true })
      .webp({ quality: calidad, effort: 5, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    if (datos.data.length <= LIMITE_BYTES || calidad === 46) {
      await fs.writeFile(destino, datos.data);
      return { bytes: datos.data.length, ancho: datos.info.width, alto: datos.info.height, calidad };
    }
  }
  throw new Error('No se pudo optimizar la imagen.');
}

function tieneTrazos(svg) {
  return /\bstroke="(?!none")[^"]+"/.test(svg);
}

/**
 * Optimiza todas las imágenes de <carpeta>/originales/ y las deja en <carpeta>/img/.
 * Devuelve la lista de resultados (para tests o para otros scripts).
 */
export async function optimizarCarpeta(carpeta, { log = console.log } = {}) {
  const raizDemo = path.resolve(carpeta);
  if (!existsSync(raizDemo)) throw new Error(`No existe la carpeta ${carpeta}.`);
  const originales = path.join(raizDemo, 'originales');
  const destino = path.join(raizDemo, 'img');
  if (!existsSync(originales)) {
    await fs.mkdir(originales, { recursive: true });
    log(`He creado la carpeta ${path.relative(process.cwd(), originales) || originales}.`);
    log('Pon ahí tus PNG/JPG de Krita y tus SVG de Inkscape y vuelve a ejecutar el script.');
    return [];
  }
  await fs.mkdir(destino, { recursive: true });

  const entradas = (await fs.readdir(originales, { withFileTypes: true }))
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'es'));

  if (!entradas.length) {
    log('La carpeta originales/ está vacía. Pon ahí tus imágenes y vuelve a ejecutar el script.');
    return [];
  }

  const resultados = [];
  for (const nombre of entradas) {
    const origen = path.join(originales, nombre);
    const extension = path.extname(nombre).toLowerCase();
    // Se lee el archivo una sola vez y se trabaja con esa copia en memoria
    // (comprobar y después volver a leer deja un hueco en el que puede cambiar).
    const base = nombreLimpio(nombre);
    let antes = 0;
    try {
      const contenido = await fs.readFile(origen);
      antes = contenido.length;
      if (RASTER.has(extension)) {
        const grande = await rasterAWebp(contenido, path.join(destino, `${base}.webp`), ANCHO_MAXIMO);
        const pequena = await rasterAWebp(contenido, path.join(destino, `${base}-${ANCHO_PEQUENO}.webp`), ANCHO_PEQUENO);
        resultados.push({ nombre, tipo: 'foto', antes, salidas: [`img/${base}.webp`, `img/${base}-${ANCHO_PEQUENO}.webp`], despues: grande.bytes + pequena.bytes, grande, pequena });
      } else if (VECTOR.has(extension)) {
        const texto = contenido.toString('utf8');
        const { data } = optimize(texto, { ...CONFIG_SVGO, path: origen });
        await fs.writeFile(path.join(destino, `${base}.svg`), data);
        resultados.push({ nombre, tipo: 'dibujo', antes, salidas: [`img/${base}.svg`], despues: Buffer.byteLength(data), trazos: tieneTrazos(data) });
      } else if (extension === '.kra' || extension === '.psd') {
        resultados.push({ nombre, tipo: 'saltado', antes, motivo: 'Es un archivo de trabajo. Expórtalo como PNG desde Krita.' });
      } else {
        resultados.push({ nombre, tipo: 'saltado', antes, motivo: 'Formato no soportado (usa PNG, JPG o SVG).' });
      }
    } catch (error) {
      resultados.push({ nombre, tipo: 'error', antes, motivo: error.message });
    }
  }
  return resultados;
}

function imprimirResumen(resultados, carpeta, log = console.log) {
  if (!resultados.length) return;
  log('');
  log(`Imágenes de ${carpeta}`);
  log('─'.repeat(60));
  let totalAntes = 0;
  let totalDespues = 0;
  for (const r of resultados) {
    if (r.tipo === 'foto' || r.tipo === 'dibujo') {
      totalAntes += r.antes;
      totalDespues += r.despues;
      const ahorro = r.antes ? Math.max(0, Math.round((1 - r.despues / r.antes) * 100)) : 0;
      log(`✔ ${r.nombre}: ${formatearTamano(r.antes)} → ${formatearTamano(r.despues)} (${ahorro} % menos)`);
      log(`    ${r.salidas.join('  ·  ')}`);
      if (r.tipo === 'foto') {
        log(`    Para ponerla en la web (cópialo en index.html y cambia el texto alternativo):`);
        log(
          `    <img src="${r.salidas[1]}" srcset="${r.salidas[1]} ${r.pequena.ancho}w, ${r.salidas[0]} ${r.grande.ancho}w" ` +
            `sizes="(min-width: 60rem) 50vw, 100vw" width="${r.grande.ancho}" height="${r.grande.alto}" alt="Describe aquí la imagen" loading="lazy" decoding="async">`,
        );
        if (r.grande.bytes > LIMITE_BYTES) log(`    ⚠ Sigue pesando más de 300 KB. Prueba a exportarla más pequeña desde Krita.`);
      }
      if (r.tipo === 'dibujo' && !r.trazos) {
        log('    ⚠ Este SVG no tiene trazos (stroke): se verá, pero no se "dibujará solo".');
        log('      En Inkscape usa el Lápiz (P) o la pluma Bézier (B) con trazo y sin relleno.');
      }
    } else if (r.tipo === 'saltado') {
      log(`– ${r.nombre}: saltado. ${r.motivo}`);
    } else {
      log(`✖ ${r.nombre}: no se pudo optimizar. ${r.motivo}`);
    }
  }
  log('─'.repeat(60));
  const ahorroTotal = totalAntes ? Math.max(0, Math.round((1 - totalDespues / totalAntes) * 100)) : 0;
  log(`Total: ${formatearTamano(totalAntes)} → ${formatearTamano(totalDespues)} (${ahorroTotal} % menos).`);
  log('Los originales se quedan en originales/ (no se suben a GitHub).');
}

async function principal() {
  const carpeta = process.argv[2];
  if (!carpeta || carpeta === '--help' || carpeta === '-h') {
    console.log('Uso: node scripts/optimizar-imagenes.mjs <carpeta-de-la-demo>');
    console.log('Ejemplo: node scripts/optimizar-imagenes.mjs demos/peluqueria-rocio');
    process.exitCode = carpeta ? 0 : 1;
    return;
  }
  try {
    const resultados = await optimizarCarpeta(carpeta);
    imprimirResumen(resultados, carpeta);
    if (resultados.some((r) => r.tipo === 'error')) process.exitCode = 1;
  } catch (error) {
    console.error(`No se ha podido terminar: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await principal();
}
