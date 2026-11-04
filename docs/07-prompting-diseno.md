# Cómo conseguir que Antigravity diseñe a TU gusto (prompting)

Antigravity no adivina tu gusto: lo aprende de **lo que le escribes** (prompts) y de **lo que dejas guardado** (reglas). Los estilos que vienen de serie son solo un punto de partida. Si te parecen infantiles o poco serios, se cambian o se crean los tuyos.

## 1. Las tres herramientas

| Herramienta | Qué es | Cuándo se usa |
|---|---|---|
| **Prompt** | Lo que escribes en el chat | Para cada cosa concreta: "cambia los colores a..." |
| **Regla `.agents/rules/mi-estilo.md`** | Tu gusto guardado. Antigravity lo lee **siempre**. | Para lo que quieres en TODAS las demos: "nada infantil", "mucho espacio en blanco" |
| **Skill `/crear-estilo`** | Un procedimiento guardado | Para crear un estilo base nuevo a partir de webs que te gusten |

## 2. Un buen prompt de diseño tiene 6 partes

1. **Rol**: "Actúa como diseñadora web senior especializada en negocios locales."
2. **Contexto**: qué negocio es, a quién vende, qué sensación debe dar.
3. **Objetivo**: qué quieres exactamente ahora (una cosa cada vez).
4. **Referencias**: webs o capturas que te gustan, y **qué** te gusta de cada una.
5. **Restricciones**: lo que NO quieres y lo que no se puede tocar.
6. **Cómo sabes que está bien**: "Enséñame 3 opciones antes de aplicar ninguna."

### Ejemplo flojo
> Haz la web más bonita.

Antigravity no sabe qué es "bonita" para ti. Cambiará cosas al azar.

### Ejemplo bueno
> Actúa como diseñadora web senior. Esta demo es para un taller mecánico de Los Barrios, clientes de 35-60 años que buscan confianza.
>
> Ahora mismo el estilo vibrante parece infantil (formas de colores, pegatinas). Quiero que parezca la web de un negocio serio y de confianza.
>
> Referencia: [pega una captura o un enlace]. Me gusta su fondo claro, la foto grande arriba y que solo use azul marino y un naranja de acento.
>
> No quiero formas flotando, sombras de dibujo ni letras gigantes en todas las secciones. No toques los textos ni la banda de "Web de muestra".
>
> Antes de cambiar nada, propón 3 paletas de color con sus códigos y 2 parejas de tipografías. Yo elijo.

## 3. Trucos que funcionan

- **Pide que te pregunte primero.** "Antes de hacer nada, hazme 5 preguntas para entender qué quiero."
- **Una cosa cada vez.** Primero colores, luego tipografía, luego la portada. Si pides todo junto, es difícil saber qué te gusta y qué no.
- **Pide opciones, no una sola respuesta.** "Dame 3 versiones del título de la portada."
- **Enseña en vez de explicar.** Haz captura de una web que te guste (tecla Windows + Mayúsculas + S), pégala en el chat y di qué te gusta: "el espacio", "la foto", "cómo aparece el texto al bajar".
- **Di lo que NO quieres.** Es igual de útil que lo que sí: "nada de degradados", "nada de emojis".
- **Usa palabras de diseño.** Ayudan mucho: *minimalista, editorial, sobrio, cálido, contraste alto, mucho aire (espacio en blanco), jerarquía, tipografía con serifa / sin serifa, paleta monocromática, acento*.
- **Corrige con precisión.** En vez de "no me gusta", di "el título es demasiado grande; reduce un 30% y usa peso normal, no negrita".
- **Si se lía, para y resume.** "Para. Resume en 5 puntos lo que hemos decidido hasta ahora." Y sigue desde ahí.
- **Guarda lo que te gusta.** Cuando algo te encante o lo odies: "Añade a `.agents/rules/mi-estilo.md` que [lo que sea]". Desde ese momento vale para todas las demos.

## 4. Plantillas para copiar

**Hacer un estilo nuevo más profesional**
> /crear-estilo Quiero un estilo "sobrio" para negocios serios (talleres, gestorías, clínicas). Tres palabras: profesional, limpio, de confianza. Referencias: [enlaces o capturas]. No quiero nada que parezca de dibujos animados.

**Retocar una demo**
> En la demo demos/[slug]: [qué quieres cambiar]. Referencia: [captura]. No toques [lo que no se toca]. Antes de aplicarlo, dime en 3 puntos qué vas a cambiar.

**Revisión con ojo crítico**
> Actúa como directora de arte exigente. Mira la demo demos/[slug] en el móvil y en el ordenador y dime las 5 cosas que la hacen parecer poco profesional, ordenadas de más a menos importante. No cambies nada todavía.

**Probar una idea sin miedo**
> Haz una copia de la demo en una rama nueva para probar [idea]. Si no me gusta, volvemos a la anterior.

Con Git nada se pierde: siempre se puede volver atrás.

## 5. Tu archivo de gusto: `.agents/rules/mi-estilo.md`

Ábrelo en Antigravity y rellénalo con tus palabras: sensación general, lo que te gusta, lo que no, webs de referencia y tu firma. Borra los "(Ejemplo)" o cámbialos por lo tuyo. Cuanto más concreto, mejor diseñará Antigravity para ti.
