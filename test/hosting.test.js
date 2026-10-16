import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

test('les ressources et l’accueil restent dans le projet sur GitHub Pages', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1]);
  assert.ok(assets.length >= 2, 'La page doit charger le script et la feuille de style');
  const home = html.match(/class="brand" href="([^"]+)"/)[1];
  for (const prefix of ['/', '/Voyage/']) {
    const base = `https://example.github.io${prefix}`;
    assert.equal(new URL(home, base).pathname, prefix);
    for (const asset of assets) {
      const pathname = new URL(asset, base).pathname;
      assert.ok(pathname.startsWith(prefix), `${asset} sort du répertoire ${prefix}`);
      await access(new URL(`../${pathname.slice(prefix.length)}`, import.meta.url));
    }
  }
});
