// Ayudantes para construir la pantalla de forma segura.
//
// Regla de oro del CRM: NUNCA se usa innerHTML. Los textos que vienen de la
// base de datos (nombres de negocios, notas...) podrían contener código, y
// innerHTML lo ejecutaría (ataque XSS). Con el() todo texto se mete como
// texto, nunca como HTML.

/**
 * Crea un elemento. Ejemplo:
 *   el('a', { href: url, class: 'boton' }, 'Abrir')
 *   el('ul', {}, lista.map((x) => el('li', {}, x.nombre)))
 */
export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos ?? {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (clave.startsWith('on')) {
      // Los eventos solo como funciones; nunca como texto (la CSP lo bloquearía igualmente).
      if (typeof valor === 'function') nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (clave === 'style') {
      continue; // nada de estilos en línea: van en crm.css
    } else if (clave === 'class') {
      nodo.className = valor;
    } else if (clave === 'dataset') {
      Object.assign(nodo.dataset, valor);
    } else if (clave === 'href' || clave === 'src') {
      const seguro = urlSegura(valor);
      if (seguro) nodo.setAttribute(clave, seguro);
    } else if (valor === true) {
      nodo.setAttribute(clave, '');
    } else {
      nodo.setAttribute(clave, String(valor));
    }
  }
  añadir(nodo, hijos);
  return nodo;
}

function añadir(nodo, hijos) {
  for (const h of hijos.flat(Infinity)) {
    if (h === null || h === undefined || h === false) continue;
    nodo.append(h instanceof Node ? h : document.createTextNode(String(h)));
  }
}

/** Solo deja pasar enlaces http(s), tel:, mailto: y rutas internas (#/...). */
export function urlSegura(url) {
  const texto = String(url ?? '').trim();
  if (!texto) return '';
  if (texto.startsWith('#') || texto.startsWith('/') || texto.startsWith('./')) return texto;
  try {
    const u = new URL(texto);
    return ['https:', 'http:', 'tel:', 'mailto:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

export function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

export function montar(nodo, ...hijos) {
  vaciar(nodo);
  añadir(nodo, hijos);
  return nodo;
}

/** Enlace externo que se abre en otra pestaña sin dar acceso a esta. */
export function enlaceFuera(href, ...hijos) {
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, ...hijos);
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const ZONA = 'Europe/Madrid';

export function fechaCorta(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: ZONA });
}

export function fechaHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: ZONA,
  });
}

export function haceCuanto(iso) {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/** Valor para <input type="datetime-local"> en hora local. */
export function aInputFecha(fecha) {
  const d = new Date(fecha);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function inicioDeHoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function finDeHoy() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// ---------------------------------------------------------------------------
// Avisos flotantes ("toasts") y diálogos
// ---------------------------------------------------------------------------

export function avisar(mensaje, tipo = 'ok') {
  const zona = document.getElementById('avisos');
  if (!zona) return;
  const nodo = el('div', { class: `aviso aviso-${tipo}`, role: tipo === 'error' ? 'alert' : 'status' }, mensaje);
  zona.append(nodo);
  setTimeout(() => nodo.remove(), tipo === 'error' ? 7000 : 3500);
}

/**
 * Abre un diálogo modal. contenido es una función que recibe cerrar() y
 * devuelve los nodos a mostrar.
 */
export function abrirDialogo(titulo, contenido) {
  const dialogo = el('dialog', { class: 'dialogo', 'aria-label': titulo });
  const cerrar = () => {
    dialogo.close();
    dialogo.remove();
  };
  dialogo.append(
    el('div', { class: 'dialogo-cabecera' },
      el('h2', {}, titulo),
      el('button', { class: 'boton-icono', type: 'button', 'aria-label': 'Cerrar', onclick: cerrar }, '✕'),
    ),
    el('div', { class: 'dialogo-cuerpo' }, contenido(cerrar)),
  );
  dialogo.addEventListener('cancel', (e) => {
    e.preventDefault();
    cerrar();
  });
  document.body.append(dialogo);
  dialogo.showModal();
  return cerrar;
}

/** Botón que se desactiva mientras trabaja, para no guardar dos veces. */
export function botonAccion(texto, accion, clase = 'boton boton-principal') {
  const b = el('button', { type: 'button', class: clase }, texto);
  b.addEventListener('click', async () => {
    if (b.disabled) return;
    b.disabled = true;
    try {
      await accion();
    } catch (e) {
      avisar(e.message ?? String(e), 'error');
    } finally {
      b.disabled = false;
    }
  });
  return b;
}
