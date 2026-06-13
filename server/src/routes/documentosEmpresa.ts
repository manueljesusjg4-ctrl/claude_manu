// Documentación de empresa (REA, RC, SPA, certificados...) y packs documentales.
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const rutasDocumentosEmpresa = Router();

rutasDocumentosEmpresa.get('/', async (_req, res) => {
  const docs = await prisma.documentoEmpresa.findMany({ orderBy: { tipo: 'asc' } });
  const hoy = new Date();
  const en30 = new Date(hoy.getTime() + 30 * 86400000);
  res.json(
    docs.map((d) => ({
      ...d,
      estadoCaducidad: !d.fechaCaducidad
        ? 'SIN_CADUCIDAD'
        : d.fechaCaducidad < hoy
          ? 'CADUCADO'
          : d.fechaCaducidad <= en30
            ? 'POR_CADUCAR'
            : 'VIGENTE',
    }))
  );
});

rutasDocumentosEmpresa.post('/', async (req, res) => {
  const d = req.body;
  const doc = await prisma.documentoEmpresa.create({
    data: {
      tipo: d.tipo,
      nombre: d.nombre,
      fechaEmision: d.fechaEmision ? new Date(d.fechaEmision) : null,
      fechaCaducidad: d.fechaCaducidad ? new Date(d.fechaCaducidad) : null,
      archivoUrl: d.archivoUrl || null,
      notas: d.notas || null,
    },
  });
  res.status(201).json(doc);
});

rutasDocumentosEmpresa.put('/:id', async (req, res) => {
  const d = req.body;
  const doc = await prisma.documentoEmpresa.update({
    where: { id: Number(req.params.id) },
    data: {
      tipo: d.tipo,
      nombre: d.nombre,
      fechaEmision: d.fechaEmision ? new Date(d.fechaEmision) : null,
      fechaCaducidad: d.fechaCaducidad ? new Date(d.fechaCaducidad) : null,
      archivoUrl: d.archivoUrl || null,
      notas: d.notas || null,
    },
  });
  res.json(doc);
});

rutasDocumentosEmpresa.delete('/:id', async (req, res) => {
  await prisma.documentoEmpresa.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

// ---- Packs documentales para clientes -------------------------------------------
// Las constructoras piden CIF, REA, RC, SPA, certificados... antes de contratar.
// Aquí se registra qué se envió, a quién y cuándo.
export const rutasPacks = Router();

rutasPacks.get('/', async (_req, res) => {
  const packs = await prisma.envioPack.findMany({
    include: { cliente: true, items: { include: { documento: true } } },
    orderBy: { fecha: 'desc' },
  });
  res.json(packs);
});

rutasPacks.post('/', async (req, res) => {
  const d = req.body;
  const pack = await prisma.envioPack.create({
    data: {
      clienteId: Number(d.clienteId),
      fecha: new Date(d.fecha || Date.now()),
      notas: d.notas || null,
      items: { create: (d.documentoIds || []).map((id: number) => ({ documentoId: Number(id) })) },
    },
    include: { cliente: true, items: { include: { documento: true } } },
  });
  res.status(201).json(pack);
});

rutasPacks.delete('/:id', async (req, res) => {
  await prisma.envioPack.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
