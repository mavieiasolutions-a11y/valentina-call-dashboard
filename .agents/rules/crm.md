---
trigger: glob
globs: crm/**
description: Reglas al tocar el código del CRM
---

# Al tocar el CRM (`crm/`)

- El CRM lo usa Valentina a diario desde el móvil: cualquier cambio tiene que verse bien a 375 px y funcionar con el pulgar (botones de 44 px mínimo).
- **Nunca `innerHTML`**: construye la pantalla con `el()` de `crm/js/dom.js`, que mete los textos como texto (evita ataques XSS).
- Sin librerías nuevas por CDN. Si hace falta una, se copia a `crm/vendor/` desde `node_modules` en `scripts/construir-crm.mjs`.
- Las reglas de contacto están en `crm/js/reglas.js` y en la base de datos (`supabase/migrations`). No las cambies sin que lo pida Miguel; si se cambian, hay que cambiar las dos y pasar `npm test`.
- `crm/config.js` solo lleva la URL y la clave **pública** de Supabase. Nunca la secreta.
- Después de cambiar algo: `npm test`, `npm run test:e2e` y `npm run seguridad`.
