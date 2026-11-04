// Busca negocios SIN web en un municipio y los guarda en el CRM.
//
// Uso:
//   npm run buscar -- --sector "barbería" --municipio "Algeciras"
//   npm run buscar -- --sector "panadería" --municipio "Tarifa" --fuente osm
//   npm run buscar -- --sector "bar" --municipio "San Roque" --verificar
//   npm run buscar -- --sector "bar" --municipio "San Roque" --prueba   (no guarda nada)
//
// Opciones:
//   --fuente serper|osm   serper = Google Maps (1 crédito por página). osm = OpenStreetMap (gratis).
//   --paginas N           páginas de resultados de Google Maps (por defecto 1, máximo 3).
//   --verificar           busca en Google si los mejores candidatos tienen web escondida (1 crédito cada uno, máx. 10).
//   --prueba              enseña lo que encontraría, sin guardar en el CRM.
import { parseArgs } from 'node:util';
import { cargarEntorno, ejecutar } from './lib/entorno.mjs';
import { conectarCRM } from './lib/crm.mjs';
import { buscarEnMaps, buscarWebPropia } from './lib/serper.mjs';
import { buscarEnOsm } from './lib/osm.mjs';
import { desdeSerper, desdeOsm, preparar } from './lib/negocios.mjs';
import { clasificarWeb, formatearTelefono } from '../crm/js/reglas.js';
import { AJUSTES } from '../crm/js/ajustes.js';

const CREDITOS_MAX_DIA = 40;

await ejecutar(async () => {
  const { values: op } = parseArgs({
    options: {
      sector: { type: 'string' },
      municipio: { type: 'string' },
      fuente: { type: 'string' },
      paginas: { type: 'string', default: '1' },
      verificar: { type: 'boolean', default: false },
      prueba: { type: 'boolean', default: false },
    },
  });
  if (!op.sector || !op.municipio) {
    throw new Error(
      'Dime qué buscar y dónde. Ejemplo:\n   npm run buscar -- --sector "barbería" --municipio "Algeciras"\n' +
        `   Municipios de la zona: ${AJUSTES.zona.municipios.join(', ')}`,
    );
  }
  cargarEntorno();
  const clave = process.env.SERPER_API_KEY?.trim();
  const fuente = op.fuente ?? (clave ? 'serper' : 'osm');
  if (fuente === 'serper' && !clave) throw new Error('Para buscar en Google Maps falta SERPER_API_KEY en .env.local (o usa --fuente osm).');
  const paginas = Math.min(3, Math.max(1, Number(op.paginas) || 1));

  const sb = op.prueba ? null : await conectarCRM();
  if (sb && fuente === 'serper') {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const { data } = await sb.from('busquedas').select('creditos').gte('creado_en', hoy.toISOString());
    const gastados = (data ?? []).reduce((s, b) => s + b.creditos, 0);
    if (gastados + paginas > CREDITOS_MAX_DIA) {
      throw new Error(`Hoy ya se han gastado ${gastados} créditos de Serper (tope diario ${CREDITOS_MAX_DIA}). Sigue mañana o usa --fuente osm.`);
    }
  }

  console.log(`\n🔎 Buscando "${op.sector}" en ${op.municipio} (${fuente === 'serper' ? 'Google Maps vía Serper' : 'OpenStreetMap'})...`);
  let encontrados = [];
  let creditos = 0;
  if (fuente === 'serper') {
    for (let p = 1; p <= paginas; p++) {
      const { sitios, creditos: c } = await buscarEnMaps({ consulta: op.sector, municipio: op.municipio, pagina: p, clave });
      creditos += c;
      encontrados.push(...sitios.map((s) => desdeSerper(s, { sector: op.sector, municipio: op.municipio })));
      if (sitios.length < 10) break;
    }
  } else {
    const { elementos } = await buscarEnOsm({ sector: op.sector, municipio: op.municipio });
    encontrados = elementos.map((e) => desdeOsm(e, { sector: op.sector, municipio: op.municipio }));
  }

  const descartes = {};
  const candidatos = [];
  for (const n of encontrados) {
    const { negocio, motivo } = preparar(n);
    if (motivo) descartes[motivo] = (descartes[motivo] ?? 0) + 1;
    else candidatos.push(negocio);
  }
  candidatos.sort((a, b) => b.puntuacion - a.puntuacion);

  if (op.verificar && fuente === 'serper') {
    const revisar = candidatos.slice(0, 10);
    console.log(`\n🌐 Comprobando en Google si ${revisar.length} candidatos tienen web escondida...`);
    for (const n of revisar) {
      const { url, creditos: c } = await buscarWebPropia({ nombre: n.nombre, municipio: op.municipio, clave, clasificarWeb });
      creditos += c;
      if (url) {
        n.posible_web = url;
        n.puntuacion = Math.max(0, n.puntuacion - 30);
        n.notas += `; -30 posible web encontrada en Google: ${url} (compruébalo)`;
      }
    }
    candidatos.sort((a, b) => b.puntuacion - a.puntuacion);
  }

  console.log(`\nResultados: ${encontrados.length} encontrados, ${candidatos.length} sin web propia.`);
  for (const [motivo, n] of Object.entries(descartes)) console.log(`   · ${n} descartados: ${motivo}`);
  if (candidatos.length) {
    console.table(
      candidatos.map((n) => ({
        Nombre: n.nombre.slice(0, 32),
        Teléfono: n.telefono ? `${formatearTelefono(n.telefono)} (${n.telefono_tipo})` : '—',
        Reseñas: n.num_resenas,
        Web: n.posible_web ? '¿posible?' : n.web_tipo,
        Puntos: n.puntuacion,
      })),
    );
  }

  if (!sb) {
    console.log('\nModo prueba: no he guardado nada. Quita --prueba para guardarlos en el CRM.\n');
    return;
  }

  let resumen = { insertados: 0, duplicados: 0, bloqueados: 0 };
  for (let i = 0; i < candidatos.length; i += 100) {
    const { data, error } = await sb.rpc('importar_negocios', { lista: candidatos.slice(i, i + 100) });
    if (error) throw new Error(`El CRM no ha aceptado los negocios: ${error.message}`);
    for (const k of Object.keys(resumen)) resumen[k] += data[k];
  }
  await sb.from('busquedas').insert({
    consulta: op.sector,
    municipio: op.municipio,
    fuente,
    resultados: encontrados.length,
    nuevos: resumen.insertados,
    sin_web: candidatos.length,
    creditos,
  });

  console.log(`\n✔ Guardado en el CRM: ${resumen.insertados} nuevos, ${resumen.duplicados} ya estaban, ${resumen.bloqueados} en la lista de no contactar.`);
  if (creditos) console.log(`   Créditos de Serper gastados: ${creditos}.`);
  console.log('   Siguiente paso: abre el CRM → Negocios → etapa "Nuevo" y marca como "Cualificado" los que te gusten.\n');
});
