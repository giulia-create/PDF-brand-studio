# PDF Brand Studio — Fasi 2 + 3

MVP tecnico di editor documentale aziendale con conversione, storage persistente server-side ed editor visuale.

## Funzioni implementate

### Fase 2 — Upload, conversione e persistenza
- Upload PDF, DOC, DOCX, JPG, JPEG, PNG.
- Upload multiplo JPG/PNG → unico PDF.
- DOC/DOCX → PDF con LibreOffice headless.
- PDF/JPG/PNG → PDF.
- File salvati in storage server-side persistente (`DATA_DIR`).
- Metadati documento e ID univoco.
- API per leggere/eliminare/salvare documenti.
- Generazione server-side delle anteprime PNG tramite Poppler (`pdftoppm`).
- Stato editor salvato separatamente in `editor-state.json`.

### Fase 3 — Editor visuale
- Anteprima multipagina.
- Miniature pagine.
- Selezione pagina.
- Riordino pagine.
- Rotazione pagina.
- Eliminazione pagina.
- Duplicazione pagina.
- Inserimento testo.
- Modifica testo, dimensione e colore.
- Inserimento immagini.
- Inserimento firma tramite upload.
- Disegno firma con mouse/touchscreen.
- Evidenziatore.
- Drag & drop degli elementi.
- Ridimensionamento degli elementi.
- Undo / redo.
- Brand Kit con logo e dati aziendali.
- Header/footer/numerazione applicati in esportazione.
- Salvataggio progetto.
- Generazione e download PDF finale con `pdf-lib`.

## Non ancora implementato
- OCR (Fase 8 della roadmap).
- Modifica diretta del testo nativo già presente nel PDF.
- Autenticazione utenti.
- Brand Kit persistente su database per utente (attualmente viene incluso nello stato del progetto e salvato anche nel browser).
- Template aziendali multipli.
- Storage S3/object storage.
- Firma digitale qualificata.

## Avvio locale

Prerequisiti:
- Node.js 22+
- LibreOffice
- Poppler (`pdftoppm`)
- ImageMagick (`convert`)

```bash
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

Apri `http://localhost:3000`.

## Deploy consigliato: Railway + Docker

Il progetto include un `Dockerfile` che installa automaticamente:
- LibreOffice Writer
- Poppler
- ImageMagick
- font DejaVu

Questo rende Railway più adatto di un hosting puramente serverless per questa versione, perché la conversione Word e le anteprime PDF richiedono binari di sistema.

### Variabili ambiente

Impostare almeno:

```env
DATA_DIR=/data/documents
MAX_UPLOAD_MB=25
LIBREOFFICE_BIN=soffice
PDFTOPPM_BIN=pdftoppm
IMAGEMAGICK_BIN=convert
```

`DATABASE_URL` può essere collegata a PostgreSQL Railway; il database è già predisposto nello schema Prisma ma non è ancora necessario per usare l'editor MVP.

### Volume persistente

Su Railway montare un volume sul servizio con mount path:

```text
/data
```

I documenti vengono salvati in `/data/documents`.

## Nota di sicurezza prima del lancio pubblico

Questa build è un MVP tecnico. Prima di consentire caricamenti a clienti reali va aggiunta autenticazione e autorizzazione per impedire l'accesso a un documento conoscendone l'ID. Gli ID sono UUID casuali, ma questo non sostituisce un vero controllo accessi.
