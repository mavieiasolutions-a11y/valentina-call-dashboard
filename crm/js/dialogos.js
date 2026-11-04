// Ventanas para registrar llamadas, preparar WhatsApp, notas y negocios.
import { el, abrirDialogo, avisar, botonAccion, aInputFecha, inicioDeHoy } from './dom.js';
import {
  RESULTADOS,
  ETAPAS,
  puedeContactar,
  rellenarPlantilla,
  validarMensaje,
  enlaceWhatsApp,
  enlaceTelefono,
  formatearTelefono,
  normalizarTelefono,
  tipoTelefono,
  clasificarWeb,
  puntuarNegocio,
  esSanitario,
  esInstagram,
} from './reglas.js';
import { comprobarCarga } from './componentes.js';

export function valoresPlantilla(ctx, negocio, demo) {
  return {
    negocio: negocio.nombre,
    demo_url: demo?.url ?? '',
    remitente: ctx.usuario()?.nombre?.split(' ')[0] || ctx.ajustes.remitente,
    empresa: ctx.ajustes.empresa.nombre,
    identificacion: ctx.ajustes.empresa.identificacion,
    municipio: negocio.municipio || ctx.ajustes.zona.nombre,
  };
}

function listaMensajes(titulo, lista, clase) {
  if (!lista.length) return null;
  return el('div', { class: `alerta ${clase}` }, el('strong', {}, titulo), el('ul', {}, lista.map((m) => el('li', {}, m))));
}

function manana(hora = 10, minutos = 30) {
  const d = inicioDeHoy();
  d.setDate(d.getDate() + 1);
  d.setHours(hora, minutos);
  return d;
}

// ---------------------------------------------------------------------------
// Llamada
// ---------------------------------------------------------------------------

export function dialogoLlamada(ctx, { negocio, actividades, demo }, alGuardar) {
  const permiso = puedeContactar({ negocio, canal: 'llamada', actividades, demo, festivos: ctx.festivos, ajustes: ctx.ajustes });
  const guion = ctx.plantillas.find((p) => p.clave === 'guion_llamada');
  const { texto: guionTexto } = rellenarPlantilla(guion?.texto ?? '', valoresPlantilla(ctx, negocio, demo));

  abrirDialogo(`Llamar a ${negocio.nombre}`, (cerrar) => {
    if (negocio.no_contactar) {
      return [listaMensajes('No se puede llamar', permiso.motivos, 'alerta-peligro')];
    }
    const proxima = el('input', { id: 'proxima', type: 'datetime-local' });
    const proximaTexto = el('input', { id: 'proxima-texto', type: 'text', maxlength: 300, placeholder: 'Ej.: Llamar después de comer' });
    const notas = el('textarea', { id: 'notas-llamada', maxlength: 4000, placeholder: 'Qué te ha dicho, con quién has hablado...' });
    const opciones = RESULTADOS.llamada.map((r) =>
      el('label', { class: 'opcion' }, el('input', { type: 'radio', name: 'resultado', value: r.id }), r.nombre));

    const grupo = el('fieldset', { class: 'opciones' }, el('legend', {}, '¿Cómo ha ido?'), opciones);
    grupo.addEventListener('change', () => {
      const r = grupo.querySelector('input:checked')?.value;
      if (r === 'no_contesta' || r === 'buzon') {
        proxima.value = aInputFecha(manana(10, 30));
        proximaTexto.value = 'Volver a llamar';
      } else if (r === 'volver_a_llamar') {
        proxima.value = '';
        proximaTexto.value = 'Volver a llamar';
        proxima.focus();
      } else if (r === 'acepta_whatsapp') {
        proxima.value = '';
        proximaTexto.value = '';
      } else if (r === 'interesado') {
        proxima.value = aInputFecha(manana(11, 0));
        proximaTexto.value = 'Concretar cita para enseñar la propuesta';
      } else {
        proxima.value = '';
        proximaTexto.value = '';
      }
    });

    const guardar = botonAccion('Guardar llamada', async () => {
      const resultado = grupo.querySelector('input:checked')?.value;
      if (!resultado) throw new Error('Elige cómo ha ido la llamada.');
      if (resultado === 'volver_a_llamar' && !proxima.value) throw new Error('¿Cuándo hay que volver a llamar? Pon fecha y hora.');
      await ctx.motor.registrarActividad({
        negocio_id: negocio.id,
        tipo: 'llamada',
        resultado,
        detalle: notas.value.trim(),
        proxima_accion_en: proxima.value ? new Date(proxima.value).toISOString() : null,
        proxima_accion: proxima.value ? proximaTexto.value.trim() : '',
      });
      avisar('Llamada guardada.');
      cerrar();
      await alGuardar({ resultado });
    });

    return [
      listaMensajes('Antes de llamar', permiso.motivos, 'alerta-atencion'),
      listaMensajes('Ten en cuenta', permiso.avisos, 'alerta-atencion'),
      negocio.telefono
        ? el('p', {}, el('a', { class: 'boton boton-principal', href: enlaceTelefono(negocio.telefono) }, `📞 Llamar al ${formatearTelefono(negocio.telefono)}`))
        : el('p', { class: 'problema' }, 'Este negocio no tiene teléfono.'),
      el('details', {}, el('summary', {}, 'Guion de llamada'), el('pre', { class: 'guion' }, guionTexto)),
      grupo,
      el('div', { class: 'campo' }, el('label', { for: 'notas-llamada' }, 'Notas'), notas),
      el('div', { class: 'campos-2' },
        el('div', { class: 'campo' }, el('label', { for: 'proxima' }, 'Próxima acción'), proxima),
        el('div', { class: 'campo' }, el('label', { for: 'proxima-texto' }, '¿Qué hay que hacer?'), proximaTexto),
      ),
      el('div', { class: 'acciones acciones-fijas' }, guardar, el('button', { type: 'button', class: 'boton', onclick: cerrar }, 'Cancelar')),
    ];
  });
}

// ---------------------------------------------------------------------------
// WhatsApp (salida)
// ---------------------------------------------------------------------------

export async function dialogoWhatsApp(ctx, { negocio, actividades, demo }, alGuardar, { clavePreferida = '' } = {}) {
  const hoy = await ctx.motor.actividadesDesde(inicioDeHoy());
  const yo = ctx.usuario()?.id;
  const enviadosHoy = hoy.filter((a) => a.tipo === 'whatsapp' && a.resultado === 'enviado' && a.modo === 'frio' && a.creado_por === yo).length;
  const permiso = puedeContactar({ negocio, canal: 'whatsapp', actividades, demo, enviadosHoy, festivos: ctx.festivos, ajustes: ctx.ajustes });

  abrirDialogo(`WhatsApp a ${negocio.nombre}`, (cerrar) => {
    if (!permiso.ok) {
      return [
        listaMensajes('Ahora no se puede enviar', permiso.motivos, 'alerta-peligro'),
        listaMensajes('Ten en cuenta', permiso.avisos, 'alerta-atencion'),
        el('button', { type: 'button', class: 'boton', onclick: cerrar }, 'Entendido'),
      ];
    }
    const modo = permiso.modo;
    const disponibles = ctx.plantillas.filter((p) => p.canal === 'whatsapp' && p.modo === modo);
    const preferida =
      disponibles.find((p) => p.clave === clavePreferida)
      ?? (negocio.permiso_whatsapp ? disponibles.find((p) => p.clave === 'whatsapp_tras_llamada') : null)
      ?? disponibles[0];
    const selector = el('select', { id: 'plantilla' }, disponibles.map((p) =>
      el('option', { value: p.clave, selected: p.clave === preferida?.clave }, p.nombre)));
    const texto = el('textarea', { id: 'texto-whatsapp', maxlength: 2000, rows: 9 });
    const revision = el('div', { class: 'mensaje-revision', 'aria-live': 'polite' });
    const carga = el('p', { class: 'texto-peq texto-suave' });
    const abrir = el('a', { class: 'boton boton-whatsapp', target: '_blank', rel: 'noopener noreferrer' }, 'Abrir WhatsApp');
    const confirmar = el('div', { class: 'alerta alerta-atencion', hidden: true });

    const valores = valoresPlantilla(ctx, negocio, demo);
    const poner = () => {
      const p = disponibles.find((x) => x.clave === selector.value);
      texto.value = rellenarPlantilla(p?.texto ?? '', valores).texto;
      revisar();
    };
    const revisar = () => {
      const v = validarMensaje(texto.value, { demoUrl: demo?.url ?? '', modo, ajustes: ctx.ajustes });
      revision.replaceChildren(
        el('p', { class: 'texto-suave' }, `${v.palabras} palabras · ${texto.value.length} caracteres`),
        v.problemas.length ? el('ul', {}, v.problemas.map((p) => el('li', { class: 'problema' }, `✖ ${p}`))) : null,
        v.avisos.length ? el('ul', {}, v.avisos.map((p) => el('li', { class: 'consejo' }, `⚠ ${p}`))) : null,
        v.ok ? el('p', { class: 'texto-peq' }, '✔ El mensaje cumple las reglas.') : null,
      );
      abrir.setAttribute('aria-disabled', String(!v.ok));
      if (v.ok) abrir.setAttribute('href', enlaceWhatsApp(negocio.telefono, texto.value));
      else abrir.removeAttribute('href');
    };
    selector.addEventListener('change', poner);
    texto.addEventListener('input', revisar);

    abrir.addEventListener('click', () => {
      confirmar.hidden = false;
    });
    const registrar = botonAccion('Sí, lo he enviado', async () => {
      const proxima = modo === 'frio' ? new Date(Date.now() + ctx.ajustes.limites.diasParaSeguimiento * 86400000) : null;
      if (proxima) proxima.setHours(10, 30, 0, 0);
      await ctx.motor.registrarActividad({
        negocio_id: negocio.id,
        tipo: 'whatsapp',
        resultado: 'enviado',
        modo,
        detalle: texto.value,
        proxima_accion_en: proxima ? proxima.toISOString() : null,
        proxima_accion: proxima ? 'Seguimiento si no ha respondido' : '',
      });
      avisar('WhatsApp registrado.');
      cerrar();
      await alGuardar();
    });
    confirmar.append(el('p', {}, '¿Has enviado el mensaje en WhatsApp?'),
      el('div', { class: 'acciones' }, registrar, el('button', { type: 'button', class: 'boton', onclick: () => { confirmar.hidden = true; } }, 'No, todavía no')));

    poner();
    if (demo?.url && modo !== 'conversacion') {
      carga.textContent = 'Comprobando que la demo carga…';
      comprobarCarga(demo.url).then((ok) => {
        carga.textContent = ok
          ? '✔ La demo carga desde tu conexión.'
          : '⚠ La demo NO carga ahora mismo desde tu conexión (puede ser un bloqueo temporal). Mejor espera y vuelve a probar.';
        carga.className = ok ? 'texto-peq' : 'texto-peq problema';
      });
    }

    return [
      listaMensajes('Ten en cuenta', permiso.avisos, 'alerta-atencion'),
      el('p', { class: 'texto-suave texto-peq' },
        modo === 'frio' ? 'Primer mensaje.' : modo === 'seguimiento' ? 'Seguimiento: es el último mensaje si no responde.' : 'Conversación: ya os ha escrito.'),
      el('div', { class: 'campo' }, el('label', { for: 'plantilla' }, 'Plantilla'), selector),
      el('div', { class: 'campo' }, el('label', { for: 'texto-whatsapp' }, 'Mensaje (puedes cambiarlo)'), texto),
      revision,
      carga,
      el('div', { class: 'acciones acciones-fijas' }, abrir, el('button', { type: 'button', class: 'boton', onclick: cerrar }, 'Cancelar')),
      confirmar,
    ];
  });
}

// ---------------------------------------------------------------------------
// Respuesta recibida (WhatsApp, visita, email)
// ---------------------------------------------------------------------------

export function dialogoRespuesta(ctx, { negocio }, alGuardar) {
  abrirDialogo(`Registrar respuesta de ${negocio.nombre}`, (cerrar) => {
    const tipo = el('select', { id: 'tipo-respuesta' },
      el('option', { value: 'whatsapp' }, 'WhatsApp'),
      el('option', { value: 'visita' }, 'Visita en persona'),
      el('option', { value: 'email' }, 'Email'));
    const contenedor = el('div');
    const pintarOpciones = () => {
      const lista = RESULTADOS[tipo.value].filter((r) => r.id !== 'enviado');
      contenedor.replaceChildren(el('fieldset', { class: 'opciones' }, el('legend', {}, '¿Qué ha pasado?'),
        lista.map((r) => el('label', { class: 'opcion' }, el('input', { type: 'radio', name: 'resultado-respuesta', value: r.id }), r.nombre))));
    };
    tipo.addEventListener('change', pintarOpciones);
    pintarOpciones();
    const detalle = el('textarea', { id: 'detalle-respuesta', maxlength: 4000, placeholder: 'Pega aquí lo que te ha contestado' });
    const proxima = el('input', { id: 'proxima-respuesta', type: 'datetime-local' });
    const guardar = botonAccion('Guardar', async () => {
      const resultado = contenedor.querySelector('input:checked')?.value;
      if (!resultado) throw new Error('Elige qué ha pasado.');
      await ctx.motor.registrarActividad({
        negocio_id: negocio.id,
        tipo: tipo.value,
        resultado,
        detalle: detalle.value.trim(),
        proxima_accion_en: proxima.value ? new Date(proxima.value).toISOString() : null,
        proxima_accion: proxima.value ? 'Contestar / seguir la conversación' : '',
      });
      avisar(resultado === 'baja' || resultado === 'no_interesa' ? 'Guardado. No se le volverá a contactar.' : 'Respuesta guardada.');
      cerrar();
      await alGuardar();
    });
    return [
      el('div', { class: 'campo' }, el('label', { for: 'tipo-respuesta' }, 'Por dónde'), tipo),
      contenedor,
      el('div', { class: 'campo' }, el('label', { for: 'detalle-respuesta' }, 'Detalle'), detalle),
      el('div', { class: 'campo' }, el('label', { for: 'proxima-respuesta' }, 'Próxima acción (opcional)'), proxima),
      el('div', { class: 'acciones acciones-fijas' }, guardar, el('button', { type: 'button', class: 'boton', onclick: cerrar }, 'Cancelar')),
    ];
  });
}

// ---------------------------------------------------------------------------
// Nota
// ---------------------------------------------------------------------------

export function dialogoNota(ctx, { negocio }, alGuardar) {
  abrirDialogo(`Nota sobre ${negocio.nombre}`, (cerrar) => {
    const texto = el('textarea', { id: 'texto-nota', maxlength: 4000 });
    const proxima = el('input', { id: 'proxima-nota', type: 'datetime-local' });
    const que = el('input', { id: 'que-nota', type: 'text', maxlength: 300 });
    setTimeout(() => texto.focus(), 0);
    return [
      el('div', { class: 'campo' }, el('label', { for: 'texto-nota' }, 'Nota'), texto),
      el('div', { class: 'campos-2' },
        el('div', { class: 'campo' }, el('label', { for: 'proxima-nota' }, 'Recordatorio (opcional)'), proxima),
        el('div', { class: 'campo' }, el('label', { for: 'que-nota' }, '¿Qué hay que hacer?'), que)),
      el('div', { class: 'acciones acciones-fijas' },
        botonAccion('Guardar nota', async () => {
          if (!texto.value.trim() && !proxima.value) throw new Error('Escribe algo.');
          await ctx.motor.registrarActividad({
            negocio_id: negocio.id,
            tipo: 'nota',
            resultado: '',
            detalle: texto.value.trim(),
            proxima_accion_en: proxima.value ? new Date(proxima.value).toISOString() : null,
            proxima_accion: proxima.value ? que.value.trim() : '',
          });
          avisar('Nota guardada.');
          cerrar();
          await alGuardar();
        }),
        el('button', { type: 'button', class: 'boton', onclick: cerrar }, 'Cancelar')),
    ];
  });
}

// ---------------------------------------------------------------------------
// Cambiar etapa a mano
// ---------------------------------------------------------------------------

export function dialogoEtapa(ctx, { negocio }, alGuardar) {
  abrirDialogo('Cambiar etapa', (cerrar) => {
    const opciones = ETAPAS.filter((e) => e.id !== 'baja').map((e) =>
      el('label', { class: 'opcion' },
        el('input', { type: 'radio', name: 'etapa', value: e.id, checked: e.id === negocio.etapa }),
        el('span', {}, el('strong', {}, e.nombre), el('br'), el('span', { class: 'texto-peq texto-suave' }, e.ayuda))));
    const grupo = el('fieldset', { class: 'opciones' }, el('legend', {}, 'Etapa'), opciones);
    return [
      el('p', { class: 'texto-suave texto-peq' }, 'Normalmente la etapa cambia sola al registrar llamadas, WhatsApp y demos. Para pedir la baja usa el botón "Baja".'),
      grupo,
      el('div', { class: 'acciones acciones-fijas' },
        botonAccion('Guardar', async () => {
          const etapa = grupo.querySelector('input:checked')?.value;
          await ctx.motor.actualizarNegocio(negocio.id, { etapa });
          avisar('Etapa cambiada.');
          cerrar();
          await alGuardar();
        }),
        el('button', { type: 'button', class: 'boton', onclick: cerrar }, 'Cancelar')),
    ];
  });
}

// ---------------------------------------------------------------------------
// Baja
// ---------------------------------------------------------------------------

export function dialogoBaja(ctx, { negocio }, alGuardar) {
  abrirDialogo('Dar de baja', (cerrar) => [
    el('p', {}, `${negocio.nombre} no volverá a recibir llamadas ni mensajes, ni de ti ni de Harvey. Solo Miguel puede deshacerlo.`),
    el('div', { class: 'acciones' },
      botonAccion('Sí, dar de baja', async () => {
        await ctx.motor.actualizarNegocio(negocio.id, { etapa: 'baja', no_contactar: true, motivo_no_contactar: 'Pidió la baja' });
        avisar('Dado de baja.');
        cerrar();
        await alGuardar();
      }, 'boton boton-peligro'),
      el('button', { type: 'button', class: 'boton', onclick: cerrar }, 'Cancelar')),
  ]);
}

// ---------------------------------------------------------------------------
// Crear / editar negocio
// ---------------------------------------------------------------------------

export function dialogoNegocio(ctx, negocio, alGuardar) {
  const editar = Boolean(negocio?.id);
  abrirDialogo(editar ? `Editar ${negocio.nombre}` : 'Añadir negocio', (cerrar) => {
    const v = (k) => negocio?.[k] ?? '';
    const campo = (id, etiqueta, atributos = {}, ayuda = '') =>
      el('div', { class: 'campo' }, el('label', { for: id }, etiqueta), el('input', { id, value: v(id), ...atributos }),
        ayuda ? el('p', { class: 'campo-ayuda' }, ayuda) : null);
    const municipios = el('datalist', { id: 'lista-municipios' }, ctx.ajustes.zona.municipios.map((m) => el('option', { value: m })));
    const sectores = el('datalist', { id: 'lista-sectores' }, ctx.ajustes.sectores.map((s) => el('option', { value: s })));
    const notas = el('textarea', { id: 'notas', maxlength: 5000 });
    notas.value = v('notas');
    const cuerpo = el('div', {},
      municipios, sectores,
      campo('nombre', 'Nombre del negocio', { required: true, maxlength: 200 }),
      el('div', { class: 'campos-2' },
        campo('telefono', 'Teléfono', { type: 'tel', inputmode: 'tel', value: v('telefono') ? formatearTelefono(v('telefono')) : '' }),
        campo('sector', 'Sector', { list: 'lista-sectores', maxlength: 100 })),
      el('div', { class: 'campos-2' },
        campo('municipio', 'Municipio', { list: 'lista-municipios', maxlength: 100 }),
        campo('direccion', 'Dirección', { maxlength: 300 })),
      campo('web', 'Web, Instagram o Facebook (si tiene)', { type: 'url', maxlength: 500, placeholder: 'https://' }),
      el('div', { class: 'campo' }, el('label', { for: 'notas' }, 'Notas'), notas),
    );
    const leer = (id) => cuerpo.querySelector(`#${id}`).value.trim();
    return [
      cuerpo,
      el('div', { class: 'acciones acciones-fijas' },
        botonAccion(editar ? 'Guardar cambios' : 'Añadir', async () => {
          const nombre = leer('nombre');
          if (!nombre) throw new Error('El nombre es obligatorio.');
          const telefonoTexto = leer('telefono');
          const telefono = normalizarTelefono(telefonoTexto) || null;
          if (telefonoTexto && !telefono) throw new Error('El teléfono no parece válido (9 cifras en España).');
          const web = leer('web');
          if (web && !/^https?:\/\//i.test(web)) throw new Error('La web tiene que empezar por https://');
          const datos = {
            nombre, telefono, telefono_tipo: tipoTelefono(telefono), sector: leer('sector'), municipio: leer('municipio'),
            direccion: leer('direccion'), web, web_tipo: clasificarWeb(web), notas: notas.value.trim(),
            instagram: esInstagram(web) ? web : v('instagram'),
            sanitario: esSanitario(`${nombre} ${leer('sector')}`),
          };
          datos.puntuacion = puntuarNegocio({ ...negocio, ...datos, direccion: `${datos.direccion} ${datos.municipio}` }, ctx.ajustes).puntos;
          if (!editar) datos.fuente = 'manual';
          const guardado = editar ? await ctx.motor.actualizarNegocio(negocio.id, datos) : await ctx.motor.crearNegocio(datos);
          avisar(editar ? 'Cambios guardados.' : 'Negocio añadido.');
          cerrar();
          await alGuardar(guardado);
        }),
        el('button', { type: 'button', class: 'boton', onclick: cerrar }, 'Cancelar')),
    ];
  });
}
