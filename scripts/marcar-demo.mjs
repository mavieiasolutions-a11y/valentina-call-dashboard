// Cambia el estado de una demo en el CRM.
//
// Uso:
//   npm run demo:estado -- <slug> revision     (lista para que Miguel la revise)
//   npm run demo:estado -- <slug> publicada    (ya está en internet; comprueba que carga)
//   npm run demo:estado -- <slug> diseno       (vuelve a diseño para hacer cambios)
//
// La APROBACIÓN no se hace aquí: la hace Miguel en el CRM (pestaña Demos).
import { existsSync } from 'node:fs';
import { ejecutar } from './lib/entorno.mjs';
import { conectarCRM } from './lib/crm.mjs';
import { AJUSTES } from '../crm/js/ajustes.js';

const PERMITIDOS = ['diseno', 'revision', 'publicada', 'archivada'];

await ejecutar(async () => {
  const [slug, estado, urlManual] = process.argv.slice(2);
  if (!slug || !estado) throw new Error('Uso: npm run demo:estado -- <slug> <revision|publicada|diseno|archivada>');
  if (estado === 'aprobada') throw new Error('Las demos las aprueba Miguel desde el CRM (pestaña Demos), no un script.');
  if (!PERMITIDOS.includes(estado)) throw new Error(`Estado no válido. Usa uno de: ${PERMITIDOS.join(', ')}.`);
  if (estado !== 'archivada' && !existsSync(`demos/${slug}/index.html`)) throw new Error(`No existe demos/${slug}/index.html.`);

  const sb = await conectarCRM();
  const cambios = { estado };
  if (estado === 'publicada') {
    const url = urlManual ?? `${AJUSTES.demos.urlBase.replace(/\/$/, '')}/${slug}/`;
    const r = await fetch(url, { redirect: 'follow' }).catch(() => null);
    if (!r?.ok) {
      throw new Error(
        `La dirección ${url} todavía no carga (${r ? r.status : 'sin conexión'}). ` +
          '¿Se ha aceptado ya el Pull Request en GitHub? Cloudflare tarda 1-2 minutos en publicar.',
      );
    }
    cambios.url = url;
  }
  const { data, error } = await sb.from('demos').update(cambios).eq('slug', slug).select('slug, estado, url');
  if (error) throw new Error(`El CRM no lo ha aceptado: ${error.message}`);
  if (!data.length) throw new Error(`No hay ninguna demo "${slug}" en el CRM.`);
  console.log(`\n✔ ${slug} → ${estado}${cambios.url ? ` (${cambios.url})` : ''}\n`);
  if (estado === 'revision') console.log('  Ahora sube la rama a GitHub y abre el Pull Request: Miguel la revisará y la aprobará en el CRM.\n');
});
