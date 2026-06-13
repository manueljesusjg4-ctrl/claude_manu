// Copia de seguridad: exportar toda la base de datos a JSON y reimportarla.
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const rutasBackup = Router();

// Orden de inserción que respeta las claves ajenas
const TABLAS = [
  'usuario', 'configuracion', 'trabajador', 'documentoTrabajador',
  'cliente', 'interaccion', 'seguimiento', 'obra', 'asignacion', 'parteHoras',
  'factura', 'anticipo', 'proveedor', 'gasto', 'tarifaCategoria',
  'presupuesto', 'lineaPresupuesto', 'documentoEmpresa', 'envioPack',
  'envioPackItem', 'escenario',
] as const;

rutasBackup.get('/exportar', async (_req, res) => {
  const datos: Record<string, unknown[]> = {};
  for (const tabla of TABLAS) {
    datos[tabla] = await (prisma as any)[tabla].findMany();
  }
  res.setHeader('Content-Disposition', `attachment; filename="backup-gestion-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ version: 1, fecha: new Date().toISOString(), datos });
});

rutasBackup.post('/importar', async (req, res) => {
  const { datos } = req.body || {};
  if (!datos) return res.status(400).json({ error: 'Archivo de backup no válido' });
  try {
    // Vaciar en orden inverso y reinsertar en orden directo
    for (const tabla of [...TABLAS].reverse()) {
      await (prisma as any)[tabla].deleteMany();
    }
    for (const tabla of TABLAS) {
      const filas = datos[tabla] || [];
      for (const fila of filas) {
        await (prisma as any)[tabla].create({ data: fila });
      }
    }
    res.json({ ok: true, mensaje: 'Copia de seguridad restaurada correctamente' });
  } catch (e: any) {
    res.status(500).json({ error: `Error al restaurar: ${e.message}` });
  }
});
