import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.gz': 'application/gzip', '.pfb': 'application/octet-stream', '.ttf':'font/ttf', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const allowed = new Set(['assets/favicon.svg', 'assets/favicon-32.png', 'assets/apple-touch-icon.png', 'src/country-flags.js', 'index.html', 'style.css', 'design.css', 'src/app.js', 'src/organizer.js', 'src/booking-forms.js', 'src/ticket-places.js', 'src/ticket-parser.js', 'src/ticket-reader.js', 'src/packing-clothes.js', 'src/destination-currency.js', 'src/official-sites.js', 'src/travel-tools.js', 'src/travel-files.js', 'src/core.js', 'src/trips.js', 'src/free-maps.js', 'src/trip-map.js', 'src/place-info.js', 'src/descriptions.js', 'src/destination-theme.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png', 'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png']);
const server = http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
    if (!['GET', 'HEAD'].includes(req.method) || (!allowed.has(name) && !/^vendor\/flags\/[A-Z]{2}\.svg$/.test(name) && !/^vendor\/tickets\/(?:pdf(?:\.worker)?\.mjs|tesseract\.mjs|worker\.min\.js|tesseract-core-lstm\.wasm\.js|lang\/(?:fra|eng)\.traineddata\.gz|standard_fonts\/[a-zA-Z0-9_-]+\.(?:pfb|ttf))$/.test(name))) {
      res.writeHead(404); res.end('Introuvable'); return;
    }
    const data = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': types[path.extname(name)], 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https:; img-src 'self' https://tile.openstreetmap.org data: https://*.googleapis.com https://*.gstatic.com https://*.google.com; font-src 'self' https://fonts.gstatic.com; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Introuvable'); }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Voyage démarre sur le port ${server.address().port}`));
