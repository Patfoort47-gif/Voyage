export async function setupPWA() {
  const status=document.querySelector('#pwa-status'),network=document.querySelector('#network-status'),install=document.querySelector('#install-app'),update=document.querySelector('#update-app');
  const connection=()=>{network.textContent=navigator.onLine?'En ligne':'Hors ligne · données locales disponibles';document.body.classList.toggle('is-offline',!navigator.onLine);};
  addEventListener('online',connection);addEventListener('offline',connection);connection();
  let prompt;
  addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
  install.addEventListener('click',async()=>{if(prompt){await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;}});
  addEventListener('appinstalled',()=>{install.hidden=true;status.textContent='Application installée.';});
  if(!('serviceWorker' in navigator)){status.textContent='Installation hors ligne indisponible dans ce navigateur.';document.querySelector('#offline-reader').disabled=true;return;}
  try {
    const registration=await navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname,updateViaCache:'none'});
    let reload=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reload)location.reload();});
    const waiting=()=>{if(registration.waiting)update.hidden=false;};waiting();
    registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',waiting));
    update.addEventListener('click',()=>{reload=true;registration.waiting?.postMessage({type:'SKIP_WAITING'});});
    status.textContent='Préparation du carnet hors ligne…';
    setTimeout(()=>{if(!registration.active)status.textContent='Préparation hors ligne incomplète. Restez en ligne puis rechargez pour réessayer.';},20000);
    navigator.serviceWorker.ready.then(()=>{status.textContent='Carnet prêt hors ligne. Billets et données restent dans ce navigateur.';});
    document.querySelector('#offline-reader').addEventListener('click',async event=>{
      const button=event.target;button.disabled=true;status.textContent='Téléchargement des outils de lecture de billets (environ 10 Mo)…';
      try {await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Le mode hors ligne n’est pas encore prêt. Rechargez la page en ligne.')),20000))]);const channel=new MessageChannel();await new Promise((resolve,reject)=>{channel.port1.onmessage=e=>e.data.ok?resolve():reject(new Error(e.data.error));(registration.active||navigator.serviceWorker.controller).postMessage({type:'CACHE_TICKETS'},[channel.port2]);});status.textContent='Lecture PDF et photos prête hors ligne.';}catch(error){status.textContent='Préparation incomplète : '+error.message;}finally{button.disabled=false;}
    });
  }catch{status.textContent='Le mode hors ligne n’a pas pu être préparé. Réessayez avec une connexion.';document.querySelector('#offline-reader').disabled=true;}
}
