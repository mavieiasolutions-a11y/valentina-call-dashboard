// Pantalla "Plantillas": mensajes de WhatsApp y guion de llamada.
import { el, avisar, botonAccion } from '../dom.js';
import { rellenarPlantilla, validarMensaje } from '../reglas.js';
import { PLANTILLAS_BASE } from '../plantillas-base.js';

const EJEMPLO = {
  negocio: 'Barbería El Faro',
  demo_url: 'https://mavie-demos.pages.dev/ejemplo-barberia/',
  municipio: 'Algeciras',
};

export async function vistaPlantillas(ctx) {
  await ctx.recargarPlantillas();
  const propias = new Set((await ctx.motor.listarPlantillas()).map((p) => p.clave));
  const valores = {
    ...EJEMPLO,
    remitente: ctx.usuario()?.nombre?.split(' ')[0] || ctx.ajustes.remitente,
    empresa: ctx.ajustes.empresa.nombre,
    identificacion: ctx.ajustes.empresa.identificacion,
  };

  const tarjetas = ctx.plantillas.map((p) => {
    const id = `plantilla-${p.clave}`;
    const texto = el('textarea', { id, rows: p.canal === 'llamada' ? 14 : 7, maxlength: 4000 });
    texto.value = p.texto;
    const vista = el('div', { class: 'mensaje-revision', 'aria-live': 'polite' });
    const revisar = () => {
      const { texto: relleno } = rellenarPlantilla(texto.value, valores);
      if (p.canal !== 'whatsapp') {
        vista.replaceChildren();
        return;
      }
      const v = validarMensaje(relleno, { demoUrl: EJEMPLO.demo_url, modo: p.modo, ajustes: ctx.ajustes });
      vista.replaceChildren(
        el('p', { class: 'texto-suave' }, `Con datos de ejemplo: ${v.palabras} palabras.`),
        v.problemas.length ? el('ul', {}, v.problemas.map((x) => el('li', { class: 'problema' }, `✖ ${x}`))) : el('p', { class: 'texto-peq' }, '✔ Cumple las reglas.'),
        v.avisos.length ? el('ul', {}, v.avisos.map((x) => el('li', { class: 'consejo' }, `⚠ ${x}`))) : null,
      );
    };
    texto.addEventListener('input', revisar);
    revisar();
    const esPropia = propias.has(p.clave);
    const deSerie = PLANTILLAS_BASE.some((b) => b.clave === p.clave);
    return el('section', { class: 'tarjeta' },
      el('h2', {}, p.nombre, esPropia ? el('span', { class: 'etiqueta' }, 'personalizada') : null),
      el('div', { class: 'campo' }, el('label', { for: id, class: 'oculto-visual' }, p.nombre), texto),
      vista,
      el('div', { class: 'acciones' },
        botonAccion('Guardar', async () => {
          if (p.canal === 'whatsapp') {
            const v = validarMensaje(rellenarPlantilla(texto.value, valores).texto, { demoUrl: EJEMPLO.demo_url, modo: p.modo, ajustes: ctx.ajustes });
            if (!v.ok) throw new Error('La plantilla no cumple las reglas. Mira los avisos en rojo.');
          }
          await ctx.motor.guardarPlantilla({ clave: p.clave, canal: p.canal, modo: p.modo, nombre: p.nombre, texto: texto.value });
          avisar('Plantilla guardada.');
          ctx.recargar();
        }, 'boton boton-peq boton-principal'),
        esPropia && deSerie
          ? botonAccion('Volver a la de serie', async () => {
            await ctx.motor.borrarPlantilla(p.clave);
            avisar('Restaurada la plantilla de serie.');
            ctx.recargar();
          }, 'boton boton-peq')
          : null),
    );
  });

  return el('div', {},
    el('div', { class: 'titulo-vista' },
      el('div', {}, el('h1', {}, 'Plantillas'),
        el('p', { class: 'subtitulo' }, 'Huecos: {negocio} {demo_url} {remitente} {empresa} {identificacion} {municipio}'))),
    el('div', { class: 'alerta alerta-atencion' },
      'Reglas (como Harvey): menos de 80 palabras, un solo enlace (el de la demo), sin precios ni prisas, y el primer mensaje siempre con la opción de responder BAJA.'),
    tarjetas,
  );
}
