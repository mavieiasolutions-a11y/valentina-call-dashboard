import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTelefono,
  tipoTelefono,
  formatearTelefono,
  enlaceWhatsApp,
  slugify,
  clasificarWeb,
  necesitaWeb,
  enZona,
  puntuarNegocio,
  estadoHorario,
  rellenarPlantilla,
  validarMensaje,
  puedeContactar,
  avanzarEtapa,
  etapaTrasActividad,
  esSanitario,
} from '../../crm/js/reglas.js';
import { AJUSTES } from '../../crm/js/ajustes.js';
import { PLANTILLAS_BASE, unirPlantillas } from '../../crm/js/plantillas-base.js';

// Fechas de referencia (hora de Madrid, noviembre = UTC+1)
const MIERCOLES_11H = new Date('2026-11-04T10:00:00Z'); // miércoles 11:00 en Madrid
const MIERCOLES_15H = new Date('2026-11-04T14:00:00Z'); // 15:00, entre franjas
const SABADO = new Date('2026-11-07T10:00:00Z');
const LUNES_FESTIVO = new Date('2026-12-07T10:00:00Z');

test('normaliza teléfonos españoles y de Gibraltar', () => {
  assert.equal(normalizarTelefono('600 11 22 33'), '+34600112233');
  assert.equal(normalizarTelefono('+34 956-12-34-56'), '+34956123456');
  assert.equal(normalizarTelefono('0034 600112233'), '+34600112233');
  assert.equal(normalizarTelefono('34600112233'), '+34600112233');
  assert.equal(normalizarTelefono('+34 600112233'), '+34600112233');
  assert.equal(normalizarTelefono('200 12345'), '+35020012345');
  assert.equal(normalizarTelefono('123'), '');
  assert.equal(normalizarTelefono(''), '');
  assert.equal(normalizarTelefono(null), '');
  assert.equal(normalizarTelefono('+34 500112233'), '');
});

test('distingue móvil y fijo', () => {
  assert.equal(tipoTelefono('+34600112233'), 'movil');
  assert.equal(tipoTelefono('+34711223344'), 'movil');
  assert.equal(tipoTelefono('+34956123456'), 'fijo');
  assert.equal(tipoTelefono('+35054012345'), 'movil');
  assert.equal(tipoTelefono('+35020012345'), 'fijo');
  assert.equal(tipoTelefono(''), 'otro');
});

test('formatea y crea enlaces', () => {
  assert.equal(formatearTelefono('+34600112233'), '600 112 233');
  assert.equal(enlaceWhatsApp('+34600112233', 'Hola & adiós'), 'https://wa.me/34600112233?text=Hola%20%26%20adi%C3%B3s');
  assert.equal(enlaceWhatsApp('+34600112233'), 'https://wa.me/34600112233');
  assert.equal(enlaceWhatsApp(''), '');
});

test('slugify quita acentos y símbolos', () => {
  assert.equal(slugify('Peluquería Rocío & Co.'), 'peluqueria-rocio-y-co');
  assert.equal(slugify('  Taller   Ñandú  '), 'taller-nandu');
  assert.ok(slugify('x'.repeat(100)).length <= 48);
});

test('clasifica webs: propia, redes, directorios', () => {
  assert.equal(clasificarWeb(''), 'sin_web');
  assert.equal(clasificarWeb('https://www.instagram.com/barberia'), 'redes');
  assert.equal(clasificarWeb('facebook.com/pages/x'), 'redes');
  assert.equal(clasificarWeb('https://booksy.com/es-es/123'), 'directorio');
  assert.equal(clasificarWeb('https://www.paginasamarillas.es/f/algeciras'), 'directorio');
  assert.equal(clasificarWeb('https://barberiaelfaro.es'), 'propia');
  assert.equal(necesitaWeb('https://barberiaelfaro.es'), false);
  assert.equal(necesitaWeb('https://instagram.com/x'), true);
});

test('zona: código postal y municipio, y descarta otros países', () => {
  assert.equal(enZona('Calle Real 3, 11201 Algeciras, Cádiz'), true);
  assert.equal(enZona('Av. España 10, 11300 La Línea de la Concepción'), true);
  assert.equal(enZona('Calle Sol 2, Tarifa'), true);
  assert.equal(enZona('Main Street 5, Gibraltar GX11 1AA'), true);
  assert.equal(enZona('Calle Larios 1, 29005 Málaga'), false);
  assert.equal(enZona('Av. Reforma 222, 11200 Ciudad de México, México'), false);
  assert.equal(enZona(''), false);
});

test('puntúa mejor a quien tiene móvil, reseñas y solo redes', () => {
  const bueno = puntuarNegocio({
    nombre: 'Barbería Sur', telefono: '600112233', num_resenas: 80, valoracion: 4.7,
    web: 'https://instagram.com/barberiasur', direccion: 'C/ Ancha 1, 11201 Algeciras',
  });
  const malo = puntuarNegocio({
    nombre: 'Tienda X', telefono: '', num_resenas: 0, web: 'https://tiendax.es', direccion: 'Madrid 28001',
  });
  assert.ok(bueno.puntos > 80, `bueno = ${bueno.puntos}`);
  assert.equal(malo.puntos, 0);
  assert.ok(bueno.razones.length > 0);
});

test('detecta negocios sanitarios', () => {
  assert.equal(esSanitario('Clínica Dental Sonrisa'), true);
  assert.equal(esSanitario('Dra. Pérez estética'), true);
  assert.equal(esSanitario('Barbería El Faro'), false);
});

test('horario comercial: franjas, fines de semana y festivos', () => {
  assert.equal(estadoHorario(MIERCOLES_11H).dentro, true);
  const tarde = estadoHorario(MIERCOLES_15H);
  assert.equal(tarde.dentro, false);
  assert.equal(tarde.siguiente, 'hoy a las 17:00');
  const sabado = estadoHorario(SABADO);
  assert.equal(sabado.dentro, false);
  assert.equal(sabado.siguiente, 'el lunes a las 10:00');
  const festivo = estadoHorario(LUNES_FESTIVO);
  assert.equal(festivo.dentro, false);
  assert.match(festivo.motivo, /festivo/);
  assert.equal(festivo.siguiente, 'el miércoles a las 10:00'); // 8 de diciembre también es festivo
  assert.equal(estadoHorario(MIERCOLES_11H, AJUSTES, ['2026-11-04']).dentro, false);
});

test('rellena plantillas y avisa de huecos', () => {
  const r = rellenarPlantilla('Hola {negocio}, mira {demo_url} {nada}', { negocio: 'Faro', demo_url: 'https://x.dev/faro/' });
  assert.equal(r.texto, 'Hola Faro, mira https://x.dev/faro/ {nada}');
  assert.deepEqual(r.faltan, ['nada']);
});

test('las plantillas de serie pasan el filtro de mensajes', () => {
  const valores = {
    negocio: 'Barbería El Faro', demo_url: 'https://mavie-demos.pages.dev/barberia-el-faro/',
    remitente: 'Valentina', empresa: 'Mavie IA Solutions', identificacion: AJUSTES.empresa.identificacion,
    municipio: 'Algeciras',
  };
  for (const p of PLANTILLAS_BASE.filter((x) => x.canal === 'whatsapp')) {
    const { texto, faltan } = rellenarPlantilla(p.texto, valores);
    assert.deepEqual(faltan, [], p.clave);
    const v = validarMensaje(texto, { demoUrl: valores.demo_url, modo: p.modo });
    assert.deepEqual(v.problemas, [], `${p.clave}: ${v.problemas.join(' | ')}`);
    if (p.modo === 'frio') assert.ok(v.palabras <= 90, `${p.clave} tiene ${v.palabras} palabras`);
  }
});

test('el filtro bloquea precios, varios enlaces, urgencias y falta de BAJA', () => {
  const demo = 'https://mavie-demos.pages.dev/faro/';
  const v = validarMensaje('Oferta: web por 150 € https://a.com https://b.com', { demoUrl: demo });
  assert.equal(v.ok, false);
  assert.ok(v.problemas.some((p) => p.includes('precios')));
  assert.ok(v.problemas.some((p) => p.includes('un solo enlace')));
  assert.ok(v.problemas.some((p) => p.includes('oferta')));
  assert.ok(v.problemas.some((p) => p.includes('BAJA')));
  const otro = validarMensaje(`Mira https://otra.web/ y responde BAJA`, { demoUrl: demo });
  assert.ok(otro.problemas.some((p) => p.includes('el de su demo')));
  assert.equal(validarMensaje('Depende, lo vemos en diez minutos.', { modo: 'conversacion' }).ok, true);
});

test('unirPlantillas: las guardadas mandan sobre las de serie', () => {
  const propias = [{ clave: 'whatsapp_frio', texto: 'mío' }];
  const todas = unirPlantillas(propias);
  assert.equal(todas.find((p) => p.clave === 'whatsapp_frio').texto, 'mío');
  assert.equal(todas.length, PLANTILLAS_BASE.length);
});

test('las etapas solo avanzan, salvo baja, cliente y descartado', () => {
  assert.equal(avanzarEtapa('nuevo', 'contactado'), 'contactado');
  assert.equal(avanzarEtapa('interesado', 'contactado'), 'interesado');
  assert.equal(avanzarEtapa('interesado', 'baja'), 'baja');
  assert.equal(avanzarEtapa('baja', 'interesado'), 'baja');
  assert.equal(avanzarEtapa('cliente', 'baja'), 'cliente');
  assert.equal(avanzarEtapa('descartado', 'contactado'), 'descartado');
  assert.equal(avanzarEtapa('descartado', 'respondio'), 'respondio');
  assert.equal(avanzarEtapa('nuevo', null), 'nuevo');
  assert.equal(etapaTrasActividad('demo_lista', 'whatsapp', 'enviado'), 'contactado');
  assert.equal(etapaTrasActividad('contactado', 'llamada', 'no_interesa'), 'baja');
  assert.equal(etapaTrasActividad('contactado', 'llamada', 'no_contesta'), 'contactado');
});

// ---------------------------------------------------------------------------
// ¿Se puede contactar?
// ---------------------------------------------------------------------------

const negocio = { etapa: 'demo_lista', telefono: '+34600112233', no_contactar: false };
const demoOk = { estado: 'aprobada' };

test('primer WhatsApp: necesita demo aprobada, horario y límite diario', () => {
  assert.equal(puedeContactar({ negocio, canal: 'whatsapp', demo: demoOk, ahora: MIERCOLES_11H }).ok, true);
  assert.equal(puedeContactar({ negocio, canal: 'whatsapp', demo: demoOk, ahora: MIERCOLES_11H }).modo, 'frio');
  const sinDemo = puedeContactar({ negocio, canal: 'whatsapp', demo: { estado: 'diseno' }, ahora: MIERCOLES_11H });
  assert.equal(sinDemo.ok, false);
  const tarde = puedeContactar({ negocio, canal: 'whatsapp', demo: demoOk, ahora: MIERCOLES_15H });
  assert.equal(tarde.ok, false);
  assert.ok(tarde.motivos.some((m) => m.includes('17:00')));
  const limite = puedeContactar({ negocio, canal: 'whatsapp', demo: demoOk, ahora: MIERCOLES_11H, enviadosHoy: 10 });
  assert.equal(limite.ok, false);
});

test('WhatsApp a fijo o a baja: nunca', () => {
  const fijo = puedeContactar({ negocio: { ...negocio, telefono: '+34956123456' }, canal: 'whatsapp', demo: demoOk, ahora: MIERCOLES_11H });
  assert.equal(fijo.ok, false);
  const baja = puedeContactar({ negocio: { ...negocio, no_contactar: true }, canal: 'llamada', ahora: MIERCOLES_11H });
  assert.equal(baja.ok, false);
});

test('seguimiento: uno solo y después de esperar', () => {
  const hace2 = { tipo: 'whatsapp', resultado: 'enviado', creado_en: '2026-11-02T10:00:00Z' };
  const hace6 = { tipo: 'whatsapp', resultado: 'enviado', creado_en: '2026-10-29T10:00:00Z' };
  const pronto = puedeContactar({ negocio: { ...negocio, etapa: 'contactado' }, canal: 'whatsapp', demo: demoOk, actividades: [hace2], ahora: MIERCOLES_11H });
  assert.equal(pronto.modo, 'seguimiento');
  assert.equal(pronto.ok, false);
  const ya = puedeContactar({ negocio: { ...negocio, etapa: 'contactado' }, canal: 'whatsapp', demo: demoOk, actividades: [hace6], ahora: MIERCOLES_11H });
  assert.equal(ya.ok, true);
  const dos = puedeContactar({ negocio: { ...negocio, etapa: 'contactado' }, canal: 'whatsapp', demo: demoOk, actividades: [hace6, hace2], ahora: MIERCOLES_11H });
  assert.equal(dos.ok, false);
});

test('si ha respondido, se conversa sin límites de frío', () => {
  const r = puedeContactar({
    negocio: { ...negocio, etapa: 'respondio' }, canal: 'whatsapp', demo: null, ahora: MIERCOLES_15H,
    actividades: [{ tipo: 'whatsapp', resultado: 'enviado', creado_en: '2026-11-03T10:00:00Z' }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.modo, 'conversacion');
  assert.ok(r.avisos.length > 0);
});

test('llamadas: máximo de intentos sin respuesta y aviso fuera de horario', () => {
  const sinRespuesta = Array.from({ length: 3 }, () => ({ tipo: 'llamada', resultado: 'no_contesta' }));
  assert.equal(puedeContactar({ negocio, canal: 'llamada', actividades: sinRespuesta, ahora: MIERCOLES_11H }).ok, false);
  const fuera = puedeContactar({ negocio, canal: 'llamada', ahora: SABADO });
  assert.equal(fuera.ok, true);
  assert.ok(fuera.avisos.length > 0);
});
