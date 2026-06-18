// Construcción de la app Express. Separado de index.ts para poder reutilizar
// la misma app tanto en un servidor tradicional (npm start) como en una
// función serverless (Vercel).
import 'dotenv/config';
// Captura errores de rutas async (rechazos de promesas) y los pasa al
// manejador de errores en vez de tumbar el proceso entero del servidor.
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import { requiereAuth } from './middleware/auth';
import { rutasUploads, carpetaSubidas, usaAlmacenamientoLocal } from './routes/uploads';
import { rutasAuth } from './routes/auth';
import { rutasConfiguracion } from './routes/configuracion';
import { rutasTrabajadores } from './routes/trabajadores';
import { rutasClientes } from './routes/clientes';
import { rutasObras } from './routes/obras';
import { rutasFacturas } from './routes/facturas';
import { rutasGastos, rutasProveedores } from './routes/gastos';
import { rutasPresupuestos } from './routes/presupuestos';
import { rutasDocumentosEmpresa, rutasPacks } from './routes/documentosEmpresa';
import { rutasTesoreria } from './routes/tesoreria';
import { rutasSimulador } from './routes/simulador';
import { rutasDashboard } from './routes/dashboard';
import { rutasInformes } from './routes/informes';
import { rutasBackup } from './routes/backup';

export const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // límite amplio para importar backups

// Carpeta donde se guardan los PDFs/fotos de documentos subidos (solo si no
// hay almacenamiento en la nube configurado, ver routes/uploads.ts)
if (usaAlmacenamientoLocal) {
  fs.mkdirSync(carpetaSubidas, { recursive: true });
  app.use('/uploads', express.static(carpetaSubidas));
}

// Rutas públicas
app.use('/api/auth', rutasAuth);

// Rutas protegidas (requieren sesión)
app.use('/api/configuracion', requiereAuth, rutasConfiguracion);
app.use('/api/trabajadores', requiereAuth, rutasTrabajadores);
app.use('/api/clientes', requiereAuth, rutasClientes);
app.use('/api/obras', requiereAuth, rutasObras);
app.use('/api/facturas', requiereAuth, rutasFacturas);
app.use('/api/gastos', requiereAuth, rutasGastos);
app.use('/api/proveedores', requiereAuth, rutasProveedores);
app.use('/api/presupuestos', requiereAuth, rutasPresupuestos);
app.use('/api/documentos-empresa', requiereAuth, rutasDocumentosEmpresa);
app.use('/api/packs', requiereAuth, rutasPacks);
app.use('/api/tesoreria', requiereAuth, rutasTesoreria);
app.use('/api/simulador', requiereAuth, rutasSimulador);
app.use('/api/dashboard', requiereAuth, rutasDashboard);
app.use('/api/informes', requiereAuth, rutasInformes);
app.use('/api/backup', requiereAuth, rutasBackup);
app.use('/api/uploads', requiereAuth, rutasUploads);

// Fuera de Vercel (servidor tradicional) servimos también el frontend compilado.
// En Vercel, el frontend lo sirve directamente la plataforma como sitio estático.
if (!process.env.VERCEL) {
  const dirCliente = path.join(__dirname, '../../client/dist');
  app.use(express.static(dirCliente));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dirCliente, 'index.html'), (err) => {
      if (err) res.status(404).send('Frontend no compilado. Usa "npm run dev" para desarrollo.');
    });
  });
}

// Manejo centralizado de errores
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Restricción de clave foránea: intentan borrar algo que aún tiene datos relacionados
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar: este registro tiene otros datos relacionados (obras, facturas, presupuestos...). Elimina o reasigna esos datos primero.',
      });
    }
    // Registro no encontrado al actualizar/eliminar
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'El registro ya no existe o fue eliminado.' });
    }
    // Valor duplicado en un campo único
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un registro con ese mismo valor (duplicado).' });
    }
  }

  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});
