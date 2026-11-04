// Comprueba que cada API está bien configurada y explica qué es cada una.
// Uso: npm run probar-apis            (no gasta créditos)
//      npm run probar-apis -- --serper  (hace 1 búsqueda real: gasta 1 crédito)
import { cargarEntorno } from './lib/entorno.mjs';
import { conectarCRM } from './lib/crm.mjs';
import { buscarEnMaps } from './lib/serper.mjs';

cargarEntorno();
const gastarSerper = process.argv.includes('--serper');
let fallos = 0;

async function probar(nombre, explicacion, prueba) {
  console.log(`\n■ ${nombre}\n  ${explicacion}`);
  try {
    const resultado = await prueba();
    console.log(`  ✔ ${resultado}`);
  } catch (e) {
    fallos++;
    console.log(`  ✖ ${e.message}`);
  }
}

await probar(
  'Festivos (date.nager.at)',
  'API pública y gratuita, SIN clave: cualquiera puede preguntarle. El CRM la usa para no llamar en festivo.',
  async () => {
    const anio = new Date().getFullYear();
    const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${anio}/ES`);
    if (!r.ok) throw new Error(`respondió ${r.status}`);
    const festivos = await r.json();
    const andalucia = festivos.filter((f) => !f.counties || f.counties.includes('ES-AN'));
    return `responde: ${andalucia.length} festivos en Andalucía en ${anio}. Ejemplo de respuesta: ${JSON.stringify(andalucia[0])}`;
  },
);

await probar(
  'Supabase (tu base de datos)',
  'API con clave PÚBLICA + usuario y contraseña. Lo que puede hacer cada usuario lo decide la base de datos (RLS).',
  async () => {
    const sb = await conectarCRM();
    const { count, error } = await sb.from('negocios').select('*', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return `conectado con la cuenta del agente. Hay ${count} negocios en el CRM.`;
  },
);

await probar(
  'Serper (Google Maps)',
  'API con clave SECRETA (SERPER_API_KEY): quien la tenga gasta tus créditos. Por eso vive solo en .env.local.',
  async () => {
    const clave = process.env.SERPER_API_KEY?.trim();
    if (!clave) throw new Error('no hay SERPER_API_KEY en .env.local (se usará OpenStreetMap, que es gratis).');
    if (!gastarSerper) return 'clave configurada. Para probarla de verdad (gasta 1 crédito): npm run probar-apis -- --serper';
    const { sitios } = await buscarEnMaps({ consulta: 'panadería', municipio: 'Algeciras', clave });
    return `funciona: ${sitios.length} resultados. El primero: ${sitios[0]?.title ?? '—'}`;
  },
);

console.log(fallos ? `\n${fallos} API(s) con problemas. Mira docs/03-aprende-apis.md\n` : '\nTodo listo.\n');
process.exitCode = fallos ? 1 : 0;
