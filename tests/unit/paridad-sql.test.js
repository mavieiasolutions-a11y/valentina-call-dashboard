// Comprueba que las reglas de etapas de la web (crm/js/reglas.js) y las de la
// base de datos (función privado.avanzar_etapa) dan el mismo resultado.
// Necesita un Postgres de pruebas: PGURL=postgres://... npm test
// Sin PGURL, la prueba se salta (en GitHub Actions sí se ejecuta).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { ETAPAS, RESULTADOS, etapaTrasActividad } from '../../crm/js/reglas.js';

const PGURL = process.env.PGURL;

test('etapas: la web y la base de datos aplican las mismas reglas', { skip: !PGURL && 'sin PGURL' }, () => {
  const bd = `paridad_${process.pid}`;
  const urlBd = `${PGURL.replace(/\/[^/]*$/, '')}/${bd}`;
  const psql = (url, args) => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', ...args], { encoding: 'utf8' });
  psql(PGURL, ['-c', `create database ${bd}`]);
  try {
    psql(urlBd, ['-f', 'supabase/tests/00_simular_supabase.sql']);
    for (const f of readdirSync('supabase/migrations').sort()) psql(urlBd, ['-f', `supabase/migrations/${f}`]);

    const casos = [];
    for (const etapa of ETAPAS.map((e) => e.id)) {
      for (const [tipo, lista] of Object.entries(RESULTADOS)) {
        for (const { id: resultado } of lista) casos.push([etapa, tipo, resultado]);
      }
    }
    const valores = casos.map(([e, t, r]) => `('${e}','${t}','${r}')`).join(',');
    const salida = psql(urlBd, [
      '-t', '-A', '-F', '|', '-c',
      `select e, t, r, privado.avanzar_etapa(e, privado.etapa_objetivo(t, r)) from (values ${valores}) v(e, t, r)`,
    ]);
    const filas = salida.trim().split('\n').map((l) => l.split('|'));
    assert.equal(filas.length, casos.length);
    for (const [e, t, r, sql] of filas) {
      assert.equal(sql, etapaTrasActividad(e, t, r), `${e} + ${t}:${r}`);
    }
  } finally {
    psql(PGURL, ['-c', `drop database if exists ${bd}`]);
  }
});
