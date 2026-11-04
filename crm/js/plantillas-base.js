// Plantillas de mensajes y guion de llamada que vienen de serie.
// Desde la pestaña "Plantillas" del CRM se pueden cambiar; los cambios se
// guardan en la base de datos y tienen prioridad sobre estas.
//
// Huecos disponibles: {negocio} {demo_url} {remitente} {empresa} {identificacion} {municipio}
// Reglas (las comprueba reglas.js): menos de 80 palabras, un solo enlace,
// sin precios, sin urgencias, y siempre la opción de BAJA en el primer mensaje.

export const PLANTILLAS_BASE = [
  {
    clave: 'whatsapp_frio',
    canal: 'whatsapp',
    modo: 'frio',
    nombre: 'Primer WhatsApp con la demo',
    texto:
      'Hola, soy {remitente}, de {empresa}. Buscando negocios de {municipio} vimos que {negocio} no tiene página web, ' +
      'así que os hemos preparado una de muestra, sin compromiso: {demo_url}\n\n' +
      'Es solo una idea para que veáis cómo podría quedar. ¿Qué os parece? ' +
      'Si os gusta, os lo enseñamos en diez minutos.\n\n' +
      '{identificacion}. Si no os interesa, responded BAJA y no os volvemos a escribir.',
  },
  {
    clave: 'whatsapp_tras_llamada',
    canal: 'whatsapp',
    modo: 'frio',
    nombre: 'WhatsApp después de hablar por teléfono',
    texto:
      'Hola, soy {remitente}, de {empresa}. Como hemos hablado por teléfono, aquí tenéis la web de muestra ' +
      'que hemos preparado para {negocio}: {demo_url}\n\n' +
      'Miradla con calma y decidme qué cambiaríais.\n\n' +
      '{identificacion}. Si no os interesa, responded BAJA y no os volvemos a escribir.',
  },
  {
    clave: 'whatsapp_seguimiento',
    canal: 'whatsapp',
    modo: 'seguimiento',
    nombre: 'Seguimiento (solo uno)',
    texto:
      'Hola de nuevo, soy {remitente}. Hace unos días os envié la web de muestra de {negocio}: {demo_url}\n\n' +
      '¿Habéis podido verla? Si queréis cambiar algo, colores, fotos o textos, lo ajustamos.\n\n' +
      'Si no os interesa, responded BAJA y no os escribimos más.',
  },
  {
    clave: 'respuesta_precio',
    canal: 'whatsapp',
    modo: 'conversacion',
    nombre: 'Respuesta: ¿cuánto cuesta?',
    texto:
      'Depende de lo que necesitéis: no es lo mismo una página sencilla que una con reservas. ' +
      'Lo vemos en diez minutos y os digo exactamente. ¿Cuándo os viene bien?',
  },
  {
    clave: 'respuesta_contacto',
    canal: 'whatsapp',
    modo: 'conversacion',
    nombre: 'Respuesta: ¿cómo tenéis mi número?',
    texto:
      'Lo vimos en vuestra ficha pública de Google Maps. Si preferís que lo borremos, decídmelo y lo hacemos ahora mismo.',
  },
  {
    clave: 'respuesta_no_carga',
    canal: 'whatsapp',
    modo: 'conversacion',
    nombre: 'Respuesta: no me carga la página',
    texto:
      'Algunos días las operadoras bloquean un rato parte de las páginas de internet. ' +
      'Probad más tarde o con otra conexión (wifi o datos), o si queréis os la enseño en persona.',
  },
  {
    clave: 'respuesta_baja',
    canal: 'whatsapp',
    modo: 'conversacion',
    nombre: 'Respuesta: baja',
    texto: 'Gracias por decírnoslo. No os volvemos a escribir. ¡Mucha suerte con {negocio}!',
  },
  {
    clave: 'guion_llamada',
    canal: 'llamada',
    modo: 'llamada',
    nombre: 'Guion de llamada',
    texto:
      '1. SALUDO (10 segundos)\n' +
      '"Hola, ¿hablo con {negocio}? Soy {remitente}, de {empresa}, una agencia de aquí del Campo de Gibraltar."\n\n' +
      '2. MOTIVO\n' +
      '"Os llamo porque buscando negocios de {municipio} vi que no tenéis página web, y os hemos preparado una de muestra, gratis y sin compromiso."\n\n' +
      '3. PREGUNTA FÁCIL\n' +
      '"¿Os la puedo mandar por WhatsApp a este número para que la veáis con calma?"\n' +
      '   - Sí → resultado "Acepta que le envíe la demo por WhatsApp".\n' +
      '   - Ahora no puedo → "¿Cuándo os viene mejor que os llame?" → "Volver a llamar" con fecha.\n\n' +
      '4. OBJECIONES\n' +
      '- "Ya tengo Instagram": "Genial, la web no lo sustituye: hace que os encuentren en Google y lleva a vuestro Instagram y WhatsApp."\n' +
      '- "¿Cuánto cuesta?": "Depende de lo que necesitéis. Primero mirad la muestra y, si os gusta, lo vemos en diez minutos."\n' +
      '- "No tengo tiempo": "Por eso os la mandamos hecha. Solo tenéis que mirarla."\n' +
      '- "No me interesa": "Perfecto, gracias. No os volvemos a llamar." → resultado "No le interesa (baja)".\n\n' +
      '5. CIERRE\n' +
      '"Muchas gracias, ahora os la envío. Cualquier cambio que queráis, me decís."',
  },
];

export function plantillaPorClave(clave, propias = []) {
  return propias.find((p) => p.clave === clave) ?? PLANTILLAS_BASE.find((p) => p.clave === clave) ?? null;
}

/** Une las plantillas guardadas en la base de datos con las de serie (las guardadas mandan). */
export function unirPlantillas(propias = []) {
  const claves = new Set(propias.map((p) => p.clave));
  return [...propias, ...PLANTILLAS_BASE.filter((p) => !claves.has(p.clave))];
}
