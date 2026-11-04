// Festivos: se combinan los de crm/js/ajustes.js con los de la API pública
// date.nager.at (gratis, sin clave). Se guardan en el navegador un día para
// no preguntar cada vez. Si la API no responde, se usan solo los de ajustes.
import { AJUSTES } from './ajustes.js';

const CLAVE = 'crm-festivos-v1';

export async function cargarFestivos() {
  const anio = new Date().getFullYear();
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (guardado?.anio === anio && Date.now() - guardado.cuando < 86400000) return guardado.fechas;
  } catch {
    /* sin localStorage */
  }
  try {
    const respuestas = await Promise.all(
      [anio, anio + 1].map((a) => fetch(`https://date.nager.at/api/v3/PublicHolidays/${a}/ES`).then((r) => (r.ok ? r.json() : []))),
    );
    const fechas = respuestas.flat()
      .filter((f) => !f.counties || f.counties.includes(AJUSTES.regionFestivos))
      .map((f) => f.date);
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ anio, cuando: Date.now(), fechas }));
    } catch {
      /* sin localStorage */
    }
    return fechas;
  } catch {
    return [];
  }
}
