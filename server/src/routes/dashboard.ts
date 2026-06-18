// Dashboard: KPIs, caja proyectada, alertas y próximas acciones del CRM.
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { generarMovimientos, proyectarSemanas } from '../lib/tesoreria';
import { calcularCosteTrabajador } from '../lib/costes';
import { claveDia, lunesDeSemana, sumarDias } from '../lib/fechas';

export const rutasDashboard = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;

rutasDashboard.get('/', async (_req, res) => {
  const config = await prisma.configuracion.findFirstOrThrow();
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
  const en30 = new Date(hoy.getTime() + 30 * 86400000);

  // ---- Caja proyectada 12 semanas -------------------------------------------
  const desde = lunesDeSemana(hoy);
  const movimientos = await generarMovimientos(desde, sumarDias(desde, 12 * 7));
  const caja = proyectarSemanas(movimientos, hoy, 12, 0);

  // ---- Facturación y margen --------------------------------------------------
  const facturas = await prisma.factura.findMany();
  const factMes = facturas.filter((f) => f.fechaEmision >= inicioMes).reduce((s, f) => s + f.baseImponible, 0);
  const factAnio = facturas.filter((f) => f.fechaEmision >= inicioAnio).reduce((s, f) => s + f.baseImponible, 0);

  // Coste laboral mensual estimado (trabajadores activos, con extras prorrateadas)
  const trabajadores = await prisma.trabajador.findMany({ where: { estado: 'ACTIVO' } });
  const costeLaboralMes = trabajadores.reduce(
    (s, t) => s + calcularCosteTrabajador(t.costeEmpresaMensual, config).costeMensualConExtras,
    0
  );
  const gastosFijos = await prisma.gasto.findMany({ where: { esRecurrente: true } });
  const gastosFijosMes = gastosFijos.reduce((s, g) => s + g.importe, 0);
  const margenMes = factMes - costeLaboralMes - gastosFijosMes;
  const mesesTranscurridos = hoy.getMonth() + 1;
  const margenAnio = factAnio - (costeLaboralMes + gastosFijosMes) * mesesTranscurridos;

  // ---- Contadores --------------------------------------------------------------
  const obrasActivas = await prisma.obra.count({ where: { estado: 'ACTIVA' } });
  const asignacionesHoy = await prisma.asignacion.findMany({
    where: { fechaInicio: { lte: hoy }, OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }] },
    include: { trabajador: true },
  });
  const enObraHoy = new Set(asignacionesHoy.filter((a) => a.trabajador.estado === 'ACTIVO').map((a) => a.trabajadorId)).size;

  // ---- Alertas -------------------------------------------------------------------
  const alertas: { tipo: string; nivel: 'ROJO' | 'AMBAR'; mensaje: string; enlace: string }[] = [];

  // Documentos de empresa caducados o por caducar
  const docsEmpresa = await prisma.documentoEmpresa.findMany();
  for (const d of docsEmpresa) {
    if (!d.fechaCaducidad) continue;
    if (d.fechaCaducidad < hoy)
      alertas.push({ tipo: 'DOC_EMPRESA', nivel: 'ROJO', mensaje: `Documento de empresa CADUCADO: ${d.nombre}`, enlace: '/documentacion' });
    else if (d.fechaCaducidad <= en30)
      alertas.push({ tipo: 'DOC_EMPRESA', nivel: 'AMBAR', mensaje: `Documento de empresa caduca pronto: ${d.nombre} (${d.fechaCaducidad.toLocaleDateString('es-ES')})`, enlace: '/documentacion' });
  }

  // Documentos de trabajadores
  const docsTrab = await prisma.documentoTrabajador.findMany({ include: { trabajador: true } });
  for (const d of docsTrab) {
    if (!d.fechaCaducidad) continue;
    const nombre = `${d.trabajador.nombre} ${d.trabajador.apellidos}`;
    if (d.fechaCaducidad < hoy)
      alertas.push({ tipo: 'DOC_TRABAJADOR', nivel: 'ROJO', mensaje: `${nombre}: ${d.nombre} CADUCADO`, enlace: `/trabajadores/${d.trabajadorId}` });
    else if (d.fechaCaducidad <= en30)
      alertas.push({ tipo: 'DOC_TRABAJADOR', nivel: 'AMBAR', mensaje: `${nombre}: ${d.nombre} caduca el ${d.fechaCaducidad.toLocaleDateString('es-ES')}`, enlace: `/trabajadores/${d.trabajadorId}` });
  }

  // Cobros vencidos sin pagar
  const vencidas = facturas.filter((f) => f.estado === 'PENDIENTE' && f.fechaCobroEsperada < hoy);
  for (const f of vencidas) {
    const total = r2(f.baseImponible * (1 + f.porcentajeIva / 100) - f.anticipoAplicado);
    alertas.push({ tipo: 'COBRO_VENCIDO', nivel: 'ROJO', mensaje: `Factura ${f.numero} VENCIDA sin cobrar (${total.toLocaleString('es-ES')} €)`, enlace: '/tesoreria' });
  }

  // Obras activas sin certificar nada
  const obras = await prisma.obra.findMany({ where: { estado: 'ACTIVA' }, include: { facturas: true, partes: true } });
  for (const o of obras) {
    if (o.partes.length > 0 && o.facturas.length === 0) {
      alertas.push({ tipo: 'OBRA_SIN_CERTIFICAR', nivel: 'AMBAR', mensaje: `Obra "${o.nombre}" tiene horas trabajadas y nada certificado`, enlace: `/obras/${o.id}` });
    }
  }

  // Clientes grandes nuevos sin informe de solvencia
  const clientesSinSolvencia = await prisma.cliente.findMany({
    where: {
      solvenciaConsultada: false,
      tipo: { in: ['PROMOTORA', 'CONSTRUCTORA'] },
      estadoPipeline: { in: ['NEGOCIACION', 'GANADO'] },
    },
  });
  for (const c of clientesSinSolvencia) {
    alertas.push({ tipo: 'SOLVENCIA', nivel: 'AMBAR', mensaje: `Cliente "${c.nombre}" en ${c.estadoPipeline === 'GANADO' ? 'cartera' : 'negociación'} sin informe de solvencia`, enlace: `/crm/${c.id}` });
  }

  // Semanas de caja negativa
  for (const s of caja.semanas) {
    if (s.negativa) {
      alertas.push({ tipo: 'CAJA', nivel: 'ROJO', mensaje: `Caja proyectada NEGATIVA la semana del ${new Date(s.semana).toLocaleDateString('es-ES')} (${s.saldoAcumulado.toLocaleString('es-ES')} €)`, enlace: '/tesoreria' });
      break; // con la primera basta para avisar
    }
  }

  // "Gatillo de cobro": se cierra la quincena o el mes y hay obras activas con
  // horas trabajadas todavía sin certificar nada desde la última factura.
  const diaMes = hoy.getDate();
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const cierraQuincena = diaMes >= 13 && diaMes <= 15;
  const cierraMes = diaMes >= ultimoDiaMes - 2;
  if (cierraQuincena || cierraMes) {
    for (const o of obras) {
      const ultimaFactura = o.facturas.length > 0
        ? o.facturas.reduce((max, f) => (f.fechaEmision > max ? f.fechaEmision : max), o.facturas[0].fechaEmision)
        : null;
      const partesSinFacturar = o.partes.filter((p) => !ultimaFactura || p.fecha > ultimaFactura);
      if (partesSinFacturar.length > 0) {
        const horas = r2(partesSinFacturar.reduce((s, p) => s + p.horas, 0));
        alertas.push({
          tipo: 'GATILLO_COBRO',
          nivel: 'AMBAR',
          mensaje: `Toca facturar "${o.nombre}": ${horas} h trabajadas desde la última certificación (${cierraQuincena ? 'cierre de quincena' : 'cierre de mes'})`,
          enlace: `/obras/${o.id}`,
        });
      }
    }
  }

  // ---- Próximas acciones del CRM ---------------------------------------------------
  const seguimientos = await prisma.seguimiento.findMany({
    where: { completado: false },
    include: { cliente: true },
    orderBy: { fechaPrevista: 'asc' },
    take: 8,
  });

  res.json({
    caja,
    kpis: {
      facturacionMes: r2(factMes),
      facturacionAnio: r2(factAnio),
      margenMesEstimado: r2(margenMes),
      margenAnioEstimado: r2(margenAnio),
      costeLaboralMes: r2(costeLaboralMes),
      gastosFijosMes: r2(gastosFijosMes),
      obrasActivas,
      trabajadoresActivos: trabajadores.length,
      enObraHoy,
    },
    alertas,
    seguimientos: seguimientos.map((s) => ({
      id: s.id,
      fechaPrevista: claveDia(s.fechaPrevista),
      descripcion: s.descripcion,
      cliente: { id: s.cliente.id, nombre: s.cliente.nombre },
      vencido: s.fechaPrevista < hoy,
    })),
  });
});
