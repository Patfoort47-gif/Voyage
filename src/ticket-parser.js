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
  for(const m of text.matchAll(/\b([a-z]{3,10})\.?\s+(\d{1,2})(?:,)?\s+(20\d{2})\b/g))if(months[m[1]])add(m[3],months[m[1]],m[2]);
  return [...new Set(found)];
}
const times=value=>[...String(value).matchAll(/\b([01]?\d|2[0-3])\s*[:hH]\s*([0-5]\d)\b/g)].map(m=>`${m[1].padStart(2,'0')}:${m[2]}`);
export function parseTicket(text,{places=[],startDate='',days=30,kindHint=null}={}) {
  const raw=String(text||'').slice(0,100000),lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean),normalized=plain(raw).toLowerCase();
  const flightMatch=plain(raw).toUpperCase().match(/\b(?:FLIGHT(?:\s*(?:NO|NUMBER|N[°O]))?|VOL(?:\s*N[°O])?)\s*[:#.-]?\s*([A-Z0-9]{2,3}\s*\d{1,4}[A-Z]?)\b/);
  const kind=kindHint|| (flightMatch||/boarding pass|carte d.embarquement|e-ticket.*flight|aeroport|airport/.test(normalized)?'flight':/check.in|check.out|hotel|hebergement|room reservation/.test(normalized)?'hotel':/musee|museum|zoo|aquarium|admission|entree|visit/.test(normalized)?'museum':null);
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
  const structured=structuredTicket(raw,{kind,startDate,days});
  const result={title,kind,bookingDate,checkoutDate,time,endTime,reference:referenceMatch?.[1]||'',placeId:place?.id||'',day,details,warnings,...structured.fields,evidence:structured.evidence};
  for(const key of structured.ambiguous)result[key]='';
  if(structured.ambiguous.length)warnings.push('Plusieurs vols ou références ont été détectés : séparez les billets ou choisissez les informations du trajet voulu.');
  if(structured.startDates.length>1&&!structured.tableResolved){result.bookingDate='';delete result.day;}
  if(structured.startTimes.length>1&&!structured.fields.time)result.time='';
  if(result.bookingDate&&startDate){const index=Math.round((Date.parse(result.bookingDate+'T12:00:00Z')-Date.parse(startDate+'T12:00:00Z'))/86400000)+1;if(index>=1&&index<=days)result.day=index;}
  result.warnings=warnings.filter(w=>!(result.bookingDate&&w.startsWith('Date absente'))&&!(result.time&&w.startsWith('Horaire absent')));
  return result;
}

function cleanLines(raw) {
  return raw.replace(/\s+(?=(?:Arrival|Arrivée|Departure|Départ|Check[ -]in|Check[ -]out)\s*:)/gi,'\n').split(/\n+/).map(s=>s.trim()).filter(Boolean);
}
const fieldBoundary=/^(?:(?:date|heure|time)\s*(?:de|du|of)?\s*)?(?:departure|depart\b|arrival|arrivee|check[ -]?in|check[ -]?out|flight|vol\b|booking|reference|pnr\b|passenger|passager|boarding|embarquement|seat\b|siege|gate\b|porte\b|terminal|baggage|bagage|ticket|visit\b|visite|entry\b|entree|from\b|to\b|airline|compagnie|address|adresse|guest|client|room|chambre|visitors|nombre de visiteurs|nombre de voyageurs|type de billet|ticket type|tarif)/i;
function contexts(lines,label) {
  return lines.flatMap((line,index)=>{
    if(!label.test(plain(line)))return [];
    const block=[line];
    for(let j=index+1;j<Math.min(lines.length,index+8);j++){if(fieldBoundary.test(plain(lines[j])))break;block.push(lines[j]);}
    return [block.join('\n')];
  });
}
const single = values => {const unique=[...new Set(values.filter(Boolean))];return unique.length===1?unique[0]:'';};
function textField(lines,label) {
  return contexts(lines,label).map(block=>{
    const match=plain(block).match(label);
    const value=(match?block.slice(match.index+match[0].length):block).replace(/^\s*[:#.-]?\s*/,'').trim();
    return value.length<=300?value:'';
  });
}
export function structuredTicket(raw,{kind,startDate='',days=30}={}) {
  let tableResolved=false;const ambiguous=[];
  const lines=cleanLines(raw).filter(line=>!/issued|issue date|emission|naissance|date of birth|expiration|expiry|valid until/i.test(plain(line))),evidence={},fields={};
  const departure=/\b(?:departure|depart(?!ement)|outbound)\b/i,arrival=/\b(?:arrival|arrivee)\b/i,checkin=/\bcheck[ -]?in\b|\bdate d.arrivee\b/i,checkout=/\bcheck[ -]?out\b|\bdate de depart\b/i,visit=/\b(?:date de visite|visit date|date of visit|visite|admission|entry time|entree|creneau|timeslot|slot)\b/i;
  const start=kind==='flight'?departure:kind==='hotel'?checkin:visit,end=kind==='flight'?arrival:kind==='hotel'?checkout:/closing|fermeture|fin de visite/i;
  const put=(key,value,source)=>{if(value){fields[key]=value;evidence[key]=source?.slice(0,250)||'';}};
  const starts=contexts(lines,start),ends=contexts(lines,end);
  const dated=(blocks,key)=>{
    const values=blocks.flatMap(datesInText),chosen=single(values);put(key,chosen,blocks.find(b=>datesInText(b).includes(chosen)));
    return values;
  };
  const startDates=dated(starts,'bookingDate');
  if(kind==='flight')dated(ends,'arrivalDate');else if(kind==='hotel')dated(ends,'checkoutDate');
  const timeValue=(block)=>{
    const result=times(block);if(result.length)return result;
    // Quatre chiffres seulement sur une ligne horaire isolée, jamais depuis l’année d’une date.
    return block.split('\n').filter(line=>!datesInText(line).length).flatMap(line=>[...line.matchAll(/(?:^|\b(?:time|heure)\s*:?\s*)([01]\d|2[0-3])([0-5]\d)\s*$/gi)].map(m=>m[1]+':'+m[2]));
  };
  const startTimes=starts.flatMap(timeValue),endTimes=ends.flatMap(timeValue);
  put('time',single(startTimes),starts.find(b=>timeValue(b).includes(single(startTimes))));put('endTime',single(endTimes),ends.find(b=>timeValue(b).includes(single(endTimes))));
  // Tableaux à deux colonnes : départ/arrivée puis valeurs dans le même ordre.
  if(kind==='flight')for(let i=0;i<lines.length;i++)if(departure.test(plain(lines[i]))&&arrival.test(plain(lines[i]))) {
    const block=lines.slice(i+1,i+4),dateRow=block.find(line=>datesInText(line).length),timeRow=block.find(line=>times(line).length===2);
    const dates=dateRow?datesInText(dateRow):[];
    if(dates.length===2){tableResolved=true;put('bookingDate',dates[0],dateRow);put('arrivalDate',dates[1],dateRow);}
    if(timeRow){const values=times(timeRow);put('time',values[0],timeRow);put('endTime',values[1],timeRow);}
  }
  const patterns=kind==='flight'?{
    airline:/^(?:airline|compagnie(?: aerienne)?)\s*:?/i,origin:/^(?:from|origin|origine|aeroport de depart|departure airport)\s*:?/i,destination:/^(?:to|destination|aeroport d.arrivee|arrival airport)\s*:?/i,
    passenger:/^(?:passenger(?: name)?|passager(?:s)?|nom du passager|travell?er(?: name)?)\s*:?/i,terminal:/^(?:departure terminal|terminal de depart|terminal)\s*:?/i,arrivalTerminal:/^(?:arrival terminal|terminal d.arrivee)\s*:?/i,
    gate:/^(?:boarding gate|gate|porte(?: d.embarquement)?)\s*:?/i,seat:/^(?:seat(?: number)?|siege(?:s)?)\s*:?/i,baggage:/^(?:baggage(?: allowance)?|bagage(?:s)?|luggage)\s*:?/i
  }:kind==='hotel'?{
    address:/^(?:address|adresse)\s*:?/i,guestName:/^(?:guest name|name of guest|nom du client|reservation au nom de)\s*:?/i,roomType:/^(?:room type|type de chambre|chambre)\s*:?/i,contact:/^(?:contact|telephone|phone|tel\.)\s*:?/i
  }:{ticketType:/^(?:ticket type|type de billet|tarif)\s*:?/i,meetingPoint:/^(?:meeting point|point de rendez.vous|adresse|address)\s*:?/i};
  for(const [key,label] of Object.entries(patterns)){const blocks=contexts(lines,label),values=textField(lines,label);put(key,single(values),blocks[0]);}
  if(kind==='flight') {
    const flights=contexts(lines,/^(?:flight(?:\s*(?:no\.?|number|n[°o]))?|vol(?:\s*n[°o])?)\s*:?/i).flatMap(block=>[...plain(block).toUpperCase().matchAll(/\b([A-Z0-9]{2,3})\s*(\d{1,4}[A-Z]?)\b/g)].filter(m=>/[A-Z]/.test(m[1])).map(m=>m[1]+m[2]));
    if(new Set(flights).size>1)ambiguous.push('flightNumber','title');
    put('flightNumber',single(flights),contexts(lines,/^(?:flight|vol)\b/i)[0]);
    if(fields.flightNumber)put('title',`Vol ${fields.flightNumber}`,evidence.flightNumber);
  }
  const referenceLabel=/^(?:booking (?:reference|ref\.?|number)|reference(?: de reservation)?|numero (?:de reservation|du billet)|pnr|confirmation(?: number| code)?|record locator)\s*:?/i;
  const refs=textField(lines,referenceLabel).map(value=>value.trim().match(/^([A-Z0-9][A-Z0-9-]{3,24})$/i)?.[1]).filter(value=>value&&!/^(?:number|reference|booking|confirmation|passenger)$/i.test(value));
  if(new Set(refs).size>1)ambiguous.push('reference');
  put('reference',single(refs),contexts(lines,referenceLabel)[0]);
  const countKey=kind==='hotel'?'guests':'visitors',countLabel=kind==='hotel'?/^(?:guests|adults|nombre de voyageurs|voyageurs|occupants)\s*:?/i:/^(?:visitors|participants|nombre de visiteurs|visiteurs|personnes)\s*:?/i;
  const counts=textField(lines,countLabel).map(value=>/^\d{1,3}$/.test(value.trim())?Number(value):null).filter(n=>n>0);put(countKey,single(counts),contexts(lines,countLabel)[0]);
  if(kind==='hotel') {
    const titles=textField(lines,/^(?:hotel(?: name)?|nom de l.hotel|property(?: name)?|etablissement)\s*:?/i);put('title',single(titles),contexts(lines,/^(?:hotel|property|etablissement)\b/i)[0]);
  }
  // Une année absente n’est complétée que si le mois/jour se situe dans la fenêtre du voyage.
  if(!fields.bookingDate&&startDate) {
    const candidates=[];
    for(const block of starts)for(const m of plain(block).toLowerCase().matchAll(/\b(\d{1,2})\s*([a-z]{3,10})\b(?![ \t,-]*\d{2,4}\b)/g))if(months[m[2]]) {
      for(const year of [+startDate.slice(0,4)-1,+startDate.slice(0,4),+startDate.slice(0,4)+1]){const date=`${year}-${String(months[m[2]]).padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(dateForDay(date,1)&&date>=startDate&&date<=dateForDay(startDate,days))candidates.push(date);}
    }
    put('bookingDate',single(candidates),starts[0]);if(fields.bookingDate)evidence.bookingDate+=' · année proposée d’après les dates du voyage';
  }
  return {fields,evidence,startDates,startTimes,tableResolved,ambiguous};
}
