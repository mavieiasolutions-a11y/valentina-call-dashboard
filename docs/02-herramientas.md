# Herramientas: cuáles, por qué y dónde funcionan

Criterios que se pidieron. Todas las herramientas los cumplen:

1. **100% gratis.** Las que corren en local, solo si el ordenador de Valentina puede con ellas (Windows, 8 GB de RAM, sin tarjeta gráfica). Si no, en la nube.
2. **Específicas, claras y fáciles.** Una herramienta para cada cosa.
3. **Integradas con Antigravity** sin pasos extra: todo se lanza con `npm run ...` o con una *skill* (`/nueva-demo`...).
4. **Webs animadas y distintas.** Ella pone los nombres y diseña con su tableta.
5. **Seguras.** Nada de PHP ni servidores propios. Pasan revisión automática en cada cambio.

## Para diseñar (en local)

| Herramienta | Para qué | Por qué esta | ¿Va con 8 GB? |
|---|---|---|---|
| **Krita** | Ilustraciones, texturas, fondos pintados con la tableta | Gratis y de código abierto. Detecta la presión del lápiz. Exporta PNG. | Sí, con lienzos de hasta ~3000 px |
| **Inkscape** | Logos y dibujos de **trazo** (SVG) que luego "se dibujan solos" en la web | Gratis. El SVG es lo que permite animar el trazo con GSAP (DrawSVG). | Sí |
| **Squoosh** (squoosh.app) | Comprimir una imagen suelta a mano | Funciona en el navegador, sin subir la imagen a ningún sitio | Sí |

> Las imágenes no hay que comprimirlas a mano: `npm run imagenes -- demos/<slug>` lo hace con *sharp* y *SVGO*, en local, una a una para no llenar la memoria.

## Para construir las webs

| Herramienta | Para qué | Dónde corre |
|---|---|---|
| **Antigravity** (su plan Pro) | El agente que escribe el código con ella. Lee `AGENTS.md` y las *skills* de `.agents/skills/`. | La IA en la nube (Google), el editor en local |
| **Plantillas propias** (`plantilla-demo/`) | Tres estilos base: clásico, editorial y vibrante. Cada demo parte de uno y se personaliza. | Local |
| **GSAP** (ScrollTrigger, SplitText, DrawSVG) | Animaciones: textos que aparecen, dibujos que se trazan, efectos al hacer scroll | Se copia dentro de cada demo. Gratis también para uso comercial desde 2025. |
| **Tipografías Fontsource** | Letras bonitas sin depender de Google Fonts | Se copian dentro de cada demo. Mejor para el RGPD: no se envían datos a Google. |
| **Node.js + npm** | Ejecuta los scripts | Local, ligero |
| **Git + GitHub** | Guardar versiones, revisar y publicar | Local + nube gratis |

**Por qué no WordPress, Wix ni PHP:**

- WordPress y PHP necesitan un servidor que hay que mantener y actualizar. Un plugin viejo o un PHP mal configurado son la causa más común de que roben datos.
- Wix no deja el código en nuestras manos y no es gratis para un dominio propio.
- Una web **estática** (solo HTML, CSS y JS) no tiene base de datos ni servidor que atacar.

## Para publicar (en la nube, gratis)

| Servicio | Para qué | Límites gratis |
|---|---|---|
| **Cloudflare Pages** | Publicar el CRM y las demos, con vista previa en cada Pull Request y cabeceras de seguridad | 500 publicaciones al mes, tráfico ilimitado. Se permite uso comercial. |
| **GitHub** | Código, revisiones, pruebas automáticas, CodeQL, Dependabot, búsqueda de claves | Todo gratis en repos públicos |

> **Vercel** (lo que se planteó en la Semana 0) en su plan gratis **solo permite uso personal, no comercial**. Por eso aquí se usa Cloudflare Pages.

## Para el CRM y los datos (en la nube, gratis)

| Servicio | Para qué | Límites gratis |
|---|---|---|
| **Supabase** | Base de datos, usuarios y reglas de seguridad (RLS) | 2 proyectos, 500 MB. Se pausa tras 7 días sin uso (con uso diario, no pasa). |
| **Serper.dev** | Buscar negocios en Google Maps (nombre, teléfono, web, reseñas) | 2.500 búsquedas al registrarse, sin tarjeta. El CRM cuenta las gastadas. |
| **OpenStreetMap (Overpass)** | Alternativa sin clave y gratis siempre | Menos datos: muchos negocios no tienen teléfono |
| **date.nager.at** | Festivos de España y Andalucía | Gratis, sin clave |
| **WhatsApp normal de su móvil** | Enviar la demo: el CRM prepara el mensaje y abre WhatsApp con un toque (`wa.me`) | Gratis. Sin robots, así que no hay riesgo de bloqueo del número. |

## Lo que NO se usa (y por qué)

- **IA en local** (Ollama, Stable Diffusion...): con 8 GB y sin gráfica irían muy lentas. La IA ya la pone Antigravity en la nube.
- **Robots que manejan WhatsApp Web o Instagram:** van contra sus normas. Harvey tuvo problemas con open-wa por esto. Aquí envía ella, a mano.
- **CDN externos** (scripts o fuentes cargados de otra web): si esa web cae, la demo deja de funcionar, y si la hackean, la nuestra también. Todo va dentro de cada demo.
- **Formularios en las demos:** recogerían datos personales (RGPD) y necesitarían servidor. Se usan botones de WhatsApp y de llamada.
