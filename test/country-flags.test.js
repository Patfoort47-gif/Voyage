import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { flagCode, flagMarkup } from '../src/country-flags.js';

test('drapeaux : pays français, noms locaux et codes ISO, sans dépendre de l’ambiance du dossier', async () => {
  for (const [name, code] of [['France','FR'],['Suède','SE'],['Sverige','SE'],['Japon','JP'],['Pérou','PE'],['États-Unis','US'],['Portugal','PT'],[' uk ','GB'],['ca','CA']]) {
    assert.equal(flagCode(name), code);
    assert.ok(flagMarkup(name).includes(`/vendor/flags/${code}.svg`));
    await access(new URL(`../vendor/flags/${code}.svg`, import.meta.url));
  }
});
test('pays inconnu : aucun faux drapeau ni texte injecté dans le HTML', () => {
  for (const value of ['', null, 'Destination imaginaire', '<img src=x onerror=alert(1)>']) {
    assert.equal(flagCode(value),null);
    assert.equal(flagMarkup(value),'');
  }
});
