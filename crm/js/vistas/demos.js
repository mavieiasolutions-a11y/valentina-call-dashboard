// Pantalla "Demos": todas las webs de muestra y en qué estado están.
import { el } from '../dom.js';
import { ESTADOS_DEMO, etiquetaDemo, cuando } from '../componentes.js';

export async function vistaDemos(ctx, _parametro, consulta) {
  const estado = consulta.get('estado') ?? '';
  const [demos, todas] = await Promise.all([ctx.motor.listarDemos({ estado }), estado ? ctx.motor.listarDemos() : null]);
  const lista = todas ?? demos;
  const cuenta = (id) => lista.filter((d) => d.estado === id).length;

  const chip = (id, texto, n) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(estado === id),
    onclick: () => ctx.irA(id ? `#/demos?estado=${id}` : '#/demos'),
  }, `${texto} · ${n}`);

  return el('div', {},
    el('div', { class: 'titulo-vista' },
      el('div', {}, el('h1', {}, 'Demos'),
        el('p', { class: 'subtitulo' }, 'Diseño → Revisión (Miguel) → Aprobada → Publicada. Nada se envía sin aprobar.'))),
    el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por estado' },
      chip('', 'Todas', lista.length),
      ESTADOS_DEMO.map((e) => chip(e.id, e.nombre, cuenta(e.id)))),
    demos.length
      ? el('ul', { class: 'lista' }, demos.map((d) => el('li', {},
        el('a', { class: 'fila', href: `#/negocio/${encodeURIComponent(d.negocio_id)}` },
          el('span', { class: 'fila-titulo' }, d.marca || d.slug),
          etiquetaDemo(d.estado),
          el('span', { class: 'fila-detalle' },
            el('span', {}, d.negocio?.nombre ?? '—'),
            el('span', {}, d.negocio?.municipio ?? ''),
            el('span', {}, `demos/${d.slug}`),
            el('span', {}, 'Actualizada ', cuando(d.actualizado_en)),
            d.notas_revision ? el('span', { class: 'consejo' }, '⚠ Tiene cambios pedidos') : null)))))
      : el('p', { class: 'vacio' }, 'No hay demos aquí. Se crean desde Antigravity con /nueva-demo.'),
  );
}
