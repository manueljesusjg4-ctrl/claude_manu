// Almacenamiento de archivos subidos (documentos, firmas de EPIs...).
// En local guarda en disco (carpeta uploads/). En Vercel el disco no es
// persistente entre despliegues, así que si hay un token de Vercel Blob
// configurado, los archivos se guardan ahí en su lugar.
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const carpetaSubidas = path.join(__dirname, '../../uploads');

// En Vercel el sistema de archivos es de solo lectura (salvo /tmp), así que
// ahí nunca se usa disco local, aunque no haya token de Blob configurado.
export const usaAlmacenamientoLocal = !process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL;

/** Guarda un archivo y devuelve la URL pública desde la que se puede servir. */
export async function guardarArchivo(buffer: Buffer, nombreOriginal: string): Promise<string> {
  const ext = path.extname(nombreOriginal).toLowerCase();
  const nombre = `${crypto.randomUUID()}${ext}`;

  if (usaAlmacenamientoLocal) {
    fs.mkdirSync(carpetaSubidas, { recursive: true });
    fs.writeFileSync(path.join(carpetaSubidas, nombre), buffer);
    return `/uploads/${nombre}`;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('No hay almacenamiento de archivos configurado en este servidor (falta Vercel Blob).');
  }
  const { put } = await import('@vercel/blob');
  const resultado = await put(nombre, buffer, { access: 'public' });
  return resultado.url;
}
