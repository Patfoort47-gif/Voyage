import { coordinates, fromURL, mapsReference } from './core.js';

export const defaultServices = {
  search: 'https://nominatim.openstreetmap.org/search',
  driving: 'https://router.project-osrm.org/route/v1/driving',
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
};
const cacheKey = 'voyage.osm.cache.v1';
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
  const query = [place.name || ref.name, place.country].filter(Boolean).join(', ');
  const url = new URL(serviceURL(services.search));
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '5', 'accept-language': 'fr' });
  const identity = url.href;
  let cache = {};
  try { cache = JSON.parse(storage.getItem(cacheKey) || '{}'); } catch { /* Cache is optional. */ }
  if (cache?.[identity]?.at > Date.now() - 30 * 86400000 && Array.isArray(cache[identity].results)) return cache[identity].results;
  const data = await request(url.href);
  if (!Array.isArray(data)) throw new Error('Le service de recherche n’a pas renvoyé de résultats valides.');
  const results = data.filter(p => coordinates(p.lat, p.lon)).map(p => ({
    ...coordinates(p.lat, p.lon), name: p.name || String(p.display_name || place.name).split(',')[0],
    address: p.display_name || '', country: p.address?.country || place.country,
    url: ['node', 'way', 'relation'].includes(p.osm_type) && /^\d+$/.test(String(p.osm_id)) ? `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}` : '', source: 'OpenStreetMap'
  }));
  try {
    cache = Object.fromEntries(Object.entries(cache || {}).filter(([, v]) => v?.at > Date.now() - 30 * 86400000).slice(-199));
    cache[identity] = { at: Date.now(), results }; storage.setItem(cacheKey, JSON.stringify(cache));
  } catch { /* A disabled cache must not discard search results. */ }
  return results;
}

export async function computeFreeDay(day, mode, services = readServices(), request = politeFetch) {
  const stops = day.previous ? [day.previous, ...day.stops] : day.stops;
  if (stops.length < 2) return { distanceMeters: 0, durationMillis: 0, noTravel: true };
  if (!['walking', 'driving'].includes(mode)) throw new Error('Mode de déplacement non pris en charge.');
  for (const p of stops) if (!coordinates(p.lat, p.lng)) throw new Error(`Retrouvez et confirmez d’abord les coordonnées de « ${p.name} ».`);
  let distanceMeters = 0, durationMillis = 0;
  // At most 25 coordinates per call; adjacent blocks share one stop, no leg.
  for (let i = 0; i < stops.length - 1; i += 24) {
    const part = stops.slice(i, i + 25), points = part.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${serviceURL(services[mode])}/${points}?overview=false&steps=false&continue_straight=false`;
    const data = await request(url), route = data.routes?.[0];
    if (data.code !== 'Ok' || !route || !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || route.duration < 0
      || !Array.isArray(route.legs) || route.legs.length !== part.length - 1) throw new Error('Aucun trajet complet trouvé. Vérifiez les lieux ou le mode de déplacement.');
    distanceMeters += route.distance; durationMillis += route.duration * 1000;
  }
  return { distanceMeters, durationMillis, noTravel: false };
}

export function formatFreeRoute(result) {
  if (result.noTravel) return '0 km · 0 min — une seule étape, aucun déplacement entre visites';
  const minutes = Math.ceil(result.durationMillis / 60000), hours = Math.floor(minutes / 60);
  return `${(result.distanceMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · ${hours ? `${hours} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`} de trajet — OpenStreetMap / OSRM, sans trafic`;
}
