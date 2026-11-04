// Pantalla "Cifras": cómo va el embudo y el trabajo de las últimas semanas.
import { el, fechaCorta } from '../dom.js';
import { ETAPAS } from '../reglas.js';
import { indicador, seccion } from '../componentes.js';

const CREDITOS_SERPER_GRATIS = 2500;

export async function vistaEstadisticas(ctx) {
  const hace30 = new Date(Date.now() - 30 * 86400000);
  const [conteo, actividades, busquedas] = await Promise.all([
    ctx.motor.contarPorEtapa(),
    ctx.motor.actividadesDesde(hace30),
    ctx.motor.listarBusquedas(200),
  ]);
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);
  const contactados = ['contactado', 'respondio', 'interesado', 'cliente'].reduce((s, e) => s + (conteo[e] ?? 0), 0);
  const respondieron = ['respondio', 'interesado', 'cliente'].reduce((s, e) => s + (conteo[e] ?? 0), 0);
  const tasa = contactados ? Math.round((respondieron / contactados) * 100) : 0;
  const enviados30 = actividades.filter((a) => a.tipo === 'whatsapp' && a.resultado === 'enviado').length;
  const llamadas30 = actividades.filter((a) => a.tipo === 'llamada').length;
  const creditos = busquedas.reduce((s, b) => s + (b.creditos ?? 0), 0);

  // Embudo: una sola serie (cuántos negocios hay en cada etapa), barras horizontales.
  const maximo = Math.max(1, ...ETAPAS.map((e) => conteo[e.id] ?? 0));
  const embudo = el('ol', { class: 'embudo', 'aria-label': 'Negocios por etapa' }, ETAPAS.map((e) => {
    const n = conteo[e.id] ?? 0;
    const barra = el('span', { class: 'embudo-barra', title: `${e.nombre}: ${n}` });
    barra.style.width = `${(n / maximo) * 100}%`;
    return el('li', {},
      el('span', { class: 'embudo-etiqueta' }, e.nombre),
      el('span', { class: 'embudo-pista' }, barra, el('span', { class: 'embudo-valor' }, n)));
  }));

  // Actividad por día (últimos 14 días) como tabla: se lee mejor que un gráfico con pocos datos.
  const dias = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    dias.push(d);
  }
  const filas = dias.map((d) => {
    const fin = new Date(d.getTime() + 86400000);
    const delDia = actividades.filter((a) => new Date(a.creado_en) >= d && new Date(a.creado_en) < fin);
    return {
      dia: d,
      llamadas: delDia.filter((a) => a.tipo === 'llamada').length,
      whatsapp: delDia.filter((a) => a.tipo === 'whatsapp' && a.resultado === 'enviado').length,
      respuestas: delDia.filter((a) => ['respondio', 'interesado', 'acepta_whatsapp'].includes(a.resultado)).length,
    };
  }).filter((f) => f.llamadas || f.whatsapp || f.respuestas);

  return el('div', {},
    el('div', { class: 'titulo-vista' }, el('div', {}, el('h1', {}, 'Cifras'), el('p', { class: 'subtitulo' }, 'Cómo va el trabajo.'))),
    el('div', { class: 'indicadores' },
      indicador('Negocios en el CRM', String(total)),
      indicador('Contactados', String(contactados)),
      indicador('Tasa de respuesta', `${tasa}%`, 'De los contactados, cuántos han respondido'),
      indicador('Clientes', String(conteo.cliente ?? 0)),
      indicador('WhatsApp (30 días)', String(enviados30)),
      indicador('Llamadas (30 días)', String(llamadas30)),
    ),
    el('div', { class: 'rejilla rejilla-2' },
      seccion('Embudo', null, embudo),
      seccion('Actividad (14 días)', null,
        filas.length
          ? el('div', { class: 'tabla-envoltura' }, el('table', {},
            el('thead', {}, el('tr', {}, el('th', {}, 'Día'), el('th', { class: 'numero' }, 'Llamadas'), el('th', { class: 'numero' }, 'WhatsApp'), el('th', { class: 'numero' }, 'Respuestas'))),
            el('tbody', {}, filas.map((f) => el('tr', {},
              el('td', {}, f.dia.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })),
              el('td', { class: 'numero' }, f.llamadas), el('td', { class: 'numero' }, f.whatsapp), el('td', { class: 'numero' }, f.respuestas))))))
          : el('p', { class: 'vacio' }, 'Sin actividad en los últimos 14 días.')),
    ),
    seccion('Búsquedas y créditos de Serper', null,
      el('p', { class: 'texto-suave texto-peq' }, `Gastados: ${creditos} de ${CREDITOS_SERPER_GRATIS} gratis (aprox.). Mira el saldo real en serper.dev.`),
      busquedas.length
        ? el('div', { class: 'tabla-envoltura' }, el('table', {},
          el('thead', {}, el('tr', {}, el('th', {}, 'Fecha'), el('th', {}, 'Búsqueda'), el('th', {}, 'Fuente'),
            el('th', { class: 'numero' }, 'Sin web'), el('th', { class: 'numero' }, 'Nuevos'), el('th', { class: 'numero' }, 'Créditos'))),
          el('tbody', {}, busquedas.slice(0, 30).map((b) => el('tr', {},
            el('td', {}, fechaCorta(b.creado_en)), el('td', {}, `${b.consulta} · ${b.municipio}`), el('td', {}, b.fuente),
            el('td', { class: 'numero' }, b.sin_web), el('td', { class: 'numero' }, b.nuevos), el('td', { class: 'numero' }, b.creditos))))))
        : el('p', { class: 'vacio' }, 'Aún no hay búsquedas.')),
  );
}
