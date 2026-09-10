import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type StoredDocument = {
  id: string;
  name: string;
  sourceName: string;
  mimeType: string;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
};

const root = process.env.DATA_DIR || '/data/documents';
export const docDir = (id:string) => join(root, id);
export const pdfPath = (id:string) => join(docDir(id), 'document.pdf');
export const metaPath = (id:string) => join(docDir(id), 'meta.json');
export async function ensureDocDir(id:string){ await mkdir(docDir(id), {recursive:true}); }
export async function saveMeta(meta:StoredDocument){ await ensureDocDir(meta.id); await writeFile(metaPath(meta.id), JSON.stringify(meta,null,2)); }
export async function readMeta(id:string){ return JSON.parse(await readFile(metaPath(id),'utf8')) as StoredDocument; }
