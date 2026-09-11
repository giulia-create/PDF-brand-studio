import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import {
  ensureDocDir,
  pdfPath,
  saveMeta,
  docDir,
} from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

type DetectedField = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function detectFieldsFromBBox(html: string): DetectedField[] {
  const fields: DetectedField[] = [];

  const pageRegex =
    /<page[^>]*width="([^"]+)"[^>]*height="([^"]+)"[^>]*>([\s\S]*?)<\/page>/g;

  let pageMatch: RegExpExecArray | null;
  let pageIndex = 0;

  while ((pageMatch = pageRegex.exec(html))) {
    const pageWidth = Number(pageMatch[1]);
    const pageHeight = Number(pageMatch[2]);
    const pageContent = pageMatch[3];

    const wordRegex =
      /<word[^>]*xMin="([^"]+)"[^>]*yMin="([^"]+)"[^>]*xMax="([^"]+)"[^>]*yMax="([^"]+)"[^>]*>([\s\S]*?)<\/word>/g;

    let wordMatch: RegExpExecArray | null;

    while ((wordMatch = wordRegex.exec(pageContent))) {
      const xMin = Number(wordMatch[1]);
      const yMin = Number(wordMatch[2]);
      const xMax = Number(wordMatch[3]);
      const yMax = Number(wordMatch[4]);
      const text = decodeHtml(wordMatch[5]).trim();

      const isDots =
        /^\.{4,}$/.test(text) ||
        /^_{4,}$/.test(text) ||
        /^…{2,}$/.test(text) ||
        /^[._…]{4,}$/.test(text);

      if (!isDots) continue;

      fields.push({
        page: pageIndex,
        x: xMin / pageWidth,
        y: yMin / pageHeight,
        w: Math.max(0.08, (xMax - xMin) / pageWidth),
        h: Math.max(0.025, (yMax - yMin) / pageHeight),
      });
    }

    pageIndex++;
  }

  return fields;
}

async function convertWord(
  file: File,
  workingDir: string
): Promise<{
  pdfBytes: Uint8Array;
  detectedFields: DetectedField[];
}> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = extname(file.name).toLowerCase();

  const input = join(workingDir, file.name);

  await writeFile(input, bytes);

  await execFileAsync(
    process.env.LIBREOFFICE_BIN || 'soffice',
    [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      workingDir,
      input,
    ],
    { timeout: 60000 }
  );

  const outputPdf = join(
    workingDir,
    basename(file.name, ext) + '.pdf'
  );

  const outputHtml = join(workingDir, 'layout.html');

  await execFileAsync(
    process.env.PDFTOTEXT_BIN || 'pdftotext',
    [
      '-bbox-layout',
      '-enc',
      'UTF-8',
      outputPdf,
      outputHtml,
    ],
    { timeout: 60000 }
  );

  const pdfBytes = new Uint8Array(await readFile(outputPdf));

  let detectedFields: DetectedField[] = [];

  try {
    const html = await readFile(outputHtml, 'utf8');
    detectedFields = detectFieldsFromBBox(html);
  } catch {
    detectedFields = [];
  }

  return {
    pdfBytes,
    detectedFields,
  };
}

async function convertImage(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = extname(file.name).toLowerCase();

  const pdf = await PDFDocument.create();

  const img =
    ext === '.png'
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes);

  const page = pdf.addPage([595.28, 841.89]);

  const scale = Math.min(
    535 / img.width,
    780 / img.height
  );

  page.drawImage(img, {
    x: (595.28 - img.width * scale) / 2,
    y: (841.89 - img.height * scale) / 2,
    width: img.width * scale,
    height: img.height * scale,
  });

  return pdf.save();
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();

    const files = data
      .getAll('files')
      .filter((f): f is File => f instanceof File);

    if (!files.length) {
      return NextResponse.json(
        { error: 'File mancante' },
        { status: 400 }
      );
    }

    const max =
      Number(process.env.MAX_UPLOAD_MB || 25) *
      1024 *
      1024;

    if (files.some((f) => f.size > max)) {
      return NextResponse.json(
        {
          error: `Un file supera ${
            process.env.MAX_UPLOAD_MB || 25
          } MB`,
        },
        { status: 413 }
      );
    }

    const multiple = files.length > 1;

    if (
      multiple &&
      files.some(
        (f) =>
          !['.jpg', '.jpeg', '.png'].includes(
            extname(f.name).toLowerCase()
          )
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Il caricamento multiplo è disponibile per immagini JPG/PNG.',
        },
        { status: 400 }
      );
    }

    let pdfBytes: Uint8Array;
    let detectedFields: DetectedField[] = [];

    if (multiple) {
      const out = await PDFDocument.create();

      for (const f of files) {
        const bytes = new Uint8Array(
          await f.arrayBuffer()
        );

        const ext = extname(f.name).toLowerCase();

        const img =
          ext === '.png'
            ? await out.embedPng(bytes)
            : await out.embedJpg(bytes);

        const page = out.addPage([
          595.28,
          841.89,
        ]);

        const scale = Math.min(
          535 / img.width,
          780 / img.height
        );

        page.drawImage(img, {
          x: (595.28 - img.width * scale) / 2,
          y: (841.89 - img.height * scale) / 2,
          width: img.width * scale,
          height: img.height * scale,
        });
      }

      pdfBytes = await out.save();
    } else {
      const file = files[0];

      const ext = extname(
        file.name
      ).toLowerCase();

      if (ext === '.pdf') {
        pdfBytes = new Uint8Array(
          await file.arrayBuffer()
        );
      } else if (
        ['.jpg', '.jpeg', '.png'].includes(ext)
      ) {
        pdfBytes = await convertImage(file);
      } else if (
        ['.doc', '.docx'].includes(ext)
      ) {
        const workingDir = await mkdtemp(
          join(tmpdir(), 'pdfbrand-')
        );

        try {
          const result = await convertWord(
            file,
            workingDir
          );

          pdfBytes = result.pdfBytes;
          detectedFields =
            result.detectedFields;
        } finally {
          await rm(workingDir, {
            recursive: true,
            force: true,
          });
        }
      } else {
        throw new Error(
          'Formato non supportato'
        );
      }
    }

    const parsed = await PDFDocument.load(
      pdfBytes,
      {
        ignoreEncryption: true,
      }
    );

    const id = randomUUID();

    await ensureDocDir(id);
    await writeFile(pdfPath(id), pdfBytes);

    const now = new Date().toISOString();

    const meta = {
      id,
      name: multiple
        ? 'Immagini-unite.pdf'
        : files[0].name.replace(
            /\.[^.]+$/,
            ''
          ) + '.pdf',
      sourceName: multiple
        ? `${files.length} immagini`
        : files[0].name,
      mimeType: 'application/pdf',
      pageCount: parsed.getPageCount(),
      createdAt: now,
      updatedAt: now,
    };

    await saveMeta(meta);

    const pages = Array.from(
      { length: parsed.getPageCount() },
      (_, i) => ({
        id: randomUUID(),
        sourceIndex: i,
        rotation: 0,
      })
    );

    const overlays = detectedFields
      .filter(
        (field) => pages[field.page]
      )
      .map((field) => ({
        id: randomUUID(),
        type: 'text',
        pageId: pages[field.page].id,
        x: field.x,
        y: field.y,
        w: field.w,
        h: field.h,
        text: '',
        fontSize: 16,
        color: '#111827',
        opacity: 1,
      }));

    await writeFile(
      join(
        docDir(id),
        'editor-state.json'
      ),
      JSON.stringify(
        {
          pages,
          overlays,
          autoFields: true,
          detectedFields:
            detectedFields.length,
        },
        null,
        2
      )
    );

    return NextResponse.json(
      {
        ...meta,
        detectedFields:
          detectedFields.length,
      },
      { status: 201 }
    );
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : 'Errore sconosciuto';

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
