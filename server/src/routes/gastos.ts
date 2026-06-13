// Gastos de empresa (fijos y variables) y proveedores.
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const rutasGastos = Router();

rutasGastos.get('/', async (_req, res) => {
  const gastos = await prisma.gasto.findMany({
    include: { proveedor: true, obra: true },
    orderBy: { fecha: 'desc' },
  });
  res.json(gastos);
});

rutasGastos.post('/', async (req, res) => {
  const d = req.body;
  const g = await prisma.gasto.create({
    data: {
      concepto: d.concepto,
      categoria: d.categoria,
      importe: Number(d.importe),
      esRecurrente: Boolean(d.esRecurrente),
      fecha: new Date(d.fecha),
      pagado: Boolean(d.pagado),
      proveedorId: d.proveedorId ? Number(d.proveedorId) : null,
      obraId: d.obraId ? Number(d.obraId) : null,
      notas: d.notas || null,
    },
  });
  res.status(201).json(g);
});

rutasGastos.put('/:id', async (req, res) => {
  const d = req.body;
  const g = await prisma.gasto.update({
    where: { id: Number(req.params.id) },
    data: {
      concepto: d.concepto,
      categoria: d.categoria,
      importe: Number(d.importe),
      esRecurrente: Boolean(d.esRecurrente),
      fecha: new Date(d.fecha),
      pagado: Boolean(d.pagado),
      proveedorId: d.proveedorId ? Number(d.proveedorId) : null,
      obraId: d.obraId ? Number(d.obraId) : null,
      notas: d.notas || null,
    },
  });
  res.json(g);
});

rutasGastos.delete('/:id', async (req, res) => {
  await prisma.gasto.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

// ---- Proveedores ---------------------------------------------------------------
export const rutasProveedores = Router();

rutasProveedores.get('/', async (_req, res) => {
  const proveedores = await prisma.proveedor.findMany({
    include: { _count: { select: { gastos: true } } },
    orderBy: { nombre: 'asc' },
  });
  res.json(proveedores);
});

rutasProveedores.post('/', async (req, res) => {
  const d = req.body;
  const p = await prisma.proveedor.create({
    data: {
      nombre: d.nombre,
      cif: d.cif || null,
      contacto: d.contacto || null,
      telefono: d.telefono || null,
      email: d.email || null,
      plazoPagoDias: Number(d.plazoPagoDias || 30),
      notas: d.notas || null,
    },
  });
  res.status(201).json(p);
});

rutasProveedores.put('/:id', async (req, res) => {
  const d = req.body;
  const p = await prisma.proveedor.update({
    where: { id: Number(req.params.id) },
    data: {
      nombre: d.nombre,
      cif: d.cif || null,
      contacto: d.contacto || null,
      telefono: d.telefono || null,
      email: d.email || null,
      plazoPagoDias: Number(d.plazoPagoDias || 30),
      notas: d.notas || null,
    },
  });
  res.json(p);
});

rutasProveedores.delete('/:id', async (req, res) => {
  await prisma.proveedor.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
