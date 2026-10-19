import { validateFile } from './travel-files.js';
const resource=name=>new URL('../vendor/tickets/'+name,import.meta.url).href;
async function recognize(image,progress) {
  const {default:Tesseract}=await import('../vendor/tickets/tesseract.mjs');
  const {createWorker}=Tesseract;
  let worker;
  try {
    worker=await createWorker('fra+eng',1,{workerPath:resource('worker.min.js'),workerBlobURL:false,corePath:resource('tesseract-core-lstm.wasm.js'),langPath:resource('lang'),gzip:true,cacheMethod:'none',logger:event=>progress?.(`Lecture de l’image : ${Math.round((event.progress||0)*100)} %`)});
    const result=await worker.recognize(image);return result.data.text;
  } finally {if(worker)await worker.terminate();}
}
export async function readTicket(file,progress) {
  validateFile(file);
  if(file.type!=='application/pdf') {
    const image=await createImageBitmap(file);
    try {const scale=Math.min(1,2200/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.ceil(image.width*scale);canvas.height=Math.ceil(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return {text:await recognize(canvas,progress),method:'Reconnaissance d’image',warnings:[]};}finally{image.close();}
  }
  const pdfjs=await import('../vendor/tickets/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=resource('pdf.worker.mjs');
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,standardFontDataUrl:resource('standard_fonts/')});
  let pdf;
  try {
    pdf=await task.promise;
    if(pdf.numPages>20)throw new Error('Ce PDF dépasse 20 pages. Importez seulement les pages du billet.');
    let text='',scans=0;const warnings=[];
    for(let i=1;i<=pdf.numPages;i++) {
      progress?.(`Lecture du PDF : page ${i} / ${pdf.numPages}`);
      const page=await pdf.getPage(i),content=await page.getTextContent();let line='',lastY=null,pageText='';
      for(const item of content.items) {if(!item.str)continue;const y=item.transform?.[5];if(lastY!==null&&Math.abs(y-lastY)>3){pageText+=line+'\n';line='';}line+=(line?' ':'')+item.str;lastY=y;if(item.hasEOL){pageText+=line+'\n';line='';lastY=null;}}
      pageText+=line;
      if(pageText.replace(/\s/g,'').length<20) {
        if(scans>=3){warnings.push('Seules les trois premières pages scannées ont été reconnues. Importez les autres séparément.');continue;}
        scans++;const initial=page.getViewport({scale:1}),scale=Math.min(2,2000/Math.max(initial.width,initial.height)),viewport=page.getViewport({scale});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;pageText=await recognize(canvas,progress);canvas.width=canvas.height=0;
      }
      text+=pageText+'\n';page.cleanup();
      if(text.length>100000){warnings.push('Document long : texte limité à 100 000 caractères.');break;}
    }
    return {text:text.slice(0,100000),method:scans?'PDF et reconnaissance d’image':'Texte du PDF',warnings};
  } catch(error) {if(error.name==='PasswordException')throw new Error('Ce PDF est protégé par un mot de passe. Fournissez une copie déverrouillée.');throw error;}
  finally {await task.destroy();}
}
