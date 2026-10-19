import { coordinates, fromURL, mapsReference } from './core.js';

export const defaultServices = {
  search: 'https://nominatim.openstreetmap.org/search',
  photon: 'https://photon.komoot.io/api',
  driving: 'https://router.project-osrm.org/route/v1/driving',
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
};
const cacheKey = 'voyage.osm.cache.v2';
let pending = Promise.resolve();
const optionalStorage = () => { try { return globalThis.localStorage; } catch { return null; } };

export function serviceURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Indiquez une adresse de service HTTPS sans identifiants, paramètres ni fragment.');
  return url.href.replace(/\/$/, '');
}

export function readServices(storage = optionalStorage()) {
  try {
    const saved = JSON.parse(storage.getItem('voyage.free.services') || '{}');
    return Object.fromEntries(Object.entries(defaultServices).map(([k, v]) => [k, serviceURL(saved[k] || v)]));
  } catch { return { ...defaultServices }; }
}

async function politeFetch(url) {
  // Shared same-origin lock + timestamp prevent parallel requests across tabs.
  const run = async () => {
    let last = 0;
    try { last = Number(localStorage.getItem('voyage.osm.last-request')) || 0; } catch { /* Memory throttling still applies. */ }
    const wait = Math.min(1100, Math.max(0, last + 1100 - Date.now()));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    try { localStorage.setItem('voyage.osm.last-request', String(Date.now())); } catch { /* Storage may be disabled. */ }
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), referrerPolicy: 'strict-origin-when-cross-origin' });
    if (response.status === 429) throw new Error('Service gratuit occupé ou quota atteint. Attendez avant de relancer.');
    if (!response.ok) throw new Error(`Service gratuit indisponible (HTTP ${response.status}). Réessayez plus tard ou changez de serveur dans les réglages.`);
    return response.json();
  };
  const scheduled = () => globalThis.navigator?.locks ? navigator.locks.request('voyage-public-maps', run) : run();
  const result = pending.then(scheduled, scheduled);
  pending = result.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, 1100)));
  return result;
}

export async function findFreePlaces(place, services = readServices(), request = politeFetch, storage = optionalStorage()) {
  const embedded = fromURL(place.url);
  if (embedded) return [{ ...embedded, name: place.name, country: place.country, address: 'Coordonnées présentes dans le lien enregistré', direct: true }];
  const ref = mapsReference(place.url);
  const name = place.searchName?.trim() || place.name || ref.name;
  const query = [name, place.searchCity, place.country].filter(Boolean).join(', ');
  const simple = name.replace(/\([^)]*\)/g, '').replace(/^(?:le |la |les |l['’])/i, '').replace(/\s+/g, ' ').trim();
  const relaxed = [simple || name, place.searchCity, place.country].filter(Boolean).join(', ');
  const engine = place.searchEngine || 'auto';
  const url = new URL(serviceURL(services.search));
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', namedetails: '1', limit: '5', 'accept-language': 'fr' });
  const identity = JSON.stringify([url.href, services.photon || defaultServices.photon, engine]);
  let cache = {};
  try { cache = JSON.parse(storage.getItem(cacheKey) || '{}'); } catch { /* Cache is optional. */ }
  if (cache?.[identity]?.results?.length && cache[identity].at > Date.now() - 30 * 86400000) return cache[identity].results;
  let results = [], failure;
  if (engine !== 'photon') {
    try {
      let data = await request(url.href);
      if (!Array.isArray(data)) throw new Error('Le service de recherche n’a pas renvoyé de résultats valides.');
      if (!data.length && relaxed !== query) {
        url.searchParams.set('q', relaxed); data = await request(url.href);
        if (!Array.isArray(data)) throw new Error('Réponse de recherche invalide.');
      }
      results = data.filter(p => coordinates(p.lat, p.lon)).map(p => ({
    ...coordinates(p.lat, p.lon), name: p.name || String(p.display_name || place.name).split(',')[0],
    address: p.display_name || '', country: p.address?.country || place.country, city: p.address?.city || p.address?.town || p.address?.village || p.address?.municipality || '', countryCode: p.address?.country_code || '', localName: p.namedetails?.name || p.name || '',
    url: ['node', 'way', 'relation'].includes(p.osm_type) && /^\d+$/.test(String(p.osm_id)) ? `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}` : '', source: 'OpenStreetMap'
  }));
    } catch (error) { failure = error; }
  }
  if ((engine === 'auto' && !results.length) || engine === 'photon') {
    try {
      const photon = new URL(serviceURL(services.photon || defaultServices.photon));
      photon.search = new URLSearchParams({ q: relaxed, limit: '5', lang: 'fr' });
      const data = await request(photon.href);
      if (!Array.isArray(data.features)) throw new Error('Photon n’a pas renvoyé de résultats valides.');
      results = data.features.filter(f => f.geometry?.type === 'Point' && coordinates(f.geometry.coordinates?.[1], f.geometry.coordinates?.[0])).map(f => {
        const p = f.properties || {}, type = { N: 'node', W: 'way', R: 'relation' }[p.osm_type];
        return { ...coordinates(f.geometry.coordinates[1], f.geometry.coordinates[0]), name: p.name || name,
          address: [...new Set([p.name, p.street, p.city, p.state, p.country].filter(Boolean))].join(', '), country: p.country || place.country, city: p.city || '', countryCode: p.countrycode || '', localName: p.name || '',
          url: type && /^\d+$/.test(String(p.osm_id)) ? `https://www.openstreetmap.org/${type}/${p.osm_id}` : '', source: 'OpenStreetMap / Photon' };
      });
      failure = null;
    } catch (error) { failure = error; }
  }
  if (!results.length && failure) throw failure;
  try {
    cache = Object.fromEntries(Object.entries(cache || {}).filter(([, v]) => v?.at > Date.now() - 30 * 86400000).slice(-199));
    if (results.length) cache[identity] = { at: Date.now(), results };
    storage.setItem(cacheKey, JSON.stringify(cache));
  } catch { /* A disabled cache must not discard search results. */ }
  return results;
}

export async function reverseFreePlace(place, services = readServices(), request = politeFetch) {
  const point = coordinates(place.lat, place.lng);
  if (!point) throw new Error('Des coordonnées sont nécessaires pour retrouver la ville.');
  const url = new URL(serviceURL(services.search));
  if (!/\/search$/.test(url.pathname)) throw new Error('Précisez la ville manuellement avec ce serveur personnalisé.');
  url.pathname = url.pathname.replace(/\/search$/, '/reverse');
  url.search = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), format: 'jsonv2', addressdetails: '1', namedetails: '1', zoom: '18' });
  const data = await request(url.href);
  if (data.error || !data.address) throw new Error('Ville introuvable : indiquez-la dans le formulaire.');
  const a = data.address;
  return { city: a.city || a.town || a.village || a.municipality || '', country: a.country || place.country, countryCode: a.country_code || '', localName: data.namedetails?.name || data.name || '', address: data.display_name || '' };
}

export async function computeFreeDay(day, mode, services = readServices(), request = politeFetch) {
  const stops = day.previous ? [day.previous, ...day.stops] : day.stops;
  if (stops.length < 2) return { distanceMeters: 0, durationMillis: 0, noTravel: true };
  if (!['walking', 'driving'].includes(mode)) throw new Error('Mode de déplacement non pris en charge.');
  for (const p of stops) if (!coordinates(p.lat, p.lng)) throw new Error(`Retrouvez et confirmez d’abord les coordonnées de « ${p.name} ».`);
  let distanceMeters = 0, durationMillis = 0, geometryComplete = true;
  const geometry = [];
  // At most 25 coordinates per call; adjacent blocks share one stop, no leg.
  for (let i = 0; i < stops.length - 1; i += 24) {
    const part = stops.slice(i, i + 25), points = part.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${serviceURL(services[mode])}/${points}?overview=full&geometries=geojson&steps=false&continue_straight=false`;
    const data = await request(url), route = data.routes?.[0];
    if (data.code !== 'Ok' || !route || !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || route.duration < 0
      || !Array.isArray(route.legs) || route.legs.length !== part.length - 1) throw new Error('Aucun trajet complet trouvé. Vérifiez les lieux ou le mode de déplacement.');
    distanceMeters += route.distance; durationMillis += route.duration * 1000;
    const path = route.geometry?.type === 'LineString' ? route.geometry.coordinates : null;
    if (!Array.isArray(path) || path.length < 2 || path.some(p => !Array.isArray(p) || !coordinates(p[1], p[0]))) geometryComplete = false;
    else geometry.push(...path.map(p => [p[1], p[0]]));
  }
  return { distanceMeters, durationMillis, noTravel: false, geometry: geometryComplete ? geometry : null };
}

export function formatFreeRoute(result) {
  if (result.noTravel) return '0 km · 0 min — une seule étape, aucun déplacement entre visites';
  const minutes = Math.ceil(result.durationMillis / 60000), hours = Math.floor(minutes / 60);
  return `${(result.distanceMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · ${hours ? `${hours} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`} de trajet — OpenStreetMap / OSRM, sans trafic`;
}
