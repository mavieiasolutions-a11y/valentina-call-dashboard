---
trigger: glob
globs: demos/**
description: Reglas de diseño y seguridad al editar una demo
---

# Al editar una demo (`demos/<slug>/`)

- **Diseña con Valentina**: antes de cambiar colores, tipografías o estructura, propón 2-3 opciones y deja que elija.
- **Colores**: se cambian en las variables del principio de `css/estilos.css` (`--color-primario`, `--color-fondo`...). Comprueba el contraste (texto sobre fondo ≥ 4.5:1).
- **Animaciones** (GSAP ya está dentro de `vendor/gsap/`):
  - Que acompañen, no que mareen: duraciones 0.4-1.2 s, una animación protagonista por sección.
  - Respeta `prefers-reduced-motion` (ya lo hace `js/base.js`: no lo quites).
  - El contenido tiene que verse aunque el JS falle: anima DESDE oculto solo cuando `<html>` tiene la clase `js-listo`.
- **Dibujos de la tableta**: van en `originales/` y se optimizan con `npm run imagenes -- demos/<slug>`. Para el efecto "se dibuja solo" (DrawSVG), el SVG tiene que ser de **trazos** (stroke), no de rellenos.
- **Textos**: datos reales y públicos del negocio (nombre, teléfono, dirección, horario de Google Maps). Si no hay dato, texto genérico honesto. Nunca reseñas, premios, años o precios inventados. Nada de `[PENDIENTE]` al publicar.
- **Seguridad**: nada externo (CDN, Google Fonts, iframes, analíticas), nada en línea (`<script>` con código, `onclick`, `style=`), sin formularios. La banda "Web de muestra preparada por Mavie IA Solutions" se queda siempre.
- **Peso**: imágenes < 300 KB (mejor WebP), demo completa < 6 MB. Prueba en móvil (375 px de ancho) sin scroll horizontal.
- Al terminar cada cambio: `npm run seguridad`.
