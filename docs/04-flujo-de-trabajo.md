# El día a día

Lo que hacía Harvey, repartido entre tres:

- **Valentina:** decide, diseña y contacta.
- **Antigravity:** busca, construye y explica.
- **El CRM:** apunta todo y vigila las reglas.

## Resumen

| Paso | Dónde | Qué haces | Qué pasa en el CRM |
|---|---|---|---|
| 1. Buscar | Antigravity | `/buscar-negocios barberías en La Línea` | Entran negocios **sin web**, en *Nuevo*, con puntuación |
| 2. Elegir | CRM | Miras ficha, Maps y redes. Buenos → *Cualificado*. Con web o cerrados → *Descartado* | |
| 3. (Opcional) Llamar antes | CRM (móvil) | 📞 Llamar, con guion: "¿os puedo enviar una web de muestra por WhatsApp?" | Si dice que sí: *Acepta WhatsApp* |
| 4. Diseñar | Antigravity + tableta | `/nueva-demo <negocio>` y luego `/disenar-demo` | Demo *En diseño*; negocio en *Demo en diseño* |
| 5. Revisión | GitHub + CRM | `/publicar-demo <slug>`: Pull Request con vista previa | Demo *En revisión* |
| 6. Aprobación | CRM (Miguel) | Miguel mira la vista previa y pulsa **Aprobar** (o pide cambios) | Demo *Aprobada*; negocio en *Demo lista* |
| 7. Publicar | GitHub + Antigravity | Miguel acepta el Pull Request. Tú: `/publicar-demo <slug>` (parte B) | Demo *Publicada* con su dirección definitiva |
| 8. Enviar | CRM (móvil) | 💬 WhatsApp: el mensaje sale de la plantilla. Lo revisas, *Abrir WhatsApp*, envías y confirmas | *Contactado*; recordatorio de seguimiento a los 4 días |
| 9. Seguir | CRM | Si responde: ↩︎ *Respuesta*. Si no, un único seguimiento. Si dice que no: **Baja** | *Respondió*, *Interesado*, *Cliente* o *Baja* |

Para empezar el día: `/plan-del-dia` en Antigravity, o la pantalla **Hoy** del CRM.

## Horario y límites (como Harvey)

- Llamadas y WhatsApp a negocios: **lunes a viernes, 10:00-13:30 y 17:00-19:30**, sin festivos.
- Fuera de ese horario: diseñar, buscar y aprender.
- Máximo **10 primeros WhatsApp al día**. Mejor pocos y bien hechos.
- **Un** seguimiento como máximo, a los 4 días. Si no responde, se acabó por WhatsApp.
- Tres llamadas sin que lo cojan: mejor pasarse en persona o dejarlo.

## Los mensajes

Las plantillas están en el CRM → **Plantillas**. Puedes cambiarlas, pero el CRM no deja guardar ni enviar si:

- tiene **precios** (se hablan en persona);
- tiene más de **un enlace** o el enlace no es el de su demo;
- tiene palabras de **publicidad agresiva** ("oferta", "solo hoy"...);
- al primer mensaje le falta la frase de **BAJA**.

**Respuestas preparadas**: "¿cuánto cuesta?", "¿cómo tenéis mi número?", "no me carga" (por los bloqueos de los días de fútbol) y "no me interesa".

## La demo: nombres, dibujos y estilo

- **Tú pones el nombre de marca.** Puede ser el del negocio o uno mejor: "Barbería El Faro" → "El Faro Barber Club".
- **Estilos base:**
  - *clásico*: elegante y cálido (panaderías, floristerías, peluquerías);
  - *editorial*: tipografía grande (bares, barberías, tatuajes);
  - *vibrante*: color y formas (gimnasios, academias, talleres).
- **Tus dibujos:**
  - Inkscape para logos de trazo, que se animan "dibujándose".
  - Krita para ilustraciones con color.
  - Guárdalos en `demos/<slug>/originales/` y ejecuta `npm run imagenes -- demos/<slug>`.
- **Nunca inventes** reseñas, premios, años o precios. Usa datos de su ficha pública o textos genéricos honestos.
- Toda demo lleva la banda *"Web de muestra preparada por Mavie IA Solutions"*.

## Git en 6 comandos (lo hace Antigravity, pero entiéndelos)

| Comando | Qué hace |
|---|---|
| `git checkout -b demo/<slug>` | Crea una rama: una copia paralela para trabajar sin tocar lo publicado. |
| `git status` | Qué has cambiado. |
| `git add demos/<slug>` | Marca esos cambios para guardarlos. |
| `git commit -m "Demo <slug>: colores y logo"` | Guarda una versión con un mensaje que explica qué cambió. |
| `git push -u origin demo/<slug>` | La sube a GitHub. |
| `git checkout main` + `git pull` | Vuelves a la versión publicada y la actualizas. |

## Ten en cuenta (legal, resumido)

Esto no es asesoría legal. Ante cualquier duda, Miguel.

- Escribimos a **negocios**, con su teléfono **público** de Google Maps. En el primer mensaje siempre decimos **quiénes somos** y cómo darse de **baja**.
- Si alguien pregunta "¿cómo tenéis mi número?", se le dice de dónde y se ofrece borrarlo.
- La baja es **para siempre** y vale también para Harvey. El CRM no deja volver a escribir a una baja.
- Lo más limpio es **llamar primero y pedir permiso** para enviar la demo por WhatsApp: resultado *Acepta que le envíe la demo por WhatsApp*.
- Negocios **sanitarios** (clínicas, dentistas, fisios...): la publicidad sanitaria tiene normas propias. El CRM los marca: revisa la demo con Miguel.
