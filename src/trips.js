import { planTrip } from './core.js';

export const tripsKey = 'voyage.trips.v1';

export function validateTrip(trip) {
  if (!trip || typeof trip.id !== 'string' || !trip.id || typeof trip.name !== 'string' || !trip.name.trim()
    || typeof trip.country !== 'string' || !trip.country.trim() || !['driving', 'walking'].includes(trip.mode)
    || typeof trip.fileOrder !== 'boolean' || !Array.isArray(trip.places)
    || !trip.places.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim())
    || new Set(trip.places.map(p => p.id)).size !== trip.places.length) {
    throw new Error('Les données de ce voyage sont invalides.');
  }
  planTrip(trip.places, trip.days, trip.startId, trip.fileOrder);
  return trip;
}

export function createTrip(input, previous = null) {
  const now = new Date().toISOString();
  const trip = {
    id: previous?.id || crypto.randomUUID(), name: input.name.trim(), country: input.country.trim(),
    days: Number(input.days), mode: input.mode, fileOrder: Boolean(input.fileOrder), startId: input.startId || '',
    places: structuredClone(input.places), createdAt: previous?.createdAt || now, updatedAt: now
  };
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
