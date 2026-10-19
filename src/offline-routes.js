function database() {
  return new Promise((resolve,reject)=>{const request=indexedDB.open('voyage.routes.v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('routes');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
export async function routeSnapshot(key,value) {
  let db;
  try {
    db=await database();
    return await new Promise((resolve,reject)=>{const tx=db.transaction('routes',value?'readwrite':'readonly'),store=tx.objectStore('routes');const req=value?store.put({...value,savedAt:new Date().toISOString()},key):store.get(key);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);});
  }catch{return null;}finally{db?.close();}
}
