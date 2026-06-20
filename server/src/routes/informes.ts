// Informes: margen por obra/cliente, facturación, coste laboral y
// rentabilidad por categoría. Los datos se devuelven listos para tabla,
// gráfico y exportación CSV en el cliente.
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { calcularCosteTrabajador } from '../lib/costes';
import { clasificarHorasExtra } from '../lib/horas';
import { claveMes } from '../lib/fechas';

export const rutasInformes = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Coste y facturable por obra a partir de los partes de horas. */
async function economiaPorObra() {
  const config = await prisma.configuracion.findFirstOrThrow();
  const recargo = 1 + config.recargoHoraExtra / 100;
  const partes = await prisma.parteHoras.findMany();
  const clasificados = clasificarHorasExtra(partes);
  const trabajadores = await prisma.trabajador.findMany();
  const asignaciones = await prisma.asignacion.findMany();
  const costePorTrabajador = new Map(
    trabajadores.map((t) => [t.id, calcularCosteTrabajador(t.costeEmpresaMensual, config).costeHoraAnualizado])
  );

  const porObra = new Map<number, { coste: number; facturable: number; horas: number }>();
  const porCategoria = new Map<string, { coste: number; facturable: number; horas: number }>();
  const porMesCoste = new Map<string, number>();

  for (const p of clasificados) {
    const costeHora = costePorTrabajador.get(p.trabajadorId) || 0;
    const asig = asignaciones.find((a) => a.obraId === p.obraId && a.trabajadorId === p.trabajadorId);
    const precio = asig?.precioVentaHora || 0;
    const coste = p.horasNormales * costeHora + p.horasExtra * costeHora * recargo;
    const facturable = p.horasNormales * precio + p.horasExtra * precio * recargo;

    const o = porObra.get(p.obraId) || { coste: 0, facturable: 0, horas: 0 };
    o.coste += coste; o.facturable += facturable; o.horas += p.horas;
    porObra.set(p.obraId, o);

    const t = trabajadores.find((x) => x.id === p.trabajadorId);
    const cat = t?.categoria || 'DESCONOCIDA';
    const c = porCategoria.get(cat) || { coste: 0, facturable: 0, horas: 0 };
    c.coste += coste; c.facturable += facturable; c.horas += p.horas;
    porCategoria.set(cat, c);

    const mes = claveMes(p.fecha);
    porMesCoste.set(mes, (porMesCoste.get(mes) || 0) + coste);
  }
  return { porObra, porCategoria, porMesCoste };
}

// Margen por obra (y por cliente)
rutasInformes.get('/margen-obras', async (_req, res) => {
  const { porObra } = await economiaPorObra();
  const obras = await prisma.obra.findMany({ include: { cliente: true, facturas: true, gastos: true } });
  const filas = obras.map((o) => {
    const eco = porObra.get(o.id) || { coste: 0, facturable: 0, horas: 0 };
    const gastosObra = o.gastos.reduce((s, g) => s + g.importe, 0);
    const costeReal = eco.coste + gastosObra;
    const facturado = o.facturas.reduce((s, f) => s + f.baseImponible, 0);
    const margen = facturado - costeReal;
    return {
      obraId: o.id,
      obra: o.nombre,
      cliente: o.cliente.nombre,
      clienteId: o.clienteId,
      estado: o.estado,
      tipo: o.tipo,
      horas: r2(eco.horas),
      costeReal: r2(costeReal),
      facturado: r2(facturado),
      margen: r2(margen),
      margenPorc: r2(facturado > 0 ? (margen / facturado) * 100 : 0),
      margenPrevisto: o.margenPrevisto,
    };
  });

  // Agregado por cliente
  const porCliente = new Map<string, { cliente: string; costeReal: number; facturado: number }>();
  for (const f of filas) {
    const c = porCliente.get(f.cliente) || { cliente: f.cliente, costeReal: 0, facturado: 0 };
    c.costeReal += f.costeReal; c.facturado += f.facturado;
    porCliente.set(f.cliente, c);
  }
  res.json({
    obras: filas,
    clientes: [...porCliente.values()].map((c) => ({
      ...c,
      costeReal: r2(c.costeReal),
      facturado: r2(c.facturado),
      margen: r2(c.facturado - c.costeReal),
      margenPorc: r2(c.facturado > 0 ? ((c.facturado - c.costeReal) / c.facturado) * 100 : 0),
    })),
  });
});

// Facturación por mes y por cliente
rutasInformes.get('/facturacion', async (_req, res) => {
  const facturas = await prisma.factura.findMany({ include: { cliente: true } });
  const porMes = new Map<string, number>();
  const porCliente = new Map<string, number>();
  for (const f of facturas) {
    const mes = claveMes(f.fechaEmision);
    porMes.set(mes, (porMes.get(mes) || 0) + f.baseImponible);
    porCliente.set(f.cliente.nombre, (porCliente.get(f.cliente.nombre) || 0) + f.baseImponible);
  }
  res.json({
    porMes: [...porMes.entries()].sort().map(([mes, importe]) => ({ mes, importe: r2(importe) })),
    porCliente: [...porCliente.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cliente, importe]) => ({ cliente, importe: r2(importe) })),
  });
});

// Coste laboral por mes (imputado por partes de horas) + coste fijo de plantilla
rutasInformes.get('/coste-laboral', async (_req, res) => {
  const config = await prisma.configuracion.findFirstOrThrow();
  const { porMesCoste } = await economiaPorObra();
  const trabajadores = await prisma.trabajador.findMany({ where: { estado: 'ACTIVO' } });
  const plantillaMes = trabajadores.reduce(
    (s, t) => s + calcularCosteTrabajador(t.costeEmpresaMensual, config).costeMensualConExtras,
    0
  );
  res.json({
    costePlantillaMensual: r2(plantillaMes),
    imputadoPorMes: [...porMesCoste.entries()].sort().map(([mes, importe]) => ({ mes, importe: r2(importe) })),
  });
});

// Libro auxiliar de ingresos y gastos para enviar a la gestoría (CSV en el
// cliente). Incluye el desglose de IVA de cada movimiento del periodo.
rutasInformes.get('/gestoria', async (req, res) => {
  const desde = req.query.desde ? new Date(String(req.query.desde)) : null;
  const hasta = req.query.hasta ? new Date(String(req.query.hasta)) : null;
  const enRango = (f: Date) => (!desde || f >= desde) && (!hasta || f <= hasta);

  const facturas = await prisma.factura.findMany({ include: { cliente: true } });
  const gastos = await prisma.gasto.findMany({ include: { proveedor: true } });

  const movimientos = [
    ...facturas
      .filter((f) => enRango(f.fechaEmision))
      .map((f) => ({
        fecha: f.fechaEmision.toISOString().slice(0, 10),
        tipo: 'INGRESO' as const,
        concepto: `Factura ${f.numero} — ${f.concepto}`,
        contraparte: f.cliente.nombre,
        baseImponible: r2(f.baseImponible),
        porcentajeIva: f.porcentajeIva,
        cuotaIva: r2(f.baseImponible * (f.porcentajeIva / 100)),
        total: r2(f.baseImponible * (1 + f.porcentajeIva / 100)),
        categoria: 'FACTURACION',
        cobradoOPagado: f.estado === 'COBRADA',
      })),
    ...gastos
      .filter((g) => enRango(g.fecha))
      .map((g) => ({
        fecha: g.fecha.toISOString().slice(0, 10),
        tipo: 'GASTO' as const,
        concepto: g.concepto,
        contraparte: g.proveedor?.nombre || '—',
        baseImponible: r2(g.importe),
        porcentajeIva: 0,
        cuotaIva: 0,
        total: r2(g.importe),
        categoria: g.categoria,
        cobradoOPagado: g.pagado,
      })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  res.json(movimientos);
});

// Rentabilidad por categoría de trabajador
rutasInformes.get('/rentabilidad-categorias', async (_req, res) => {
  const { porCategoria } = await economiaPorObra();
  res.json(
    [...porCategoria.entries()].map(([categoria, v]) => ({
      categoria,
      horas: r2(v.horas),
      coste: r2(v.coste),
      facturable: r2(v.facturable),
      margen: r2(v.facturable - v.coste),
      margenPorc: r2(v.facturable > 0 ? ((v.facturable - v.coste) / v.facturable) * 100 : 0),
      margenPorHora: r2(v.horas > 0 ? (v.facturable - v.coste) / v.horas : 0),
    }))
  );
});
