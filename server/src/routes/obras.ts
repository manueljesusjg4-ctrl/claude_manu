// Obras: CRUD, asignación de equipo, partes de horas y control económico
// (coste real, facturado, margen, horas extra).
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { calcularCosteTrabajador } from '../lib/costes';
import { clasificarHorasExtra } from '../lib/horas';
import { generarPdfPartes } from '../lib/pdf';

export const rutasObras = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Control económico de una obra. Las horas extra se detectan a nivel de
 * trabajador y semana (sumando TODAS sus obras) y luego se imputan a los
 * partes correspondientes de esta obra.
 */
async function calcularEconomico(obraId: number) {
  const config = await prisma.configuracion.findFirstOrThrow();
  const obra = await prisma.obra.findUniqueOrThrow({
    where: { id: obraId },
    include: {
      asignaciones: { include: { trabajador: true } },
      facturas: true,
      anticipos: true,
      gastos: true,
    },
  });

  // Para clasificar bien las horas extra necesitamos TODOS los partes de los
  // trabajadores implicados (pueden trabajar en varias obras la misma semana).
  const idsTrabajadores = [...new Set(obra.asignaciones.map((a) => a.trabajadorId))];
  const todosPartes = await prisma.parteHoras.findMany({
    where: { trabajadorId: { in: idsTrabajadores } },
  });
  const clasificados = clasificarHorasExtra(todosPartes).filter((p) => p.obraId === obraId);

  const recargo = 1 + config.recargoHoraExtra / 100;
  const porTrabajador: Record<number, {
    trabajadorId: number; nombre: string; categoria: string;
    horasNormales: number; horasExtra: number;
    costeHora: number; precioVentaHora: number;
    coste: number; facturable: number;
  }> = {};

  for (const p of clasificados) {
    const asig = obra.asignaciones.find((a) => a.trabajadorId === p.trabajadorId);
    const trabajador = asig?.trabajador
      ?? (await prisma.trabajador.findUniqueOrThrow({ where: { id: p.trabajadorId } }));
    const coste = calcularCosteTrabajador(trabajador.costeEmpresaMensual, config);
    const costeHora = coste.costeHoraAnualizado; // coste REAL para medir margen
    const precioVenta = asig?.precioVentaHora ?? 0;

    if (!porTrabajador[p.trabajadorId]) {
      porTrabajador[p.trabajadorId] = {
        trabajadorId: p.trabajadorId,
        nombre: `${trabajador.nombre} ${trabajador.apellidos}`,
        categoria: trabajador.categoria,
        horasNormales: 0, horasExtra: 0,
        costeHora: r2(costeHora), precioVentaHora: precioVenta,
        coste: 0, facturable: 0,
      };
    }
    const acc = porTrabajador[p.trabajadorId];
    acc.horasNormales += p.horasNormales;
    acc.horasExtra += p.horasExtra;
    acc.coste += p.horasNormales * costeHora + p.horasExtra * costeHora * recargo;
    acc.facturable += p.horasNormales * precioVenta + p.horasExtra * precioVenta * recargo;
  }

  const detalle = Object.values(porTrabajador).map((d) => ({
    ...d,
    horasNormales: r2(d.horasNormales),
    horasExtra: r2(d.horasExtra),
    coste: r2(d.coste),
    facturable: r2(d.facturable),
  }));

  const costeManoObra = detalle.reduce((s, d) => s + d.coste, 0);
  const costeGastosObra = obra.gastos.reduce((s, g) => s + g.importe, 0);
  const costeReal = costeManoObra + costeGastosObra;
  const facturable = detalle.reduce((s, d) => s + d.facturable, 0);
  const facturado = obra.facturas.reduce((s, f) => s + f.baseImponible, 0);
  const horasTotales = detalle.reduce((s, d) => s + d.horasNormales + d.horasExtra, 0);
  const horasExtra = detalle.reduce((s, d) => s + d.horasExtra, 0);

  // Margen real: lo certificado/facturado menos el coste real acumulado
  const margenReal = facturado - costeReal;
  const margenRealPorc = facturado > 0 ? (margenReal / facturado) * 100 : 0;
  // Margen proyectado con lo facturable (aunque aún no esté certificado)
  const margenProyectado = facturable - costeReal;
  const margenProyectadoPorc = facturable > 0 ? (margenProyectado / facturable) * 100 : 0;

  // Alertas para precio cerrado: el coste se acerca o supera el presupuesto
  let alertaPresupuesto: string | null = null;
  if (obra.tipo === 'PRECIO_CERRADO' && obra.presupuestoCerrado) {
    const pct = (costeReal / obra.presupuestoCerrado) * 100;
    if (pct >= 100) alertaPresupuesto = `El coste real (${r2(costeReal)} €) SUPERA el presupuesto cerrado (${obra.presupuestoCerrado} €)`;
    else if (pct >= 80) alertaPresupuesto = `El coste real ya consume el ${r2(pct)}% del presupuesto cerrado`;
  }

  return {
    detalle,
    horasTotales: r2(horasTotales),
    horasExtra: r2(horasExtra),
    costeManoObra: r2(costeManoObra),
    costeGastosObra: r2(costeGastosObra),
    costeReal: r2(costeReal),
    facturable: r2(facturable),
    facturado: r2(facturado),
    pendienteCertificar: r2(facturable - facturado),
    margenReal: r2(margenReal),
    margenRealPorc: r2(margenRealPorc),
    margenProyectado: r2(margenProyectado),
    margenProyectadoPorc: r2(margenProyectadoPorc),
    margenPrevisto: obra.margenPrevisto,
    presupuestoCerrado: obra.presupuestoCerrado,
    alertaPresupuesto,
  };
}

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
  const economico = await calcularEconomico(obra.id);
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
    const eco = await calcularEconomico(id);
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
