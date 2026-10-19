import { dateForDay } from './travel-tools.js';
const plain=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'');
const months={jan:1,january:1,janvier:1,janv:1,feb:2,february:2,fevrier:2,fev:2,mar:3,march:3,mars:3,apr:4,april:4,avril:4,avr:4,may:5,mai:5,jun:6,june:6,juin:6,jul:7,july:7,juillet:7,juil:7,aug:8,august:8,aout:8,sep:9,sept:9,september:9,septembre:9,oct:10,october:10,octobre:10,nov:11,november:11,novembre:11,dec:12,december:12,decembre:12};
export function datesInText(value) {
  const text=plain(value).toLowerCase(),found=[];
  const add=(year,month,day)=>{const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(dateForDay(date,1))found.push(date);};
  for(const m of text.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g))add(m[1],m[2],m[3]);
  // Europe : jour/mois/année ; aucune supposition pour un format US ambigu.
  for(const m of text.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/g))add(m[3],m[2],m[1]);
  for(const m of text.matchAll(/\b(\d{1,2})[\s-]*([a-z]{3,10})\.?[\s,-]*(20\d{2})\b/g))if(months[m[2]])add(m[3],months[m[2]],m[1]);
  return [...new Set(found)];
}
const times=value=>[...String(value).matchAll(/\b([01]?\d|2[0-3])\s*[:hH]\s*([0-5]\d)\b/g)].map(m=>`${m[1].padStart(2,'0')}:${m[2]}`);
export function parseTicket(text,{places=[],startDate='',days=30}={}) {
  const raw=String(text||'').slice(0,100000),lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean),normalized=plain(raw).toLowerCase();
  const flightMatch=plain(raw).toUpperCase().match(/\b(?:FLIGHT(?:\s*(?:NO|NUMBER|N[°O]))?|VOL(?:\s*N[°O])?)\s*[:#.-]?\s*([A-Z0-9]{2,3}\s*\d{1,4}[A-Z]?)\b/);
  const kind=flightMatch||/boarding pass|carte d.embarquement|e-ticket.*flight|aeroport|airport/.test(normalized)?'flight':/check.in|check.out|hotel|hebergement|room reservation/.test(normalized)?'hotel':/musee|museum|zoo|aquarium|admission|entree|visit/.test(normalized)?'museum':null;
  const ignore=line=>/date (?:of birth|de naissance|d.emission)|issued|issue date|emission|expiration|expiry|valid until|valable jusqu/.test(plain(line).toLowerCase());
  const useful=lines.filter(line=>!ignore(line));
  const startLabels=kind==='flight'?/departure|depart(?!ement)|outbound/:kind==='hotel'?/check.in|arrivee|arrival/:/visit|visite|admission|entry|entree|date|creneau|slot/;
  const endLabels=kind==='hotel'?/check.out|depart/:/return|retour/;
  const relevant=useful.filter(line=>startLabels.test(plain(line).toLowerCase()));
  const labeledDates=[...new Set(relevant.flatMap(datesInText))],allDates=[...new Set(useful.flatMap(datesInText))];
  const bookingDate=labeledDates.length===1?labeledDates[0]:allDates.length===1?allDates[0]:'';
  const ends=[...new Set(useful.filter(line=>endLabels.test(plain(line).toLowerCase())).flatMap(datesInText))];
  const checkoutDate=ends.length===1&&ends[0]>=bookingDate?ends[0]:'';
  const startTimes=[...new Set(relevant.flatMap(times))],allTimes=[...new Set(useful.flatMap(times))];
  const time=startTimes.length===1?startTimes[0]:allTimes.length===1?allTimes[0]:'';
  const finishTimes=[...new Set(useful.filter(line=>/arrival|arrivee|closing|fermeture|check.out/.test(plain(line).toLowerCase())).flatMap(times))];
  const endTime=finishTimes.length===1?finishTimes[0]:'';
  const referenceMatch=plain(raw).match(/(?:booking\s*(?:reference|ref|number)|reservation\s*(?:number|reference)|(?:reference|numero|n[°o])\s*(?:(?:de|du|de la)\s*)?(?:reservation|billet|commande)|pnr|confirmation\s*(?:number|code|n[°o])|ticket\s*(?:number|no|n[°o])|record locator)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9-]{3,24})\b/i);
  const matched=places.filter(p=>[p.localName,p.name].some(name=>name&&plain(raw).toLowerCase().includes(plain(name).toLowerCase())&&name.length>=4));
  const place=matched.length===1?matched[0]:null;
  const flightNumber=flightMatch?.[1].replace(/\s/g,'')||'';
  const title=flightNumber?`Vol ${flightNumber}`:place?.name||'';
  let day;
  if(bookingDate&&dateForDay(startDate,1)) {const index=Math.round((Date.parse(bookingDate+'T12:00:00Z')-Date.parse(startDate+'T12:00:00Z'))/86400000)+1;if(index>=1&&index<=days)day=index;}
  const details=useful.filter(line=>/passenger|passager|travell?er|voyageur|\bfrom\b|\bto\b|destination|origin|origine|depart|arriv|gate|porte|terminal|seat|siege|baggage|bagage|boarding|embarquement|airline|compagnie|classe|\bclass\b|duration|duree|adresse|address|chambre|\broom\b|visitors|participants|prix|price|tarif|total|montant|amount/i.test(plain(line))).slice(0,25);
  const warnings=[];
  if(!bookingDate)warnings.push('Date absente ou ambiguë : à compléter.');
  if(!time)warnings.push('Horaire absent ou ambigu : à compléter.');
  if(allDates.length>1)warnings.push('Plusieurs dates figurent sur le document : vérifiez le départ, le retour et la date de visite.');
  if(kind==='flight')warnings.push('Les horaires sont ceux du billet, généralement en heure locale. Aucun suivi en temps réel du vol.');
  if(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/.test(raw))warnings.push('Les dates numériques sont lues au format jour/mois/année : vérifiez le format de votre billet.');
  return {title,kind,bookingDate,checkoutDate,time,endTime,reference:referenceMatch?.[1]||'',placeId:place?.id||'',day,details,warnings};
}
