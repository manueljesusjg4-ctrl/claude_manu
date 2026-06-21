// ============================================================================
// MOTOR DE TESORERÍA — proyección de caja semana a semana.
//
// ENTRADAS de dinero:
//   - Facturas/certificaciones pendientes, en su fecha de cobro esperada.
//     Si están anticipadas vía confirming, el dinero (menos el coste
//     financiero) entra en la fecha del anticipo.
//     Los anticipos de cliente ya aplicados se descuentan del importe a cobrar.
//   - Anticipos de cliente con fecha futura.
//
// SALIDAS de dinero:
//   - Nóminas: cada trabajador cobra cada 30 días desde su fecha de alta, NO
//     todos el mismo día de calendario (cada uno tiene su propio ciclo).
//   - Seguridad Social (empresa): el último día del mes SIGUIENTE al devengo
//     (esto sí es un plazo legal fijo, independiente de cada trabajador).
//   - Pagas extra: SOLO se pagan cuando se acaba una obra, y solo la parte
//     proporcional devengada durante el tiempo trabajado en esa obra (no la
//     paga completa, y no en una fecha fija de junio/diciembre).
//   - Gastos fijos recurrentes: cada mes. Gastos puntuales: en su fecha.
//
// El objetivo es detectar las semanas en que la caja proyectada queda en
// negativo, porque la empresa adelanta nóminas antes de cobrar.
// ============================================================================
import { prisma } from './prisma';
import { claveDia, finDeMes, finDeMesSiguiente, lunesDeSemana, mesesEntre, sumarDias } from './fechas';

export interface MovimientoCaja {
  fecha: string;       // AAAA-MM-DD
  tipo: 'ENTRADA' | 'SALIDA';
  categoria: string;   // COBRO_FACTURA | CONFIRMING | ANTICIPO_CLIENTE | NOMINA | SEGURIDAD_SOCIAL | PAGA_EXTRA | GASTO_FIJO | GASTO | IVA
  concepto: string;
  importe: number;     // siempre positivo; el tipo indica el signo
}

export interface SemanaCaja {
  semana: string;      // lunes (AAAA-MM-DD)
  entradas: number;
  salidas: number;
  neto: number;
  saldoAcumulado: number;
  negativa: boolean;
  movimientos: MovimientoCaja[];
}

export interface ProyeccionCaja {
  saldoInicial: number;
  semanas: SemanaCaja[];
  semanaMinima: { semana: string; saldo: number } | null;
  necesidadMaxima: number; // cuánto dinero hay que adelantar (saldo mínimo si es negativo)
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Genera todos los movimientos de caja proyectados entre dos fechas a partir
 * de los datos reales de la base de datos.
 */
export async function generarMovimientos(desde: Date, hasta: Date): Promise<MovimientoCaja[]> {
  const config = await prisma.configuracion.findFirstOrThrow();
  const movimientos: MovimientoCaja[] = [];

  // ---- ENTRADAS: facturas pendientes de cobro -------------------------------
  const facturas = await prisma.factura.findMany({
    where: { estado: 'PENDIENTE' },
    include: { cliente: true },
  });
  for (const f of facturas) {
    const total = f.baseImponible * (1 + f.porcentajeIva / 100) - f.anticipoAplicado;
    if (f.anticipadaConfirming && f.fechaAnticipo) {
      // Con confirming el dinero entra antes, menos el coste financiero
      const fecha = f.fechaAnticipo;
      if (fecha >= desde && fecha <= hasta) {
        movimientos.push({
          fecha: claveDia(fecha),
          tipo: 'ENTRADA',
          categoria: 'CONFIRMING',
          concepto: `Anticipo confirming ${f.numero} — ${f.cliente.nombre}`,
          importe: r2(total - f.costeFinanciero),
        });
      }
    } else {
      // Cobro normal en la fecha esperada; si ya está vencida, se asume que
      // entrará "ya" (hoy) para no ocultarla de la proyección.
      const fecha = f.fechaCobroEsperada < desde ? desde : f.fechaCobroEsperada;
      if (fecha >= desde && fecha <= hasta) {
        movimientos.push({
          fecha: claveDia(fecha),
          tipo: 'ENTRADA',
          categoria: 'COBRO_FACTURA',
          concepto: `Cobro ${f.numero} — ${f.cliente.nombre}${f.fechaCobroEsperada < desde ? ' (VENCIDA)' : ''}`,
          importe: r2(total),
        });
      }
    }
  }

  // ---- ENTRADAS: anticipos de cliente con fecha futura ----------------------
  const anticipos = await prisma.anticipo.findMany({ include: { cliente: true } });
  for (const a of anticipos) {
    if (a.fecha >= desde && a.fecha <= hasta) {
      movimientos.push({
        fecha: claveDia(a.fecha),
        tipo: 'ENTRADA',
        categoria: 'ANTICIPO_CLIENTE',
        concepto: `Anticipo a cuenta — ${a.cliente.nombre}`,
        importe: r2(a.importe),
      });
    }
  }

  // ---- SALIDAS: nóminas -------------------------------------------------
  // Cada trabajador cobra cada 30 días desde que empezó a trabajar (su
  // propio ciclo), no todos el mismo día de calendario.
  const trabajadores = await prisma.trabajador.findMany({ where: { estado: 'ACTIVO' } });
  const porcSS = config.porcentajeSeguridadSocial / 100;
  const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

  for (const t of trabajadores) {
    const salarioMes = t.costeEmpresaMensual * (1 - porcSS);
    let ciclo = Math.max(1, Math.ceil((desde.getTime() - t.fechaAlta.getTime()) / TREINTA_DIAS_MS));
    let fechaPago = sumarDias(t.fechaAlta, 30 * ciclo);
    while (fechaPago <= hasta) {
      if (fechaPago >= desde) {
        movimientos.push({
          fecha: claveDia(fechaPago),
          tipo: 'SALIDA',
          categoria: 'NOMINA',
          concepto: `Nómina — ${t.nombre} ${t.apellidos}`,
          importe: r2(salarioMes),
        });
      }
      ciclo++;
      fechaPago = sumarDias(t.fechaAlta, 30 * ciclo);
    }
  }

  // ---- SALIDAS: Seguridad Social (empresa) -------------------------------
  // El total cotizado se ingresa el último día del mes SIGUIENTE al devengo;
  // es un plazo legal fijo de la empresa, no depende del ciclo de cada
  // trabajador.
  const costeBaseTotal = trabajadores.reduce((s, t) => s + t.costeEmpresaMensual, 0);
  const ssMes = costeBaseTotal * porcSS;
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const finHorizonte = new Date(hasta.getFullYear(), hasta.getMonth() + 1, 1);
  while (cursor < finHorizonte) {
    const fdmSig = finDeMesSiguiente(cursor);
    if (fdmSig >= desde && fdmSig <= hasta && trabajadores.length > 0) {
      movimientos.push({
        fecha: claveDia(fdmSig),
        tipo: 'SALIDA',
        categoria: 'SEGURIDAD_SOCIAL',
        concepto: `Seguridad Social (devengo ${cursor.toLocaleDateString('es-ES', { month: 'long' })})`,
        importe: r2(ssMes),
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // ---- SALIDAS: pagas extra al finalizar cada obra -----------------------
  // Solo se paga cuando una obra termina, y solo la parte proporcional
  // devengada durante el tiempo que cada trabajador estuvo asignado a esa
  // obra (no la paga extra completa).
  const obrasQueFinalizan = await prisma.obra.findMany({
    where: { estado: { in: ['ACTIVA', 'FINALIZADA'] }, fechaFinPrevista: { gte: desde, lte: hasta } },
    include: { asignaciones: { include: { trabajador: true } } },
  });
  for (const obra of obrasQueFinalizan) {
    if (!obra.fechaFinPrevista) continue;
    let totalExtra = 0;
    let nTrabajadores = 0;
    for (const a of obra.asignaciones) {
      const fin = a.fechaFin && a.fechaFin < obra.fechaFinPrevista ? a.fechaFin : obra.fechaFinPrevista;
      if (fin <= a.fechaInicio) continue;
      const meses = mesesEntre(a.fechaInicio, fin);
      totalExtra += a.trabajador.costeEmpresaMensual * (config.porcentajePagasExtra / 100) * meses;
      nTrabajadores++;
    }
    if (totalExtra > 0) {
      movimientos.push({
        fecha: claveDia(obra.fechaFinPrevista),
        tipo: 'SALIDA',
        categoria: 'PAGA_EXTRA',
        concepto: `Paga extra fin de obra "${obra.nombre}" — parte proporcional de ${nTrabajadores} trabajador(es)`,
        importe: r2(totalExtra),
      });
    }
  }

  // ---- SALIDAS: gastos -------------------------------------------------------
  const gastos = await prisma.gasto.findMany();
  for (const g of gastos) {
    if (g.esRecurrente) {
      // Gasto fijo mensual: se paga a fin de cada mes del horizonte
      const c = new Date(desde.getFullYear(), desde.getMonth(), 1);
      while (c < finHorizonte) {
        const fdm = finDeMes(c);
        if (fdm >= desde && fdm <= hasta && fdm >= g.fecha) {
          movimientos.push({
            fecha: claveDia(fdm),
            tipo: 'SALIDA',
            categoria: 'GASTO_FIJO',
            concepto: g.concepto,
            importe: r2(g.importe),
          });
        }
        c.setMonth(c.getMonth() + 1);
      }
    } else if (!g.pagado && g.fecha >= desde && g.fecha <= hasta) {
      movimientos.push({
        fecha: claveDia(g.fecha),
        tipo: 'SALIDA',
        categoria: 'GASTO',
        concepto: g.concepto,
        importe: r2(g.importe),
      });
    }
  }

  movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return movimientos;
}

/** Agrupa los movimientos en semanas y calcula el saldo acumulado. */
export function proyectarSemanas(
  movimientos: MovimientoCaja[],
  desde: Date,
  numSemanas: number,
  saldoInicial: number
): ProyeccionCaja {
  const semanas: SemanaCaja[] = [];
  let lunes = lunesDeSemana(desde);
  let saldo = saldoInicial;
  let minimo: { semana: string; saldo: number } | null = null;

  for (let i = 0; i < numSemanas; i++) {
    const claveLunes = claveDia(lunes);
    const claveDomingo = claveDia(sumarDias(lunes, 6));
    const movs = movimientos.filter((m) => m.fecha >= claveLunes && m.fecha <= claveDomingo);
    const entradas = movs.filter((m) => m.tipo === 'ENTRADA').reduce((s, m) => s + m.importe, 0);
    const salidas = movs.filter((m) => m.tipo === 'SALIDA').reduce((s, m) => s + m.importe, 0);
    saldo += entradas - salidas;
    const semana: SemanaCaja = {
      semana: claveLunes,
      entradas: r2(entradas),
      salidas: r2(salidas),
      neto: r2(entradas - salidas),
      saldoAcumulado: r2(saldo),
      negativa: saldo < 0,
      movimientos: movs,
    };
    semanas.push(semana);
    if (!minimo || saldo < minimo.saldo) minimo = { semana: claveLunes, saldo: r2(saldo) };
    lunes = sumarDias(lunes, 7);
  }

  return {
    saldoInicial: r2(saldoInicial),
    semanas,
    semanaMinima: minimo,
    necesidadMaxima: minimo && minimo.saldo < 0 ? r2(-minimo.saldo) : 0,
  };
}
