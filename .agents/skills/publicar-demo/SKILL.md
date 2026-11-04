---
name: publicar-demo
description: Manda una demo terminada a revisión (Pull Request en GitHub con vista previa) y, cuando Miguel la aprueba y se acepta, la marca como publicada en el CRM. Úsala con "/publicar-demo <slug>", "subir la demo", "mandar a revisión" o "ya la han aprobado".
---

# Publicar una demo

## A. Mandar a revisión
1. Comprueba que estás en la rama `demo/<slug>` (`git branch --show-current`).
2. `npm run seguridad` → tiene que salir "✔ Todo correcto". Si no, arregla cada punto explicándole qué era.
3. `npm test` en verde.
4. Guarda y sube:
   - `git add demos/<slug>`
   - `git commit -m "Demo <slug> lista para revisión"`
   - `git push -u origin demo/<slug>`
5. Abre el Pull Request: el comando `git push` muestra un enlace de GitHub; si no, ve a `https://github.com/mavieiasolutions-a11y/valentina-call-dashboard/pulls` → "New pull request". Rellena la plantilla.
6. En 1-2 minutos Cloudflare comenta en el Pull Request un **enlace de vista previa**. Valentina lo pega en el CRM (ficha del negocio → Demo → "Enlace de vista previa").
7. Marca la demo en revisión: `npm run demo:estado -- <slug> revision`
8. Explica qué pasa ahora: Miguel la mira, la aprueba en el CRM y acepta el Pull Request (o pide cambios).

## B. Cuando Miguel la ha aprobado y aceptado
1. `git checkout main` y `git pull`.
2. `npm run demo:estado -- <slug> publicada` → comprueba que la dirección definitiva carga y la guarda en el CRM.
3. Si dice "todavía no carga": espera 2 minutos (Cloudflare está publicando) y repite.
4. Siguiente paso: "Ya puedes enviarla desde el CRM: ficha del negocio → 💬 WhatsApp".

## Si piden cambios
`npm run demo:estado -- <slug> diseno`, haz los cambios (con `/disenar-demo`), y vuelve al paso A.
