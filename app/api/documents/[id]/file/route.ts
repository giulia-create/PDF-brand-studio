import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'node:fs/promises';
import { pdfPath, readMeta, saveMeta } from '@/lib/storage';
import { PDFDocument } from 'pdf-lib';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const data=await readFile(pdfPath(id));return new NextResponse(data,{headers:{'Content-Type':'application/pdf','Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Documento non trovato'},{status:404})}}
export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const bytes=new Uint8Array(await req.arrayBuffer());const pdf=await PDFDocument.load(bytes);await writeFile(pdfPath(id),bytes);const meta=await readMeta(id);meta.pageCount=pdf.getPageCount();meta.updatedAt=new Date().toISOString();await saveMeta(meta);return NextResponse.json(meta)}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}}
