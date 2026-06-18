// Subida de archivos (PDFs, fotos de documentos, firmas digitales de EPIs).
import { Router } from 'express';
import multer from 'multer';
import { guardarArchivo } from '../lib/almacenamiento';

export { carpetaSubidas, usaAlmacenamientoLocal } from '../lib/almacenamiento';

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF o imágenes (JPG, PNG, WEBP).'));
  },
});

export const rutasUploads = Router();

rutasUploads.post('/', (req, res) => {
  subida.single('archivo')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al subir el archivo' });
    if (!req.file) return res.status(400).json({ error: 'No se ha recibido ningún archivo.' });
    const url = await guardarArchivo(req.file.buffer, req.file.originalname);
    res.status(201).json({ url, nombre: req.file.originalname });
  });
});
