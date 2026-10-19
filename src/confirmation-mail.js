const decodeEntities=text=>text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|eacute|egrave|agrave|ecirc|ocirc|uuml);/gi,(_,value)=>{if(/^#x/i.test(value)){const n=parseInt(value.slice(2),16);return n<=0x10ffff?String.fromCodePoint(n):'';}if(value[0]==='#'){const n=+value.slice(1);return n<=0x10ffff?String.fromCodePoint(n):'';}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',eacute:'é',egrave:'è',agrave:'à',ecirc:'ê',ocirc:'ô',uuml:'ü'}[value.toLowerCase()]||'';});
export function emailHTMLText(html) {
  return decodeEntities(String(html).replace(/<(script|style|head|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\s*br\s*\/?>|<\/(?:p|div|tr|td|th|li|h[1-6])\s*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n')).trim();
}
function splitHeaders(raw) {const m=raw.match(/\r?\n\r?\n/);return m&&/^(?:Subject|From|To|Date|MIME-Version|Content-Type|Content-Transfer-Encoding|Return-Path|Received):/im.test(raw.slice(0,m.index))?{headers:raw.slice(0,m.index).replace(/\r?\n[ \t]+/g,' '),body:raw.slice(m.index+m[0].length)}:{headers:'',body:raw};}
function header(headers,name) {return headers.match(new RegExp('^'+name+':\\s*(.+)$','im'))?.[1]||'';}
function decodeBytes(text,encoding,charset,binary=false) {
  let bytes;
  if(/base64/i.test(encoding))bytes=Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0));
  else if(/quoted-printable/i.test(encoding)){const input=text.replace(/=\r?\n/g,'');const out=[];for(let i=0;i<input.length;i++){if(input[i]==='='&&/^[\da-f]{2}$/i.test(input.slice(i+1,i+3))){out.push(parseInt(input.slice(i+1,i+3),16));i+=2;}else out.push(input.charCodeAt(i));}bytes=new Uint8Array(out);}
  else if(binary)bytes=Uint8Array.from(text,c=>c.charCodeAt(0));else return text;
  try{return new TextDecoder(charset||'utf-8').decode(bytes);}catch{return new TextDecoder().decode(bytes);}
}
function decodeSubject(value) {return value.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi,(_,charset,kind,text)=>decodeBytes(kind.toUpperCase()==='Q'?text.replace(/_/g,' '):text,kind.toUpperCase()==='Q'?'quoted-printable':'base64',charset));}
export function emailToText(raw,{binary=false}={}) {
  if(String(raw).length>2*1024*1024)throw new Error('E-mail trop volumineux : 2 Mo maximum. Exportez le message sans ses pièces jointes ou collez seulement son texte.');
  let partCount=0;
  function part(input,depth=0) {
    if(depth>8||++partCount>200)throw new Error('Structure de message trop complexe. Collez le texte de la confirmation.');
    const {headers,body}=splitHeaders(input),type=header(headers,'Content-Type')||'text/plain';
    if(/attachment/i.test(header(headers,'Content-Disposition'))||/name\s*=/i.test(type))return [];
    const boundary=type.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
    if(/multipart\//i.test(type)&&boundary)return body.split('--'+(boundary[1]||boundary[2])).slice(1).filter(p=>!/^--/.test(p.trim())).flatMap(p=>part(p.replace(/^\r?\n/,''),depth+1));
    if(!/^text\/(plain|html)\b/i.test(type))return [];
    const charset=type.match(/charset\s*=\s*"?([^";\s]+)/i)?.[1],text=decodeBytes(body,header(headers,'Content-Transfer-Encoding'),charset,binary);
    return [{html:/text\/html/i.test(type),text:/text\/html/i.test(type)?emailHTMLText(text):text}];
  }
  const {headers}=splitHeaders(raw),parts=part(raw),plain=parts.filter(p=>!p.html&&p.text.trim()),selected=plain.length?plain:parts;
  const subject=decodeSubject(header(headers,'Subject'));
  const text=[subject?'Objet : '+subject:'',...selected.map(p=>p.text.trim())].filter(Boolean).join('\n');
  if(!text.trim())throw new Error('Aucun texte de confirmation trouvé. Collez le contenu lisible du message.');
  return text.slice(0,100000);
}
export async function readConfirmationFile(file) {
  if(file.size>2*1024*1024)throw new Error('Fichier de confirmation limité à 2 Mo.');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
  return emailToText(binary,{binary:true});
}
export function confirmationJSON(fields) {return {format:'voyage-confirmation',version:1,fields};}
export function readConfirmationJSON(value) {
  const data=typeof value==='string'?JSON.parse(value):value;
  if(data?.format!=='voyage-confirmation'||data.version!==1||!data.fields||typeof data.fields!=='object'||Array.isArray(data.fields))throw new Error('JSON de confirmation non reconnu.');
  const allowed=['title','kind','bookingDate','arrivalDate','checkoutDate','time','endTime','reference','placeId','day','airline','flightNumber','origin','destination','passenger','terminal','arrivalTerminal','gate','seat','baggage','address','guestName','roomType','guests','contact','visitors','ticketType','meetingPoint'];
  const fields={warnings:['Données importées : vérifiez les propositions avant d’enregistrer.'],evidence:{}};
  for(const key of allowed)if(data.fields[key]!==undefined){const v=data.fields[key];if(!['string','number'].includes(typeof v)||String(v).length>300)throw new Error('Champ de confirmation invalide.');fields[key]=v;}
  if(fields.kind&&!['flight','hotel','museum','activity','transport','restaurant'].includes(fields.kind))throw new Error('Type de réservation invalide.');return fields;
}
