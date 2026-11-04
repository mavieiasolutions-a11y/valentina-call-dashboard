// Crea la carpeta de una demo nueva a partir de un estilo de plantilla-demo/
// y la apunta en el CRM (estado "diseño").
//
// Uso:
//   npm run demo:nueva -- --estilos                                   (ver los estilos)
//   npm run demo:nueva -- --negocio "Barbería El Faro" --estilo editorial --marca "El Faro Barber Club"
//   npm run demo:nueva -- --negocio <id> --estilo clasico --eslogan "Pan de verdad desde 1985"
//   npm run demo:nueva -- --sin-crm --nombre "Ejemplo" --telefono 600000000 --municipio Algeciras --estilo vibrante
//
// --marca es el nombre que TÚ eliges para la web (puede ser el del negocio u otro más bonito).
import { parseArgs } from 'node:util';
import { relative } from 'node:path';
import { ejecutar } from './lib/entorno.mjs';
import { conectarCRM, buscarNegocio } from './lib/crm.mjs';
import { crearDemo, listarEstilos } from './lib/demo.mjs';
import { slugify, normalizarTelefono } from '../crm/js/reglas.js';

await ejecutar(async () => {
  const { values: op } = parseArgs({
    options: {
      estilos: { type: 'boolean', default: false },
      negocio: { type: 'string' },
      estilo: { type: 'string' },
      marca: { type: 'string' },
      eslogan: { type: 'string', default: '' },
      slug: { type: 'string' },
      'sin-crm': { type: 'boolean', default: false },
      nombre: { type: 'string' },
      telefono: { type: 'string', default: '' },
      municipio: { type: 'string', default: '' },
      direccion: { type: 'string', default: '' },
      sector: { type: 'string', default: '' },
    },
  });

  const estilos = listarEstilos();
  if (op.estilos || !op.estilo) {
    console.log('\nEstilos disponibles:\n');
    for (const e of estilos) console.log(`  ${e.id.padEnd(10)} ${e.nombre}: ${e.descripcion}\n             Ideal para: ${(e.ideal_para ?? []).join(', ')}\n`);
    if (!op.estilo && !op.estilos) console.log('Elige uno con --estilo <id>.\n');
    return;
  }
  if (!estilos.some((e) => e.id === op.estilo)) throw new Error(`No existe el estilo "${op.estilo}". Usa --estilos para verlos.`);

  let negocio;
  let sb = null;
  if (op['sin-crm']) {
    if (!op.nombre) throw new Error('Con --sin-crm tienes que poner --nombre.');
    negocio = {
      id: null,
      nombre: op.nombre,
      sector: op.sector,
      telefono: normalizarTelefono(op.telefono),
      direccion: op.direccion,
      municipio: op.municipio,
    };
  } else {
    if (!op.negocio) throw new Error('Dime de qué negocio es la demo: --negocio "nombre" (o --sin-crm).');
    sb = await conectarCRM();
    negocio = await buscarNegocio(sb, op.negocio);
    if (negocio.no_contactar) throw new Error(`${negocio.nombre} está en "no contactar" (${negocio.motivo_no_contactar}). No se le hace demo.`);
    const { data: activa } = await sb.from('demos').select('slug, estado').eq('negocio_id', negocio.id).neq('estado', 'archivada').maybeSingle();
    if (activa) throw new Error(`${negocio.nombre} ya tiene una demo: demos/${activa.slug} (${activa.estado}).`);
  }

  const marca = op.marca?.trim() || negocio.nombre;
  const slug = op.slug ?? slugify(marca);
  const { carpeta: absoluta } = await crearDemo({
    slug,
    estilo: op.estilo,
    datos: {
      marca,
      negocio: negocio.nombre,
      sector: negocio.sector,
      eslogan: op.eslogan,
      telefono: negocio.telefono ?? '',
      direccion: negocio.direccion,
      municipio: negocio.municipio,
      negocioId: negocio.id,
    },
  });

  const carpeta = relative(process.cwd(), absoluta).split('\\').join('/');
  if (sb) {
    const { error } = await sb.from('demos').insert({ negocio_id: negocio.id, slug, marca, estilo: op.estilo });
    if (error) throw new Error(`La carpeta está creada pero el CRM no la ha apuntado: ${error.message}`);
  }

  console.log(`\n✔ Demo creada en ${carpeta}`);
  console.log('  Siguientes pasos:');
  console.log('   1. Mírala: npm run ver-demos  →  http://localhost:5600/' + slug + '/');
  console.log('   2. Pon tus dibujos de la tableta en ' + carpeta + '/originales/ y ejecuta: npm run imagenes -- ' + carpeta);
  console.log('   3. Pide a Antigravity los cambios de diseño (colores, textos, secciones).');
  console.log('   4. Cuando esté lista: npm run demo:estado -- ' + slug + ' revision\n');
});
