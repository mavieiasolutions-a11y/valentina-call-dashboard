---
name: nueva-demo
description: Crea la demo (web de muestra animada) de un negocio del CRM a partir de un estilo de plantilla, en su propia rama de Git. Úsala cuando Valentina diga "nueva demo", "crear la web de...", o "/nueva-demo <negocio>".
---

# Crear una demo nueva

## Pasos
1. **Rama nueva** desde `main` actualizado (explica qué es una rama: "una copia paralela para trabajar sin tocar lo publicado"):
   `git checkout main` → `git pull` → `git checkout -b demo/<slug>`
2. **Elegir estilo**: ejecuta `npm run demo:nueva -- --estilos` y enseña los estilos con su "ideal para". Recomienda uno según el sector, pero **elige ella**.
3. **Nombre de marca**: pregunta a Valentina cómo quiere llamar a la web. Puede ser el nombre del negocio o uno más bonito ("Barbería El Faro" → "El Faro Barber Club"). El *slug* (nombre de la carpeta) sale de la marca: minúsculas y guiones.
4. **Eslogan** (opcional): propón 3 cortos y honestos, sin promesas falsas. Ella elige.
5. Crea la demo:
   `npm run demo:nueva -- --negocio "<nombre o id del CRM>" --estilo <estilo> --marca "<marca>" --eslogan "<eslogan>"`
   - Si hay varios negocios con ese nombre, el script lista los ids: pregunta cuál.
   - Si el negocio está en "no contactar", el script se niega. Explícale por qué.
6. Ábrela: `npm run ver-demos` y la dirección `http://localhost:5600/<slug>/`.
7. Siguiente paso: "Ahora la personalizamos con `/disenar-demo`: colores, tus dibujos y los textos".

## Qué crea
- `demos/<slug>/` con `index.html`, `css/`, `js/`, `img/`, `vendor/` (GSAP y tipografías, copiados dentro para no depender de nadie) y `demo.json`.
- En el CRM, la demo aparece en estado **En diseño** y el negocio pasa a **Demo en diseño**.
