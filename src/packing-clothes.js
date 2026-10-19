export function clothingItems(packing,days=5) {
  const duration=Math.min(30,Math.max(1,Number.isInteger(days)?days:5)),cycle=packing.laundryEvery?Math.min(duration,packing.laundryEvery):duration;
  const today=new Date().toISOString().slice(0,10),weather=packing.weather;
  const rows=weather?.end>=today?(weather.days||[]).filter(d=>!d.date||d.date>=today):[];
  const cold=rows.some(d=>d.min!==null&&d.min<10),hot=rows.some(d=>d.max!==null&&d.max>=28),warm=!rows.length||rows.some(d=>d.max!==null&&d.max>=20);
  const why=`Pour ${duration} jour(s)${packing.laundryEvery?`, lessive tous les ${packing.laundryEvery} jours`:`, sans lessive prévue`}. Quantités indicatives, par personne.`;
  const item=(id,label,quantity=1,group='Vêtements',reason=why)=>({id,label,quantity,group,why:reason});
  const result=[
    item('clothes-underwear','Sous-vêtements',cycle+1),item('clothes-socks','Paires de chaussettes',cycle+1),
    item('clothes-tshirts','T-shirts / hauts légers',Math.max(2,Math.ceil(cycle/(hot||packing.running?1:2)))),
    item('clothes-trousers','Pantalons confortables',Math.max(1,Math.ceil(cycle/4))),
    item('clothes-sleep','Pyjama / tenue de nuit'),item('clothes-sweater','Pull / sweat',cold?2:1),
    item('clothes-shoes','Chaussures confortables'),item('clothes-laundry-bag','Sac pour linge sale'),
  ];
  if(warm)result.push(item('clothes-shorts','Shorts / bas légers',Math.max(1,Math.ceil(cycle/4))));
  if(cold)result.push(item('clothes-warm','Hauts à manches longues / sous-couche',Math.max(1,Math.ceil(cycle/3))));
  if(packing.running||packing.hiking)result.push(item('clothes-sport','Tenues de sport et sous-vêtements adaptés',Math.max(1,Math.ceil(cycle/3))));
  result.push(item('clothes-swim','Maillot de bain / serviette compacte, si baignade prévue',1,'Vêtements','Option selon votre programme'));
  const extras=[['wash-teeth','Brosse à dents et dentifrice'],['wash-care','Savon, shampoing et déodorant'],['wash-sun','Crème solaire et baume à lèvres'],['wash-personal','Produits personnels / protections périodiques, si besoin'],['extras-glasses','Lunettes de vue / lentilles et solution, si besoin'],['extras-plugs','Adaptateur de prise et câbles de recharge'],['extras-earplugs','Bouchons d’oreilles / masque de nuit'],['extras-tissues','Mouchoirs et gel pour les mains'],['extras-bag','Petit sac de journée / sac réutilisable']];
  result.push(...extras.map(([id,label])=>item(id,label,1,'Toilette & petits oublis','À adapter à vos besoins et au format bagage cabine')));
  return result;
}
