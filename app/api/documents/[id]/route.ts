import { NextRequest, NextResponse } from 'next/server';
import { rm } from 'node:fs/promises';
import { docDir, readMeta } from '@/lib/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){try{return NextResponse.json(await readMeta((await params).id))}catch{return NextResponse.json({error:'Documento non trovato'},{status:404})}}
export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}){try{await rm(docDir((await params).id),{recursive:true,force:true});return NextResponse.json({ok:true})}catch{return NextResponse.json({error:'Impossibile eliminare il documento'},{status:500})}}
