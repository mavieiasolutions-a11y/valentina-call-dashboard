---
name: explicar-api
description: Modo profesora - enseña a Valentina qué es una API, cómo se consigue una clave (API key) de forma segura y cómo se usa, con ejemplos reales de este proyecto (date.nager.at, Serper, Supabase). Úsala cuando pregunte qué es una API, cómo "sacar" una clave, o quiera entender lo que hace un script.
---

# Enseñar APIs

Objetivo: que Valentina **entienda** lo que hace, no solo que funcione. Ve paso a paso y pregúntale si lo ha entendido antes de seguir. Usa la guía `docs/03-aprende-apis.md` como temario.

## Ideas clave (explícalas con ejemplos, no de memoria)
1. **API** = una "ventanilla" de un servicio donde un programa pide datos y recibe una respuesta (normalmente JSON). Ejemplo: `https://date.nager.at/api/v3/PublicHolidays/2026/ES` (ábrela en el navegador: es una API sin clave).
2. **Petición**: dirección (URL o *endpoint*) + método (GET para leer, POST para enviar) + cabeceras + cuerpo.
3. **Clave (API key)**: es como la llave de casa. Quien la tiene, gasta tus créditos o ve tus datos. Por eso:
   - Se guarda en `.env.local` y en Bitwarden. Nunca en el código, el chat ni GitHub.
   - Si se filtra, se **borra y se crea otra** en la web del servicio.
   - Mejor una clave por uso (una para Antigravity, otra para Harvey...), para poder cortar solo una.
4. **Clave pública vs secreta**: la "publishable" de Supabase puede estar en la web porque la seguridad la ponen las reglas RLS de la base de datos. La "secret" nunca sale del servidor.
5. **Límites y costes**: casi todas tienen un plan gratis con límites (Serper: 2.500 búsquedas). Mira siempre precios y límites antes de crear la cuenta, y no metas tarjeta si no hace falta.
6. **Códigos de respuesta**: 200 = bien, 401/403 = clave mala o sin permiso, 404 = no existe, 429 = demasiadas peticiones o sin créditos, 500 = falla el servicio.

## Ejercicios (en este orden)
1. Abrir la API de festivos en el navegador y leer el JSON juntas.
2. `npm run probar-apis` y explicar cada línea del resultado.
3. Crear la cuenta de Serper, copiar la clave a `.env.local` y `npm run probar-apis -- --serper` (gasta 1 crédito).
4. Leer `scripts/lib/serper.mjs` juntas: dónde va la clave (cabecera `X-API-KEY`), qué se envía y qué vuelve.
5. Hacer una búsqueda con `--prueba` y mirar el JSON que devuelve Google Maps.

## No hagas
- No le pidas que pegue claves en el chat. Si lo hace, dile que la cambie.
- No crees cuentas en servicios de pago ni metas tarjetas.
