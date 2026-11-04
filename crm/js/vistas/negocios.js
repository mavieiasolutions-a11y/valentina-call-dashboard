// Pantalla "Negocios": todos los negocios con filtros por etapa y municipio.
import { el } from '../dom.js';
import { ETAPAS } from '../reglas.js';
import { listaNegocios } from '../componentes.js';
import { dialogoNegocio } from '../dialogos.js';

export async function vistaNegocios(ctx, _parametro, consulta) {
  const filtros = {
    etapa: consulta.get('etapa') ?? '',
    municipio: consulta.get('municipio') ?? '',
    texto: consulta.get('q') ?? '',
    orden: consulta.get('orden') ?? 'puntuacion',
  };
  const [negocios, conteo] = await Promise.all([ctx.motor.listarNegocios(filtros), ctx.motor.contarPorEtapa()]);
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);

  const ir = (cambios) => {
    const p = new URLSearchParams();
    const nuevos = { ...filtros, ...cambios };
    for (const [k, v] of Object.entries({ etapa: nuevos.etapa, municipio: nuevos.municipio, q: nuevos.texto, orden: nuevos.orden })) {
      if (v && !(k === 'orden' && v === 'puntuacion')) p.set(k, v);
    }
    const q = p.toString();
    ctx.irA(`#/negocios${q ? `?${q}` : ''}`);
  };

  const buscar = el('input', { type: 'search', placeholder: 'Buscar por nombre, sector o teléfono', value: filtros.texto, 'aria-label': 'Buscar' });
  let espera;
  buscar.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => ir({ texto: buscar.value.trim() }), 400);
  });
  const municipio = el('select', { 'aria-label': 'Municipio' },
    el('option', { value: '' }, 'Todos los municipios'),
    ctx.ajustes.zona.municipios.map((m) => el('option', { value: m, selected: m === filtros.municipio }, m)));
  if (filtros.texto) {
    // Al escribir se recarga la lista: devolvemos el cursor al buscador.
    setTimeout(() => {
      buscar.focus();
      buscar.setSelectionRange(buscar.value.length, buscar.value.length);
    }, 0);
  }
  municipio.addEventListener('change', () => ir({ municipio: municipio.value }));
  const orden = el('select', { 'aria-label': 'Ordenar' },
    [['puntuacion', 'Mejor puntuación'], ['proxima', 'Próxima acción'], ['recientes', 'Más recientes']]
      .map(([v, t]) => el('option', { value: v, selected: v === filtros.orden }, t)));
  orden.addEventListener('change', () => ir({ orden: orden.value }));

  const chip = (id, texto, n) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(filtros.etapa === id), onclick: () => ir({ etapa: id }),
  }, `${texto} · ${n}`);

  return el('div', {},
    el('div', { class: 'titulo-vista' },
      el('div', {}, el('h1', {}, 'Negocios'), el('p', { class: 'subtitulo' }, `${total} en total. Los nuevos llegan desde Antigravity (/buscar-negocios).`)),
      el('button', { type: 'button', class: 'boton boton-principal', onclick: () => dialogoNegocio(ctx, null, (n) => ctx.irA(`#/negocio/${n.id}`)) }, '+ Añadir negocio'),
    ),
    el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por etapa' },
      chip('', 'Todos', total),
      ETAPAS.map((e) => chip(e.id, e.nombre, conteo[e.id] ?? 0))),
    el('div', { class: 'filtros' }, buscar, municipio, orden),
    listaNegocios(negocios, {}, filtros.etapa || filtros.texto || filtros.municipio
      ? 'Ningún negocio con esos filtros.'
      : 'Aún no hay negocios. Pídele a Antigravity: /buscar-negocios barberías en Algeciras'),
    negocios.length >= 500 ? el('p', { class: 'texto-suave texto-peq' }, 'Se muestran los 500 primeros. Usa los filtros para afinar.') : null,
  );
}
