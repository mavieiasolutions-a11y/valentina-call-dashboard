---
name: disenar-demo
description: Personaliza una demo con Valentina - colores, tipografía, textos reales del negocio, y sus dibujos de la tableta gráfica (Krita o Inkscape) convertidos en animaciones. Úsala cuando quiera cambiar el diseño, poner su logo o dibujo, cambiar colores o animaciones de una demo.
---

# Diseñar la demo (con la tableta)

Valentina es la diseñadora. Tú traduces su diseño a código.

## 1. Sus dibujos
- **Logo o ilustración que "se dibuja sola"** → Inkscape (gratis). Dibujar con la herramienta de trazo (no relleno), `Archivo → Guardar como → SVG optimizado`, en `demos/<slug>/originales/dibujo.svg`.
- **Ilustración con color, texturas o fondo** → Krita (gratis, funciona bien con 8 GB). `Archivo → Exportar → PNG` en `demos/<slug>/originales/`.
- **Fotos del negocio** (de su Google Maps o Instagram, solo si el negocio las ha publicado): en `originales/`.
- Luego: `npm run imagenes -- demos/<slug>` → crea versiones ligeras en `img/` (WebP y SVG optimizado). Enséñale el antes y el después de peso.
- Sustituye `img/dibujo.svg` por el suyo y comprueba que la animación de trazo funciona.

## 2. Colores y letra
- Pregunta: ¿qué sensación quiere (cercano, elegante, moderno, divertido)? ¿hay colores en su fachada, logo o Instagram?
- Propón 2-3 paletas (primario, fondo, acento) y cámbialas en las variables al principio de `css/estilos.css`.
- Contraste mínimo 4.5:1 para el texto. Si no llega, avísala y propón un tono más oscuro.
- Tipografías: solo las que hay en `vendor/fonts/`. Si quiere otra, se instala con `npm` desde `@fontsource` (pregunta antes).

## 3. Textos
- Datos reales: nombre, teléfono, dirección, horario (de su ficha de Google Maps en el CRM).
- Servicios: los que se vean en su ficha o redes. Si no hay, genéricos del sector ("Corte de pelo", "Arreglo de barba") sin precios.
- **Nunca inventes** reseñas, premios, años de experiencia ni precios.

## 4. Animaciones
- GSAP ya está incluido (ScrollTrigger, SplitText, DrawSVG). Una animación protagonista por sección, 0.4-1.2 s.
- Respeta "reducir movimiento" (ya lo hace `js/base.js`).

## 5. Comprobar
- `npm run ver-demos` → mírala en el navegador a 375 px (móvil) y en escritorio.
- `npm run seguridad` en verde.
- Commit: `git add demos/<slug>` y `git commit -m "Demo <slug>: <qué ha cambiado>"`.
