import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { EditorPage, Overlay } from './editor-types';
import type { BrandData } from './pdf';

function hexToRgb(hex='#111827'){
  const h=hex.replace('#',''); const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);
  return rgb(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255);
}
function dataUrlBytes(dataUrl:string){ const [meta,b64]=dataUrl.split(','); return {meta,bytes:Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}; }

export async function exportEditedPdf(source:ArrayBuffer,pages:EditorPage[],overlays:Overlay[],brand?:BrandData){
  const src=await PDFDocument.load(source); const out=await PDFDocument.create();
  const font=await out.embedFont(StandardFonts.Helvetica); const bold=await out.embedFont(StandardFonts.HelveticaBold);
  const copied=await out.copyPages(src,pages.map(p=>p.sourceIndex)); copied.forEach((p,i)=>{out.addPage(p); const rot=pages[i].rotation||0; if(rot)p.setRotation(degrees((((p.getRotation().angle||0)+rot)%360+360)%360));});
  let brandLogo:any=null;
  if(brand?.logoDataUrl){const {meta,bytes}=dataUrlBytes(brand.logoDataUrl); brandLogo=meta.includes('png')?await out.embedPng(bytes):await out.embedJpg(bytes)}
  for(let i=0;i<pages.length;i++){
    const page=out.getPage(i); const {width,height}=page.getSize(); const pageId=pages[i].id;
    if(brand){
      if(brandLogo){const s=brandLogo.scale(1),k=Math.min(95/s.width,45/s.height);page.drawImage(brandLogo,{x:35,y:height-35-s.height*k,width:s.width*k,height:s.height*k});}
      const lines=[brand.companyName,brand.address,[brand.email,brand.phone].filter(Boolean).join(' • ')].filter(Boolean) as string[];
      lines.forEach((t,idx)=>page.drawText(t,{x:Math.max(35,width-35-font.widthOfTextAtSize(t,idx===0?10:8.5)),y:height-32-idx*12,size:idx===0?10:8.5,font:idx===0?bold:font,color:rgb(.18,.21,.28)}));
      page.drawLine({start:{x:35,y:42},end:{x:width-35,y:42},thickness:.5,color:rgb(.78,.8,.84)});
      const footer=[brand.footerText,brand.vatNumber?`P.IVA ${brand.vatNumber}`:'',brand.website].filter(Boolean).join(' • ');
      if(footer)page.drawText(footer.slice(0,150),{x:35,y:27,size:7.5,font,color:rgb(.35,.38,.45)});
      page.drawText(`Pagina ${i+1} di ${pages.length}`,{x:width-92,y:27,size:7.5,font,color:rgb(.35,.38,.45)});
    }
    for(const o of overlays.filter(x=>x.pageId===pageId)){
      const x=o.x*width, w=o.w*width, h=o.h*height, y=height-(o.y*height)-h;
      if(o.type==='text' && o.text){ page.drawText(o.text,{x,y:y+Math.max(0,h-(o.fontSize||16)),size:Math.max(6,(o.fontSize||16)*(width/720)),font,color:hexToRgb(o.color)}); }
      if(o.type==='highlight'){ page.drawRectangle({x,y,width:w,height:h,color:rgb(1,.92,.2),opacity:o.opacity??.35}); }
      if((o.type==='image'||o.type==='signature')&&o.dataUrl){ const {meta,bytes}=dataUrlBytes(o.dataUrl); const img=meta.includes('png')?await out.embedPng(bytes):await out.embedJpg(bytes); page.drawImage(img,{x,y,width:w,height:h,opacity:o.opacity??1}); }
    }
  }
  return out.save();
}
