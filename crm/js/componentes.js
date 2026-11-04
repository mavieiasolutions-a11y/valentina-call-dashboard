// Piezas de pantalla que se repiten en varias vistas.
import { el, fechaHora, haceCuanto } from './dom.js';
import { nombreEtapa, formatearTelefono, tipoTelefono } from './reglas.js';

export function etiquetaEtapa(etapa) {
  return el('span', { class: `etiqueta etapa-${etapa}` }, nombreEtapa(etapa));
}

export function indicador(etiqueta, valor, nota = '') {
  return el('div', { class: 'indicador' },
    el('p', { class: 'indicador-etiqueta' }, etiqueta),
    el('p', { class: 'indicador-valor' }, valor),
    nota ? el('p', { class: 'indicador-nota' }, nota) : null,
  );
}

const ICONO_TELEFONO = { movil: '📱', fijo: '☎︎', otro: '' };

/** Una fila clicable con el resumen de un negocio. */
export function filaNegocio(n, { mostrarProxima = true } = {}) {
  const vencida = n.proxima_accion_en && new Date(n.proxima_accion_en) < new Date();
  const tel = n.telefono ? `${ICONO_TELEFONO[n.telefono_tipo || tipoTelefono(n.telefono)] ?? ''} ${formatearTelefono(n.telefono)}` : 'Sin teléfono';
  return el('li', {},
    el('a', { class: `fila${vencida && mostrarProxima ? ' fila-vencida' : ''}`, href: `#/negocio/${encodeURIComponent(n.id)}` },
      el('span', { class: 'fila-titulo' }, n.nombre),
      etiquetaEtapa(n.etapa),
      el('span', { class: 'fila-detalle' },
        el('span', {}, [n.sector, n.municipio].filter(Boolean).join(' · ') || '—'),
        el('span', {}, tel),
        el('span', { class: 'puntos', title: 'Puntuación (0-100)' }, `★ ${n.puntuacion}`),
        mostrarProxima && n.proxima_accion_en
          ? el('span', {}, `⏰ ${fechaHora(n.proxima_accion_en)}${n.proxima_accion ? ` · ${n.proxima_accion}` : ''}`)
          : null,
        n.no_contactar ? el('span', { class: 'problema' }, `⛔ ${n.motivo_no_contactar || 'No contactar'}`) : null,
      ),
    ),
  );
}

export function listaNegocios(negocios, opciones, vacio = 'No hay nada aquí.') {
  if (!negocios.length) return el('p', { class: 'vacio' }, vacio);
  return el('ul', { class: 'lista' }, negocios.map((n) => filaNegocio(n, opciones)));
}

export function seccion(titulo, contador, ...contenido) {
  return el('section', { class: 'seccion tarjeta' },
    el('h2', {}, titulo, contador !== null && contador !== undefined ? el('span', { class: 'contador' }, contador) : null),
    ...contenido,
  );
}

export function cuando(iso) {
  return el('time', { datetime: iso, title: fechaHora(iso) }, haceCuanto(iso));
}

/**
 * ¿Carga la demo desde esta conexión? (los bloqueos de LaLiga a veces tumban
 * webs legales). No se puede leer la respuesta (es de otro dominio), pero si
 * el servidor responde algo, la petición termina bien; si está bloqueada,
 * falla.
 */
export async function comprobarCarga(url) {
  if (!url) return false;
  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), 8000);
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: control.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(espera);
  }
}

/** Copia un texto al portapapeles y avisa. */
export async function copiar(texto, avisar) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar('Copiado.');
  } catch {
    avisar('No he podido copiarlo. Selecciónalo y cópialo a mano.', 'error');
  }
}

export const ESTADOS_DEMO = [
  { id: 'diseno', nombre: 'En diseño', clase: 'etapa-en_diseno' },
  { id: 'revision', nombre: 'En revisión', clase: 'etapa-respondio' },
  { id: 'aprobada', nombre: 'Aprobada', clase: 'etapa-demo_lista' },
  { id: 'publicada', nombre: 'Publicada', clase: 'etapa-cliente' },
  { id: 'archivada', nombre: 'Archivada', clase: '' },
];

export function etiquetaDemo(estado) {
  const e = ESTADOS_DEMO.find((x) => x.id === estado);
  return el('span', { class: `etiqueta ${e?.clase ?? ''}` }, e?.nombre ?? estado);
}

/** Bloque con un comando y botón de copiar. */
export function bloqueComando(texto, avisar) {
  return el('div', { class: 'comando' },
    el('code', {}, texto),
    el('button', { type: 'button', class: 'boton boton-peq', onclick: () => copiar(texto, avisar) }, 'Copiar'));
}
