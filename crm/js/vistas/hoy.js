// Pantalla "Hoy": qué toca hacer ahora mismo.
import { el, finDeHoy, inicioDeHoy } from '../dom.js';
import { estadoHorario, tipoTelefono } from '../reglas.js';
import { indicador, listaNegocios, seccion, filaNegocio } from '../componentes.js';

export async function vistaHoy(ctx) {
  const { motor, ajustes } = ctx;
  const hace30 = new Date(Date.now() - 30 * 86400000);
  const [pendientes, listos, actividades, demosRevision, conteo] = await Promise.all([
    motor.pendientes(finDeHoy()),
    motor.listarNegocios({ etapa: 'demo_lista' }),
    motor.actividadesDesde(hace30),
    motor.listarDemos({ estado: 'revision' }),
    motor.contarPorEtapa(),
  ]);

  const yo = ctx.usuario();
  const desdeHoy = inicioDeHoy();
  const deHoy = actividades.filter((a) => new Date(a.creado_en) >= desdeHoy);
  const frioHoy = deHoy.filter((a) => a.tipo === 'whatsapp' && a.resultado === 'enviado' && a.modo === 'frio' && a.creado_por === yo.id).length;
  const llamadasHoy = deHoy.filter((a) => a.tipo === 'llamada').length;
  const semana = new Date(Date.now() - 7 * 86400000);
  const respuestasSemana = actividades.filter((a) => new Date(a.creado_en) >= semana
    && ['respondio', 'interesado', 'acepta_whatsapp'].includes(a.resultado)).length;

  // Listos para enviar: demo aprobada, móvil y aún sin WhatsApp.
  const conWhatsApp = new Set(actividades.filter((a) => a.tipo === 'whatsapp' && a.resultado === 'enviado').map((a) => a.negocio_id));
  const paraEnviar = listos.filter((n) => !n.no_contactar && !conWhatsApp.has(n.id));
  const paraEnviarMovil = paraEnviar.filter((n) => tipoTelefono(n.telefono) === 'movil');
  const paraLlamar = paraEnviar.filter((n) => tipoTelefono(n.telefono) !== 'movil');

  const horario = estadoHorario(new Date(), ajustes, ctx.festivos);
  const saludo = new Date().getHours() < 14 ? 'Buenos días' : 'Buenas tardes';

  return el('div', {},
    el('div', { class: 'titulo-vista' },
      el('div', {},
        el('h1', {}, `${saludo}, ${yo.nombre.split(' ')[0]}`),
        el('p', { class: 'subtitulo' }, new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))),
      el('a', { class: 'boton', href: '#/negocios?etapa=nuevo' }, `Revisar nuevos (${conteo.nuevo ?? 0})`),
    ),
    el('div', { class: `horario ${horario.dentro ? 'horario-dentro' : 'horario-fuera'}`, role: 'status' },
      horario.dentro
        ? '● Buen momento para llamar y escribir a negocios.'
        : `● ${horario.motivo} Siguiente franja: ${horario.siguiente || 'el próximo día laborable'}. Aprovecha para diseñar demos.`),
    el('div', { class: 'indicadores' },
      indicador('Primeros WhatsApp hoy', `${frioHoy} / ${ajustes.limites.whatsappFrioPorDia}`, 'Límite diario para no saturar'),
      indicador('Llamadas hoy', String(llamadasHoy)),
      indicador('Respuestas (7 días)', String(respuestasSemana)),
      indicador('Demos en revisión', String(demosRevision.length), ctx.esAdmin() ? 'Te toca revisarlas' : 'Esperando a Miguel'),
    ),
    el('div', { class: 'rejilla rejilla-2' },
      seccion('Tareas de hoy', pendientes.length,
        el('p', { class: 'texto-suave texto-peq' }, 'Llamadas, seguimientos y recordatorios con fecha de hoy o atrasados (en rojo).'),
        listaNegocios(pendientes, {}, 'Nada pendiente. ¡Bien!')),
      seccion('Listos para enviar la demo', paraEnviarMovil.length,
        el('p', { class: 'texto-suave texto-peq' }, 'Demo aprobada y aún sin primer WhatsApp. Ábrelos y pulsa "WhatsApp".'),
        listaNegocios(paraEnviarMovil, { mostrarProxima: false }, 'No hay demos listas pendientes de enviar.'),
        paraLlamar.length
          ? el('div', {}, el('h3', {}, 'Sin móvil: mejor llamar'), el('ul', { class: 'lista' }, paraLlamar.map((n) => filaNegocio(n, { mostrarProxima: false }))))
          : null),
    ),
    demosRevision.length
      ? seccion(ctx.esAdmin() ? 'Demos para revisar' : 'Demos esperando revisión', demosRevision.length,
        el('ul', { class: 'lista' }, demosRevision.map((d) => el('li', {},
          el('a', { class: 'fila', href: `#/negocio/${encodeURIComponent(d.negocio_id)}` },
            el('span', { class: 'fila-titulo' }, d.marca || d.slug),
            el('span', { class: 'etiqueta etapa-en_diseno' }, 'En revisión'),
            el('span', { class: 'fila-detalle' }, d.negocio?.nombre ?? '', ' · ', d.negocio?.municipio ?? ''))))))
      : null,
  );
}
