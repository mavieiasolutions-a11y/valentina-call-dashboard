---
name: buscar-negocios
description: Busca negocios SIN página web en un municipio del Campo de Gibraltar (Google Maps vía Serper, o OpenStreetMap gratis) y los guarda en el CRM. Úsala cuando Valentina pida buscar, encontrar o conseguir negocios, leads o clientes, por ejemplo "/buscar-negocios barberías en La Línea".
---

# Buscar negocios sin web

Haces lo que hacía Harvey en su búsqueda semanal, pero cuando Valentina lo pide.

## Pasos
1. Saca de la petición el **sector** y el **municipio**. Si falta alguno, pregúntalo. Municipios de la zona: Algeciras, La Línea de la Concepción, San Roque, Los Barrios, Tarifa, Castellar de la Frontera, Jimena de la Frontera, San Martín del Tesorillo.
2. Explica en una línea qué vas a hacer y cuánto cuesta:
   - Con `SERPER_API_KEY` en `.env.local`: Google Maps, **1 crédito por página** (2.500 gratis al registrarse).
   - Sin clave: OpenStreetMap, **gratis**, pero con menos negocios y menos teléfonos.
3. Si es la primera vez o Valentina duda, haz antes una prueba que no guarda nada:
   `npm run buscar -- --sector "<sector>" --municipio "<municipio>" --prueba`
4. Para guardar en el CRM:
   `npm run buscar -- --sector "<sector>" --municipio "<municipio>"`
   - Opcional `--paginas 2` (más resultados, 2 créditos).
   - Opcional `--verificar`: busca en Google si los 10 mejores tienen una web escondida (1 crédito cada uno). Úsalo cuando Valentina quiera estar segura.
5. Explica el resultado:
   - Cuántos se han encontrado, cuántos tenían web propia (descartados), cuántos estaban fuera de la zona y cuántos son nuevos en el CRM.
   - La **puntuación** (0-100): sube con móvil (WhatsApp), reseñas y tener solo redes sociales; baja si es sanitario o hay posible web.
6. Termina con el siguiente paso: "Abre el CRM → Negocios → Nuevo, revisa los de más puntuación y pasa a *Cualificado* los que te gusten".

## Si algo falla
- "Faltan estas claves en .env.local" → guíala con `docs/03-aprende-apis.md`.
- "Serper rechaza la clave" → la clave está mal copiada o caducada.
- "tope diario" → se ha llegado al límite de 40 créditos al día que pusimos para no gastar los gratis de golpe.
- Error de OpenStreetMap → el servidor público está saturado; prueba en unos minutos.

## No hagas
- No busques fuera de la zona sin que Valentina lo pida expresamente.
- No guardes negocios que ya tienen web propia.
- No uses robots que entren en Google Maps o Instagram: solo las APIs de los scripts.
