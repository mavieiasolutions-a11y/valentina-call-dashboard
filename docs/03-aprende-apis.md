# Aprende APIs (y cómo "sacar" una clave sin riesgos)

Guía para Valentina. Ve en orden. Cuando tengas dudas, pídele a Antigravity: `/explicar-api`.

## 1. ¿Qué es una API?

Una API es la **ventanilla** de un servicio. Tu programa llama a una dirección y recibe datos, normalmente en formato **JSON** (texto con `{ "clave": "valor" }`).

**Ejercicio 1: una API sin clave.** Abre esto en el navegador:

https://date.nager.at/api/v3/PublicHolidays/2026/ES

Verás una lista de festivos. Cada uno tiene `date`, `localName` y `counties`: `ES-AN` es Andalucía. El CRM usa esta API para no proponerte llamar un festivo. No necesita clave porque son datos públicos y gratis.

## 2. Las partes de una llamada

| Parte | Qué es | Ejemplo |
|---|---|---|
| Dirección (*endpoint*) | A qué ventanilla llamas | `https://google.serper.dev/places` |
| Método | GET = leer, POST = enviar algo | `POST` |
| Cabeceras (*headers*) | Datos extra, como la clave | `X-API-KEY: tu-clave` |
| Cuerpo (*body*) | Lo que pides | `{"q": "barbería en Algeciras"}` |
| Respuesta | Lo que vuelve, con un código | `200` y el JSON con los negocios |

**Códigos que verás:**

| Código | Significa |
|---|---|
| `200` | Todo bien |
| `401` / `403` | La clave no vale o no tienes permiso |
| `404` | No existe |
| `429` | Vas muy rápido o no te quedan créditos |
| `500` | El servicio está fallando |

## 3. Las claves (API keys)

Una clave es **la llave de tu casa**: quien la tiene, entra (gasta tus créditos, ve tus datos).

- Se guardan en **`.env.local`** (los scripts la leen de ahí) y en **Bitwarden**. En ningún sitio más.
- **Nunca** en el chat de Antigravity, en un correo, en una captura de pantalla ni en GitHub. `.gitignore` impide subir `.env.local`, y GitHub bloquea las subidas con claves.
- Si una clave se escapa: entras en la web del servicio, **la borras y creas otra**. Borrarla del archivo no basta, porque queda en el historial.
- **Una clave para cada cosa** (Antigravity, Harvey...). Si hay un problema, cortas solo esa.
- Antes de crear una cuenta, mira **precios y límites**. Si piden tarjeta y no hace falta, no la pongas.

### Pública o secreta

Supabase te da dos claves:

- **Publishable** (`sb_publishable_...`) es **pública**. Puede ir en la web del CRM porque la seguridad no está en la clave: está en las **reglas RLS** de la base de datos. Aunque alguien la copie, sin usuario y contraseña del equipo no ve nada.
- **Secret** (`sb_secret_...`) se salta todas las reglas. **No se usa en este proyecto.** Los scripts la rechazan si la pones por error.

## 4. Tu archivo `.env.local`

1. En la carpeta del proyecto, copia `.env.example` como `.env.local`. Ya lo hiciste en la puesta en marcha.
2. Ábrelo en Antigravity y rellena:

```ini
SUPABASE_URL=https://xxxx.supabase.co         # te la pasa Miguel
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # te la pasa Miguel
AGENTE_EMAIL=...                              # la cuenta del agente (te la pasa Miguel por Bitwarden)
AGENTE_PASSWORD=...
SERPER_API_KEY=...                            # la sacas tú (ejercicio 3)
```

**Ejercicio 2.** Ejecuta `npm run probar-apis` y lee cada línea con Antigravity:

- Los **festivos**: una API pública.
- **Supabase**: clave pública más usuario.
- **Serper**: clave secreta tuya.

## 5. Sacar tu clave de Serper (ejercicio 3)

Serper da los resultados de Google Maps: nombre, teléfono, dirección, web y reseñas de cada negocio.

1. Entra en https://serper.dev → **Sign up**. Usa tu correo y una contraseña de Bitwarden. **No pide tarjeta.**
2. Te regalan **2.500 búsquedas**. Cada página de resultados gasta 1.
3. Menú **API Key** → copia la clave → pégala en `.env.local` en `SERPER_API_KEY=` y guárdala también en Bitwarden.
4. Prueba (gasta 1 búsqueda): `npm run probar-apis -- --serper`
5. **Playground** de serper.dev: haz una búsqueda a mano y mira el JSON que devuelve. Es lo mismo que recibe el script.

**Ejercicio 4.** Abre `scripts/lib/serper.mjs` con Antigravity y localiza:

- dónde va la clave (`X-API-KEY`),
- qué se envía (`q`, `gl: 'es'`, `hl: 'es'`),
- qué se hace con la respuesta (`datos.places`).

**Ejercicio 5.** Ejecuta una búsqueda que no guarda nada:

`npm run buscar -- --sector "floristería" --municipio "Algeciras" --prueba`

Pregunta a Antigravity por qué cada negocio tiene la puntuación que tiene.

## 6. La API de tu propio CRM

El CRM también es una API: Supabase crea una ventanilla por cada tabla (`negocios`, `demos`, `actividades`...).

- Los scripts entran con la cuenta del **agente**, que tiene permisos limitados: puede buscar y preparar, pero no registrar llamadas ni aprobar demos. Eso lo decide la base de datos, no el script.
- **Ejercicio 6.** Pide a Antigravity que te enseñe `supabase/migrations/...sql` y te explique una regla, por ejemplo `actividades_crear`. Después mira la prueba que la comprueba en `supabase/tests/01_seguridad.sql`.

## Resumen para llevar

1. API = ventanilla. Petición → respuesta en JSON.
2. Clave = llave. En `.env.local` y Bitwarden, nunca en otro sitio.
3. Si se escapa: se borra y se crea otra.
4. Pública (con reglas detrás) o secreta (nunca sale de tu ordenador o servidor).
5. Mira siempre límites y precios antes de registrarte.
