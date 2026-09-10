import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { docDir } from '@/lib/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const pathFor=(id:string)=>join(docDir(id),'editor-state.json');
export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){try{return NextResponse.json(JSON.parse(await readFile(pathFor((await params).id),'utf8')))}catch{return NextResponse.json({state:null})}}
export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const body=await req.json();await writeFile(pathFor((await params).id),JSON.stringify(body,null,2));return NextResponse.json({ok:true})}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}}
