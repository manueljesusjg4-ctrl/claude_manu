// Almacenamiento de archivos subidos (documentos, firmas de EPIs...).
// En local guarda en disco (carpeta uploads/). En Vercel el disco es de
// solo lectura y no persiste entre despliegues, así que ahí siempre se
// usa Vercel Blob.
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const carpetaSubidas = path.join(__dirname, '../../uploads');

export const usaAlmacenamientoLocal = !process.env.VERCEL;

/** Guarda un archivo y devuelve la URL pública desde la que se puede servir. */
export async function guardarArchivo(buffer: Buffer, nombreOriginal: string): Promise<string> {
  const ext = path.extname(nombreOriginal).toLowerCase();
  const nombre = `${crypto.randomUUID()}${ext}`;

  if (usaAlmacenamientoLocal) {
    fs.mkdirSync(carpetaSubidas, { recursive: true });
    fs.writeFileSync(path.join(carpetaSubidas, nombre), buffer);
    return `/uploads/${nombre}`;
  }

  const { put } = await import('@vercel/blob');
  const resultado = await put(nombre, buffer, { access: 'public' });
  return resultado.url;
}
