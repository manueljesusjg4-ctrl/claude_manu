// Subida de archivos (PDFs y fotos de documentos) para documentación.
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

export const carpetaSubidas = path.join(__dirname, '../../uploads');

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const almacenamiento = multer.diskStorage({
  destination: carpetaSubidas,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const subida = multer({
  storage: almacenamiento,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF o imágenes (JPG, PNG, WEBP).'));
  },
});

export const rutasUploads = Router();

rutasUploads.post('/', (req, res) => {
  subida.single('archivo')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al subir el archivo' });
    if (!req.file) return res.status(400).json({ error: 'No se ha recibido ningún archivo.' });
    res.status(201).json({ url: `/uploads/${req.file.filename}`, nombre: req.file.originalname });
  });
});
