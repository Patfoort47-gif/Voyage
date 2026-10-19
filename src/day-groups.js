import { coordinates, distance, planTrip } from './core.js';
export function proposeDayGroups(places,days,startId='') {
  if(!Number.isInteger(days)||days<1||days>30)throw new Error('Choisissez entre 1 et 30 jours.');
  if(!places.length||places.some(p=>!coordinates(p.lat,p.lng)))throw new Error('Validez les coordonnées de tous les lieux avant de proposer des zones.');
  if(places.length>500)throw new Error('Proposez des zones sur un maximum de 500 lieux par voyage.');
  const count=Math.min(days,places.length),first=places.find(p=>p.id===startId)||places[0],centers=[first];
  while(centers.length<count){const next=places.filter(p=>!centers.includes(p)).sort((a,b)=>Math.min(...centers.map(c=>distance(b,c)))-Math.min(...centers.map(c=>distance(a,c))))[0];centers.push(next);}
  let groups=[];
  for(let pass=0;pass<6;pass++) {
    groups=Array.from({length:count},()=>[]);const assigned=new Set(),capacity=Math.ceil(places.length/count);
    const pairs=places.flatMap((place,index)=>centers.map((center,group)=>({index,group,d:distance(place,center)}))).sort((a,b)=>a.d-b.d||a.index-b.index||a.group-b.group);
    for(const pair of pairs)if(!assigned.has(pair.index)&&groups[pair.group].length<capacity){groups[pair.group].push(places[pair.index]);assigned.add(pair.index);}
    // Garantir un groupe non vide par jour de visite, même pour des points identiques.
    for(let i=0;i<count;i++)if(!groups[i].length){const donor=groups.reduce((a,g,index)=>g.length>groups[a].length?index:a,0);groups[i].push(groups[donor].pop());}
    groups.forEach((group,i)=>{centers[i]={lat:group.reduce((s,p)=>s+p.lat,0)/group.length,lng:group.reduce((s,p)=>s+p.lng,0)/group.length};});
  }
  let index=groups.findIndex(group=>group.some(p=>p.id===first.id)),ordered=[],remaining=new Set(groups.map((_,i)=>i));
  while(remaining.size){remaining.delete(index);ordered.push(groups[index]);const center=centers[index];index=[...remaining].sort((a,b)=>distance(center,centers[a])-distance(center,centers[b]))[0];}
  let previous=null;
  return ordered.map((group,i)=>{
    const start=i===0?first:group.reduce((a,p)=>distance(previous,p)<distance(previous,a)?p:a,group[0]);
    const sorted=planTrip(group,1,start.id).days[0].stops;previous=sorted.at(-1);
    return sorted.map(p=>p.id);
  });
}
export function groupLabel(group,allPlaces) {
  const museum=group.filter(p=>/mus[eé]e|museum|museet/i.test(`${p.name} ${p.category||''}`)).length;
  const city=[...new Set(group.map(p=>p.city).filter(Boolean))];
  if(city.length===1)return `${museum>=group.length/2?'Visites culturelles':'Autour de'} · ${city[0]}`;
  const center={lat:allPlaces.reduce((s,p)=>s+p.lat,0)/allPlaces.length,lng:allPlaces.reduce((s,p)=>s+p.lng,0)/allPlaces.length},here={lat:group.reduce((s,p)=>s+p.lat,0)/group.length,lng:group.reduce((s,p)=>s+p.lng,0)/group.length};
  if(distance(center,here)<0.5)return 'Au centre des lieux sélectionnés';
  const dy=here.lat-center.lat,dx=(here.lng-center.lng)*Math.cos(center.lat*Math.PI/180);return `Secteur ${Math.abs(dy)>Math.abs(dx)?dy>=0?'nord':'sud':dx>=0?'est':'ouest'} des lieux sélectionnés`;
}
