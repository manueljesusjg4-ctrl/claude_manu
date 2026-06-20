// Facturas/certificaciones, confirming y anticipos de cliente.
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sumarDias } from '../lib/fechas';

export const rutasFacturas = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Añade campos calculados: total con IVA, estado efectivo (vencida), importe a cobrar. */
function decorar(f: any) {
  const total = r2(f.baseImponible * (1 + f.porcentajeIva / 100));
  const aCobrar = r2(total - f.anticipoAplicado);
  const hoy = new Date();
  const estadoEfectivo =
    f.estado === 'COBRADA' ? 'COBRADA' : f.fechaCobroEsperada < hoy ? 'VENCIDA' : 'PENDIENTE';
  return { ...f, total, aCobrar, estadoEfectivo };
}

rutasFacturas.get('/', async (_req, res) => {
  const facturas = await prisma.factura.findMany({
    include: { cliente: true, obra: true },
    orderBy: { fechaEmision: 'desc' },
  });
  res.json(facturas.map(decorar));
});

rutasFacturas.post('/', async (req, res) => {
  const d = req.body;
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: Number(d.clienteId) } });
  const plazo = d.plazoDias != null ? Number(d.plazoDias) : cliente.plazoPagoDias;
  const fechaEmision = new Date(d.fechaEmision);

  // Aplicar automáticamente anticipos de cliente pendientes de descontar
  let anticipoAplicado = 0;
  if (d.aplicarAnticipos !== false) {
    const totalFactura = Number(d.baseImponible) * (1 + Number(d.porcentajeIva) / 100);
    const anticipos = await prisma.anticipo.findMany({
      where: {
        clienteId: cliente.id,
        ...(d.obraId ? { OR: [{ obraId: Number(d.obraId) }, { obraId: null }] } : {}),
      },
      orderBy: { fecha: 'asc' },
    });
    let restante = totalFactura;
    for (const a of anticipos) {
      const disponible = a.importe - a.importeAplicado;
      if (disponible <= 0 || restante <= 0) continue;
      const aplicar = Math.min(disponible, restante);
      anticipoAplicado += aplicar;
      restante -= aplicar;
      await prisma.anticipo.update({
        where: { id: a.id },
        data: { importeAplicado: r2(a.importeAplicado + aplicar) },
      });
    }
  }

  const f = await prisma.factura.create({
    data: {
      numero: d.numero,
      clienteId: cliente.id,
      obraId: d.obraId ? Number(d.obraId) : null,
      concepto: d.concepto,
      fechaEmision,
      baseImponible: Number(d.baseImponible),
      porcentajeIva: Number(d.porcentajeIva),
      plazoDias: plazo,
      fechaCobroEsperada: d.fechaCobroEsperada ? new Date(d.fechaCobroEsperada) : sumarDias(fechaEmision, plazo),
      anticipoAplicado: r2(anticipoAplicado),
    },
  });
  res.status(201).json(decorar(f));
});

rutasFacturas.put('/:id', async (req, res) => {
  const d = req.body;
  const f = await prisma.factura.update({
    where: { id: Number(req.params.id) },
    data: {
      numero: d.numero,
      concepto: d.concepto,
      fechaEmision: new Date(d.fechaEmision),
      baseImponible: Number(d.baseImponible),
      porcentajeIva: Number(d.porcentajeIva),
      plazoDias: Number(d.plazoDias),
      fechaCobroEsperada: new Date(d.fechaCobroEsperada),
    },
  });
  res.json(decorar(f));
});

// Marcar como cobrada / pendiente
rutasFacturas.patch('/:id/cobro', async (req, res) => {
  const cobrada = Boolean(req.body.cobrada);
  const f = await prisma.factura.update({
    where: { id: Number(req.params.id) },
    data: {
      estado: cobrada ? 'COBRADA' : 'PENDIENTE',
      fechaCobroReal: cobrada ? new Date(req.body.fechaCobroReal || Date.now()) : null,
    },
  });
  res.json(decorar(f));
});

// Marcar como anticipada vía confirming/banco
rutasFacturas.patch('/:id/confirming', async (req, res) => {
  const d = req.body;
  const f = await prisma.factura.update({
    where: { id: Number(req.params.id) },
    data: {
      anticipadaConfirming: Boolean(d.anticipadaConfirming),
      costeFinanciero: Number(d.costeFinanciero || 0),
      fechaAnticipo: d.fechaAnticipo ? new Date(d.fechaAnticipo) : null,
    },
  });
  res.json(decorar(f));
});

rutasFacturas.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const f = await prisma.factura.findUnique({ where: { id } });
  if (!f) return res.status(404).json({ error: 'Factura no encontrada' });

  await prisma.$transaction(async (tx) => {
    // Si la factura tenía anticipos descontados, los devolvemos como pendientes de aplicar
    if (f.anticipoAplicado > 0) {
      const anticipos = await tx.anticipo.findMany({
        where: {
          clienteId: f.clienteId,
          ...(f.obraId ? { OR: [{ obraId: f.obraId }, { obraId: null }] } : {}),
        },
        orderBy: { fecha: 'desc' },
      });
      let restante = f.anticipoAplicado;
      for (const a of anticipos) {
        if (restante <= 0) break;
        if (a.importeAplicado <= 0) continue;
        const devolver = Math.min(a.importeAplicado, restante);
        await tx.anticipo.update({ where: { id: a.id }, data: { importeAplicado: r2(a.importeAplicado - devolver) } });
        restante -= devolver;
      }
    }
    await tx.factura.delete({ where: { id } });
  });

  res.json({ ok: true });
});

// ---- Anticipos de cliente ------------------------------------------------------
rutasFacturas.get('/anticipos', async (_req, res) => {
  const anticipos = await prisma.anticipo.findMany({
    include: { cliente: true, obra: true },
    orderBy: { fecha: 'desc' },
  });
  res.json(anticipos);
});

rutasFacturas.post('/anticipos', async (req, res) => {
  const d = req.body;
  const a = await prisma.anticipo.create({
    data: {
      clienteId: Number(d.clienteId),
      obraId: d.obraId ? Number(d.obraId) : null,
      fecha: new Date(d.fecha),
      importe: Number(d.importe),
      notas: d.notas || null,
    },
  });
  res.status(201).json(a);
});

rutasFacturas.put('/anticipos/:aid', async (req, res) => {
  const d = req.body;
  const a = await prisma.anticipo.update({
    where: { id: Number(req.params.aid) },
    data: {
      clienteId: Number(d.clienteId),
      obraId: d.obraId ? Number(d.obraId) : null,
      fecha: new Date(d.fecha),
      importe: Number(d.importe),
      notas: d.notas || null,
    },
  });
  res.json(a);
});

rutasFacturas.delete('/anticipos/:aid', async (req, res) => {
  await prisma.anticipo.delete({ where: { id: Number(req.params.aid) } });
  res.json({ ok: true });
});
