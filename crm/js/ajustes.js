// Ajustes del negocio. Este archivo lo usan el CRM (navegador) y los scripts
// de Antigravity (Node), así que solo puede tener datos, nada de claves.
// Si cambias algo aquí, cambia para los dos.

export const AJUSTES = {
  empresa: {
    nombre: 'Mavie IA Solutions',
    web: 'mavieiasolutions.com',
    // Línea que va al final de cada primer mensaje: quién escribe y cómo darse de baja.
    // Si Miguel quiere añadir titular o NIF, se pone aquí.
    identificacion: 'Mavie IA Solutions · mavieiasolutions.com',
  },

  // Nombre con el que firma quien contacta (aparece en plantillas como {remitente}).
  remitente: 'Valentina',

  // Zona de trabajo. Igual que Harvey: el Campo de Gibraltar.
  // codigosPostales son prefijos: '112' vale para 11201, 11202...
  zona: {
    nombre: 'Campo de Gibraltar',
    provincia: 'Cádiz',
    municipios: [
      'Algeciras',
      'La Línea de la Concepción',
      'San Roque',
      'Los Barrios',
      'Tarifa',
      'Castellar de la Frontera',
      'Jimena de la Frontera',
      'San Martín del Tesorillo',
    ],
    codigosPostales: ['112', '113'],
  },

  // Sectores que suelen no tener web y la necesitan. Es una lista de ideas,
  // se puede buscar cualquier otro.
  sectores: [
    'peluquería',
    'barbería',
    'taller mecánico',
    'bar',
    'restaurante',
    'cafetería',
    'panadería',
    'frutería',
    'carnicería',
    'floristería',
    'tienda de ropa',
    'zapatería',
    'ferretería',
    'fontanero',
    'electricista',
    'cerrajero',
    'carpintería',
    'reformas',
    'academia',
    'autoescuela',
    'gimnasio',
    'veterinario',
    'lavandería',
    'tatuajes',
  ],

  // Horario en el que se llama o se escribe a negocios (hora de España).
  horario: {
    zonaHoraria: 'Europe/Madrid',
    dias: [1, 2, 3, 4, 5], // lunes a viernes
    franjas: [
      ['10:00', '13:30'],
      ['17:00', '19:30'],
    ],
  },

  limites: {
    whatsappFrioPorDia: 10, // primeros mensajes al día desde su móvil
    whatsappMaxSinRespuesta: 2, // primer mensaje + un seguimiento, nunca más
    llamadasSinRespuestaMax: 3, // intentos en los que no cogen el teléfono
    diasParaSeguimiento: 4, // días de espera antes del segundo mensaje
    caracteresMensaje: 950,
  },

  // Festivos en los que no se contacta. La web también consulta la API
  // gratuita date.nager.at (festivos de España y Andalucía) cuando puede.
  // Aquí van los locales de cada pueblo y los que falten. Formato AAAA-MM-DD.
  regionFestivos: 'ES-AN',
  festivos: [
    // Andalucía 2026 (compruébalo con el calendario laboral oficial)
    '2026-01-01', '2026-01-06', '2026-02-28', '2026-04-02', '2026-04-03',
    '2026-05-01', '2026-08-15', '2026-10-12', '2026-11-02', '2026-12-07',
    '2026-12-08', '2026-12-25',
  ],

  // Dirección donde se publican las demos (proyecto de Cloudflare Pages).
  // Cámbiala cuando tengáis dominio propio, por ejemplo https://demos.mavieiasolutions.com
  demos: {
    urlBase: 'https://mavie-demos.pages.dev',
  },
};
