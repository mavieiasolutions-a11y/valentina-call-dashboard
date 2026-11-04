import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desdeSerper, desdeOsm, preparar, municipioDe, codigoPostal } from '../../scripts/lib/negocios.mjs';
import { consultaOverpass } from '../../scripts/lib/osm.mjs';
import { comprobarClavePublica } from '../../scripts/lib/crm.mjs';

const sitioSerper = {
  title: 'Barbería El Puerto',
  address: 'C. Ancha, 12, 11201 Algeciras, Cádiz',
  latitude: 36.13,
  longitude: -5.45,
  rating: 4.76,
  ratingCount: 88,
  category: 'Barbería',
  phoneNumber: '600 12 34 56',
  cid: '1234567890',
};

test('convierte un resultado de Google Maps (Serper)', () => {
  const n = desdeSerper(sitioSerper, { sector: 'barbería', municipio: 'Algeciras' });
  assert.equal(n.telefono, '+34600123456');
  assert.equal(n.codigo_postal, '11201');
  assert.equal(n.municipio, 'Algeciras');
  assert.equal(n.valoracion, 4.8);
  assert.equal(n.fuente_id, 'serper:1234567890');
  assert.equal(n.maps_url, 'https://maps.google.com/?cid=1234567890');
});

test('convierte un elemento de OpenStreetMap', () => {
  const n = desdeOsm(
    { type: 'node', id: 42, lat: 36.0, lon: -5.6, tags: { name: 'Panadería Sol', shop: 'bakery', phone: '+34 956 11 22 33', 'addr:street': 'Calle Sol', 'addr:housenumber': '3', 'addr:postcode': '11380', 'addr:city': 'Tarifa' } },
    { sector: 'panadería', municipio: 'Tarifa' },
  );
  assert.equal(n.nombre, 'Panadería Sol');
  assert.equal(n.direccion, 'Calle Sol 3, 11380 Tarifa');
  assert.equal(n.telefono, '+34956112233');
  assert.equal(n.fuente_id, 'osm:node/42');
});

test('preparar: descarta los que tienen web o están fuera, y puntúa al resto', () => {
  const base = desdeSerper(sitioSerper, { municipio: 'Algeciras' });
  assert.equal(preparar({ ...base, web: 'https://barberiaelpuerto.es' }).motivo, 'ya tiene web');
  assert.equal(preparar({ ...base, direccion: 'Calle Mayor 1, 28013 Madrid' }).motivo, 'fuera de la zona');
  const { negocio, motivo } = preparar({ ...base, web: 'https://instagram.com/elpuerto' });
  assert.equal(motivo, '');
  assert.equal(negocio.web_tipo, 'redes');
  assert.equal(negocio.instagram, 'https://instagram.com/elpuerto');
  assert.equal(negocio.telefono_tipo, 'movil');
  assert.ok(negocio.puntuacion >= 80);
  assert.match(negocio.notas, /Puntuación/);
});

test('municipio y código postal desde la dirección', () => {
  assert.equal(municipioDe('Av. España, 11300 La Linea de la Concepcion'), 'La Línea de la Concepción');
  assert.equal(municipioDe('Sin datos', 'Tarifa'), 'Tarifa');
  assert.equal(codigoPostal('Calle 1, 11360 San Roque'), '11360');
});

test('consulta de OpenStreetMap: sector conocido y sin web', () => {
  const q = consultaOverpass('Panadería', 'Tarifa');
  assert.match(q, /\["shop"="bakery"\]/);
  assert.match(q, /\[!"website"\]/);
  assert.match(q, /area\["name"="Tarifa"\]/);
  assert.match(consultaOverpass('algo raro', 'Tarifa'), /\["shop"\]/);
});

test('rechaza claves secretas de Supabase', () => {
  assert.throws(() => comprobarClavePublica('sb_secret_abcdefghijk'), /SECRETA/);
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  assert.throws(() => comprobarClavePublica(`eyJhbGciOiJIUzI1NiJ9.${payload}.firma`), /service_role/);
  assert.doesNotThrow(() => comprobarClavePublica('sb_publishable_abc123'));
});
