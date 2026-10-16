import { coordinates, fromURL, mapsReference } from './core.js';

let loading;
let activeKey;
export function loadGoogle(key) {
  if (!key?.trim()) return Promise.reject(new Error('Configurez votre clé Google Maps dans « Services Google Maps ».'));
  if (loading) {
    if (key !== activeKey) return Promise.reject(new Error('La clé a changé. Rechargez la page avant de reconnecter Google Maps.'));
    return loading;
  }
  activeKey = key;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('Google Maps ne répond pas. Vérifiez la connexion et rechargez la page.')), 20000);
    globalThis.voyageGoogleReady = () => { clearTimeout(timer); resolve(globalThis.google.maps); };
    globalThis.gm_authFailure = () => { clearTimeout(timer); reject(new Error('Google a refusé la clé. Vérifiez les API activées, la facturation et les restrictions du site.')); };
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key: key.trim(), v: 'weekly', loading: 'async', callback: 'voyageGoogleReady', language: 'fr' })}`;
    script.async = true;
    script.onerror = () => { clearTimeout(timer); reject(new Error('Impossible de charger Google Maps. Vérifiez la connexion et rechargez la page.')); };
    document.head.append(script);
  });
  return loading;
}

export async function findGooglePlaces(place, maps) {
  const embedded = fromURL(place.url);
  if (embedded) return [{ ...embedded, name: place.name, country: place.country, address: 'Coordonnées présentes dans le lien enregistré', direct: true }];
  const ref = mapsReference(place.url);
  const { Place } = await maps.importLibrary('places');
  const fields = ['id', 'displayName', 'location', 'formattedAddress', 'addressComponents', 'googleMapsURI'];
  let found;
  if (ref.placeId) {
    const p = new Place({ id: ref.placeId }); await p.fetchFields({ fields }); found = [p];
  } else {
    const response = await Place.searchByText({ textQuery: [ref.name || place.name, place.country].filter(Boolean).join(', '), fields, maxResultCount: 5, language: 'fr' });
    found = response.places;
  }
  return (found || []).filter(p => p.location && coordinates(p.location.lat(), p.location.lng())).map(p => ({
    name: p.displayName || place.name, lat: p.location.lat(), lng: p.location.lng(), placeId: p.id,
    address: p.formattedAddress || '', country: p.addressComponents?.find(c => c.types.includes('country'))?.longText || place.country,
    url: p.googleMapsURI || '', exact: Boolean((ref.placeId && ref.placeId === p.id) || (ref.cid && ref.cid === mapsReference(p.googleMapsURI).cid))
  })).sort((a, b) => Number(b.exact) - Number(a.exact));
}

function waypoint(p) {
  if (p.googlePlaceId) return `places/${p.googlePlaceId}`;
  const point = coordinates(p.lat, p.lng);
  if (point) return point;
  throw new Error(`Retrouvez et confirmez d’abord les coordonnées de « ${p.name} » dans le carnet.`);
}

export async function computeGoogleDay(day, mode, Route) {
  const stops = day.previous ? [day.previous, ...day.stops] : day.stops;
  if (stops.length < 2) return { distanceMeters: 0, durationMillis: 0, noTravel: true };
  let distanceMeters = 0, durationMillis = 0;
  // 25 intermediate waypoints per request. Overlap one stop between chunks.
  for (let i = 0; i < stops.length - 1; i += 26) {
    const part = stops.slice(i, i + 27);
    const response = await Route.computeRoutes({
      origin: waypoint(part[0]), destination: waypoint(part.at(-1)),
      intermediates: part.slice(1, -1).map(p => ({ location: waypoint(p) })),
      travelMode: mode === 'walking' ? 'WALKING' : 'DRIVING',
      ...(mode === 'driving' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
      fields: ['distanceMeters', 'durationMillis'], language: 'fr', optimizeWaypointOrder: false
    });
    const route = response.routes?.[0];
    if (!route || !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0 || !Number.isFinite(route.durationMillis) || route.durationMillis < 0) throw new Error('Google n’a pas renvoyé de trajet complet pour cette journée.');
    distanceMeters += route.distanceMeters; durationMillis += route.durationMillis;
  }
  return { distanceMeters, durationMillis, noTravel: false };
}

export function formatGoogleRoute(result) {
  if (result.noTravel) return '0 km · 0 min — une seule étape, aucun déplacement entre visites';
  const minutes = Math.ceil(result.durationMillis / 60000), hours = Math.floor(minutes / 60);
  const time = hours ? `${hours} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
  return `${(result.distanceMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · ${time} de trajet — Google Maps`;
}
