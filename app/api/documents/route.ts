import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import { ensureDocDir, pdfPath, saveMeta } from '@/lib/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const execFileAsync=promisify(execFile);

async function convertSingle(file:File):Promise<Uint8Array>{
  const bytes=new Uint8Array(await file.arrayBuffer()); const ext=extname(file.name).toLowerCase();
  if(ext==='.pdf') return bytes;
  if(['.jpg','.jpeg','.png'].includes(ext)){
    const pdf=await PDFDocument.create(); const img=ext==='.png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
    const page=pdf.addPage([595.28,841.89]); const scale=Math.min(535/img.width,780/img.height);
    page.drawImage(img,{x:(595.28-img.width*scale)/2,y:(841.89-img.height*scale)/2,width:img.width*scale,height:img.height*scale}); return pdf.save();
  }
  if(['.doc','.docx'].includes(ext)){
    const dir=await mkdtemp(join(tmpdir(),'pdfbrand-'));
    try{const input=join(dir,file.name);await writeFile(input,bytes);await execFileAsync(process.env.LIBREOFFICE_BIN||'soffice',['--headless','--convert-to','pdf','--outdir',dir,input],{timeout:60000});return new Uint8Array(await readFile(join(dir,basename(file.name,ext)+'.pdf')))}
    finally{await rm(dir,{recursive:true,force:true})}
  }
  throw new Error('Formato non supportato');
}

export async function POST(req:NextRequest){
  try{
    const data=await req.formData(); const files=data.getAll('files').filter((f):f is File=>f instanceof File);
    if(!files.length)return NextResponse.json({error:'File mancante'},{status:400});
    const max=Number(process.env.MAX_UPLOAD_MB||25)*1024*1024;
    if(files.some(f=>f.size>max))return NextResponse.json({error:`Un file supera ${process.env.MAX_UPLOAD_MB||25} MB`},{status:413});
    const multiple=files.length>1;
    if(multiple && files.some(f=>!['.jpg','.jpeg','.png'].includes(extname(f.name).toLowerCase())))return NextResponse.json({error:'Il caricamento multiplo è attualmente disponibile per immagini JPG/PNG.'},{status:400});
    let pdfBytes:Uint8Array;
    if(multiple){
      const out=await PDFDocument.create();
      for(const f of files){const b=new Uint8Array(await f.arrayBuffer());const ext=extname(f.name).toLowerCase();const img=ext==='.png'?await out.embedPng(b):await out.embedJpg(b);const page=out.addPage([595.28,841.89]);const scale=Math.min(535/img.width,780/img.height);page.drawImage(img,{x:(595.28-img.width*scale)/2,y:(841.89-img.height*scale)/2,width:img.width*scale,height:img.height*scale});}
      pdfBytes=await out.save();
    }else pdfBytes=await convertSingle(files[0]);
    const parsed=await PDFDocument.load(pdfBytes); const id=randomUUID(); await ensureDocDir(id); await writeFile(pdfPath(id),pdfBytes);
    const now=new Date().toISOString(); const meta={id,name:multiple?'Immagini-unite.pdf':files[0].name.replace(/\.[^.]+$/,'')+'.pdf',sourceName:multiple?`${files.length} immagini`:files[0].name,mimeType:'application/pdf',pageCount:parsed.getPageCount(),createdAt:now,updatedAt:now}; await saveMeta(meta);
    return NextResponse.json(meta,{status:201});
  }catch(e){const msg=(e as Error).message;return NextResponse.json({error:msg.includes('soffice')||msg.includes('ENOENT')?'Conversione Word non disponibile: LibreOffice non è installato sul server.':msg},{status:500})}
}
