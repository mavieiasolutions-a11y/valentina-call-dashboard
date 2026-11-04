// "Modo prueba": el CRM funciona con datos de ejemplo guardados en este
// navegador, sin base de datos. Sirve para aprender a usarlo y para los
// tests automáticos. Se activa solo cuando crm/config.js está vacío.
//
// Imita las reglas de la base de datos (supabase/migrations) usando las
// mismas funciones de reglas.js.

import { etapaTrasActividad, avanzarEtapa, ETAPA_POR_RESULTADO, RESULTADOS } from './reglas.js';
import { AJUSTES } from './ajustes.js';

const CLAVE = 'crm-valentina-prueba-v1';
const USUARIO = { id: 'prueba-admin', email: 'prueba@ejemplo.local', nombre: 'Valentina (prueba)', rol: 'admin' };

let memoria = null; // por si el navegador no deja usar localStorage

function hace(dias, horas = 0) {
  return new Date(Date.now() - dias * 86400000 - horas * 3600000).toISOString();
}

function dentroDe(dias, hora = 10, minutos = 30) {
  const d = new Date(Date.now() + dias * 86400000);
  d.setHours(hora, minutos, 0, 0);
  return d.toISOString();
}

function semilla() {
  const base = { sector: '', direccion: '', municipio: 'Algeciras', codigo_postal: '', email: '', web: '', web_tipo: 'sin_web',
    posible_web: '', instagram: '', maps_url: '', valoracion: null, num_resenas: 0, horario: null, lat: null, lng: null,
    fuente: 'serper', puntuacion: 50, sanitario: false, etapa: 'nuevo', no_contactar: false, motivo_no_contactar: '',
    permiso_whatsapp: false, proxima_accion_en: null, proxima_accion: '', notas: '', creado_por: USUARIO.id };
  const n = (id, datos) => ({ ...base, id, fuente_id: `prueba:${id}`, creado_en: hace(10), actualizado_en: hace(1), ...datos });
  const negocios = [
    n('n1', { nombre: 'Barbería El Faro', sector: 'Barbería', direccion: 'Calle Ejemplo 1, 11201 Algeciras', codigo_postal: '11201',
      telefono: '+34600000001', telefono_tipo: 'movil', valoracion: 4.8, num_resenas: 96, puntuacion: 95, etapa: 'demo_lista',
      web: 'https://instagram.com/ejemplo', web_tipo: 'redes', instagram: 'https://instagram.com/ejemplo',
      notas: 'Solo tiene Instagram. Mucho movimiento los sábados.' }),
    n('n2', { nombre: 'Panadería La Espiga', sector: 'Panadería', direccion: 'Calle Ejemplo 2, 11380 Tarifa', municipio: 'Tarifa',
      codigo_postal: '11380', telefono: '+34600000002', telefono_tipo: 'movil', valoracion: 4.6, num_resenas: 41, puntuacion: 75,
      etapa: 'en_diseno' }),
    n('n3', { nombre: 'Taller Hermanos Ruiz', sector: 'Taller mecánico', direccion: 'Polígono Ejemplo 3, 11370 Los Barrios',
      municipio: 'Los Barrios', codigo_postal: '11370', telefono: '+34956000003', telefono_tipo: 'fijo', valoracion: 4.4,
      num_resenas: 23, puntuacion: 55, etapa: 'cualificado', proxima_accion_en: dentroDe(0, 10, 0),
      proxima_accion: 'Llamar para ofrecer la demo' }),
    n('n4', { nombre: 'Floristería Azahar', sector: 'Floristería', direccion: 'Calle Ejemplo 4, 11300 La Línea de la Concepción',
      municipio: 'La Línea de la Concepción', codigo_postal: '11300', telefono: '+34600000004', telefono_tipo: 'movil',
      valoracion: 4.9, num_resenas: 12, puntuacion: 70, etapa: 'contactado', proxima_accion_en: dentroDe(-1, 17, 0),
      proxima_accion: 'Seguimiento WhatsApp' }),
    n('n5', { nombre: 'Bar La Bahía', sector: 'Bar', direccion: 'Paseo Ejemplo 5, 11360 San Roque', municipio: 'San Roque',
      codigo_postal: '11360', telefono: '+34600000005', telefono_tipo: 'movil', valoracion: 4.2, num_resenas: 210, puntuacion: 80,
      etapa: 'interesado', proxima_accion_en: dentroDe(1, 11, 0), proxima_accion: 'Enseñarle la demo en persona' }),
    n('n6', { nombre: 'Academia Estrecho', sector: 'Academia', direccion: 'Avenida Ejemplo 6, 11202 Algeciras',
      codigo_postal: '11202', telefono: '+34600000006', telefono_tipo: 'movil', num_resenas: 8, puntuacion: 60 }),
    n('n7', { nombre: 'Frutería Doña Carmen', sector: 'Frutería', direccion: 'Mercado Ejemplo 7, 11201 Algeciras',
      codigo_postal: '11201', telefono: '+34600000007', telefono_tipo: 'movil', num_resenas: 15, puntuacion: 65 }),
    n('n8', { nombre: 'Cerrajería Rápida', sector: 'Cerrajero', direccion: 'Calle Ejemplo 8, 11201 Algeciras',
      codigo_postal: '11201', telefono: '+34600000008', telefono_tipo: 'movil', puntuacion: 40, etapa: 'baja',
      no_contactar: true, motivo_no_contactar: 'Pidió la baja' }),
  ];
  const demos = [
    { id: 'd1', negocio_id: 'n1', slug: 'ejemplo-barberia', marca: 'El Faro Barber Club', estilo: 'editorial', estado: 'aprobada',
      url: `${AJUSTES.demos.urlBase}/ejemplo-barberia/`, notas_revision: '', creada_por: USUARIO.id, aprobada_por: USUARIO.id,
      aprobada_en: hace(1), creado_en: hace(3), actualizado_en: hace(1) },
    { id: 'd2', negocio_id: 'n2', slug: 'panaderia-la-espiga', marca: 'La Espiga', estilo: 'clasico', estado: 'revision',
      url: '', notas_revision: '', creada_por: USUARIO.id, aprobada_por: null, aprobada_en: null, creado_en: hace(2),
      actualizado_en: hace(0, 3) },
    { id: 'd3', negocio_id: 'n4', slug: 'floristeria-azahar', marca: 'Azahar Flores', estilo: 'clasico', estado: 'publicada',
      url: `${AJUSTES.demos.urlBase}/floristeria-azahar/`, notas_revision: '', creada_por: USUARIO.id, aprobada_por: USUARIO.id,
      aprobada_en: hace(6), creado_en: hace(8), actualizado_en: hace(6) },
    { id: 'd4', negocio_id: 'n5', slug: 'bar-la-bahia', marca: 'La Bahía', estilo: 'vibrante', estado: 'publicada',
      url: `${AJUSTES.demos.urlBase}/bar-la-bahia/`, notas_revision: '', creada_por: USUARIO.id, aprobada_por: USUARIO.id,
      aprobada_en: hace(9), creado_en: hace(10), actualizado_en: hace(9) },
  ];
  const a = (id, negocio_id, tipo, resultado, creado_en, extra = {}) => ({ id, negocio_id, tipo, resultado, modo: '', detalle: '',
    proxima_accion_en: null, proxima_accion: '', creado_por: USUARIO.id, creado_en, ...extra });
  const actividades = [
    a('a1', 'n4', 'whatsapp', 'enviado', hace(5), { modo: 'frio', detalle: 'Primer WhatsApp con la demo.' }),
    a('a2', 'n5', 'whatsapp', 'enviado', hace(8), { modo: 'frio' }),
    a('a3', 'n5', 'whatsapp', 'respondio', hace(7), { detalle: '«Me gusta, ¿cuánto sería?»' }),
    a('a4', 'n5', 'llamada', 'interesado', hace(6), { detalle: 'Quiere verla con su socio.' }),
    a('a5', 'n8', 'llamada', 'no_interesa', hace(4)),
    a('a6', 'n3', 'llamada', 'no_contesta', hace(1)),
    a('a7', 'n1', 'nota', '', hace(2), { detalle: 'Demo aprobada por Miguel. Lista para enviar.' }),
  ];
  return { negocios, demos, actividades, plantillas: [], busquedas: [
    { id: 'b1', consulta: 'barbería', municipio: 'Algeciras', fuente: 'serper', resultados: 20, nuevos: 6, sin_web: 9, creditos: 2, creado_en: hace(10) },
  ], noContactar: ['+34600000008'] };
}

function leer() {
  if (memoria) return memoria;
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return (memoria = JSON.parse(guardado));
  } catch {
    /* sin localStorage: se usa la memoria */
  }
  memoria = semilla();
  guardar();
  return memoria;
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(memoria));
  } catch {
    /* sin localStorage: los cambios duran hasta recargar */
  }
}

const copia = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));
const id = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function crearMotorPrueba() {
  let usuario = null;
  const avisosSesion = [];

  return {
    modoPrueba: true,
    reiniciar() {
      memoria = semilla();
      guardar();
    },

    usuario: () => usuario,
    async cargarUsuario() {
      return usuario;
    },
    alCambiarSesion(funcion) {
      avisosSesion.push(funcion);
    },
    async entrar() {
      usuario = { ...USUARIO };
      return usuario;
    },
    async salir() {
      usuario = null;
    },
    async recuperarClave() {},
    async cambiarClave() {},

    async listarNegocios({ etapa = '', texto = '', municipio = '', orden = 'puntuacion' } = {}) {
      const t = texto.trim().toLowerCase();
      let lista = leer().negocios.filter(
        (n) => (!etapa || n.etapa === etapa) && (!municipio || n.municipio === municipio)
          && (!t || `${n.nombre} ${n.sector} ${n.telefono ?? ''}`.toLowerCase().includes(t.replace(/\s/g, '')) || `${n.nombre} ${n.sector}`.toLowerCase().includes(t)),
      );
      if (orden === 'recientes') lista.sort((a, b) => b.creado_en.localeCompare(a.creado_en));
      else if (orden === 'proxima') lista.sort((a, b) => (a.proxima_accion_en ?? '9').localeCompare(b.proxima_accion_en ?? '9'));
      else lista.sort((a, b) => b.puntuacion - a.puntuacion);
      return copia(lista);
    },
    async obtenerNegocio(nid) {
      return copia(leer().negocios.find((n) => n.id === nid) ?? null);
    },
    async crearNegocio(datos) {
      const bd = leer();
      if (datos.telefono && bd.negocios.some((n) => n.telefono === datos.telefono)) throw new Error('Ya hay otro negocio con ese teléfono.');
      const nuevo = { ...semilla().negocios[5], ...datos, id: id(), fuente_id: null, etapa: 'nuevo', creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(), no_contactar: false, motivo_no_contactar: '', proxima_accion_en: null, proxima_accion: '' };
      if (datos.telefono && bd.noContactar.includes(datos.telefono)) {
        Object.assign(nuevo, { etapa: 'baja', no_contactar: true, motivo_no_contactar: 'Pidió la baja' });
      }
      bd.negocios.push(nuevo);
      guardar();
      return copia(nuevo);
    },
    async actualizarNegocio(nid, cambios) {
      const bd = leer();
      const n = bd.negocios.find((x) => x.id === nid);
      if (!n) throw new Error('No existe ese negocio.');
      if (n.no_contactar && cambios.no_contactar === false && usuario?.rol !== 'admin') {
        throw new Error('Solo un administrador puede volver a permitir el contacto con este negocio.');
      }
      Object.assign(n, cambios, { actualizado_en: new Date().toISOString() });
      if (n.etapa === 'baja') {
        n.no_contactar = true;
        n.motivo_no_contactar ||= 'Pidió la baja';
        if (n.telefono && !bd.noContactar.includes(n.telefono)) bd.noContactar.push(n.telefono);
      }
      guardar();
      return copia(n);
    },
    async contarPorEtapa() {
      const cuenta = {};
      for (const { etapa } of leer().negocios) cuenta[etapa] = (cuenta[etapa] ?? 0) + 1;
      return cuenta;
    },
    async pendientes(hasta) {
      return copia(
        leer().negocios.filter((n) => n.proxima_accion_en && !n.no_contactar && new Date(n.proxima_accion_en) <= hasta)
          .sort((a, b) => a.proxima_accion_en.localeCompare(b.proxima_accion_en)),
      );
    },

    async listarActividades(nid) {
      return copia(leer().actividades.filter((a) => a.negocio_id === nid).sort((a, b) => b.creado_en.localeCompare(a.creado_en)));
    },
    async actividadesDesde(desde) {
      return copia(leer().actividades.filter((a) => new Date(a.creado_en) >= desde));
    },
    async registrarActividad(act) {
      const bd = leer();
      const n = bd.negocios.find((x) => x.id === act.negocio_id);
      if (!n) throw new Error('No existe ese negocio.');
      const resultado = act.resultado ?? '';
      if (!RESULTADOS[act.tipo]?.some((r) => r.id === resultado)) throw new Error('Resultado no válido.');
      if (n.no_contactar && ((['whatsapp', 'email'].includes(act.tipo) && resultado === 'enviado') || (act.tipo === 'llamada' && resultado !== 'no_interesa'))) {
        throw new Error(`No se puede contactar con este negocio: ${n.motivo_no_contactar}.`);
      }
      const nueva = { modo: '', detalle: '', proxima_accion_en: null, proxima_accion: '', ...act, resultado, id: id(),
        creado_por: usuario?.id ?? USUARIO.id, creado_en: new Date().toISOString() };
      bd.actividades.push(nueva);
      const objetivo = ETAPA_POR_RESULTADO[`${act.tipo}:${resultado}`] ?? null;
      n.etapa = etapaTrasActividad(n.etapa, act.tipo, resultado);
      if (act.tipo === 'llamada' && resultado === 'acepta_whatsapp') n.permiso_whatsapp = true;
      if (objetivo === 'baja') {
        n.no_contactar = true;
        n.motivo_no_contactar = 'Pidió la baja';
        if (n.telefono && !bd.noContactar.includes(n.telefono)) bd.noContactar.push(n.telefono);
      }
      if (['llamada', 'whatsapp', 'visita', 'email'].includes(act.tipo) || act.proxima_accion_en) {
        n.proxima_accion_en = act.proxima_accion_en ?? null;
        n.proxima_accion = act.proxima_accion ?? '';
      }
      n.actualizado_en = new Date().toISOString();
      guardar();
      return copia(nueva);
    },

    async listarDemos({ estado = '' } = {}) {
      const bd = leer();
      return copia(
        bd.demos.filter((d) => !estado || d.estado === estado)
          .sort((a, b) => b.actualizado_en.localeCompare(a.actualizado_en))
          .map((d) => {
            const n = bd.negocios.find((x) => x.id === d.negocio_id);
            return { ...d, negocio: n ? { id: n.id, nombre: n.nombre, municipio: n.municipio, etapa: n.etapa } : null };
          }),
      );
    },
    async demoDeNegocio(nid) {
      return copia(leer().demos.find((d) => d.negocio_id === nid && d.estado !== 'archivada') ?? null);
    },
    async actualizarDemo(did, cambios) {
      const bd = leer();
      const d = bd.demos.find((x) => x.id === did);
      if (!d) throw new Error('No existe esa demo.');
      if (cambios.estado === 'aprobada' && d.estado !== 'aprobada') {
        if (usuario?.rol !== 'admin') throw new Error('Solo un administrador (Miguel) puede aprobar una demo.');
        cambios = { ...cambios, aprobada_por: usuario.id, aprobada_en: new Date().toISOString() };
      }
      if (cambios.estado === 'publicada' && !['aprobada', 'publicada'].includes(d.estado)) {
        throw new Error('La demo tiene que estar aprobada antes de publicarse.');
      }
      if (['diseno', 'revision'].includes(cambios.estado)) cambios = { ...cambios, aprobada_por: null, aprobada_en: null };
      if (cambios.url && !/^https:\/\/\S+$/.test(cambios.url)) throw new Error('El enlace tiene que empezar por https://');
      Object.assign(d, cambios, { actualizado_en: new Date().toISOString() });
      const n = bd.negocios.find((x) => x.id === d.negocio_id);
      if (n && ['aprobada', 'publicada'].includes(d.estado)) n.etapa = avanzarEtapa(n.etapa, 'demo_lista');
      if (n && ['diseno', 'revision'].includes(d.estado)) n.etapa = avanzarEtapa(n.etapa, 'en_diseno');
      guardar();
      return copia(d);
    },

    async listarPlantillas() {
      return copia(leer().plantillas);
    },
    async guardarPlantilla(p) {
      const bd = leer();
      bd.plantillas = bd.plantillas.filter((x) => x.clave !== p.clave);
      bd.plantillas.push({ ...p, actualizado_en: new Date().toISOString() });
      guardar();
      return copia(p);
    },
    async borrarPlantilla(clave) {
      const bd = leer();
      bd.plantillas = bd.plantillas.filter((x) => x.clave !== clave);
      guardar();
    },

    async listarBusquedas(limite = 20) {
      return copia(leer().busquedas.slice(0, limite));
    },
  };
}
