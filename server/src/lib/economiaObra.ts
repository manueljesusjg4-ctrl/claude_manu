// Control económico de una obra: coste real, facturable (lo trabajado al
// precio de venta pactado), facturado y pendiente de certificar. Se usa
// tanto en la ficha de la obra como en la proyección de tesorería (para
// anticipar lo que aún no se ha certificado).
import { prisma } from './prisma';
import { calcularCosteTrabajador } from './costes';
import { clasificarHorasExtra } from './horas';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Las horas extra se detectan a nivel de trabajador y semana (sumando TODAS
 * sus obras) y luego se imputan a los partes correspondientes de esta obra.
 */
export async function calcularEconomicoObra(obraId: number) {
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
