// OpenStreetMap (Overpass API): el "Wikipedia de los mapas". Es gratis y no
// necesita clave, pero tiene menos negocios y menos teléfonos que Google Maps.
// Documentación: https://wiki.openstreetmap.org/wiki/Overpass_API

const SERVIDORES = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// Sector en español → etiquetas de OpenStreetMap
export const ETIQUETAS_OSM = {
  peluqueria: ['shop=hairdresser', 'shop=beauty'],
  barberia: ['shop=hairdresser'],
  'taller mecanico': ['shop=car_repair', 'shop=tyres'],
  bar: ['amenity=bar', 'amenity=pub'],
  restaurante: ['amenity=restaurant', 'amenity=fast_food'],
  cafeteria: ['amenity=cafe', 'shop=pastry'],
  panaderia: ['shop=bakery'],
  fruteria: ['shop=greengrocer'],
  carniceria: ['shop=butcher'],
  floristeria: ['shop=florist'],
  'tienda de ropa': ['shop=clothes', 'shop=boutique'],
  zapateria: ['shop=shoes'],
  ferreteria: ['shop=hardware', 'shop=doityourself'],
  fontanero: ['craft=plumber'],
  electricista: ['craft=electrician'],
  cerrajero: ['shop=locksmith', 'craft=locksmith'],
  carpinteria: ['craft=carpenter'],
  reformas: ['craft=builder', 'craft=tiler', 'craft=painter'],
  academia: ['amenity=language_school', 'amenity=music_school', 'amenity=prep_school'],
  autoescuela: ['amenity=driving_school'],
  gimnasio: ['leisure=fitness_centre'],
  veterinario: ['amenity=veterinary'],
  lavanderia: ['shop=laundry', 'shop=dry_cleaning'],
  tatuajes: ['shop=tattoo'],
};

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Construye la consulta Overpass: negocios con nombre y SIN etiqueta de web. */
export function consultaOverpass(sector, municipio) {
  const etiquetas = ETIQUETAS_OSM[sinTildes(sector)];
  const filtros = etiquetas
    ? etiquetas.map((e) => {
        const [k, v] = e.split('=');
        return `["${k}"="${v}"]`;
      })
    : ['["shop"]', '["craft"]', '["amenity"~"^(restaurant|bar|cafe|pub|fast_food)$"]'];
  const nombre = municipio.replace(/"/g, '');
  const partes = filtros
    .map((f) => `  nwr(area.zona)${f}["name"][!"website"][!"contact:website"];`)
    .join('\n');
  return `[out:json][timeout:60];
area["name"="${nombre}"]["boundary"="administrative"]["admin_level"="8"]->.zona;
(
${partes}
);
out center tags 200;`;
}

export async function buscarEnOsm({ sector, municipio }) {
  const consulta = consultaOverpass(sector, municipio);
  let ultimoError;
  for (const url of SERVIDORES) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'valentina-crm/1.0' },
        body: new URLSearchParams({ data: consulta }),
      });
      if (!r.ok) throw new Error(`OpenStreetMap ha respondido ${r.status}`);
      const datos = await r.json();
      return { elementos: datos.elements ?? [], creditos: 0 };
    } catch (e) {
      ultimoError = e;
    }
  }
  throw new Error(`No he podido consultar OpenStreetMap (${ultimoError?.message}). Prueba en un rato.`);
}
