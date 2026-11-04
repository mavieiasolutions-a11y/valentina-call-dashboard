// Reglas del CRM. Son funciones "puras": reciben datos y devuelven un
// resultado, sin tocar la base de datos ni la pantalla. Las usa la web
// del CRM y también los scripts de Antigravity, y tienen tests en
// tests/unit/reglas.test.js. Si cambias una regla, ejecuta `npm test`.
//
// Estas reglas copian lo que ya hace Harvey (el agente de Miguel):
// horario comercial, nada de precios por escrito, un solo enlace,
// opción de BAJA y límites de mensajes para no molestar.

import { AJUSTES } from './ajustes.js';

// ---------------------------------------------------------------------------
// Etapas del embudo
// ---------------------------------------------------------------------------

export const ETAPAS = [
  { id: 'nuevo', nombre: 'Nuevo', ayuda: 'Encontrado en la búsqueda, sin revisar.' },
  { id: 'cualificado', nombre: 'Cualificado', ayuda: 'Revisado: no tiene web y es buen candidato.' },
  { id: 'en_diseno', nombre: 'Demo en diseño', ayuda: 'Valentina está creando su demo.' },
  { id: 'demo_lista', nombre: 'Demo lista', ayuda: 'Demo revisada y aprobada: se puede enviar.' },
  { id: 'contactado', nombre: 'Contactado', ayuda: 'Ya ha recibido mensaje o llamada.' },
  { id: 'respondio', nombre: 'Respondió', ayuda: 'Ha contestado: toca conversar.' },
  { id: 'interesado', nombre: 'Interesado', ayuda: 'Quiere hablar o ver la propuesta.' },
  { id: 'cliente', nombre: 'Cliente', ayuda: 'Ha dicho que sí.' },
  { id: 'descartado', nombre: 'Descartado', ayuda: 'No encaja (ya tiene web, cerrado...).' },
  { id: 'baja', nombre: 'Baja', ayuda: 'Pidió que no le contactemos. Nunca más.' },
];

const ORDEN = ['nuevo', 'cualificado', 'en_diseno', 'demo_lista', 'contactado', 'respondio', 'interesado', 'cliente'];

export const RESULTADOS = {
  llamada: [
    { id: 'no_contesta', nombre: 'No contesta' },
    { id: 'buzon', nombre: 'Buzón de voz' },
    { id: 'volver_a_llamar', nombre: 'Volver a llamar' },
    { id: 'acepta_whatsapp', nombre: 'Acepta que le envíe la demo por WhatsApp' },
    { id: 'interesado', nombre: 'Interesado' },
    { id: 'no_interesa', nombre: 'No le interesa (baja)' },
    { id: 'numero_erroneo', nombre: 'Número equivocado' },
    { id: 'cliente', nombre: '¡Cliente!' },
  ],
  whatsapp: [
    { id: 'enviado', nombre: 'Mensaje enviado' },
    { id: 'respondio', nombre: 'Ha respondido' },
    { id: 'interesado', nombre: 'Interesado' },
    { id: 'baja', nombre: 'Pide la baja' },
  ],
  visita: [
    { id: 'no_estaba', nombre: 'No estaba' },
    { id: 'volver', nombre: 'Volver otro día' },
    { id: 'interesado', nombre: 'Interesado' },
    { id: 'no_interesa', nombre: 'No le interesa (baja)' },
    { id: 'cliente', nombre: '¡Cliente!' },
  ],
  email: [
    { id: 'enviado', nombre: 'Email enviado' },
    { id: 'respondio', nombre: 'Ha respondido' },
    { id: 'baja', nombre: 'Pide la baja' },
  ],
  nota: [{ id: '', nombre: 'Nota' }],
  sistema: [{ id: '', nombre: 'Sistema' }],
};

// A qué etapa empuja cada resultado. null = no cambia la etapa.
// IMPORTANTE: la base de datos aplica la misma tabla (supabase/migrations,
// función crm.etapa_objetivo). El test tests/unit/paridad-sql.test.js
// comprueba que las dos coinciden.
export const ETAPA_POR_RESULTADO = {
  'llamada:no_contesta': null,
  'llamada:buzon': null,
  'llamada:volver_a_llamar': 'contactado',
  'llamada:acepta_whatsapp': 'contactado',
  'llamada:interesado': 'interesado',
  'llamada:no_interesa': 'baja',
  'llamada:numero_erroneo': null,
  'llamada:cliente': 'cliente',
  'whatsapp:enviado': 'contactado',
  'whatsapp:respondio': 'respondio',
  'whatsapp:interesado': 'interesado',
  'whatsapp:baja': 'baja',
  'visita:no_estaba': null,
  'visita:volver': 'contactado',
  'visita:interesado': 'interesado',
  'visita:no_interesa': 'baja',
  'visita:cliente': 'cliente',
  'email:enviado': 'contactado',
  'email:respondio': 'respondio',
  'email:baja': 'baja',
};

/**
 * Combina la etapa actual con la etapa a la que empuja algo que ha pasado.
 * - "baja" y "cliente" no se mueven solas (solo a mano).
 * - Pedir la baja gana siempre (salvo a un cliente).
 * - Un descartado solo revive si el negocio responde o se interesa.
 * - En el resto, la etapa solo avanza, nunca retrocede.
 */
export function avanzarEtapa(actual, objetivo) {
  if (!objetivo) return actual;
  if (actual === 'cliente' || actual === 'baja') return actual;
  if (objetivo === 'baja' || objetivo === 'cliente') return objetivo;
  if (actual === 'descartado') {
    return objetivo === 'respondio' || objetivo === 'interesado' ? objetivo : actual;
  }
  const a = ORDEN.indexOf(actual);
  const o = ORDEN.indexOf(objetivo);
  if (o === -1) return actual;
  return o > a ? objetivo : actual;
}

export function etapaTrasActividad(actual, tipo, resultado) {
  const objetivo = ETAPA_POR_RESULTADO[`${tipo}:${resultado}`] ?? null;
  return avanzarEtapa(actual, objetivo);
}

export function nombreEtapa(id) {
  return ETAPAS.find((e) => e.id === id)?.nombre ?? id;
}

export function nombreResultado(tipo, resultado) {
  return RESULTADOS[tipo]?.find((r) => r.id === resultado)?.nombre ?? resultado ?? '';
}

// ---------------------------------------------------------------------------
// Teléfonos y enlaces
// ---------------------------------------------------------------------------

/** Devuelve el teléfono en formato internacional (+34600111222) o '' si no es válido. */
export function normalizarTelefono(texto) {
  if (texto === null || texto === undefined) return '';
  const limpio = String(texto).trim();
  if (!limpio) return '';
  const conMas = limpio.startsWith('+');
  let d = limpio.replace(/\D/g, '');
  if (!d) return '';
  if (!conMas) {
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.length === 9 && /^[6789]/.test(d)) d = `34${d}`;
    else if (d.length === 8 && /^[25]/.test(d)) d = `350${d}`; // Gibraltar
  }
  if (d.startsWith('34')) return d.length === 11 && /^34[6789]/.test(d) ? `+${d}` : '';
  if (d.startsWith('350')) return d.length === 11 ? `+${d}` : '';
  return d.length >= 8 && d.length <= 15 && (conMas || limpio.startsWith('00')) ? `+${d}` : '';
}

/** 'movil', 'fijo' u 'otro'. Solo a los móviles se les puede escribir por WhatsApp con seguridad. */
export function tipoTelefono(e164) {
  if (!e164) return 'otro';
  if (/^\+34[67]/.test(e164)) return 'movil';
  if (/^\+34[89]/.test(e164)) return 'fijo';
  if (/^\+3505/.test(e164)) return 'movil';
  if (/^\+350[2]/.test(e164)) return 'fijo';
  return 'otro';
}

export function formatearTelefono(e164) {
  if (!e164) return '';
  const m = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  const g = /^\+350(\d{4})(\d{4})$/.exec(e164);
  if (g) return `+350 ${g[1]} ${g[2]}`;
  return e164;
}

export function enlaceTelefono(e164) {
  return e164 ? `tel:${e164}` : '';
}

export function enlaceWhatsApp(e164, texto = '') {
  if (!e164) return '';
  const numero = e164.replace(/\D/g, '');
  return texto ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/${numero}`;
}

export function enlaceMaps(nombre = '', direccion = '') {
  const q = [nombre, direccion].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}

/** "Peluquería Rocío & Co." -> "peluqueria-rocio-co" */
export function slugify(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

// ---------------------------------------------------------------------------
// ¿Tiene web? ¿Está en la zona? ¿Es buen candidato?
// ---------------------------------------------------------------------------

const REDES = [
  'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com', 'linktr.ee', 'wa.me', 'whatsapp.com',
  'twitter.com', 'x.com', 'youtube.com', 'linkedin.com', 'pinterest.com', 'business.site', 'g.page',
];

// Directorios y plataformas donde aparecen negocios que NO tienen web propia.
export const DIRECTORIOS = [
  'google.com', 'goo.gl', 'paginasamarillas.es', 'tripadvisor.es', 'tripadvisor.com', 'yelp.es',
  'yelp.com', 'cylex.es', 'infoisinfo.es', 'habitissimo.es', 'booksy.com', 'treatwell.es',
  'fresha.com', 'thefork.es', 'eltenedor.es', 'justeat.es', 'glovoapp.com', 'ubereats.com',
  'einforma.com', 'axesor.es', 'empresite.eleconomista.es', 'infoempresa.com', 'guiaempresa.com',
  'negociocerca.es', 'negocioscerca.es', 'top-rated.online', 'restaurantguru.com', 'wikiloc.com',
  'milanuncios.com', 'wallapop.com', 'doctoralia.es', 'topdoctors.es', 'mundoanuncio.com',
  'europa.press', 'abc.es', 'europasur.es', 'diariodecadiz.es', 'wikipedia.org',
];

function dominio(url) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function coincideDominio(host, lista) {
  return lista.some((d) => host === d || host.endsWith(`.${d}`));
}

/** 'sin_web' | 'redes' (solo Instagram/Facebook...) | 'directorio' | 'propia' */
export function clasificarWeb(url) {
  if (!url || !String(url).trim()) return 'sin_web';
  const host = dominio(String(url).trim());
  if (!host) return 'sin_web';
  if (coincideDominio(host, REDES)) return 'redes';
  if (coincideDominio(host, DIRECTORIOS)) return 'directorio';
  return 'propia';
}

/** Un negocio sin web propia es candidato aunque tenga Instagram o salga en directorios. */
export function necesitaWeb(url) {
  return clasificarWeb(url) !== 'propia';
}

export function esSanitario(texto = '') {
  return /m[eé]dic|cl[ií]nica|doctor|\bdra?\.|sanitari|dermat|l[aá]ser|dental|dentista|fisioterap|podolog|psic[oó]log|[oó]ptica|farmacia/i.test(
    texto,
  );
}

const PAISES_FUERA = /m[eé]xico|colombia|argentina|chile|per[uú]|venezuela|ecuador|united states|usa\b|portugal|marruecos|morocco/i;

/** ¿Está en la zona de trabajo? Mira el código postal y el municipio de la dirección real. */
export function enZona(direccion = '', ajustes = AJUSTES) {
  if (!direccion) return false;
  if (PAISES_FUERA.test(direccion)) return false;
  const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const dir = quitarTildes(direccion);
  const cps = direccion.match(/\b\d{5}\b/g) ?? [];
  if (cps.some((cp) => ajustes.zona.codigosPostales.some((p) => cp.startsWith(p)))) return true;
  if (/gibraltar/.test(dir) && ajustes.zona.municipios.length) return true;
  return ajustes.zona.municipios.some((m) => dir.includes(quitarTildes(m)));
}

/**
 * Puntuación de 0 a 100 para ordenar a quién preparar demo primero.
 * Devuelve también las razones, para que se entienda la nota.
 */
export function puntuarNegocio(n, ajustes = AJUSTES) {
  let puntos = 30;
  const razones = [];
  const tel = normalizarTelefono(n.telefono);
  if (tipoTelefono(tel) === 'movil') {
    puntos += 25;
    razones.push('+25 móvil: se le puede enviar la demo por WhatsApp');
  } else if (tel) {
    puntos += 10;
    razones.push('+10 tiene teléfono fijo: llamada');
  } else {
    puntos -= 20;
    razones.push('-20 sin teléfono');
  }
  const resenas = Number(n.num_resenas ?? 0);
  if (resenas >= 50) {
    puntos += 20;
    razones.push('+20 muchas reseñas: negocio activo');
  } else if (resenas >= 10) {
    puntos += 10;
    razones.push('+10 algunas reseñas');
  }
  if (Number(n.valoracion ?? 0) >= 4.3) {
    puntos += 5;
    razones.push('+5 buena valoración');
  }
  const tipoWeb = clasificarWeb(n.web);
  if (tipoWeb === 'redes') {
    puntos += 10;
    razones.push('+10 solo tiene redes sociales: ya cuida su imagen');
  } else if (tipoWeb === 'propia') {
    puntos -= 60;
    razones.push('-60 ya tiene web propia');
  }
  if (n.direccion && !enZona(n.direccion, ajustes)) {
    puntos -= 40;
    razones.push('-40 fuera de la zona');
  }
  if (esSanitario(`${n.nombre ?? ''} ${n.sector ?? ''}`)) {
    puntos -= 10;
    razones.push('-10 sanitario: la publicidad tiene normas especiales, revisar con Miguel');
  }
  return { puntos: Math.max(0, Math.min(100, puntos)), razones };
}

// ---------------------------------------------------------------------------
// Horario comercial y festivos
// ---------------------------------------------------------------------------

const DIAS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const NOMBRES_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function partesEnZona(fecha, zona = AJUSTES.horario.zonaHoraria) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(fecha).map((x) => [x.type, x.value]));
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    dia: DIAS[p.weekday],
    minutos: Number(p.hour) * 60 + Number(p.minute),
  };
}

const aMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * ¿Es buen momento para llamar o escribir?
 * Devuelve { dentro, motivo, siguiente } donde siguiente es un texto
 * como "hoy a las 17:00" o "el lunes a las 10:00".
 */
export function estadoHorario(ahora = new Date(), ajustes = AJUSTES, festivosExtra = []) {
  const festivos = new Set([...(ajustes.festivos ?? []), ...festivosExtra]);
  const { horario } = ajustes;
  const p = partesEnZona(ahora, horario.zonaHoraria);
  const franjas = horario.franjas.map(([a, b]) => [aMinutos(a), aMinutos(b)]);
  const esLaborable = (partes) => horario.dias.includes(partes.dia) && !festivos.has(partes.fecha);

  let motivo = '';
  if (festivos.has(p.fecha)) motivo = 'Hoy es festivo.';
  else if (!horario.dias.includes(p.dia)) motivo = 'Hoy no es día laborable.';
  else if (!franjas.some(([a, b]) => p.minutos >= a && p.minutos < b)) motivo = 'Fuera del horario comercial.';
  if (!motivo) return { dentro: true, motivo: '', siguiente: '' };

  // Buscar la siguiente franja disponible (máximo 15 días).
  for (let d = 0; d < 15; d++) {
    const dia = new Date(ahora.getTime() + d * 86400000);
    const pd = partesEnZona(dia, horario.zonaHoraria);
    if (!esLaborable(pd)) continue;
    for (const [a] of franjas) {
      if (d === 0 && a <= p.minutos) continue;
      const hh = String(Math.floor(a / 60)).padStart(2, '0');
      const mm = String(a % 60).padStart(2, '0');
      const cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : `el ${NOMBRES_DIA[pd.dia]}`;
      return { dentro: false, motivo, siguiente: `${cuando} a las ${hh}:${mm}` };
    }
  }
  return { dentro: false, motivo, siguiente: '' };
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

/** Cambia {negocio}, {demo_url}... por sus valores. Devuelve también los huecos que faltan. */
export function rellenarPlantilla(texto = '', valores = {}) {
  const faltan = new Set();
  const resultado = texto.replace(/\{([a-z_]+)\}/g, (todo, clave) => {
    const v = valores[clave];
    if (v === undefined || v === null || String(v).trim() === '') {
      faltan.add(clave);
      return todo;
    }
    return String(v);
  });
  return { texto: resultado, faltan: [...faltan] };
}

const PROHIBIDAS = [
  'oferta', 'descuento', 'promoción', 'promocion', 'solo hoy', 'sólo hoy', 'últimas plazas',
  'ultimas plazas', 'no es una venta', 'no es publicidad', 'urgente', 'última oportunidad',
  'ultima oportunidad', 'precio especial',
];

export function contarPalabras(texto = '') {
  return (texto.trim().match(/\S+/g) ?? []).length;
}

/**
 * Revisa un mensaje antes de enviarlo (igual que el filtro de Harvey).
 * modo: 'frio' | 'seguimiento' | 'conversacion'
 */
export function validarMensaje(texto = '', { demoUrl = '', modo = 'frio', ajustes = AJUSTES } = {}) {
  const problemas = [];
  const avisos = [];
  const max = ajustes.limites.caracteresMensaje;
  if (!texto.trim()) problemas.push('El mensaje está vacío.');
  if (texto.length > max) problemas.push(`Demasiado largo: ${texto.length} caracteres (máximo ${max}).`);
  if (/\d[\d.,]*\s?(€|eur\b|euros?\b)|€\s?\d/i.test(texto)) problemas.push('No pongas precios por escrito: se hablan en persona.');
  const bajo = texto.toLowerCase();
  for (const p of PROHIBIDAS) if (bajo.includes(p)) problemas.push(`Quita "${p}": suena a publicidad agresiva.`);
  const enlaces = texto.match(/https?:\/\/[^\s)]+/gi) ?? [];
  if (enlaces.length > 1) problemas.push('Pon un solo enlace (el de su demo).');
  if (enlaces.length === 1 && demoUrl && !enlaces[0].startsWith(demoUrl.replace(/\/$/, ''))) {
    problemas.push('El enlace tiene que ser el de su demo.');
  }
  if (modo === 'frio' && enlaces.length === 0) problemas.push('Falta el enlace a su demo.');
  if (modo !== 'conversacion' && !/\bBAJA\b/.test(texto)) problemas.push('Falta la frase para darse de baja (responder BAJA).');
  const huecos = texto.match(/\{[a-z_]+\}/g);
  if (huecos) problemas.push(`Quedan huecos sin rellenar: ${[...new Set(huecos)].join(', ')}.`);
  const palabras = contarPalabras(texto);
  if (modo === 'frio' && palabras > 90) avisos.push(`Es largo (${palabras} palabras). Mejor menos de 80.`);
  if ((texto.match(/!/g) ?? []).length > 1) avisos.push('Demasiadas exclamaciones.');
  const emojis = texto.match(/\p{Extended_Pictographic}/gu) ?? [];
  if (emojis.length > 2) avisos.push('Demasiados emojis.');
  return { ok: problemas.length === 0, problemas, avisos, palabras };
}

// ---------------------------------------------------------------------------
// ¿Puedo contactar ahora con este negocio?
// ---------------------------------------------------------------------------

const ETAPAS_CONVERSACION = ['respondio', 'interesado', 'cliente'];

/**
 * Decide si se puede llamar o escribir a un negocio y en qué "modo".
 * Devuelve { ok, modo, motivos, avisos }:
 *  - motivos: razones que lo impiden (si hay alguna, ok = false)
 *  - avisos: cosas a tener en cuenta, pero no lo impiden
 *  - modo: 'frio' | 'seguimiento' | 'conversacion' | 'llamada'
 */
export function puedeContactar({
  negocio,
  canal,
  actividades = [],
  demo = null,
  enviadosHoy = 0,
  ahora = new Date(),
  ajustes = AJUSTES,
  festivos = [],
}) {
  const motivos = [];
  const avisos = [];
  const { limites } = ajustes;

  if (negocio.no_contactar || negocio.etapa === 'baja') {
    return { ok: false, modo: '', motivos: ['Pidió no ser contactado (baja). No se le escribe ni se le llama nunca más.'], avisos };
  }

  const horario = estadoHorario(ahora, ajustes, festivos);
  const conversacion = ETAPAS_CONVERSACION.includes(negocio.etapa);
  const tel = normalizarTelefono(negocio.telefono);
  if (!tel) motivos.push('No tiene un teléfono válido.');

  if (canal === 'llamada') {
    const sinRespuesta = actividades.filter(
      (a) => a.tipo === 'llamada' && (a.resultado === 'no_contesta' || a.resultado === 'buzon'),
    ).length;
    const atendida = actividades.some(
      (a) => a.tipo === 'llamada' && a.resultado && a.resultado !== 'no_contesta' && a.resultado !== 'buzon',
    );
    if (!conversacion && !atendida && sinRespuesta >= limites.llamadasSinRespuestaMax) {
      motivos.push(`Ya lo has intentado ${sinRespuesta} veces sin respuesta. Mejor pasar a WhatsApp o visita.`);
    }
    if (!horario.dentro) avisos.push(`${horario.motivo} Mejor ${horario.siguiente || 'en horario comercial'}.`);
    return { ok: motivos.length === 0, modo: 'llamada', motivos, avisos };
  }

  if (canal !== 'whatsapp') return { ok: motivos.length === 0, modo: canal, motivos, avisos };

  if (tel && tipoTelefono(tel) !== 'movil') motivos.push('El teléfono es fijo: llama en vez de escribir.');

  if (conversacion) {
    if (!horario.dentro) avisos.push(`${horario.motivo} Si no es urgente, contesta ${horario.siguiente || 'en horario comercial'}.`);
    return { ok: motivos.length === 0, modo: 'conversacion', motivos, avisos };
  }

  const enviados = actividades
    .filter((a) => a.tipo === 'whatsapp' && a.resultado === 'enviado')
    .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
  const modo = enviados.length === 0 ? 'frio' : 'seguimiento';

  const demoAprobada = demo && (demo.estado === 'aprobada' || demo.estado === 'publicada');
  if (!demoAprobada) motivos.push('Su demo todavía no está aprobada. Nada se envía sin revisión.');

  if (enviados.length >= limites.whatsappMaxSinRespuesta) {
    motivos.push('Ya recibió el primer mensaje y el seguimiento sin responder. No se insiste más por WhatsApp.');
  } else if (modo === 'seguimiento') {
    const ultimo = new Date(enviados[enviados.length - 1].creado_en);
    const espera = limites.diasParaSeguimiento * 86400000;
    if (ahora.getTime() - ultimo.getTime() < espera) {
      const cuando = new Date(ultimo.getTime() + espera);
      motivos.push(`Espera al ${cuando.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} para el seguimiento.`);
    }
  }

  if (modo === 'frio' && enviadosHoy >= limites.whatsappFrioPorDia) {
    motivos.push(`Hoy ya has enviado ${enviadosHoy} primeros mensajes (límite ${limites.whatsappFrioPorDia}). Mañana más.`);
  }
  if (!horario.dentro) motivos.push(`${horario.motivo} Envíalo ${horario.siguiente || 'en horario comercial'}.`);
  if (negocio.permiso_whatsapp) avisos.push('Aceptó por teléfono recibir la demo por WhatsApp.');

  return { ok: motivos.length === 0, modo, motivos, avisos };
}
