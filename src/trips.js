import { validateOrganizer } from './travel-tools.js';
import { planTrip } from './core.js';

export const tripsKey = 'voyage.trips.v1';

export function routeSignature(trip) {
  return JSON.stringify([trip.id, trip.days, trip.mode, trip.fileOrder, trip.startId, trip.places.map(p => [p.id, p.lat, p.lng, p.googlePlaceId || ''])]);
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
  return validateTrip({ ...trip, updatedAt: new Date().toISOString(), places: trip.places.map(p => p.id === id ? { ...p, ...patch, id: p.id } : p) });
}

export function validateTrip(trip) {
  if (!trip || typeof trip.id !== 'string' || !trip.id || typeof trip.name !== 'string' || !trip.name.trim()
    || typeof trip.country !== 'string' || !trip.country.trim() || !['driving', 'walking'].includes(trip.mode)
    || typeof trip.fileOrder !== 'boolean' || !Array.isArray(trip.places)
    || !trip.places.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim())
    || new Set(trip.places.map(p => p.id)).size !== trip.places.length) {
    throw new Error('Les données de ce voyage sont invalides.');
  }
  if (trip.organizer !== undefined) validateOrganizer(trip.organizer);
  planTrip(trip.places, trip.days, trip.startId, trip.fileOrder);
  return trip;
}

export function createTrip(input, previous = null) {
  const now = new Date().toISOString();
  const trip = {
    id: previous?.id || crypto.randomUUID(), name: input.name.trim(), country: input.country.trim(),
    days: Number(input.days), mode: input.mode, fileOrder: Boolean(input.fileOrder), startId: input.startId || '',
    ...(previous?.organizer ? { organizer: structuredClone(previous.organizer) } : {}),
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
