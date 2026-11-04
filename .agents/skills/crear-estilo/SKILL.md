---
name: crear-estilo
description: Crea un estilo base NUEVO para las demos (en plantilla-demo/) a partir de las referencias y el gusto de Valentina, o retoca uno existente para hacerlo más profesional, más sobrio o más a su gusto. Úsala con "/crear-estilo", "quiero un estilo más profesional", "hazme un estilo como esta web", o cuando a Valentina no le convenzan los estilos que hay.
---

# Crear o retocar un estilo base

Los estilos de `plantilla-demo/` son el punto de partida de todas las demos. Si a
Valentina no le convencen (demasiado infantiles, poco serios...), se crean los suyos.
**Ella decide el gusto; tú lo traduces a código.**

## 1. Entender lo que quiere (no programes todavía)
Hazle estas preguntas, de una en una, y espera respuesta:
1. ¿Para qué tipo de negocios es este estilo? (ej.: talleres, abogados, restaurantes)
2. ¿Qué tres palabras lo describen? (ej.: "serio, limpio, cálido")
3. ¿Qué webs te gustan? Que pegue enlaces o capturas de pantalla. Pregúntale qué le gusta de cada una (colores, letra, espacio, fotos, cómo se mueven las cosas).
4. ¿Qué NO quieres ver? (ej.: "nada de formas de colores ni pegatinas")
5. ¿Animaciones: ninguna, discretas o llamativas?
Lee también `.agents/rules/mi-estilo.md`: ahí están sus gustos permanentes.

## 2. Proponer antes de construir
Resume en 5-8 líneas la propuesta: paleta (con códigos de color), tipografías (de las de `node_modules/@fontsource`), estructura de la portada, tipo de animaciones. Espera su "sí" o sus cambios.

## 3. Construir
- Copia el estilo existente más parecido: `plantilla-demo/<existente>` → `plantilla-demo/<nuevo-id>` (id en minúsculas, sin acentos, ej. `sobrio`).
- Cambia `estilo.json` (id, nombre, descripción, ideal_para, fuentes, gsap).
- Cambia `index.html`, `css/estilos.css` y `js/animaciones.js` siguiendo lo acordado.
- Mantén SIEMPRE: los marcadores `{{MARCA}}`, `{{NEGOCIO}}`, etc.; la banda "Web de muestra"; la CSP; `noindex`; nada externo; nada en línea; `prefers-reduced-motion`; el texto visible sin JavaScript.

## 4. Probar
- `npm run demo:nueva -- --sin-crm --nombre "Prueba Estilo" --telefono 600000000 --municipio Algeciras --estilo <nuevo-id>`
- `npm run ver-demos` → `http://localhost:5600/prueba-estilo/` en móvil (375 px) y en ordenador.
- `npm run seguridad` y `npm test`.
- Enséñaselo, apunta sus comentarios y repite. Cuando le guste, borra `demos/prueba-estilo`.

## 5. Guardar lo aprendido
Si en el proceso dice cosas como "esto sí" o "esto nunca", **propón añadirlas a `.agents/rules/mi-estilo.md`** para que valgan en todas las demos futuras.

## 6. Subir
Rama `estilo/<nuevo-id>` → commit → push → Pull Request (como `/publicar-demo`, parte A).
