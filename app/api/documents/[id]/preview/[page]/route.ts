import { NextRequest, NextResponse } from 'next/server';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pdfPath } from '@/lib/storage';
const execFileAsync=promisify(execFile);
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string,page:string}>}){
  const {id,page}=await params; const n=Number(page); if(!Number.isInteger(n)||n<1)return NextResponse.json({error:'Pagina non valida'},{status:400});
  const dpi=Math.min(160,Math.max(60,Number(req.nextUrl.searchParams.get('dpi')||110))); const rot=((Number(req.nextUrl.searchParams.get('rotation')||0)%360)+360)%360;
  const dir=await mkdtemp(join(tmpdir(),'pdfbrand-preview-')); const base=join(dir,'page'); const png=base+'.png';
  try{
    await execFileAsync(process.env.PDFTOPPM_BIN||'pdftoppm',['-f',String(n),'-singlefile','-png','-r',String(dpi),pdfPath(id),base],{timeout:30000});
    let result=png;
    if(rot){const rotated=join(dir,'rotated.png');await execFileAsync(process.env.IMAGEMAGICK_BIN||'convert',[png,'-rotate',String(rot),rotated],{timeout:15000});result=rotated;}
    return new NextResponse(await readFile(result),{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=60'}});
  }catch(e){return NextResponse.json({error:'Anteprima non disponibile',detail:(e as Error).message},{status:500})}
  finally{await rm(dir,{recursive:true,force:true})}
}
