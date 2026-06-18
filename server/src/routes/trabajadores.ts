// Trabajadores: CRUD, documentación con caducidades y cálculo de coste/hora.
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { calcularCosteTrabajador, calcularOverhead } from '../lib/costes';

export const rutasTrabajadores = Router();

/** Suma de gastos fijos mensuales de estructura (para el overhead). */
async function gastosEstructuraMes(): Promise<number> {
  const gastos = await prisma.gasto.findMany({
    where: { categoria: 'ESTRUCTURA', esRecurrente: true },
  });
  return gastos.reduce((s, g) => s + g.importe, 0);
}

// Listado con coste calculado y estado de documentación
rutasTrabajadores.get('/', async (_req, res) => {
  const config = await prisma.configuracion.findFirstOrThrow();
  const trabajadores = await prisma.trabajador.findMany({
    include: {
      documentos: true,
      asignaciones: { where: { fechaFin: null }, include: { obra: true } },
      llamamientos: { orderBy: { fechaInicio: 'desc' }, take: 1 },
    },
    orderBy: { apellidos: 'asc' },
  });
  const activos = trabajadores.filter((t) => t.estado === 'ACTIVO').length;
  const estructura = await gastosEstructuraMes();
  const overhead = calcularOverhead(estructura, activos, config);

  const hoy = new Date();
  const en30dias = new Date(hoy.getTime() + 30 * 86400000);

  res.json(
    trabajadores.map((t) => {
      const coste = calcularCosteTrabajador(t.costeEmpresaMensual, config);
      const docsCaducados = t.documentos.filter((d) => d.fechaCaducidad && d.fechaCaducidad < hoy);
      const docsPorCaducar = t.documentos.filter(
        (d) => d.fechaCaducidad && d.fechaCaducidad >= hoy && d.fechaCaducidad <= en30dias
      );
      const obraActual = t.asignaciones[0]?.obra ?? null;
      // Estado de llamamiento (solo relevante para fijos discontinuos): si el
      // último llamamiento no tiene fecha de fin, está actualmente llamado/activo.
      const ultimoLlamamiento = t.llamamientos[0] ?? null;
      const estadoLlamamiento =
        t.tipoContrato !== 'FIJO_DISCONTINUO'
          ? null
          : ultimoLlamamiento && !ultimoLlamamiento.fechaFin
          ? 'LLAMADO'
          : 'EN_ESPERA';
      return {
        ...t,
        coste,
        costeHoraCargadoMensual: Math.round((coste.costeHoraMensual + overhead.overheadPorHoraMensual) * 100) / 100,
        costeHoraCargadoAnualizado: Math.round((coste.costeHoraAnualizado + overhead.overheadPorHoraAnualizado) * 100) / 100,
        docsCaducados: docsCaducados.length,
        docsPorCaducar: docsPorCaducar.length,
        obraActual: obraActual ? { id: obraActual.id, nombre: obraActual.nombre } : null,
        estadoLlamamiento,
      };
    })
  );
});

// Detalle con desglose completo del coste (con y sin estructura)
rutasTrabajadores.get('/:id', async (req, res) => {
  const config = await prisma.configuracion.findFirstOrThrow();
  const t = await prisma.trabajador.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      documentos: { orderBy: { tipo: 'asc' } },
      asignaciones: { include: { obra: true }, orderBy: { fechaInicio: 'desc' } },
      partes: { orderBy: { fecha: 'desc' }, take: 50, include: { obra: true } },
      entregasEpi: { orderBy: { fecha: 'desc' } },
      llamamientos: { orderBy: { fechaInicio: 'desc' } },
    },
  });
  if (!t) return res.status(404).json({ error: 'Trabajador no encontrado' });

  const activos = await prisma.trabajador.count({ where: { estado: 'ACTIVO' } });
  const estructura = await gastosEstructuraMes();
  const overhead = calcularOverhead(estructura, activos, config);
  const coste = calcularCosteTrabajador(t.costeEmpresaMensual, config);

  res.json({
    ...t,
    coste,
    overhead,
    costeHoraCargadoMensual: Math.round((coste.costeHoraMensual + overhead.overheadPorHoraMensual) * 100) / 100,
    costeHoraCargadoAnualizado: Math.round((coste.costeHoraAnualizado + overhead.overheadPorHoraAnualizado) * 100) / 100,
  });
});

rutasTrabajadores.post('/', async (req, res) => {
  const d = req.body;
  const t = await prisma.trabajador.create({
    data: {
      nombre: d.nombre,
      apellidos: d.apellidos,
      dni: d.dni,
      categoria: d.categoria,
      especialidad: d.especialidad || null,
      telefono: d.telefono || null,
      fechaAlta: new Date(d.fechaAlta),
      tipoContrato: d.tipoContrato || 'INDEFINIDO',
      costeEmpresaMensual: Number(d.costeEmpresaMensual),
      estado: d.estado || 'ACTIVO',
      notas: d.notas || null,
    },
  });
  res.status(201).json(t);
});

rutasTrabajadores.put('/:id', async (req, res) => {
  const d = req.body;
  const t = await prisma.trabajador.update({
    where: { id: Number(req.params.id) },
    data: {
      nombre: d.nombre,
      apellidos: d.apellidos,
      dni: d.dni,
      categoria: d.categoria,
      especialidad: d.especialidad || null,
      telefono: d.telefono || null,
      fechaAlta: new Date(d.fechaAlta),
      tipoContrato: d.tipoContrato,
      costeEmpresaMensual: Number(d.costeEmpresaMensual),
      estado: d.estado,
      notas: d.notas || null,
    },
  });
  res.json(t);
});

rutasTrabajadores.delete('/:id', async (req, res) => {
  await prisma.trabajador.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

// ---- Documentos del trabajador ---------------------------------------------
rutasTrabajadores.post('/:id/documentos', async (req, res) => {
  const d = req.body;
  const doc = await prisma.documentoTrabajador.create({
    data: {
      trabajadorId: Number(req.params.id),
      tipo: d.tipo,
      nombre: d.nombre,
      fechaEmision: d.fechaEmision ? new Date(d.fechaEmision) : null,
      fechaCaducidad: d.fechaCaducidad ? new Date(d.fechaCaducidad) : null,
      archivoUrl: d.archivoUrl || null,
    },
  });
  res.status(201).json(doc);
});

rutasTrabajadores.put('/documentos/:docId', async (req, res) => {
  const d = req.body;
  const doc = await prisma.documentoTrabajador.update({
    where: { id: Number(req.params.docId) },
    data: {
      tipo: d.tipo,
      nombre: d.nombre,
      fechaEmision: d.fechaEmision ? new Date(d.fechaEmision) : null,
      fechaCaducidad: d.fechaCaducidad ? new Date(d.fechaCaducidad) : null,
      archivoUrl: d.archivoUrl || null,
    },
  });
  res.json(doc);
});

rutasTrabajadores.delete('/documentos/:docId', async (req, res) => {
  await prisma.documentoTrabajador.delete({ where: { id: Number(req.params.docId) } });
  res.json({ ok: true });
});

// ---- Entrega de EPIs / PRL con firma (control legal) -----------------------
rutasTrabajadores.post('/:id/epis', async (req, res) => {
  const d = req.body;
  const e = await prisma.entregaEpi.create({
    data: {
      trabajadorId: Number(req.params.id),
      fecha: new Date(d.fecha),
      items: d.items,
      riesgosLeidos: Boolean(d.riesgosLeidos),
      firmaUrl: d.firmaUrl || null,
      notas: d.notas || null,
    },
  });
  res.status(201).json(e);
});

rutasTrabajadores.delete('/epis/:eid', async (req, res) => {
  await prisma.entregaEpi.delete({ where: { id: Number(req.params.eid) } });
  res.json({ ok: true });
});

// ---- Llamamientos (fijos discontinuos) --------------------------------------
rutasTrabajadores.post('/:id/llamamientos', async (req, res) => {
  const d = req.body;
  const l = await prisma.llamamiento.create({
    data: {
      trabajadorId: Number(req.params.id),
      fechaInicio: new Date(d.fechaInicio),
      fechaFin: d.fechaFin ? new Date(d.fechaFin) : null,
      motivo: d.motivo || null,
      notas: d.notas || null,
    },
  });
  res.status(201).json(l);
});

rutasTrabajadores.put('/llamamientos/:lid', async (req, res) => {
  const d = req.body;
  const l = await prisma.llamamiento.update({
    where: { id: Number(req.params.lid) },
    data: {
      fechaFin: d.fechaFin ? new Date(d.fechaFin) : null,
      motivo: d.motivo || null,
      notas: d.notas || null,
    },
  });
  res.json(l);
});

rutasTrabajadores.delete('/llamamientos/:lid', async (req, res) => {
  await prisma.llamamiento.delete({ where: { id: Number(req.params.lid) } });
  res.json({ ok: true });
});
