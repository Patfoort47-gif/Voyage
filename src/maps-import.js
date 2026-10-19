import { savedMapsURL, fromURL, mapsReference } from './core.js';
const normalize=value=>String(value||'').trim().toLocaleLowerCase('fr');
export function mapsURLType(value) {
  if(!savedMapsURL(value))return 'invalid';
  const url=new URL(value);
  if(url.username||url.password)return 'invalid';
  if(/\/maps\/(?:placelists|lists|d\/)\b|\/saved\b/.test(url.pathname)||url.searchParams.get('list'))return 'list';
  if(['maps.app.goo.gl','goo.gl'].includes(url.hostname))return 'short';
  if(/\/maps\/(?:dir|directions)\b/.test(url.pathname))return 'route';
  return 'place';
}
export function parseMapsPaste(text,{country='',city='',category='À visiter'}={}) {
  if(String(text).length>100000)throw new Error('Limitez le texte à 100 000 caractères.');
  const rows=[],warnings=[],seen=new Set();
  for(const line of String(text).split(/\n+/)) {
    const matches=[...line.matchAll(/https?:\/\/[^\s<>"\]]+/g)];
    for(const [index,match] of matches.entries()) {
      const value=match[0].replace(/[).,;]+$/,'');let url;
      try{url=savedMapsURL(value);}catch{url=null;}
      const type=mapsURLType(url);
      if(type==='invalid'){warnings.push('Lien ignoré : seuls les liens HTTPS Google Maps reconnus sont acceptés.');continue;}
      if(type==='list'||type==='route'){warnings.push(type==='list'?'Liste Google Maps détectée : son contenu ne peut pas être lu directement ici. Collez les liens individuels des lieux, ou importez son export Takeout.':'Lien d’itinéraire ignoré : collez un lien par lieu.');continue;}
      const parsed=new URL(url),ref=mapsReference(url),point=fromURL(url);
      const query=parsed.searchParams.get('query')||parsed.searchParams.get('q')||'';
      const label=line.slice(index?matches[index-1].index+matches[index-1][0].length:0,match.index).replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').replace(/[|:;–-]+\s*$/,'').trim();
      const name=ref.name||(!point&&query&&!/^[-\d.,\s]+$/.test(query)?query:'')||label;
      if(!name&&!point){warnings.push('Lien court ou lieu sans nom : ajoutez le nom avant le lien (ex. « Musée Vasa https://… »), ou utilisez un lien Maps complet.');continue;}
      const identity=ref.placeId?'id:'+ref.placeId:ref.cid?'cid:'+ref.cid:point?`point:${point.lat},${point.lng}`:normalize(name)+'|'+normalize(country)+'|'+normalize(city);
      if(seen.has(identity))continue;seen.add(identity);
      rows.push({id:crypto.randomUUID(),name:name||`Lieu ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,country:country.trim(),city:city.trim(),category:category.trim()||'À visiter',url,note:'',tags:'',lat:point?.lat??null,lng:point?.lng??null,selected:true,coordinateSource:point?'Lien Maps':'À confirmer'});
    }
  }
  if(rows.length>200)throw new Error('Importez au maximum 200 lieux par lot.');
  return {places:rows,warnings:[...new Set(warnings)]};
}
export function duplicateMapsPlace(a,b) {
  const ar=mapsReference(a.url),br=mapsReference(b.url);
  if(a.url&&a.url===b.url)return true;
  if(ar.placeId&&br.placeId)return ar.placeId===br.placeId;
  if(ar.cid&&br.cid)return ar.cid===br.cid;
  return normalize(a.name)===normalize(b.name)&&normalize(a.country)===normalize(b.country)&&(!a.city||!b.city||normalize(a.city)===normalize(b.city));
}
export function mapsGeoJSON(places) {
  return {type:'FeatureCollection',features:places.map(place=>({type:'Feature',geometry:place.lat!==null&&place.lng!==null?{type:'Point',coordinates:[place.lng,place.lat]}:null,properties:{...place}}))};
}
