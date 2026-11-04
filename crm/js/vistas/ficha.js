// Ficha de un negocio: datos, demo, acciones (llamar, WhatsApp...) e historial.
import { el, avisar, botonAccion, enlaceFuera, fechaHora } from '../dom.js';
import { formatearTelefono, nombreResultado, tipoTelefono, puntuarNegocio, slugify } from '../reglas.js';
import { etiquetaEtapa, seccion, cuando, comprobarCarga, copiar, etiquetaDemo, bloqueComando } from '../componentes.js';
import {
  dialogoLlamada, dialogoWhatsApp, dialogoRespuesta, dialogoNota, dialogoEtapa, dialogoBaja, dialogoNegocio,
} from '../dialogos.js';

const ICONOS = { llamada: '📞', whatsapp: '💬', visita: '🚶', email: '✉️', nota: '📝', sistema: '⚙️' };
const TIPO_WEB = { sin_web: 'Sin web', redes: 'Solo redes sociales', directorio: 'Solo en directorios', propia: 'Tiene web propia' };

export async function vistaFicha(ctx, id) {
  const negocio = await ctx.motor.obtenerNegocio(id);
  if (!negocio) {
    return el('div', { class: 'tarjeta' }, el('h1', {}, 'No encuentro este negocio'), el('a', { href: '#/negocios' }, 'Volver a negocios'));
  }
  const [actividades, demo] = await Promise.all([ctx.motor.listarActividades(id), ctx.motor.demoDeNegocio(id)]);
  const datos = { negocio, actividades, demo };
  const recargar = () => ctx.recargar();

  const trasLlamada = async ({ resultado }) => {
    if (resultado === 'acepta_whatsapp' && demo && ['aprobada', 'publicada'].includes(demo.estado)) {
      const actualizado = await ctx.motor.obtenerNegocio(id);
      const acts = await ctx.motor.listarActividades(id);
      await dialogoWhatsApp(ctx, { negocio: actualizado, actividades: acts, demo }, recargar, { clavePreferida: 'whatsapp_tras_llamada' });
    }
    await recargar();
  };

  const esMovil = tipoTelefono(negocio.telefono) === 'movil';
  const acciones = el('div', { class: 'acciones ficha-acciones' },
    el('button', { type: 'button', class: 'boton boton-principal', disabled: !negocio.telefono || negocio.no_contactar,
      onclick: () => dialogoLlamada(ctx, datos, trasLlamada) }, '📞 Llamar'),
    el('button', { type: 'button', class: 'boton boton-whatsapp', disabled: !esMovil || negocio.no_contactar,
      title: esMovil ? '' : 'Solo para móviles', onclick: () => dialogoWhatsApp(ctx, datos, recargar) }, '💬 WhatsApp'),
    el('button', { type: 'button', class: 'boton', onclick: () => dialogoRespuesta(ctx, datos, recargar) }, '↩︎ Respuesta'),
    el('button', { type: 'button', class: 'boton', onclick: () => dialogoNota(ctx, datos, recargar) }, '📝 Nota'),
    el('button', { type: 'button', class: 'boton', disabled: negocio.etapa === 'baja', onclick: () => dialogoEtapa(ctx, datos, recargar) }, 'Etapa'),
    negocio.etapa !== 'baja'
      ? el('button', { type: 'button', class: 'boton boton-peligro', onclick: () => dialogoBaja(ctx, datos, recargar) }, 'Baja')
      : null,
  );

  const alertas = [];
  if (negocio.no_contactar) alertas.push(el('div', { class: 'alerta alerta-peligro', role: 'alert' }, `⛔ No contactar: ${negocio.motivo_no_contactar || 'en la lista de no contactar'}.`));
  if (negocio.posible_web) {
    alertas.push(el('div', { class: 'alerta alerta-atencion' },
      'Google muestra una posible web: ', enlaceFuera(negocio.posible_web, negocio.posible_web),
      '. Ábrela: si de verdad es suya, cambia la etapa a "Descartado".'));
  }
  if (negocio.sanitario) alertas.push(el('div', { class: 'alerta alerta-atencion' }, 'Negocio sanitario: la publicidad tiene normas especiales. Revisa la demo con Miguel antes de enviarla.'));

  const { razones } = puntuarNegocio(negocio, ctx.ajustes);

  const fichaDatos = seccion('Datos', null,
    el('dl', { class: 'datos' },
      el('dt', {}, 'Teléfono'),
      el('dd', {}, negocio.telefono
        ? [el('a', { href: `tel:${negocio.telefono}` }, formatearTelefono(negocio.telefono)), ` (${negocio.telefono_tipo === 'movil' ? 'móvil' : negocio.telefono_tipo})`]
        : '—'),
      el('dt', {}, 'Dirección'),
      el('dd', {}, negocio.direccion || negocio.municipio || '—', negocio.maps_url ? [' · ', enlaceFuera(negocio.maps_url, 'Ver en Maps')] : null),
      el('dt', {}, 'Web'),
      el('dd', {}, TIPO_WEB[negocio.web_tipo] ?? negocio.web_tipo, negocio.web ? [' · ', enlaceFuera(negocio.web, 'abrir')] : null),
      el('dt', {}, 'Reseñas'),
      el('dd', {}, negocio.num_resenas ? `${negocio.num_resenas} (${negocio.valoracion ?? '—'} ★)` : '—'),
      el('dt', {}, 'Puntuación'),
      el('dd', {}, el('details', {}, el('summary', {}, `${negocio.puntuacion} / 100`), el('ul', { class: 'texto-peq' }, razones.map((r) => el('li', {}, r))))),
      el('dt', {}, 'Próxima acción'),
      el('dd', {}, negocio.proxima_accion_en ? `${fechaHora(negocio.proxima_accion_en)} · ${negocio.proxima_accion || 'sin detalle'}` : 'Ninguna'),
      el('dt', {}, 'Origen'),
      el('dd', {}, { serper: 'Google Maps', osm: 'OpenStreetMap', manual: 'A mano', harvey: 'Harvey' }[negocio.fuente] ?? negocio.fuente),
    ),
    negocio.notas ? el('p', { class: 'historial-texto' }, negocio.notas) : null,
    el('button', { type: 'button', class: 'boton boton-peq', onclick: () => dialogoNegocio(ctx, negocio, recargar) }, 'Editar datos'),
  );

  return el('div', {},
    el('a', { class: 'volver', href: '#/negocios' }, '← Negocios'),
    el('div', { class: 'ficha-cabecera' },
      el('div', {},
        el('h1', {}, negocio.nombre),
        el('p', { class: 'subtitulo' }, etiquetaEtapa(negocio.etapa), ' ', [negocio.sector, negocio.municipio].filter(Boolean).join(' · '))),
    ),
    alertas,
    acciones,
    el('div', { class: 'rejilla rejilla-2', role: 'presentation' },
      el('div', {}, fichaDatos),
      el('div', {}, tarjetaDemo(ctx, negocio, demo, recargar)),
    ),
    seccion('Historial', actividades.length,
      actividades.length
        ? el('ol', { class: 'historial' }, actividades.map((a) => el('li', {},
          el('span', { class: 'historial-icono', 'aria-hidden': 'true' }, ICONOS[a.tipo] ?? '•'),
          el('div', {},
            el('strong', {}, a.tipo === 'nota' ? 'Nota' : `${a.tipo[0].toUpperCase()}${a.tipo.slice(1)}: ${nombreResultado(a.tipo, a.resultado)}`),
            a.modo ? el('span', { class: 'texto-suave texto-peq' }, ` (${a.modo})`) : null,
            ' · ', el('span', { class: 'texto-suave texto-peq' }, cuando(a.creado_en)),
            a.detalle ? el('p', { class: 'historial-texto' }, a.detalle) : null))))
        : el('p', { class: 'vacio' }, 'Todavía no hay nada. Empieza llamando o creando su demo.')),
  );
}

function tarjetaDemo(ctx, negocio, demo, recargar) {
  if (!demo) {
    const marca = negocio.nombre;
    return seccion('Demo', null,
      el('p', {}, 'Aún no tiene demo.'),
      el('p', { class: 'texto-peq' }, 'En Antigravity, escribe:'),
      bloqueComando(`/nueva-demo ${negocio.nombre}`, avisar),
      el('details', {}, el('summary', { class: 'texto-peq' }, 'O con el comando directo'),
        bloqueComando(`npm run demo:nueva -- --negocio "${negocio.id}" --estilo clasico --marca "${marca}" --slug ${slugify(marca)}`, avisar)),
    );
  }

  const estadoCarga = el('span', { class: 'texto-peq' });
  const partes = [
    el('p', {}, el('strong', {}, demo.marca || demo.slug), ' ', etiquetaDemo(demo.estado)),
    el('p', { class: 'texto-suave texto-peq' }, `Carpeta: demos/${demo.slug} · Estilo: ${demo.estilo || '—'}`),
  ];
  if (demo.url) {
    partes.push(el('div', { class: 'acciones' },
      enlaceFuera(demo.url, el('span', { class: 'boton boton-peq' }, 'Abrir demo')),
      el('button', { type: 'button', class: 'boton boton-peq', onclick: () => copiar(demo.url, avisar) }, 'Copiar enlace'),
      el('button', { type: 'button', class: 'boton boton-peq', onclick: async () => {
        estadoCarga.textContent = 'Comprobando…';
        const ok = await comprobarCarga(demo.url);
        estadoCarga.textContent = ok ? '✔ Carga bien desde aquí.' : '✖ No carga desde esta conexión ahora mismo.';
      } }, 'Comprobar que carga'),
      estadoCarga));
  }
  if (demo.notas_revision) partes.push(el('div', { class: 'alerta alerta-atencion' }, el('strong', {}, 'Cambios pedidos: '), demo.notas_revision));

  if (demo.estado === 'diseno') {
    partes.push(el('p', { class: 'texto-peq' }, 'Cuando esté lista, en Antigravity: ', el('code', {}, `/publicar-demo ${demo.slug}`)));
  }
  if (demo.estado === 'revision') {
    const previa = el('input', { type: 'url', id: 'url-previa', placeholder: 'https://...pages.dev/', value: demo.url });
    partes.push(
      el('div', { class: 'campo' }, el('label', { for: 'url-previa' }, 'Enlace de vista previa (lo da Cloudflare en el Pull Request)'), previa),
      botonAccion('Guardar enlace', async () => {
        await ctx.motor.actualizarDemo(demo.id, { url: previa.value.trim() });
        avisar('Enlace guardado.');
        await recargar();
      }, 'boton boton-peq'),
    );
    if (ctx.esAdmin()) {
      const notas = el('textarea', { id: 'notas-revision', maxlength: 2000, placeholder: 'Qué hay que cambiar (si pides cambios)' });
      partes.push(
        el('h3', {}, 'Revisión de Miguel'),
        el('div', { class: 'campo' }, el('label', { for: 'notas-revision' }, 'Comentarios'), notas),
        el('div', { class: 'acciones' },
          botonAccion('✔ Aprobar', async () => {
            await ctx.motor.actualizarDemo(demo.id, { estado: 'aprobada', notas_revision: '' });
            avisar('Demo aprobada. Ya se puede enviar.');
            await recargar();
          }),
          botonAccion('Pedir cambios', async () => {
            if (!notas.value.trim()) throw new Error('Escribe qué hay que cambiar.');
            await ctx.motor.actualizarDemo(demo.id, { estado: 'diseno', notas_revision: notas.value.trim() });
            avisar('Devuelta a diseño con tus comentarios.');
            await recargar();
          }, 'boton')),
      );
    } else {
      partes.push(el('p', { class: 'texto-suave texto-peq' }, 'Esperando a que Miguel la revise y la apruebe.'));
    }
  }
  if (demo.estado === 'aprobada') {
    partes.push(el('p', { class: 'texto-peq' }, 'Aprobada. Cuando el Pull Request esté aceptado, en Antigravity: ', el('code', {}, `/publicar-demo ${demo.slug}`)));
  }
  return seccion('Demo', null, partes);
}
