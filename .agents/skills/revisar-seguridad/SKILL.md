---
name: revisar-seguridad
description: Revisa la seguridad del repositorio o de una demo (claves subidas, PHP, scripts externos, CSP, formularios, innerHTML) y explica cada problema y cómo arreglarlo. Úsala antes de cada commit o Pull Request, o cuando Valentina pregunte si algo es seguro.
---

# Revisión de seguridad

1. Ejecuta `npm run seguridad` y `npm audit --omit=dev`.
2. Por cada problema, explica en una frase **qué riesgo hay** y arréglalo:
   - **Clave en un archivo** → quítala, y que Valentina **cree una clave nueva** en el servicio (la vieja ya no es segura aunque se borre: queda en el historial de Git). Si ya se subió a GitHub, avisa a Miguel.
   - **PHP o código de servidor** → no lo usamos: un servidor mal configurado es la forma más común de que roben datos. Las demos son estáticas.
   - **Script o fuente de fuera** → descárgalo dentro de la demo. Si el otro sitio cae o lo hackean, nuestra web no se ve afectada.
   - **`<script>` en línea, `onclick`, `style=`** → muévelo a `.js`/`.css`. La política CSP bloquea lo que va en línea, y así un texto malicioso nunca se puede ejecutar.
   - **Formulario** → las demos no recogen datos (RGPD). Se usan botones de WhatsApp y llamada.
   - **innerHTML en el CRM** → usa `el()` de `crm/js/dom.js`.
3. Vuelve a ejecutar hasta "✔ Todo correcto".
4. Recuerda: en GitHub, cada Pull Request pasa además CodeQL (análisis de código), la búsqueda de claves (gitleaks) y las pruebas. Si algo sale en rojo allí, se mira el detalle juntos.
