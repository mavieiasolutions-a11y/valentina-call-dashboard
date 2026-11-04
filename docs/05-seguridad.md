# Seguridad

Objetivo: que **no se pueda filtrar nada**. Quedan fuera los problemas típicos de PHP y servidores, y cada cambio pasa revisiones automáticas antes de publicarse.

## 1. Sin servidor, sin PHP

- **Las demos son estáticas** (HTML, CSS y JS). No hay base de datos, ni formularios, ni código de servidor que atacar.
- **El CRM también es estático.** Los datos están en Supabase, protegidos por reglas de la propia base de datos.
- El revisor de seguridad **rechaza** cualquier `.php`, `.asp`, `.jsp` o similar.

## 2. Cabeceras de seguridad (CSP y compañía)

Cloudflare aplica `crm/_headers` y `demos/_headers` a cada página:

| Cabecera | Qué evita |
|---|---|
| `Content-Security-Policy` | Que se ejecute código que no sea nuestro. Solo se cargan archivos del propio sitio; nada en línea. |
| `frame-ancestors 'none'` / `X-Frame-Options: DENY` | Que otra web meta la nuestra dentro para engañar (*clickjacking*). |
| `Strict-Transport-Security` | Que se abra sin cifrar (http). |
| `Referrer-Policy: no-referrer` | Que se filtre de dónde vienes. |
| `Permissions-Policy` | Acceso a cámara, micrófono, ubicación... |
| `X-Robots-Tag: noindex` | Que el CRM o las demos salgan en Google. |

Las demos llevan además la CSP dentro del HTML (`<meta>`), por si algún día se publican en otro sitio.

## 3. La base de datos (Supabase)

- **RLS en todas las tablas.** Sin sesión no se ve nada. Con sesión pero fuera de la tabla `equipo`, tampoco.
- **Roles:**

  | Rol | Puede |
  |---|---|
  | `admin` (Miguel) | Todo, incluido aprobar demos, borrar y deshacer bajas |
  | `comercial` (Valentina) | Buscar, diseñar, registrar llamadas y WhatsApp. No borra ni aprueba. |
  | `agente` (Antigravity) | Buscar y preparar. **No** registra contactos, **no** aprueba, **no** borra, **no** cambia plantillas. |
  | `harvey` | Solo sus 3 funciones del puente. No lee las tablas. |

- **Reglas que pone la base de datos**, aunque alguien manipule la web:
  - Nadie firma como otro: `creado_por` se pone solo.
  - Nadie cambia la fecha de lo que hizo.
  - El historial no se reescribe: solo `admin` puede corregirlo.
  - Una demo solo se aprueba por `admin`, y solo se publica si está aprobada.
  - A quien pidió la **baja** no se le puede registrar un envío ni una llamada. Su teléfono queda en `lista_no_contactar`, y solo `admin` puede deshacerlo.
- **Pruebas:** `supabase/tests/01_seguridad.sql` comprueba todo esto en cada Pull Request, contra un Postgres de pruebas.

## 4. Claves

- En `.env.local` (fuera de Git) y en Bitwarden.
- En la web solo va la clave **pública** de Supabase. La secreta no se usa en ningún sitio.
- Los scripts rechazan la clave secreta si se pone por error.
- GitHub *Push protection* bloquea subir claves. `gitleaks` revisa todo el historial en cada Pull Request.
- Serper tiene un tope de 40 créditos al día en el script, para que un error no gaste los gratuitos.

### Si se escapa una clave

1. Bórrala y crea otra en la web del servicio: Supabase → API Keys, serper.dev → API Key.
2. Cámbiala en `.env.local` (y en `crm/config.js` si era la pública).
3. Si era la contraseña del agente: Supabase → Authentication → Users → el agente → cambiar contraseña.
4. Avisa a Miguel.

## 5. El CRM no ejecuta textos de fuera

Los nombres de negocios vienen de Google Maps o de otras personas, y podrían contener código. El CRM **nunca usa `innerHTML`**: todo se pinta como texto con `el()` de `crm/js/dom.js`. Una prueba automática mete `<script>` en el nombre de un negocio y comprueba que se ve como texto.

Los enlaces solo se aceptan si empiezan por `https://`, `tel:` o `mailto:`.

## 6. Revisiones automáticas en cada Pull Request

| Revisión | Qué mira |
|---|---|
| `npm run seguridad` | PHP, claves, `.env`, demos (CSP, `noindex`, nada externo, nada en línea, sin formularios, sin `[PENDIENTE]`, peso de imágenes) y CRM (sin `innerHTML`) |
| `npm test` | Reglas de contacto, filtros de mensajes, búsqueda y el propio revisor |
| `npm run test:sql` | Permisos de la base de datos |
| `npm run test:e2e` | El CRM en un navegador real, sin errores ni violaciones de CSP |
| `npm audit` | Librerías con fallos conocidos |
| CodeQL | Análisis de seguridad del código (GitHub) |
| gitleaks | Claves en todo el historial |
| Dependabot | Avisa de librerías con fallos y abre Pull Requests para actualizarlas |

Si algo sale en rojo, **no se acepta el Pull Request**.

## 7. Privacidad de los negocios

- Solo se guardan datos **profesionales y públicos** (ficha de Google Maps u OpenStreetMap).
- Las demos no recogen datos de nadie: no hay formularios, analíticas ni cookies.
- Las demos y el CRM no aparecen en Google (`noindex`).
- La base de datos está en la UE.
