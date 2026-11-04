// Prueba el comando de búsqueda completo contra un "Serper" falso local
// (sin gastar créditos ni guardar nada: modo --prueba).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const SITIOS = [
  { title: 'Barbería Sin Web', address: 'C. Ancha 1, 11201 Algeciras', phoneNumber: '600 11 22 33', rating: 4.7, ratingCount: 60, cid: '1' },
  { title: 'Peluquería Con Web', address: 'C. Real 2, 11201 Algeciras', phoneNumber: '600 44 55 66', website: 'https://peluconweb.es', cid: '2' },
  { title: 'Barbería Instagram', address: 'C. Mar 3, 11201 Algeciras', phoneNumber: '956 11 22 33', website: 'https://instagram.com/x', cid: '3' },
  { title: 'Barbería Lejos', address: 'Gran Vía 1, 28013 Madrid', phoneNumber: '600 77 88 99', cid: '4' },
];

test('buscar-negocios --prueba filtra webs propias y fuera de zona', async () => {
  let clave = '';
  const servidor = createServer((req, res) => {
    clave = req.headers['x-api-key'];
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      assert.equal(JSON.parse(cuerpo).q, 'barbería en Algeciras');
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ places: SITIOS }));
    });
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const puerto = servidor.address().port;
  const salida = await new Promise((resolve) => {
    const p = spawn(process.execPath, ['scripts/buscar-negocios.mjs', '--sector', 'barbería', '--municipio', 'Algeciras', '--prueba'], {
      env: { ...process.env, SERPER_API_KEY: 'clave-falsa', SERPER_URL_PRUEBAS: `http://127.0.0.1:${puerto}` },
    });
    let texto = '';
    p.stdout.on('data', (c) => (texto += c));
    p.stderr.on('data', (c) => (texto += c));
    p.on('close', (codigo) => resolve({ texto, codigo }));
  });
  servidor.close();
  assert.equal(clave, 'clave-falsa', 'la clave viaja en la cabecera X-API-KEY');
  assert.equal(salida.codigo, 0, salida.texto);
  assert.match(salida.texto, /4 encontrados, 2 sin web propia/);
  assert.match(salida.texto, /1 descartados: ya tiene web/);
  assert.match(salida.texto, /1 descartados: fuera de la zona/);
  assert.match(salida.texto, /Barbería Sin Web/);
  assert.match(salida.texto, /Modo prueba: no he guardado nada/);
});
