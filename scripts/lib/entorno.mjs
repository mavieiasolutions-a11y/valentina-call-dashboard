// Carga las claves de .env.local y avisa en español si falta alguna.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let cargado = false;

export function cargarEntorno() {
  if (cargado) return;
  cargado = true;
  const archivo = resolve(process.cwd(), '.env.local');
  if (existsSync(archivo)) process.loadEnvFile(archivo);
}

/** Devuelve las variables pedidas o termina con un mensaje claro de qué falta. */
export function exigir(...nombres) {
  cargarEntorno();
  const faltan = nombres.filter((n) => !process.env[n] || /^(TU-|sb_publishable_x|pon-aqui)/.test(process.env[n]));
  if (faltan.length) {
    throw new Error(
      `Faltan estas claves en .env.local: ${faltan.join(', ')}.\n` +
        '   Copia .env.example como .env.local y rellénalo (guía: docs/03-aprende-apis.md).',
    );
  }
  return Object.fromEntries(nombres.map((n) => [n, process.env[n]]));
}

/** Ejecuta la función principal de un script y muestra los errores sin "ruido". */
export async function ejecutar(principal) {
  try {
    await principal();
  } catch (error) {
    console.error(`\n✖ ${error.message}\n`);
    process.exitCode = 1;
  }
}
