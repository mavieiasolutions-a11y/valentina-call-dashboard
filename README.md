# CRM de Valentina · Mavie IA Solutions

Valentina hace lo que hacía **Harvey**, el agente de Miguel:

1. **Busca** negocios del Campo de Gibraltar que **no tienen página web**.
2. Les **diseña una demo gratuita y animada**, con sus propios dibujos hechos en la tableta.
3. Les **contacta** por WhatsApp desde su móvil o por teléfono, siempre con las mismas reglas que Harvey: horario comercial, sin precios por escrito, un solo seguimiento y baja para siempre si lo piden.

Ella decide y diseña. **Antigravity** (su agente de IA) prepara y construye. El **CRM** apunta todo y comprueba las reglas.

```
Antigravity ──/buscar-negocios──▶ CRM (Supabase) ◀── Valentina en el móvil: llamar / WhatsApp
     │                               ▲
     └──/nueva-demo──▶ demos/<slug> ─┴─ Pull Request ─▶ Miguel aprueba ─▶ Cloudflare Pages
```

## Todo gratis

| Pieza | Servicio | Coste |
|---|---|---|
| CRM y demos (webs) | Cloudflare Pages | Gratis (500 publicaciones al mes, tráfico ilimitado) |
| Base de datos y usuarios | Supabase | Gratis (se pausa tras 7 días sin uso; con uso diario no pasa) |
| Código, revisiones y seguridad | GitHub (repo público) | Gratis: Actions, CodeQL, Dependabot y búsqueda de claves |
| Buscar negocios | Serper (Google Maps) / OpenStreetMap | 2.500 búsquedas gratis / gratis siempre |
| Festivos | date.nager.at | Gratis, sin clave |
| Animaciones | GSAP | Gratis, también para uso comercial |
| Dibujo | Krita / Inkscape | Gratis, en local (van bien con 8 GB) |
| Agente de IA | Antigravity | Ya incluido en su plan Pro |

## Empezar

- **Probar el CRM ahora mismo, sin configurar nada:** `npm ci` y luego `npm run crm`. Abre http://localhost:5500 y entra en *modo prueba* con datos de ejemplo.
- **Puesta en marcha real** (Miguel, una vez): [docs/01-puesta-en-marcha.md](docs/01-puesta-en-marcha.md)
- **Herramientas y por qué estas:** [docs/02-herramientas.md](docs/02-herramientas.md)
- **Aprender APIs (Valentina):** [docs/03-aprende-apis.md](docs/03-aprende-apis.md)
- **El día a día:** [docs/04-flujo-de-trabajo.md](docs/04-flujo-de-trabajo.md)
- **Seguridad:** [docs/05-seguridad.md](docs/05-seguridad.md)
- **Puente con Harvey:** [docs/06-puente-harvey.md](docs/06-puente-harvey.md)
- **Diseñar a tu gusto con Antigravity (prompting):** [docs/07-prompting-diseno.md](docs/07-prompting-diseno.md)

## Carpetas

| Carpeta | Qué hay |
|---|---|
| `crm/` | La web del CRM: HTML y JavaScript sin frameworks, ni PHP ni servidor propio. |
| `demos/` | Las demos publicadas. Cada una es una carpeta estática. |
| `plantilla-demo/` | Los tres estilos base de las demos: clásico, editorial y vibrante. |
| `scripts/` | Los comandos que usa Antigravity (`npm run ...`). |
| `supabase/` | Tablas, reglas de seguridad (RLS) y sus pruebas. |
| `.agents/` | Reglas y *skills* de Antigravity. `AGENTS.md` es su manual. |
| `docs/` | Las guías. |
| `tests/` | Pruebas automáticas. |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run crm` | Abre el CRM en local (modo prueba si `crm/config.js` está vacío). |
| `npm run buscar -- --sector "bar" --municipio "Tarifa"` | Busca negocios sin web y los guarda en el CRM. |
| `npm run demo:nueva -- --negocio "..." --estilo clasico --marca "..."` | Crea una demo. |
| `npm run imagenes -- demos/<slug>` | Optimiza los dibujos y fotos de `originales/`. |
| `npm run ver-demos` | Abre las demos en local. |
| `npm run demo:estado -- <slug> revision\|publicada` | Cambia el estado de la demo en el CRM. |
| `npm run hoy` | Lo que toca hoy. |
| `npm run probar-apis` | Comprueba las claves de `.env.local`. |
| `npm run seguridad` | Revisión de seguridad. Se ejecuta sola en cada Pull Request. |
| `npm test` / `npm run test:e2e` / `npm run test:sql` | Pruebas: reglas, navegador y base de datos. |
