# Puente con Harvey

Harvey (en el Lenovo) y Valentina trabajan el mismo territorio:

- **Harvey** vende **apps de reservas** a negocios que ya tienen web o presencia digital, sobre todo estéticas.
- **Valentina** vende **webs** a quienes **no tienen**.

Los negocios que Harvey marca como *"sin web"* hoy acaban en la ruta de puerta fría. Son justo los clientes de Valentina.

El puente hace tres cosas:

1. Harvey **envía** al CRM de Valentina los negocios sin web que encuentra.
2. Harvey **pregunta** qué teléfonos ya lleva Valentina (o pidieron la baja) para no escribirles.
3. Harvey **avisa** de los que lleva él y de las bajas que recibe, para que Valentina no los toque.

Es de **un solo sentido por función** y con permisos mínimos:

- La cuenta de Harvey (rol `harvey`) **no puede leer las tablas** del CRM.
- Solo puede usar estas tres funciones de la base de datos.

| Función | Qué hace |
|---|---|
| `harvey_enviar_negocios(lista)` | Inserta negocios en el CRM de Valentina (fuente "Harvey"). Ignora duplicados y bajas. |
| `harvey_telefonos_ocupados()` | Devuelve los teléfonos que Valentina ya trabaja (`valentina`) y las bajas (`baja`). |
| `harvey_no_contactar(telefonos, motivo)` | `motivo = 'harvey'`: Harvey lo lleva y Valentina no lo toca si aún no lo había contactado. `motivo = 'baja'`: baja para los dos, para siempre. Devuelve los que Valentina ya había contactado, para resolverlo a mano. |

Todo esto está probado en `supabase/tests/01_seguridad.sql`, apartado 8.

## Activarlo

### 1. Cuenta de Harvey en el CRM (Miguel, en Supabase)

1. **Authentication → Users → Add user**: `tucorreo+harvey@gmail.com`, contraseña de Bitwarden, *Auto Confirm*.
2. En **SQL Editor**:

   ```sql
   select public.alta_equipo('tucorreo+harvey@gmail.com', 'Harvey', 'harvey');
   ```

### 2. Variables en el Lenovo (Miguel)

En el `.env` que usa Harvey, en el Lenovo y nunca en el chat:

```ini
VALENTINA_SUPABASE_URL=https://xxxx.supabase.co
VALENTINA_SUPABASE_KEY=sb_publishable_...
VALENTINA_HARVEY_EMAIL=tucorreo+harvey@gmail.com
VALENTINA_HARVEY_PASSWORD=...
```

### 3. Pedírselo a Claudio, en la sesión del Lenovo (`mavie_ai_agent`)

Copia y pega esto en la sesión de Claude Code del Lenovo:

> Quiero conectar Harvey con el CRM de Valentina (repo `valentina-call-dashboard`, archivo `docs/06-puente-harvey.md`). Es un proyecto de Supabase **distinto** del de las demos. Las credenciales están en el `.env` como `VALENTINA_*`: no las muestres en el chat.
>
> 1. Crea `harvey/mavie/valentina.py` con un cliente mínimo (httpx). Debe:
>    - iniciar sesión con email y contraseña en `POST {URL}/auth/v1/token?grant_type=password` (cabecera `apikey`);
>    - guardar el `access_token` y renovarlo antes de que caduque;
>    - llamar a las RPC `POST {URL}/rest/v1/rpc/<funcion>` con las cabeceras `apikey` y `Authorization: Bearer <token>`.
> 2. En el ciclo de trabajo, una vez al día, envía con `harvey_enviar_negocios` las empresas con `no_digital_reason` que empiece por "sin web" y que aún no se hayan enviado. Guarda los ids enviados en `settings` (`valentina_enviados`). Formato de cada elemento:
>    `{"harvey_id": "<company_id>", "nombre", "telefono" (E.164 CON +), "telefono_tipo" ("movil"/"fijo"), "sector", "direccion", "municipio", "codigo_postal", "maps_url", "valoracion", "num_resenas", "motivo"}`.
>    Máximo 200 por llamada.
> 3. Antes de redactar un WhatsApp en frío, una llamada o de meter un negocio en la ruta, consulta `harvey_telefonos_ocupados()` (con caché de 15 minutos) y salta esos teléfonos. Si la consulta falla, **no envíes** (es más seguro esperar).
> 4. Cuando `opt_out_everywhere` dé de baja un teléfono, llama a `harvey_no_contactar([tel], 'baja')`. Cuando Harvey cree un borrador en frío o una demo para un negocio, llama a `harvey_no_contactar([tel], 'harvey')`. Si la respuesta trae `ya_contactados_por_valentina`, avísame por WhatsApp.
> 5. Añade pruebas con respuestas simuladas y no actives nada sin enseñarme antes el plan.

### 4. Decisión pendiente (Miguel)

Si un negocio sin web está en la **ruta de puerta fría** de Miguel y Valentina ya le ha enviado su demo:

- **Opción A (recomendada):** la ruta lo salta mientras Valentina lo trabaja. Ya viene en `harvey_telefonos_ocupados()`.
- **Opción B:** Miguel lo visita igualmente, con la demo de Valentina en el móvil. Más fuerza comercial, pero el negocio recibe dos contactos.
