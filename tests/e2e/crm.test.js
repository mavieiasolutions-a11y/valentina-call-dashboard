// Prueba de extremo a extremo del CRM en MODO PRUEBA (sin base de datos):
// abre un navegador de verdad, hace clic como lo haría Valentina y comprueba
// que todo responde, sin errores ni avisos de seguridad (CSP) en la consola.
//
// Ejecutar: npm run test:e2e   (necesita Playwright; en GitHub Actions se instala solo)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}

const PUERTO = 5577;
const BASE = `http://localhost:${PUERTO}`;
// Miércoles 4 de noviembre de 2026 a las 11:00 en Madrid (dentro del horario comercial)
const AHORA = new Date('2026-11-04T10:00:00Z');

let servidor;
let navegador;

before(async () => {
  if (!chromium) return;
  // CRM_MODO_PRUEBA hace que el servidor ignore crm/config.js: las pruebas nunca tocan la base de datos real.
  servidor = spawn(process.execPath, ['scripts/servidor.mjs', 'crm', String(PUERTO)], {
    stdio: 'ignore',
    env: { ...process.env, CRM_MODO_PRUEBA: '1' },
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  navegador = await chromium.launch();
});

after(async () => {
  await navegador?.close();
  servidor?.kill();
});

async function nuevaPagina(viewport = { width: 390, height: 844 }) {
  const contexto = await navegador.newContext({ viewport, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await contexto.route('https://date.nager.at/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await contexto.route('https://mavie-demos.pages.dev/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
  await contexto.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'whatsapp' }));
  const pagina = await contexto.newPage();
  await pagina.clock.install({ time: AHORA });
  const errores = [];
  pagina.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errores.push(m.text());
  });
  pagina.on('pageerror', (e) => errores.push(e.message));
  await pagina.goto(`${BASE}/#/hoy`);
  await pagina.evaluate(() => localStorage.clear());
  await pagina.reload();
  await pagina.getByRole('heading', { level: 1 }).first().waitFor();
  return { pagina, errores, contexto };
}

test('Hoy: horario, indicadores y tareas', { skip: !chromium && 'Playwright no instalado' }, async () => {
  const { pagina, errores, contexto } = await nuevaPagina();
  await pagina.getByText('Buen momento para llamar').waitFor();
  await pagina.getByText('Tareas de hoy').waitFor();
  await pagina.getByText('Listos para enviar la demo').waitFor();
  assert.ok(await pagina.getByRole('link', { name: /Barbería El Faro/ }).first().isVisible());
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.equal(desborde, 0, 'sin scroll horizontal en el móvil');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('WhatsApp: plantilla válida, enlace wa.me y registro del envío', { skip: !chromium && 'Playwright no instalado' }, async () => {
  const { pagina, errores, contexto } = await nuevaPagina();
  await pagina.goto(`${BASE}/#/negocio/n1`);
  await pagina.getByRole('button', { name: /WhatsApp/ }).click();
  const texto = pagina.locator('#texto-whatsapp');
  await texto.waitFor();
  const mensaje = await texto.inputValue();
  const enlacesMensaje = mensaje.match(/https:\/\/\S+/g) ?? [];
  assert.deepEqual(enlacesMensaje, ['https://mavie-demos.pages.dev/ejemplo-barberia/'], 'un solo enlace: el de su demo');
  assert.match(mensaje, /BAJA/);
  await pagina.getByText('El mensaje cumple las reglas').waitFor();
  await pagina.getByText('La demo carga desde tu conexión').waitFor();
  const enlace = pagina.locator('a.boton-whatsapp', { hasText: 'Abrir WhatsApp' });
  assert.match(await enlace.getAttribute('href'), /^https:\/\/wa\.me\/34600000001\?text=/);
  assert.equal(await enlace.getAttribute('rel'), 'noopener noreferrer');

  // Un precio rompe las reglas y desactiva el botón
  await texto.fill(`${mensaje}\nSolo 150 €`);
  await pagina.getByText(/No pongas precios/).waitFor();
  assert.equal(await enlace.getAttribute('aria-disabled'), 'true');
  await texto.fill(mensaje);

  const [ventana] = await Promise.all([contexto.waitForEvent('page'), enlace.click()]);
  await ventana.close();
  await pagina.getByRole('button', { name: 'Sí, lo he enviado' }).click();
  await pagina.getByText('WhatsApp registrado.').waitFor();
  await pagina.getByText('Whatsapp: Mensaje enviado').waitFor();
  assert.ok(await pagina.locator('.ficha-cabecera .etiqueta', { hasText: 'Contactado' }).isVisible());

  // Segundo intento el mismo día: tiene que pedir esperar al seguimiento
  await pagina.getByRole('button', { name: /WhatsApp/ }).click();
  await pagina.getByText('Ahora no se puede enviar').waitFor();
  await pagina.getByText(/para el seguimiento/).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('Llamada a un fijo y baja definitiva', { skip: !chromium && 'Playwright no instalado' }, async () => {
  const { pagina, errores, contexto } = await nuevaPagina();
  await pagina.goto(`${BASE}/#/negocio/n3`);
  assert.equal(await pagina.getByRole('button', { name: /WhatsApp/ }).isDisabled(), true, 'WhatsApp desactivado para fijos');
  await pagina.getByRole('button', { name: /Llamar/ }).click();
  await pagina.getByText('Guion de llamada').click();
  await pagina.getByText('Taller Hermanos Ruiz', { exact: false }).first().waitFor();
  await pagina.getByLabel('No contesta').check();
  assert.notEqual(await pagina.locator('#proxima').inputValue(), '', 'propone volver a llamar mañana');
  await pagina.getByRole('button', { name: 'Guardar llamada' }).click();
  await pagina.getByText('Llamada guardada.').waitFor();
  assert.equal(await pagina.getByText('Llamada: No contesta').count(), 2, 'la llamada nueva aparece en el historial');

  await pagina.goto(`${BASE}/#/negocio/n4`);
  await pagina.getByRole('button', { name: 'Baja' }).click();
  await pagina.getByRole('button', { name: 'Sí, dar de baja' }).click();
  await pagina.getByText(/No contactar: Pidió la baja/).waitFor();
  assert.equal(await pagina.getByRole('button', { name: /Llamar/ }).isDisabled(), true);
  assert.equal(await pagina.getByRole('button', { name: /WhatsApp/ }).isDisabled(), true);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('Añadir negocio a mano y revisar una demo', { skip: !chromium && 'Playwright no instalado' }, async () => {
  const { pagina, errores, contexto } = await nuevaPagina({ width: 1280, height: 900 });
  await pagina.goto(`${BASE}/#/negocios`);
  await pagina.getByRole('button', { name: '+ Añadir negocio' }).click();
  await pagina.locator('#nombre').fill('Zapatería <script>alert(1)</script>');
  await pagina.locator('#telefono').fill('611 22 33 44');
  await pagina.locator('#municipio').fill('Tarifa');
  await pagina.getByRole('button', { name: 'Añadir', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Zapatería <script>alert(1)</script>' }).waitFor();
  assert.equal(await pagina.locator('main script').count(), 0, 'el nombre se muestra como texto, nunca como código');

  await pagina.goto(`${BASE}/#/demos?estado=revision`);
  await pagina.getByRole('link', { name: /La Espiga/ }).click();
  await pagina.getByRole('button', { name: '✔ Aprobar' }).click();
  await pagina.getByText('Demo aprobada. Ya se puede enviar.').waitFor();
  assert.ok(await pagina.locator('.etiqueta', { hasText: 'Aprobada' }).first().isVisible());

  await pagina.goto(`${BASE}/#/plantillas`);
  const frio = pagina.locator('#plantilla-whatsapp_frio');
  await frio.fill('Hola {negocio}, oferta solo hoy: {demo_url}');
  await pagina.getByText(/suena a publicidad agresiva/).first().waitFor();
  await pagina.getByRole('button', { name: 'Guardar' }).first().click();
  await pagina.getByText(/no cumple las reglas/).waitFor();

  await pagina.goto(`${BASE}/#/estadisticas`);
  await pagina.getByRole('heading', { name: 'Embudo' }).waitFor();
  assert.deepEqual(errores, []);
  await contexto.close();
});
