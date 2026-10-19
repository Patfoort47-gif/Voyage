import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationTheme, themeIllustration, themeStyle } from '../src/destination-theme.js';

test('un dossier garde la même ambiance après renommage de son titre', () => {
  assert.equal(destinationTheme({ country: 'Portugal', name: 'Vacances' }).accent, destinationTheme({ country: 'Portugal', name: 'Été' }).accent);
  assert.equal(destinationTheme({ country: 'Suède' }).code, 'SE');
  assert.equal(destinationTheme({ country: 'Jordanie' }).art, 'desert');
  assert.equal(destinationTheme({ country: 'Monaco' }).code, 'MC');
  assert.equal(destinationTheme({ country: 'Norvège' }).code, 'NO');
});

test('la ville précise le thème du pays sans qu’un titre étranger le remplace', () => {
  assert.match(destinationTheme({ country: 'Suède', places: [{ city: 'Stockholm' }] }).label, /Stockholm/);
  assert.equal(destinationTheme({ country: 'France', name: 'Stockholm' }).id, 'france');
  assert.match(destinationTheme({ country: 'Portugal', places: [{ city: 'Lisboa' }] }).label, /Lisbonne/);
  assert.match(destinationTheme({ country: 'Portugal', places: [{ city: 'Porto' }] }).label, /Porto/);
  assert.notEqual(destinationTheme({ country: 'Portugal', name: 'Porto' }).accent, destinationTheme({ country: 'Portugal', name: 'Sintra' }).accent);
  assert.ok(!destinationTheme({ country: 'Norvège', name: 'Stockholm' }).label.includes('Stockholm'));
});

test('destination inconnue : thème de repli, sans injection de texte dans les SVG ou styles', () => {
  const theme = destinationTheme({ country: '<script>alert(1)</script>', name: '" onload="alert(1)' });
  assert.equal(theme.id, 'explorer');
  assert.ok(!themeIllustration(theme).includes('alert'));
  assert.ok(!themeStyle(theme).includes('script'));
  assert.ok(themeIllustration(theme).includes('aria-hidden="true"'));
});
