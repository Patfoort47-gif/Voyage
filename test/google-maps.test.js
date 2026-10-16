import test from 'node:test';
import assert from 'node:assert/strict';
import { fromURL, mapsReference } from '../src/core.js';
import { findGooglePlaces, computeGoogleDay, formatGoogleRoute, loadGoogle } from '../src/google-maps.js';

test('lien Maps : coordonnées du lieu, identifiant CID sans perte de précision, caméra ignorée', () => {
  assert.deepEqual(fromURL('https://www.google.com/maps/place/Test/data=!3d43.727!4d7.415'), { lat: 43.727, lng: 7.415 });
  assert.equal(fromURL('https://www.google.com/maps/@43.7,7.4,15z'), null);
  assert.equal(fromURL('https://evil.test/?q=43.7,7.4'), null);
  const ref = mapsReference('https://www.google.com/maps/place/Un+lieu/data=!4m2!3m1!1s0x1234:0xffffffffffffffff');
  assert.equal(ref.name, 'Un lieu'); assert.equal(ref.cid, '18446744073709551615');
  assert.equal(mapsReference('https://www.google.com/maps/search/?api=1&query=Test&query_place_id=ChIJtest').placeId, 'ChIJtest');
});

test('recherche Places : nom du lien et pays, candidats et pays à confirmer', async () => {
  let request;
  const maps = { importLibrary: async () => ({ Place: { searchByText: async r => {
    request = r;
    return { places: [{ id: 'ChIJtest', displayName: 'Lieu trouvé', location: { lat: () => 43.7, lng: () => 7.4 },
      formattedAddress: 'Adresse du lieu', addressComponents: [{ types: ['country'], longText: 'Monaco' }], googleMapsURI: 'https://maps.google.com/?cid=4660' }] };
  } } }) };
  const found = await findGooglePlaces({ name: 'Ancien nom', country: 'Monaco', url: 'https://www.google.com/maps/place/Lieu+du+lien/data=!1s0x999:0x1234' }, maps);
  assert.equal(request.textQuery, 'Lieu du lien, Monaco');
  assert.equal(found[0].exact, true); assert.equal(found[0].country, 'Monaco');
  assert.equal(found[0].lat, 43.7); assert.equal(found[0].placeId, 'ChIJtest');
});

test('coordonnées explicites : aucune requête Google nécessaire', async () => {
  const found = await findGooglePlaces({ name: 'Lieu', country: 'France', url: 'https://maps.google.com/?q=48.2,2.3' }, null);
  assert.deepEqual([found[0].lat, found[0].lng], [48.2, 2.3]);
  await assert.rejects(loadGoogle(''), /Configurez/);
});

test('Routes : vrai total API, ordre conservé, liaison depuis la veille incluse', async () => {
  let request;
  const Route = { computeRoutes: async r => { request = r; return { routes: [{ distanceMeters: 12600, durationMillis: 3720000 }] }; } };
  const previous = { lat: 43.7, lng: 7.4 }, stops = [{ lat: 43.8, lng: 7.5 }, { lat: 43.9, lng: 7.6 }];
  const result = await computeGoogleDay({ previous, stops }, 'driving', Route);
  assert.deepEqual(request.origin, previous); assert.deepEqual(request.destination, stops[1]);
  assert.deepEqual(request.intermediates, [{ location: stops[0] }]);
  assert.equal(request.travelMode, 'DRIVING'); assert.equal(request.routingPreference, 'TRAFFIC_AWARE');
  assert.equal(request.optimizeWaypointOrder, false);
  assert.equal(result.distanceMeters, 12600); assert.equal(result.durationMillis, 3720000);
  assert.ok(formatGoogleRoute(result).includes('1 h 02')); assert.ok(formatGoogleRoute(result).includes('Google Maps'));
});

test('Routes : limite de 25 intermédiaires, total sans doubler une liaison', async () => {
  const stops = Array.from({ length: 60 }, (_, i) => ({ lat: i, lng: 1 })); let calls = 0, legs = 0;
  const Route = { computeRoutes: async r => {
    calls++; assert.ok(r.intermediates.length <= 25);
    legs += r.intermediates.length + 1;
    return { routes: [{ distanceMeters: (r.intermediates.length + 1) * 1000, durationMillis: 60000 }] };
  } };
  const result = await computeGoogleDay({ stops }, 'walking', Route);
  assert.equal(calls, 3); assert.equal(legs, 59); assert.equal(result.distanceMeters, 59000);
});

test('Routes : les erreurs ou valeurs absentes ne deviennent jamais 0 km', async () => {
  const day = { stops: [{ lat: 43, lng: 7 }, { lat: 44, lng: 8 }] };
  await assert.rejects(computeGoogleDay(day, 'walking', { computeRoutes: async () => ({ routes: [] }) }), /complet/);
  await assert.rejects(computeGoogleDay(day, 'walking', { computeRoutes: async () => ({ routes: [{ distanceMeters: 20, durationMillis: null }] }) }), /complet/);
  await assert.rejects(computeGoogleDay({ stops: [{ name: 'Absent' }, day.stops[0]] }, 'walking', {}), /coordonnées/);
  const result = await computeGoogleDay({ stops: [day.stops[0]] }, 'walking', {});
  assert.equal(result.noTravel, true);
  assert.ok(formatGoogleRoute(result).includes('aucun déplacement'));
});
