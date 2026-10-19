// 2-opt sur un chemin ouvert : le premier lieu reste fixe, sans ajouter de retour.
export function improvePath(points,distance) {
  const result=[...points];
  if(result.length<4||result.length>200)return result;
  for(let pass=0;pass<4;pass++) {
    let changed=false;
    for(let i=1;i<result.length-1;i++)for(let j=i+1;j<result.length;j++) {
      const a=result[i-1],b=result[i],c=result[j],d=result[j+1];
      const before=distance(a,b)+(d?distance(c,d):0),after=distance(a,c)+(d?distance(b,d):0);
      if(after+1e-8<before){result.splice(i,j-i+1,...result.slice(i,j+1).reverse());changed=true;}
    }
    if(!changed)break;
  }
  return result;
}
