const normalize = value => String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export function ticketPlaceStatus(place, data={}) {
  const manual=data.ticketPlaces?.[place.id];
  if(manual==='ticket'||manual==='none')return manual;
  if(data.bookings?.some(b=>b.placeId===place.id&&b.kind==='museum'))return 'ticket';
  const label=normalize(`${place.name||''} ${place.localName||''} ${place.category||''}`);
  if(/museet\b/.test(label))return 'ticket';
  if(/\b(musee|museum|museo|museu|museet|museo|zoo|zoolog|aquarium|oceanarium|billetterie|ticketed|amusement|theme park|parc d.attractions|parc a theme|parc aquatique|water park|parc (?:a billets?|payant)|palais|palace|castle|chateau|slott|exposition|exhibition)\w*/.test(label))return 'ticket';
  if(/\b(quartier|neighbou?rhood|district|rue|street|avenue|boulevard|ruelle|promenade|esplanade|place publique|square|gamla stan)\b/.test(label))return 'none';
  return 'unknown';
}
export function ticketPlaces(trip,data) { return trip.places.filter(place=>ticketPlaceStatus(place,data)==='ticket'); }
