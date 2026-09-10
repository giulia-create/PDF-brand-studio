import { NextRequest, NextResponse } from 'next/server';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const execFileAsync=promisify(execFile);

export async function POST(req:NextRequest){const data=await req.formData();const file=data.get('file');if(!(file instanceof File))return NextResponse.json({error:'File mancante'},{status:400});const max=Number(process.env.MAX_UPLOAD_MB||25)*1024*1024;if(file.size>max)return NextResponse.json({error:'File troppo grande'},{status:413});const bytes=new Uint8Array(await file.arrayBuffer());const ext=extname(file.name).toLowerCase();
if(ext==='.pdf')return new NextResponse(bytes,{headers:{'Content-Type':'application/pdf'}});
if(['.jpg','.jpeg','.png'].includes(ext)){const pdf=await PDFDocument.create();const img=ext==='.png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const page=pdf.addPage([595.28,841.89]);const scale=Math.min(535/img.width,780/img.height);page.drawImage(img,{x:(595.28-img.width*scale)/2,y:(841.89-img.height*scale)/2,width:img.width*scale,height:img.height*scale});return new NextResponse(await pdf.save(),{headers:{'Content-Type':'application/pdf'}})}
if(['.doc','.docx'].includes(ext)){const dir=await mkdtemp(join(tmpdir(),'pdfbrand-'));try{const input=join(dir,file.name);await writeFile(input,bytes);await execFileAsync(process.env.LIBREOFFICE_BIN||'soffice',['--headless','--convert-to','pdf','--outdir',dir,input],{timeout:60000});const output=join(dir,basename(file.name,ext)+'.pdf');const result=await readFile(output);return new NextResponse(result,{headers:{'Content-Type':'application/pdf'}})}catch(e){return NextResponse.json({error:'Conversione Word non disponibile. Installare LibreOffice/soffice sul server.',detail:(e as Error).message},{status:503})}finally{await rm(dir,{recursive:true,force:true})}}
return NextResponse.json({error:'Formato non supportato'},{status:415})}
