// Convierte lo que devuelven las APIs (Google Maps vía Serper u OpenStreetMap)
// al formato de la tabla "negocios" del CRM. Son funciones puras con tests.
import {
  normalizarTelefono,
  tipoTelefono,
  clasificarWeb,
  enZona,
  esSanitario,
  puntuarNegocio,
  enlaceMaps,
  esInstagram,
} from '../../crm/js/reglas.js';
import { AJUSTES } from '../../crm/js/ajustes.js';

const quitarTildes = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function codigoPostal(direccion = '') {
  return direccion.match(/\b(\d{5})\b/)?.[1] ?? '';
}

/** Saca el municipio de la dirección si es uno de la zona; si no, usa el que se buscó. */
export function municipioDe(direccion = '', porDefecto = '', ajustes = AJUSTES) {
  const dir = quitarTildes(direccion);
  const encontrado = ajustes.zona.municipios.find((m) => dir.includes(quitarTildes(m)));
  if (encontrado) return encontrado;
  if (/la linea/.test(dir)) return 'La Línea de la Concepción';
  if (/gibraltar/.test(dir)) return 'Gibraltar';
  return porDefecto;
}

/** Un resultado de Serper (Google Maps) → negocio */
export function desdeSerper(sitio, { sector = '', municipio = '' } = {}) {
  const direccion = sitio.address ?? '';
  const nombre = (sitio.title ?? '').trim();
  return {
    nombre,
    sector: sitio.category || sector,
    direccion,
    municipio: municipioDe(direccion, municipio),
    codigo_postal: codigoPostal(direccion),
    telefono: normalizarTelefono(sitio.phoneNumber ?? '') || null,
    web: sitio.website ?? '',
    valoracion: typeof sitio.rating === 'number' ? Math.round(sitio.rating * 10) / 10 : null,
    num_resenas: Number(sitio.ratingCount ?? 0) || 0,
    lat: sitio.latitude ?? null,
    lng: sitio.longitude ?? null,
    maps_url: sitio.cid ? `https://maps.google.com/?cid=${sitio.cid}` : enlaceMaps(nombre, direccion),
    fuente: 'serper',
    fuente_id: sitio.cid ? `serper:${sitio.cid}` : sitio.placeId ? `serper:${sitio.placeId}` : null,
  };
}

/** Un elemento de OpenStreetMap (Overpass) → negocio */
export function desdeOsm(el, { sector = '', municipio = '' } = {}) {
  const t = el.tags ?? {};
  const calle = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const cp = t['addr:postcode'] ?? '';
  const ciudad = t['addr:city'] ?? municipio;
  const direccion = [calle, [cp, ciudad].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;
  return {
    nombre: (t.name ?? '').trim(),
    sector: sector || t.shop || t.amenity || t.craft || t.leisure || '',
    direccion,
    municipio: municipioDe(direccion, municipio),
    codigo_postal: /^\d{5}$/.test(cp) ? cp : '',
    telefono: normalizarTelefono(t.phone ?? t['contact:phone'] ?? t.mobile ?? '') || null,
    web: t.website ?? t['contact:website'] ?? t['contact:facebook'] ?? t['contact:instagram'] ?? '',
    instagram: t['contact:instagram'] ?? '',
    email: t.email ?? t['contact:email'] ?? '',
    lat,
    lng,
    maps_url: lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : '',
    fuente: 'osm',
    fuente_id: `osm:${el.type}/${el.id}`,
  };
}

/**
 * Completa los campos calculados y decide si se importa.
 * Devuelve { negocio, motivo } donde motivo explica por qué se descarta ('' = se importa).
 */
export function preparar(n, ajustes = AJUSTES) {
  if (!n.nombre) return { negocio: n, motivo: 'sin nombre' };
  const web_tipo = clasificarWeb(n.web);
  if (web_tipo === 'propia') return { negocio: n, motivo: 'ya tiene web' };
  const direccionParaZona = n.direccion || n.municipio;
  if (direccionParaZona && !enZona(direccionParaZona, ajustes)) return { negocio: n, motivo: 'fuera de la zona' };
  const { puntos, razones } = puntuarNegocio(n, ajustes);
  return {
    negocio: {
      ...n,
      telefono_tipo: tipoTelefono(n.telefono),
      web_tipo,
      instagram: n.instagram || (esInstagram(n.web) ? n.web : ''),
      sanitario: esSanitario(`${n.nombre} ${n.sector}`),
      puntuacion: puntos,
      notas: `Puntuación ${puntos}: ${razones.join('; ')}`,
    },
    motivo: '',
  };
}
