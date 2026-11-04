// Conexión al CRM (Supabase) con la cuenta del agente.
// El agente tiene permisos limitados por la base de datos (rol "agente"):
// puede buscar negocios y preparar demos, pero no registrar llamadas ni
// WhatsApp, ni aprobar demos, ni borrar nada.
import { createClient } from '@supabase/supabase-js';
import { exigir } from './entorno.mjs';

/** Rechaza claves secretas: los scripts solo usan la clave pública + la cuenta del agente. */
export function comprobarClavePublica(clave) {
  if (clave.startsWith('sb_secret_')) {
    throw new Error('Has puesto la clave SECRETA de Supabase. Usa la "publishable" (sb_publishable_...) y borra la secreta de .env.local.');
  }
  const partes = clave.split('.');
  if (partes.length === 3) {
    try {
      const datos = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
      if (datos.role === 'service_role') {
        throw new Error('Has puesto la clave "service_role" (secreta). Usa la clave pública (anon o publishable).');
      }
    } catch (e) {
      if (e.message.includes('service_role')) throw e;
    }
  }
}

export async function conectarCRM() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, AGENTE_EMAIL, AGENTE_PASSWORD } = exigir(
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'AGENTE_EMAIL',
    'AGENTE_PASSWORD',
  );
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(SUPABASE_URL)) {
    throw new Error('SUPABASE_URL tiene que ser algo como https://abcd1234.supabase.co');
  }
  comprobarClavePublica(SUPABASE_PUBLISHABLE_KEY);
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email: AGENTE_EMAIL, password: AGENTE_PASSWORD });
  if (error) throw new Error(`No he podido entrar en el CRM con la cuenta del agente: ${error.message}`);
  const { data: yo } = await sb.from('equipo').select('rol, nombre').eq('user_id', data.user.id).maybeSingle();
  if (!yo) throw new Error(`La cuenta ${AGENTE_EMAIL} existe pero no está en el equipo. Miguel tiene que darla de alta (docs/01-puesta-en-marcha.md, paso 3).`);
  return sb;
}

/** Busca un negocio por id exacto o por parte del nombre. */
export async function buscarNegocio(sb, texto) {
  const esId = /^[0-9a-f-]{36}$/i.test(texto);
  const consulta = sb.from('negocios').select('*').limit(10);
  const { data, error } = esId ? await consulta.eq('id', texto) : await consulta.ilike('nombre', `%${texto.replace(/[%_]/g, '')}%`);
  if (error) throw new Error(`Error leyendo negocios: ${error.message}`);
  if (!data.length) throw new Error(`No encuentro ningún negocio que se llame "${texto}".`);
  if (data.length > 1) {
    const lista = data.map((n) => `   - ${n.nombre} (${n.municipio || 'sin municipio'}) → ${n.id}`).join('\n');
    throw new Error(`Hay varios negocios con ese nombre. Repite con el id:\n${lista}`);
  }
  return data[0];
}
