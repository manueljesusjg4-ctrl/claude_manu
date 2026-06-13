// Presupuestos: generador con margen en tiempo real, histórico y estados.
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const rutasPresupuestos = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Calcula totales y margen de un presupuesto a partir de sus líneas. */
function calcularTotales(lineas: { cantidad: number; precioUnitario: number; costeUnitario: number }[], umbral: number) {
  const total = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);
  const coste = lineas.reduce((s, l) => s + l.cantidad * l.costeUnitario, 0);
  const margen = total - coste;
  const margenPorc = total > 0 ? (margen / total) * 100 : 0;
  return {
    total: r2(total),
    costeEstimado: r2(coste),
    margen: r2(margen),
    margenPorc: r2(margenPorc),
    avisoMargenBajo: margenPorc < umbral,
  };
}

rutasPresupuestos.get('/', async (_req, res) => {
  const config = await prisma.configuracion.findFirstOrThrow();
  const presupuestos = await prisma.presupuesto.findMany({
    include: { cliente: true, lineas: true },
    orderBy: { fecha: 'desc' },
  });
  res.json(presupuestos.map((p) => ({ ...p, ...calcularTotales(p.lineas, config.umbralMargenAviso) })));
});

rutasPresupuestos.get('/:id', async (req, res) => {
  const config = await prisma.configuracion.findFirstOrThrow();
  const p = await prisma.presupuesto.findUnique({
    where: { id: Number(req.params.id) },
    include: { cliente: true, lineas: true },
  });
  if (!p) return res.status(404).json({ error: 'Presupuesto no encontrado' });
  res.json({ ...p, ...calcularTotales(p.lineas, config.umbralMargenAviso) });
});

rutasPresupuestos.post('/', async (req, res) => {
  const d = req.body;
  // Numeración automática: P-AAAA-NNN
  const anio = new Date(d.fecha).getFullYear();
  const cuantos = await prisma.presupuesto.count();
  const numero = d.numero || `P-${anio}-${String(cuantos + 1).padStart(3, '0')}`;

  const p = await prisma.presupuesto.create({
    data: {
      numero,
      clienteId: Number(d.clienteId),
      fecha: new Date(d.fecha),
      tipo: d.tipo,
      estado: d.estado || 'BORRADOR',
      condiciones: d.condiciones || null,
      notas: d.notas || null,
      lineas: {
        create: (d.lineas || []).map((l: any) => ({
          descripcion: l.descripcion,
          categoria: l.categoria || null,
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precioUnitario),
          costeUnitario: Number(l.costeUnitario || 0),
        })),
      },
    },
    include: { cliente: true, lineas: true },
  });
  res.status(201).json(p);
});

rutasPresupuestos.put('/:id', async (req, res) => {
  const d = req.body;
  const id = Number(req.params.id);
  // Reemplazar líneas completas (más simple y seguro para el editor)
  await prisma.lineaPresupuesto.deleteMany({ where: { presupuestoId: id } });
  const p = await prisma.presupuesto.update({
    where: { id },
    data: {
      clienteId: Number(d.clienteId),
      fecha: new Date(d.fecha),
      tipo: d.tipo,
      estado: d.estado,
      condiciones: d.condiciones || null,
      notas: d.notas || null,
      lineas: {
        create: (d.lineas || []).map((l: any) => ({
          descripcion: l.descripcion,
          categoria: l.categoria || null,
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precioUnitario),
          costeUnitario: Number(l.costeUnitario || 0),
        })),
      },
    },
    include: { cliente: true, lineas: true },
  });
  res.json(p);
});

// Cambiar estado (enviado / aceptado / rechazado) — enlazado al CRM
rutasPresupuestos.patch('/:id/estado', async (req, res) => {
  const p = await prisma.presupuesto.update({
    where: { id: Number(req.params.id) },
    data: { estado: req.body.estado },
  });
  res.json(p);
});

rutasPresupuestos.delete('/:id', async (req, res) => {
  await prisma.presupuesto.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
