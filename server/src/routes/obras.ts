// Obras: CRUD, asignación de equipo, partes de horas y control económico
// (coste real, facturado, margen, horas extra).
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { calcularEconomicoObra } from '../lib/economiaObra';
import { generarPdfPartes } from '../lib/pdf';

export const rutasObras = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;

rutasObras.get('/', async (_req, res) => {
  const obras = await prisma.obra.findMany({
    include: { cliente: true, asignaciones: { where: { fechaFin: null } }, facturas: true },
    orderBy: [{ estado: 'asc' }, { fechaInicio: 'desc' }],
  });
  res.json(
    obras.map((o) => ({
      ...o,
      trabajadoresAsignados: o.asignaciones.length,
      facturado: r2(o.facturas.reduce((s, f) => s + f.baseImponible, 0)),
    }))
  );
});

rutasObras.get('/:id', async (req, res) => {
  const obra = await prisma.obra.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      cliente: true,
      encargado: true,
      asignaciones: { include: { trabajador: true }, orderBy: { fechaInicio: 'desc' } },
      partes: { include: { trabajador: true }, orderBy: { fecha: 'desc' } },
      facturas: { orderBy: { fechaEmision: 'desc' } },
      anticipos: true,
      gastos: true,
      ordenes: { include: { encargado: true }, orderBy: { fecha: 'desc' } },
    },
  });
  if (!obra) return res.status(404).json({ error: 'Obra no encontrada' });
  const economico = await calcularEconomicoObra(obra.id);
  res.json({ ...obra, economico });
});

rutasObras.post('/', async (req, res) => {
  const d = req.body;
  const obra = await prisma.obra.create({
    data: {
      clienteId: Number(d.clienteId),
      nombre: d.nombre,
      direccion: d.direccion || null,
      tipo: d.tipo,
      estado: d.estado || 'PRESUPUESTADA',
      fechaInicio: d.fechaInicio ? new Date(d.fechaInicio) : null,
      fechaFinPrevista: d.fechaFinPrevista ? new Date(d.fechaFinPrevista) : null,
      presupuestoCerrado: d.presupuestoCerrado ? Number(d.presupuestoCerrado) : null,
      plazoCobroDias: d.plazoCobroDias ? Number(d.plazoCobroDias) : null,
      margenPrevisto: d.margenPrevisto ? Number(d.margenPrevisto) : null,
      encargadoId: d.encargadoId ? Number(d.encargadoId) : null,
      notas: d.notas || null,
    },
  });
  res.status(201).json(obra);
});

rutasObras.put('/:id', async (req, res) => {
  const d = req.body;
  const id = Number(req.params.id);

  // Validación: avisar al cerrar una obra sin certificar todo lo trabajado
  if (d.estado === 'FINALIZADA' && !d.confirmarCierre) {
    const eco = await calcularEconomicoObra(id);
    if (eco.pendienteCertificar > 0.01) {
      return res.status(409).json({
        error: `Esta obra tiene ${eco.pendienteCertificar.toFixed(2)} € trabajados pendientes de certificar. ¿Seguro que quieres finalizarla?`,
        requiereConfirmacion: true,
      });
    }
  }

  const obra = await prisma.obra.update({
    where: { id },
    data: {
      clienteId: Number(d.clienteId),
      nombre: d.nombre,
      direccion: d.direccion || null,
      tipo: d.tipo,
      estado: d.estado,
      fechaInicio: d.fechaInicio ? new Date(d.fechaInicio) : null,
      fechaFinPrevista: d.fechaFinPrevista ? new Date(d.fechaFinPrevista) : null,
      presupuestoCerrado: d.presupuestoCerrado ? Number(d.presupuestoCerrado) : null,
      plazoCobroDias: d.plazoCobroDias ? Number(d.plazoCobroDias) : null,
      margenPrevisto: d.margenPrevisto ? Number(d.margenPrevisto) : null,
      encargadoId: d.encargadoId ? Number(d.encargadoId) : null,
      notas: d.notas || null,
    },
  });
  res.json(obra);
});

rutasObras.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const o = await prisma.obra.findUnique({
    where: { id },
    include: { _count: { select: { facturas: true, anticipos: true, gastos: true } } },
  });
  if (!o) return res.status(404).json({ error: 'Obra no encontrada' });

  const bloqueos: string[] = [];
  if (o._count.facturas > 0) bloqueos.push(`${o._count.facturas} factura(s)`);
  if (o._count.anticipos > 0) bloqueos.push(`${o._count.anticipos} anticipo(s)`);
  if (o._count.gastos > 0) bloqueos.push(`${o._count.gastos} gasto(s)`);

  if (bloqueos.length > 0) {
    return res.status(409).json({
      error: `No se puede eliminar "${o.nombre}": tiene ${bloqueos.join(', ')} asociado(s). Elimina o reasigna primero esos datos.`,
    });
  }

  await prisma.obra.delete({ where: { id } });
  res.json({ ok: true });
});

// ---- Asignaciones de equipo ---------------------------------------------------
rutasObras.post('/:id/asignaciones', async (req, res) => {
  const d = req.body;
  const trabajadorId = Number(d.trabajadorId);

  // Validación: documentación obligatoria vigente antes de asignar a obra
  const hoy = new Date();
  const docs = await prisma.documentoTrabajador.findMany({ where: { trabajadorId } });
  const obligatorios = ['ALTA_SS', 'TPC', 'PRL_20H', 'RECONOCIMIENTO_MEDICO'];
  const problemas: string[] = [];
  for (const tipo of obligatorios) {
    const doc = docs.find((x) => x.tipo === tipo);
    if (!doc) problemas.push(`falta ${tipo.replace(/_/g, ' ')}`);
    else if (doc.fechaCaducidad && doc.fechaCaducidad < hoy) problemas.push(`${tipo.replace(/_/g, ' ')} caducado`);
  }
  if (problemas.length > 0 && !d.confirmarSinDocumentacion) {
    return res.status(409).json({
      error: `Documentación incompleta del trabajador: ${problemas.join(', ')}. ¿Asignar de todas formas?`,
      requiereConfirmacion: true,
    });
  }

  const a = await prisma.asignacion.create({
    data: {
      obraId: Number(req.params.id),
      trabajadorId,
      fechaInicio: new Date(d.fechaInicio),
      fechaFin: d.fechaFin ? new Date(d.fechaFin) : null,
      precioVentaHora: Number(d.precioVentaHora),
    },
  });
  res.status(201).json(a);
});

rutasObras.put('/asignaciones/:aid', async (req, res) => {
  const d = req.body;
  const a = await prisma.asignacion.update({
    where: { id: Number(req.params.aid) },
    data: {
      fechaInicio: new Date(d.fechaInicio),
      fechaFin: d.fechaFin ? new Date(d.fechaFin) : null,
      precioVentaHora: Number(d.precioVentaHora),
    },
  });
  res.json(a);
});

rutasObras.delete('/asignaciones/:aid', async (req, res) => {
  await prisma.asignacion.delete({ where: { id: Number(req.params.aid) } });
  res.json({ ok: true });
});

// ---- Partes de horas ------------------------------------------------------------
rutasObras.post('/:id/partes', async (req, res) => {
  const d = req.body;
  const p = await prisma.parteHoras.create({
    data: {
      obraId: Number(req.params.id),
      trabajadorId: Number(d.trabajadorId),
      fecha: new Date(d.fecha),
      horas: Number(d.horas),
      notas: d.notas || null,
    },
  });
  res.status(201).json(p);
});

rutasObras.put('/partes/:pid', async (req, res) => {
  const d = req.body;
  const p = await prisma.parteHoras.update({
    where: { id: Number(req.params.pid) },
    data: {
      trabajadorId: Number(d.trabajadorId),
      fecha: new Date(d.fecha),
      horas: Number(d.horas),
      notas: d.notas || null,
    },
  });
  res.json(p);
});

rutasObras.delete('/partes/:pid', async (req, res) => {
  await prisma.parteHoras.delete({ where: { id: Number(req.params.pid) } });
  res.json({ ok: true });
});

// Validación del parte por el encargado de la obra: prueba documental de que
// las horas reflejan las directrices dadas en obra (trazabilidad/antisanciones).
rutasObras.patch('/partes/:pid/validar', async (req, res) => {
  const validado = Boolean(req.body.validado);
  const p = await prisma.parteHoras.update({
    where: { id: Number(req.params.pid) },
    data: {
      validado,
      validadoEn: validado ? new Date() : null,
      validadoNota: validado ? req.body.nota || null : null,
    },
  });
  res.json(p);
});

// PDF formal de partes de horas de una obra (para adjuntar a facturas)
rutasObras.get('/:id/partes/pdf', async (req, res) => {
  const obra = await prisma.obra.findUnique({
    where: { id: Number(req.params.id) },
    include: { cliente: true },
  });
  if (!obra) return res.status(404).json({ error: 'Obra no encontrada' });

  const desde = req.query.desde ? new Date(String(req.query.desde)) : null;
  const hasta = req.query.hasta ? new Date(String(req.query.hasta)) : null;
  const partes = await prisma.parteHoras.findMany({
    where: {
      obraId: obra.id,
      ...(desde || hasta
        ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
        : {}),
    },
    include: { trabajador: true },
    orderBy: [{ fecha: 'asc' }, { trabajadorId: 'asc' }],
  });

  const buffer = await generarPdfPartes(obra, partes);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="partes-${obra.nombre.replace(/\s+/g, '_')}.pdf"`);
  res.send(buffer);
});

// ---- Registro de órdenes/directrices (antisanciones) ----------------------------
rutasObras.post('/:id/ordenes', async (req, res) => {
  const d = req.body;
  const o = await prisma.ordenTrabajo.create({
    data: {
      obraId: Number(req.params.id),
      fecha: new Date(d.fecha),
      encargadoId: d.encargadoId ? Number(d.encargadoId) : null,
      directriz: d.directriz,
    },
  });
  res.status(201).json(o);
});

rutasObras.delete('/ordenes/:oid', async (req, res) => {
  await prisma.ordenTrabajo.delete({ where: { id: Number(req.params.oid) } });
  res.json({ ok: true });
});
