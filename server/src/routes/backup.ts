// Copia de seguridad: exportar toda la base de datos a JSON y reimportarla.
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const rutasBackup = Router();

// Tablas de datos del negocio, en orden de inserción que respeta las claves
// ajenas. La tabla "usuario" se excluye a propósito: contiene los hashes de
// las contraseñas (no debe salir en un archivo descargable) y no debe borrarse
// al restaurar, para no dejar a los socios sin acceso.
const TABLAS = [
  'configuracion', 'trabajador', 'documentoTrabajador',
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
  if (!datos || typeof datos !== 'object') {
    return res.status(400).json({ error: 'Archivo de copia de seguridad no válido' });
  }
  try {
    // Todo dentro de una única transacción: si algo falla a mitad, NO se borra
    // nada y los datos actuales quedan intactos (no se puede perder la base
    // de datos por un archivo corrupto).
    await prisma.$transaction(async (tx) => {
      for (const tabla of [...TABLAS].reverse()) {
        await (tx as any)[tabla].deleteMany();
      }
      for (const tabla of TABLAS) {
        const filas = datos[tabla] || [];
        for (const fila of filas) {
          await (tx as any)[tabla].create({ data: fila });
        }
      }
    }, { timeout: 120000 });
    res.json({ ok: true, mensaje: 'Copia de seguridad restaurada correctamente' });
  } catch (e: any) {
    res.status(500).json({ error: `No se ha restaurado nada (los datos actuales siguen intactos). Detalle: ${e.message}` });
  }
});
