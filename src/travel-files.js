const database = () => new Promise((resolve,reject)=>{
  if (!globalThis.indexedDB) { reject(new Error('Le stockage de fichiers est indisponible dans ce navigateur.')); return; }
  const request = indexedDB.open('voyage.documents.v1',1);
  request.onupgradeneeded = ()=>request.result.createObjectStore('files');
  request.onsuccess = ()=>resolve(request.result);
  request.onerror = ()=>reject(new Error('Impossible d’ouvrir le stockage des billets.'));
});
export function validateFile(file) {
  if (!file || file.size > 10*1024*1024 || file.size < 1 || !['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Choisissez un PDF ou une image JPG, PNG ou WebP de 10 Mo maximum.');
}
export async function documentFile(action, id, file) {
  if (action === 'put') validateFile(file);
  const db = await database();
  try {
    return await new Promise((resolve,reject)=>{
      const tx = db.transaction('files',action==='get'?'readonly':'readwrite'), store=tx.objectStore('files');
      const req = action==='put' ? store.put(file,id) : action==='delete' ? store.delete(id) : store.get(id);
      tx.oncomplete=()=>resolve(req.result);
      tx.onerror=()=>reject(new Error('Le stockage du document a échoué. Vérifiez l’espace disponible.'));
      tx.onabort=()=>reject(new Error('Le document n’a pas pu être enregistré.'));
    });
  } finally { db.close(); }
}

export async function deleteUnusedDocument(id,storage=globalThis.localStorage,remove=key=>documentFile('delete',key)){
  try{const trips=JSON.parse(storage.getItem('voyage.trips.v1')||'[]');if(!Array.isArray(trips)||trips.some(t=>(t.organizer?.bookings||[]).some(b=>b.attachment?.id===id)))return;}catch{return;}
  await remove(id);
}
