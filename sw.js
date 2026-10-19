const PREFIX='voyage-shell:'+new URL('./',self.location.href).pathname+':';
const CACHE=PREFIX+'v2';
const SHELL=["./src/maps-import.js","./src/maps-import-ui.js","./src/confirmation-mail.js","./src/trip-templates.js","./src/day-groups.js","./src/day-groups-ui.js","./assets/icon-192.png","./assets/icon-512.png","./assets/icon-maskable.png","./", "./index.html", "./style.css", "./design.css", "./manifest.json", "./src/app.js", "./src/booking-forms.js", "./src/core.js", "./src/country-flags.js", "./src/descriptions.js", "./src/destination-currency.js", "./src/destination-theme.js", "./src/free-maps.js", "./src/official-sites.js", "./src/organizer.js", "./src/packing-clothes.js", "./src/place-info.js", "./src/ticket-parser.js", "./src/ticket-places.js", "./src/ticket-reader.js", "./src/travel-files.js", "./src/travel-tools.js", "./src/trip-map.js", "./src/trips.js", "./src/route-optimizer.js", "./src/offline-routes.js", "./src/trip-insights.js", "./src/backups.js", "./src/pwa.js", "./assets/apple-touch-icon.png", "./assets/favicon-32.png", "./assets/favicon.svg", "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css", "./vendor/leaflet/images/layers-2x.png", "./vendor/leaflet/images/layers.png", "./vendor/leaflet/images/marker-icon-2x.png", "./vendor/leaflet/images/marker-icon.png", "./vendor/leaflet/images/marker-shadow.png"];
const TICKETS=["./vendor/tickets/pdf.mjs", "./vendor/tickets/pdf.worker.mjs", "./vendor/tickets/tesseract-core-lstm.wasm.js", "./vendor/tickets/tesseract.mjs", "./vendor/tickets/worker.min.js", "./vendor/tickets/lang/eng.traineddata.gz", "./vendor/tickets/lang/fra.traineddata.gz", "./vendor/tickets/standard_fonts/FoxitDingbats.pfb", "./vendor/tickets/standard_fonts/FoxitFixed.pfb", "./vendor/tickets/standard_fonts/FoxitFixedBold.pfb", "./vendor/tickets/standard_fonts/FoxitFixedBoldItalic.pfb", "./vendor/tickets/standard_fonts/FoxitFixedItalic.pfb", "./vendor/tickets/standard_fonts/FoxitSerif.pfb", "./vendor/tickets/standard_fonts/FoxitSerifBold.pfb", "./vendor/tickets/standard_fonts/FoxitSerifBoldItalic.pfb", "./vendor/tickets/standard_fonts/FoxitSerifItalic.pfb", "./vendor/tickets/standard_fonts/FoxitSymbol.pfb", "./vendor/tickets/standard_fonts/LiberationSans-Bold.ttf", "./vendor/tickets/standard_fonts/LiberationSans-BoldItalic.ttf", "./vendor/tickets/standard_fonts/LiberationSans-Italic.ttf", "./vendor/tickets/standard_fonts/LiberationSans-Regular.ttf"];
const base=new URL('./',self.location.href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='CACHE_TICKETS')event.waitUntil((async()=>{try{await (await caches.open(CACHE)).addAll(TICKETS);event.ports[0]?.postMessage({ok:true});}catch{event.ports[0]?.postMessage({ok:false,error:'Connexion ou espace de stockage insuffisant. Réessayez en ligne.'});}})());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Aucun cache de services externes, ni préchargement de tuiles OpenStreetMap.
  if(request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
  if(!SHELL.some(path=>new URL(path,base).pathname===url.pathname)&&!url.pathname.startsWith(new URL('vendor/',base).pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(request,{signal:AbortSignal.timeout(3000)});
      if(response.ok){await cache.put(request,response.clone()).catch(()=>{});return response;}
      const cached=await cache.match(request);return cached||response;
    }catch {
      const cached=await cache.match(request);if(cached)return cached;
      if(request.mode==='navigate')return (await cache.match(new URL('./index.html',base).href))||Response.error();
      return Response.error();
    }
  })());
});
