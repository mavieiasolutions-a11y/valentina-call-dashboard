// Resumen de lo que toca hoy en el CRM (para la skill /plan-del-dia).
// Uso: npm run hoy
import { ejecutar } from './lib/entorno.mjs';
import { conectarCRM } from './lib/crm.mjs';
import { estadoHorario, formatearTelefono, tipoTelefono, nombreEtapa } from '../crm/js/reglas.js';

await ejecutar(async () => {
  const sb = await conectarCRM();
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  const [pendientes, listos, enviados, demos] = await Promise.all([
    sb.from('negocios').select('id, nombre, telefono, etapa, proxima_accion_en, proxima_accion')
      .lte('proxima_accion_en', fin.toISOString()).eq('no_contactar', false).order('proxima_accion_en').limit(50),
    sb.from('negocios').select('id, nombre, telefono').eq('etapa', 'demo_lista').eq('no_contactar', false).limit(50),
    sb.from('actividades').select('negocio_id').eq('tipo', 'whatsapp').eq('resultado', 'enviado').limit(5000),
    sb.from('demos').select('slug, estado, marca').in('estado', ['diseno', 'revision']).limit(50),
  ]);
  for (const r of [pendientes, listos, enviados, demos]) if (r.error) throw new Error(r.error.message);

  const h = estadoHorario(new Date());
  console.log(`\n${h.dentro ? '🟢 Ahora es horario comercial.' : `🟠 ${h.motivo} Siguiente franja: ${h.siguiente}.`}\n`);

  console.log(`📋 Tareas de hoy o atrasadas (${pendientes.data.length}):`);
  for (const n of pendientes.data) {
    const cuando = new Date(n.proxima_accion_en).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    console.log(`   - ${n.nombre} (${nombreEtapa(n.etapa)}) · ${cuando} · ${n.proxima_accion || 'sin detalle'}`);
  }

  const yaEnviados = new Set(enviados.data.map((a) => a.negocio_id));
  const paraEnviar = listos.data.filter((n) => !yaEnviados.has(n.id));
  console.log(`\n💬 Demos aprobadas listas para enviar (${paraEnviar.length}):`);
  for (const n of paraEnviar) {
    console.log(`   - ${n.nombre} · ${formatearTelefono(n.telefono)} (${tipoTelefono(n.telefono) === 'movil' ? 'WhatsApp' : 'llamar'})`);
  }

  console.log(`\n🎨 Demos en diseño o revisión (${demos.data.length}):`);
  for (const d of demos.data) console.log(`   - ${d.marca || d.slug} → ${d.estado === 'diseno' ? 'en diseño' : 'esperando a Miguel'}`);
  console.log('');
});
