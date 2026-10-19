import { validateOrganizer } from './travel-tools.js';
import { planTrip } from './core.js';

export const tripsKey = 'voyage.trips.v1';

export function routeSignature(trip) {
  return JSON.stringify(['nearest-2opt-v1', trip.id, trip.days, trip.mode, trip.fileOrder, trip.startId, trip.dayGroups||null, trip.places.map(p => [p.id, p.lat, p.lng, p.googlePlaceId || ''])]);
}

export function formatTripCreatedAt(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return 'Date de création inconnue';
  return `Créé le ${date.toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`;
}

export function remainingPlaces(places, trip) {
  const included = new Set(trip.places.map(p => p.id));
  return places.filter(p => !included.has(p.id)).map(p => ({ ...p, selected: false }));
}

export function updateTripPlace(trip, id, patch) {
  if (!trip.places.some(p => p.id === id)) throw new Error('Ce lieu ne figure plus dans le voyage.');
  const moved=trip.places.some(p=>p.id===id&&(('lat' in patch&&patch.lat!==p.lat)||('lng' in patch&&patch.lng!==p.lng)));
  return validateTrip({ ...trip,...(moved?{dayGroups:null}:{}), updatedAt: new Date().toISOString(), places: trip.places.map(p => p.id === id ? { ...p, ...patch, id: p.id } : p) });
}

export function validateTrip(trip) {
  if (!trip || typeof trip.id !== 'string' || !trip.id || typeof trip.name !== 'string' || !trip.name.trim()
    || typeof trip.country !== 'string' || !trip.country.trim() || !['driving', 'walking'].includes(trip.mode)
    || typeof trip.fileOrder !== 'boolean' || !Array.isArray(trip.places)
    || !trip.places.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim())
    || new Set(trip.places.map(p => p.id)).size !== trip.places.length) {
    throw new Error('Les données de ce voyage sont invalides.');
  }
  for(const place of trip.places) {
    if(place.visited!==undefined && typeof place.visited!=='boolean')throw new Error('Le suivi de visite est invalide.');
    if(place.tasks!==undefined && (!Array.isArray(place.tasks)||place.tasks.length>100||place.tasks.some(task=>!task||typeof task.id!=='string'||!task.id||typeof task.text!=='string'||!task.text.trim()||task.text.length>300||typeof task.done!=='boolean')||new Set(place.tasks.map(t=>t.id)).size!==place.tasks.length))throw new Error('La liste des tâches du lieu est invalide.');
  }
  if (trip.organizer !== undefined) validateOrganizer(trip.organizer);
  planTrip(trip.places, trip.days, trip.startId, trip.fileOrder, trip.dayGroups);
  return trip;
}

export function createTrip(input, previous = null) {
  const now = new Date().toISOString();
  const trip = {
    id: previous?.id || crypto.randomUUID(), name: input.name.trim(), country: input.country.trim(),
    days: Number(input.days), mode: input.mode, fileOrder: Boolean(input.fileOrder), startId: input.startId || '',
    ...(previous?.organizer ? { organizer: structuredClone(previous.organizer) } : input.organizer ? {organizer:structuredClone(input.organizer)} : {}),
    ...(previous?.dayGroups && !input.fileOrder && previous.days===Number(input.days) && previous.startId===(input.startId||'') && previous.places.length===input.places.length && previous.places.every(p=>input.places.some(q=>q.id===p.id&&q.lat===p.lat&&q.lng===p.lng)) ? {dayGroups:structuredClone(previous.dayGroups)} : {}),
    places: structuredClone(input.places), createdAt: previous?.createdAt || now, updatedAt: now
  };
  if (previous?.days !== undefined && previous.days !== trip.days && trip.organizer?.packing) delete trip.organizer.packing.weather;
  return validateTrip(trip);
}

export function loadTrips(storage) {
  const trips = JSON.parse(storage.getItem(tripsKey) || '[]');
  if (!Array.isArray(trips)) throw new Error('La sauvegarde des voyages est invalide.');
  trips.forEach(validateTrip);
  return trips;
}

export function persistTrips(storage, trips) {
  trips.forEach(validateTrip);
  storage.setItem(tripsKey, JSON.stringify(trips));
}
