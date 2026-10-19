import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDescription } from '../src/descriptions.js';
import { automaticArticle, findPlaceArticles } from '../src/place-info.js';
import { createTrip, routeSignature } from '../src/trips.js';
import { demo } from '../src/core.js';

test('un descriptif ne change pas la clé du parcours, une localisation ou la durée oui', () => {
  const t = createTrip({ name: 'Voyage', country: 'Portugal', days: 5, mode: 'driving', fileOrder: false, places: demo });
  const modified = structuredClone(t); modified.name = 'Autre nom'; modified.places[0].description = 'Un nouveau texte'; modified.places[0].city = 'Lisbonne';
  assert.equal(routeSignature(t), routeSignature(modified));
  modified.places[0].lat += 0.01; assert.notEqual(routeSignature(t), routeSignature(modified));
  const duration = { ...t, days: 4 }; assert.notEqual(routeSignature(t), routeSignature(duration));
});

test('ville et nom local récupérés puis résultat concordant présélectionné', async () => {
  const result = await prepareDescription({ name: 'Église Saint-Nicolas', country: 'Suède', lat: 59.325, lng: 18.071 }, async () => ({ city: 'Stockholm', localName: 'Storkyrkan', countryCode: 'se', distanceKm: 0.02 }), async context => {
    assert.equal(context.localName, 'Storkyrkan'); assert.equal(context.city, 'Stockholm');
    return [{ title: 'Storkyrkan', description: 'Description', km: 0.02, verifiedLocation: true }];
  });
  assert.equal(result.automatic.title, 'Storkyrkan');
});

test('ni homonyme lointain, ni voisin de nom différent, ni fiche non géolocalisée ne sont choisis automatiquement', () => {
  const p = { name: 'Église Saint-Nicolas', localName: 'Storkyrkan', city: 'Stockholm' };
  for (const a of [{ title: 'Storkyrkan', km: 4, verifiedLocation: true }, { title: 'Autre église', km: 0.02, verifiedLocation: true }, { title: 'Storkyrkan', km: null, verifiedLocation: false }]) assert.equal(automaticArticle(p, [a]), null);
});

test('une ville dans un autre pays ne déclenche aucune attribution automatique', async () => {
  let calls = 0;
  const result = await prepareDescription({ name: 'Église', country: 'Suède', lat: 48, lng: 2 }, async () => ({ city: 'Paris', countryCode: 'fr', localName: 'Église', distanceKm: 0.01 }), async () => { calls++; return []; });
  assert.equal(calls, 0); assert.equal(result.automatic, null); assert.ok(result.warning.includes('pays'));
});

test('une bonne fiche française évite toute recherche dans une autre langue', async () => {
  const calls = [];
  const result = await findPlaceArticles({ name: 'Église Saint-Nicolas', localName: 'Storkyrkan', city: 'Stockholm', country: 'Suède', lat: 59.325, lng: 18.071 }, 'auto', async url => {
    calls.push(url);
    return { ok: true, json: async () => ({ query: { pages: { 1: { title: 'Église Saint-Nicolas de Stockholm', extract: 'Résumé français', fullurl: 'https://fr.wikipedia.org/wiki/Test', coordinates: [{ lat: 59.325, lon: 18.071 }] } } } }) };
  });
  assert.equal(calls.length, 1); assert.equal(result[0].language, 'fr');
});
