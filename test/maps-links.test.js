import test from 'node:test';
import assert from 'node:assert/strict';
import { fromURL, mapsReference } from '../src/core.js';

test('lien Maps : coordonnées du lieu, identifiant CID sans perte de précision, caméra ignorée', () => {
  assert.deepEqual(fromURL('https://www.google.com/maps/place/Test/data=!3d43.727!4d7.415'), { lat: 43.727, lng: 7.415 });
  assert.equal(fromURL('https://www.google.com/maps/@43.7,7.4,15z'), null);
  assert.equal(fromURL('https://evil.test/?q=43.7,7.4'), null);
  const ref = mapsReference('https://www.google.com/maps/place/Un+lieu/data=!4m2!3m1!1s0x1234:0xffffffffffffffff');
  assert.equal(ref.name, 'Un lieu'); assert.equal(ref.cid, '18446744073709551615');
  assert.equal(mapsReference('https://www.google.com/maps/search/?api=1&query=Test&query_place_id=ChIJtest').placeId, 'ChIJtest');
});

