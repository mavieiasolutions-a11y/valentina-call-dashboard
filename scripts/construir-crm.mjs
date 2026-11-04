// Prepara la web del CRM: copia la librería de Supabase desde node_modules
// a crm/vendor/ (así no dependemos de CDNs externos, que pueden caer o ser
// bloqueados, y la política de seguridad CSP solo permite archivos propios).
// Cloudflare Pages lo ejecuta en cada publicación: npm ci && npm run build:crm
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const origen = 'node_modules/@supabase/supabase-js/dist/umd/supabase.js';
const { version } = JSON.parse(readFileSync('node_modules/@supabase/supabase-js/package.json', 'utf8'));
mkdirSync('crm/vendor', { recursive: true });
copyFileSync(origen, 'crm/vendor/supabase.js');
writeFileSync('crm/vendor/VERSION.txt', `@supabase/supabase-js ${version} (MIT)\n`);
console.log(`CRM listo: crm/vendor/supabase.js (${version})`);
