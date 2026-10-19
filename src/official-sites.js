import { coordinates, distance } from './core.js';
import { safeLink } from './travel-tools.js';
import { wikipediaLink, suggestedLanguage } from './place-info.js';
const normalized = value => String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^\p{L}\p{N}]/gu,'');
function matching(place,names) {
  const key = value => normalized(value).replace(/^(musee(du|de|des)?|museum(of)?)/,'');
  const wanted=[place.name,place.localName].filter(Boolean).map(key).filter(Boolean);
  return names.some(n=>wanted.includes(key(n)));
}
async function json(url,request) {
  const response=await request(url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Recherche des sites indisponible. Réessayez plus tard.');
  const data=await response.json();if(data.error)throw new Error('La recherche n’a pas abouti.');return data;
}
export async function findOfficialSite(place,request=fetch) {
  if(!coordinates(place.lat,place.lng))return null;
  let ids=[];
  const source=wikipediaLink(place.descriptionSource);
  if(source) {
    const article=new URL(source),title=decodeURIComponent(article.pathname.split('/wiki/')[1]||'').replaceAll('_',' ');
    if(title) {
      const query=new URLSearchParams({action:'query',format:'json',origin:'*',prop:'pageprops',ppprop:'wikibase_item',redirects:'1',titles:title});
      const data=await json(article.origin+'/w/api.php?'+query,request);
      ids=Object.values(data.query?.pages||{}).map(p=>p.pageprops?.wikibase_item).filter(id=>/^Q\d+$/.test(id));
    }
  }
  if(!ids.length) {
    for(const language of [...new Set(['fr',suggestedLanguage(place),'en'])]) {
      const query=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'geosearch',ggscoord:`${place.lat}|${place.lng}`,ggsradius:'1000',ggslimit:'20',prop:'pageprops',ppprop:'wikibase_item'});
      const data=await json(`https://${language}.wikipedia.org/w/api.php?`+query,request);
      ids=Object.values(data.query?.pages||{}).filter(p=>matching(place,[p.title])).map(p=>p.pageprops?.wikibase_item).filter(id=>/^Q\d+$/.test(id));
      if(ids.length)break;
    }
  }
  if(!ids.length)return null;
  const query=new URLSearchParams({action:'wbgetentities',ids:[...new Set(ids)].join('|'),props:'claims|labels|aliases',format:'json',origin:'*'});
  const data=await json('https://www.wikidata.org/w/api.php?'+query,request);
  const matches=[];
  for(const entity of Object.values(data.entities||{})) {
    const names=[...Object.values(entity.labels||{}).map(l=>l.value),...Object.values(entity.aliases||{}).flat().map(a=>a.value)];
    const point=entity.claims?.P625?.filter(c=>c.rank!=='deprecated').map(c=>c.mainsnak?.datavalue?.value).find(p=>coordinates(p?.latitude,p?.longitude));
    if(!matching(place,names)||!point||distance(place,{lat:point.latitude,lng:point.longitude})>1)continue;
    for(const claim of entity.claims?.P856||[]) {
      const url=safeLink(claim.mainsnak?.datavalue?.value);
      if(url&&claim.rank!=='deprecated')matches.push({url,source:`https://www.wikidata.org/wiki/${entity.id}`,name:place.name,checkedAt:new Date().toISOString()});
    }
  }
  const urls=[...new Set(matches.map(m=>m.url))];
  // Plusieurs sites déclarés : conserver le choix à l’utilisateur plutôt que deviner la billetterie.
  return urls.length===1 ? matches[0] : null;
}
