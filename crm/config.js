// Conexión del CRM con Supabase.
// Supabase → tu proyecto → Project Settings → API Keys.
//  - url: la "Project URL" (https://xxxx.supabase.co)
//  - clavePublica: la "publishable key" (sb_publishable_...). Es PÚBLICA a
//    propósito: protege la base de datos con RLS, no con secretos.
//    ¡NUNCA pongas aquí la "secret key"!
//
// Si lo dejas vacío, el CRM arranca en MODO PRUEBA con datos de ejemplo.
export const CONFIG = {
  url: '',
  clavePublica: '',
};
