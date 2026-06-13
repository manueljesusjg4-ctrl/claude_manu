// CRM: clientes/leads, pipeline, interacciones, seguimientos y métricas.
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const rutasClientes = Router();

rutasClientes.get('/', async (_req, res) => {
  const clientes = await prisma.cliente.findMany({
    include: {
      seguimientos: { where: { completado: false }, orderBy: { fechaPrevista: 'asc' } },
      _count: { select: { interacciones: true, obras: true, facturas: true } },
    },
    orderBy: { nombre: 'asc' },
  });
  res.json(clientes);
});

// Métricas del CRM: conversión, leads por origen, valor del pipeline
rutasClientes.get('/metricas', async (_req, res) => {
  const clientes = await prisma.cliente.findMany();
  const porEstado: Record<string, number> = {};
  const porOrigen: Record<string, number> = {};
  let valorPipeline = 0;
  for (const c of clientes) {
    porEstado[c.estadoPipeline] = (porEstado[c.estadoPipeline] || 0) + 1;
    const origen = c.origen || 'Sin origen';
    porOrigen[origen] = (porOrigen[origen] || 0) + 1;
    // El pipeline "vivo" excluye ganados y perdidos
    if (!['GANADO', 'PERDIDO'].includes(c.estadoPipeline)) valorPipeline += c.valorEstimado;
  }
  const cerrados = (porEstado['GANADO'] || 0) + (porEstado['PERDIDO'] || 0);
  const tasaConversion = cerrados > 0 ? Math.round(((porEstado['GANADO'] || 0) / cerrados) * 1000) / 10 : 0;
  res.json({ porEstado, porOrigen, valorPipeline, tasaConversion, totalClientes: clientes.length });
});

rutasClientes.get('/:id', async (req, res) => {
  const c = await prisma.cliente.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      interacciones: { orderBy: { fecha: 'desc' } },
      seguimientos: { orderBy: { fechaPrevista: 'asc' } },
      obras: { include: { partes: { include: { trabajador: true }, orderBy: { fecha: 'desc' } } } },
      facturas: { orderBy: { fechaEmision: 'desc' } },
      anticipos: true,
      presupuestos: { orderBy: { fecha: 'desc' } },
      packs: { include: { items: { include: { documento: true } } }, orderBy: { fecha: 'desc' } },
    },
  });
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(c);
});

rutasClientes.post('/', async (req, res) => {
  const d = req.body;
  const config = await prisma.configuracion.findFirstOrThrow();
  const c = await prisma.cliente.create({
    data: {
      nombre: d.nombre,
      cif: d.cif || null,
      tipo: d.tipo,
      personaContacto: d.personaContacto || null,
      telefono: d.telefono || null,
      email: d.email || null,
      origen: d.origen || null,
      plazoPagoDias: d.plazoPagoDias != null ? Number(d.plazoPagoDias) : config.plazoCobroDefecto,
      estadoPipeline: d.estadoPipeline || 'FRIO',
      valorEstimado: Number(d.valorEstimado || 0),
      notas: d.notas || null,
    },
  });
  res.status(201).json(c);
});

rutasClientes.put('/:id', async (req, res) => {
  const d = req.body;
  const c = await prisma.cliente.update({
    where: { id: Number(req.params.id) },
    data: {
      nombre: d.nombre,
      cif: d.cif || null,
      tipo: d.tipo,
      personaContacto: d.personaContacto || null,
      telefono: d.telefono || null,
      email: d.email || null,
      origen: d.origen || null,
      plazoPagoDias: Number(d.plazoPagoDias),
      estadoPipeline: d.estadoPipeline,
      valorEstimado: Number(d.valorEstimado || 0),
      solvenciaConsultada: Boolean(d.solvenciaConsultada),
      solvenciaResultado: d.solvenciaResultado || null,
      solvenciaFecha: d.solvenciaFecha ? new Date(d.solvenciaFecha) : null,
      notas: d.notas || null,
    },
  });
  res.json(c);
});

// Mover en el pipeline (para la vista Kanban con arrastre)
rutasClientes.patch('/:id/pipeline', async (req, res) => {
  const c = await prisma.cliente.update({
    where: { id: Number(req.params.id) },
    data: { estadoPipeline: req.body.estadoPipeline },
  });
  res.json(c);
});

rutasClientes.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const c = await prisma.cliente.findUnique({
    where: { id },
    include: { _count: { select: { obras: true, facturas: true, presupuestos: true, anticipos: true, packs: true } } },
  });
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });

  const bloqueos: string[] = [];
  if (c._count.obras > 0) bloqueos.push(`${c._count.obras} obra(s)`);
  if (c._count.facturas > 0) bloqueos.push(`${c._count.facturas} factura(s)`);
  if (c._count.presupuestos > 0) bloqueos.push(`${c._count.presupuestos} presupuesto(s)`);
  if (c._count.anticipos > 0) bloqueos.push(`${c._count.anticipos} anticipo(s)`);
  if (c._count.packs > 0) bloqueos.push(`${c._count.packs} pack(s) documental(es)`);

  if (bloqueos.length > 0) {
    return res.status(409).json({
      error: `No se puede eliminar "${c.nombre}": tiene ${bloqueos.join(', ')} asociado(s). Elimina o reasigna primero esos datos a otro cliente.`,
    });
  }

  await prisma.cliente.delete({ where: { id } });
  res.json({ ok: true });
});

// ---- Interacciones -----------------------------------------------------------
rutasClientes.post('/:id/interacciones', async (req, res) => {
  const d = req.body;
  const i = await prisma.interaccion.create({
    data: {
      clienteId: Number(req.params.id),
      fecha: new Date(d.fecha),
      tipo: d.tipo,
      resumen: d.resumen,
      resultado: d.resultado || null,
    },
  });
  res.status(201).json(i);
});

rutasClientes.delete('/interacciones/:iid', async (req, res) => {
  await prisma.interaccion.delete({ where: { id: Number(req.params.iid) } });
  res.json({ ok: true });
});

// ---- Seguimientos (próximas acciones, aparecen en el dashboard) ---------------
rutasClientes.post('/:id/seguimientos', async (req, res) => {
  const d = req.body;
  const s = await prisma.seguimiento.create({
    data: {
      clienteId: Number(req.params.id),
      fechaPrevista: new Date(d.fechaPrevista),
      descripcion: d.descripcion,
    },
  });
  res.status(201).json(s);
});

rutasClientes.patch('/seguimientos/:sid', async (req, res) => {
  const s = await prisma.seguimiento.update({
    where: { id: Number(req.params.sid) },
    data: { completado: Boolean(req.body.completado) },
  });
  res.json(s);
});

rutasClientes.delete('/seguimientos/:sid', async (req, res) => {
  await prisma.seguimiento.delete({ where: { id: Number(req.params.sid) } });
  res.json({ ok: true });
});
