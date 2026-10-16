import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, loadTrips, persistTrips, tripsKey } from '../src/trips.js';
import { demo, planTrip } from '../src/core.js';

const input = () => ({ name: ' Portugal en famille ', country: 'Portugal', days: 5, mode: 'driving', fileOrder: false, startId: 'demo-2', places: structuredClone(demo) });
const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('un voyage sauvegardé possède une copie indépendante du carnet', () => {
  const original = input(), trip = createTrip(original), storage = memoryStorage();
  original.places[0].name = 'Lieu modifié'; original.places.splice(1);
  assert.equal(trip.places.length, 10);
  assert.equal(trip.places[0].name, demo[0].name);
  persistTrips(storage, [trip]);
  const restored = loadTrips(storage)[0];
  assert.equal(restored.name, 'Portugal en famille');
  assert.deepEqual(planTrip(restored.places, restored.days, restored.startId, restored.fileOrder), planTrip(trip.places, trip.days, trip.startId, trip.fileOrder));
});
test('modifier un voyage conserve son identité et sa date de création', () => {
  const first = createTrip(input());
  const modified = createTrip({ ...first, name: 'Week-end', days: 2, mode: 'walking', places: first.places.slice(0, 3) }, first);
  assert.equal(modified.id, first.id); assert.equal(modified.createdAt, first.createdAt);
  assert.equal(modified.days, 2); assert.equal(modified.places.length, 3);
  assert.equal(first.places.length, 10);
});
test('supprimer un dossier conserve les autres après rechargement', () => {
  const storage = memoryStorage(), first = createTrip(input()), second = createTrip({ ...input(), name: 'Autre voyage' });
  persistTrips(storage, [first, second]);
  persistTrips(storage, loadTrips(storage).filter(t => t.id !== first.id));
  assert.deepEqual(loadTrips(storage).map(t => t.id), [second.id]);
});
test('un voyage vide ou invalide ne remplace pas la sauvegarde valide', () => {
  const storage = memoryStorage(); persistTrips(storage, [createTrip(input())]);
  const before = storage.getItem(tripsKey);
  assert.throws(() => createTrip({ ...input(), places: [] }), /Sélectionne/);
  assert.throws(() => persistTrips(storage, [{ ...createTrip(input()), days: 0 }]));
  assert.equal(storage.getItem(tripsKey), before);
  assert.throws(() => loadTrips({ getItem: () => '{}' }), /invalide/);
});
test('une erreur de stockage remonte au lieu de prétendre avoir sauvegardé', () => {
  assert.throws(() => persistTrips({ setItem: () => { throw new Error('QuotaExceededError'); } }, [createTrip(input())]), /QuotaExceededError/);
});
