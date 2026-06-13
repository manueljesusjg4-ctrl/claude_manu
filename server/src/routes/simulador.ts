// SIMULADOR DE RENTABILIDAD (herramienta estrella): se introduce un escenario
// con uno o varios equipos/clientes y se calcula al instante facturación,
// coste real, margen por mes, horas extra y flujo de caja.
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { calcularCosteTrabajador, calcularCosteObraCorta } from '../lib/costes';
import { claveDia, claveMes, finDeMes, finDeMesSiguiente, lunesDeSemana, mesesEntre, sumarDias, diasLaborablesEntre } from '../lib/fechas';

export const rutasSimulador = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;

// Un "bloque" del escenario = un equipo trabajando para un cliente
export interface BloqueEscenario {
  nombre: string;             // ej. "5 oficiales con Marcos"
  categoria: string;          // categoría de los trabajadores
  numTrabajadores: number;
  costeMensualPorTrabajador: number; // coste empresa base €/mes
  precioVentaHora: number;
  horasDia: number;           // jornada h/día
  diasSemana: number;         // días/semana
  fechaInicio: string;
  fechaFin: string;
  plazoCobroDias: number;
  modoObraCorta: boolean;     // usar horas reales del periodo en vez de anualizado
}

/** Calcula un escenario completo (uno o varios bloques combinados). */
async function calcularEscenario(bloques: BloqueEscenario[], saldoInicial: number) {
  const config = await prisma.configuracion.findFirstOrThrow();
  const recargo = 1 + config.recargoHoraExtra / 100;
  const porcSS = config.porcentajeSeguridadSocial / 100;

  type Mov = { fecha: Date; importe: number };
  const movs: Mov[] = [];
  const porMesGlobal: Record<string, { facturacion: number; coste: number }> = {};
  const resultadosBloques: any[] = [];

  for (const b of bloques) {
    const inicio = new Date(b.fechaInicio);
    const fin = new Date(b.fechaFin);
    const meses = mesesEntre(inicio, fin);
    const diasLab = diasLaborablesEntre(inicio, fin);
    // Horas por trabajador en el periodo según jornada indicada
    const horasSemana = b.horasDia * b.diasSemana;
    const horasPorTrabajador = diasLab * b.horasDia * (b.diasSemana / 5); // ajusta si trabajan <5 días
    const horasTotales = horasPorTrabajador * b.numTrabajadores;

    // Horas extra: lo que excede de 40 h/semana
    const horasExtraSemana = Math.max(0, horasSemana - 40);
    const semanas = horasPorTrabajador / Math.max(1, horasSemana);
    const horasExtraPorTrabajador = horasExtraSemana * semanas;
    const horasNormalesPorTrabajador = horasPorTrabajador - horasExtraPorTrabajador;

    // Coste/hora según el modo elegido
    const costeCalc = calcularCosteTrabajador(b.costeMensualPorTrabajador, config);
    let costeHora = costeCalc.costeHoraAnualizado;
    let notaCoste = `Coste/hora anualizado: ${costeHora.toFixed(2)} €/h`;
    if (b.modoObraCorta) {
      const corta = calcularCosteObraCorta(b.costeMensualPorTrabajador, meses, horasPorTrabajador, config);
      costeHora = corta.costeHora;
      notaCoste = `Modo obra corta: ${costeHora.toFixed(2)} €/h (coste del periodo ÷ horas trabajadas)`;
    }

    // Totales del bloque
    const facturacion =
      (horasNormalesPorTrabajador * b.precioVentaHora + horasExtraPorTrabajador * b.precioVentaHora * recargo) *
      b.numTrabajadores;
    const coste =
      (horasNormalesPorTrabajador * costeHora + horasExtraPorTrabajador * costeHora * recargo) * b.numTrabajadores;
    const margen = facturacion - coste;
    const margenPorc = facturacion > 0 ? (margen / facturacion) * 100 : 0;

    // Reparto mensual y movimientos de caja
    const costeMensualEquipo = b.numTrabajadores * b.costeMensualPorTrabajador;
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const facturacionMes = meses > 0 ? facturacion / meses : facturacion;
    while (cursor <= fin) {
      // Fracción del mes cubierta por el periodo (para meses parciales)
      const mesIni = new Date(Math.max(cursor.getTime(), inicio.getTime()));
      const mesFin = new Date(Math.min(finDeMes(cursor).getTime(), fin.getTime()));
      const diasMes = finDeMes(cursor).getDate();
      const diasCubiertos = Math.max(0, (mesFin.getTime() - mesIni.getTime()) / 86400000 + 1);
      const fr = Math.min(1, diasCubiertos / diasMes);
      const fMes = facturacionMes * fr;
      const cMes = (coste / Math.max(meses, 0.01)) * fr;

      const clave = claveMes(cursor);
      if (!porMesGlobal[clave]) porMesGlobal[clave] = { facturacion: 0, coste: 0 };
      porMesGlobal[clave].facturacion += fMes;
      porMesGlobal[clave].coste += cMes;

      // Caja: nómina fin de mes, SS mes siguiente, cobro a plazo del cliente
      movs.push({ fecha: finDeMes(cursor), importe: -costeMensualEquipo * (1 - porcSS) * fr });
      movs.push({ fecha: finDeMesSiguiente(cursor), importe: -costeMensualEquipo * porcSS * fr });
      movs.push({ fecha: sumarDias(finDeMes(cursor), b.plazoCobroDias), importe: fMes * (1 + config.porcentajeIva / 100) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    // Extras devengadas pagadas al final (finiquito)
    movs.push({ fecha: fin, importe: -costeMensualEquipo * (config.porcentajePagasExtra / 100) * meses });

    resultadosBloques.push({
      nombre: b.nombre,
      numTrabajadores: b.numTrabajadores,
      horasTotales: r2(horasTotales),
      horasExtraTotales: r2(horasExtraPorTrabajador * b.numTrabajadores),
      costeHora: r2(costeHora),
      precioVentaHora: b.precioVentaHora,
      facturacion: r2(facturacion),
      coste: r2(coste),
      margen: r2(margen),
      margenPorc: r2(margenPorc),
      notaCoste,
      avisoMargenBajo: margenPorc < config.umbralMargenAviso,
    });
  }

  // Totales globales
  const facturacionTotal = resultadosBloques.reduce((s, b) => s + b.facturacion, 0);
  const costeTotal = resultadosBloques.reduce((s, b) => s + b.coste, 0);
  const margenTotal = facturacionTotal - costeTotal;

  // Flujo de caja semanal consolidado
  movs.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const semanas: { semana: string; entradas: number; salidas: number; saldoAcumulado: number; negativa: boolean }[] = [];
  let minimo: { semana: string; saldo: number } | null = null;
  if (movs.length > 0) {
    let lunes = lunesDeSemana(movs[0].fecha);
    const ultima = movs[movs.length - 1].fecha;
    let saldo = saldoInicial;
    while (lunes <= ultima) {
      const finSem = sumarDias(lunes, 6);
      const sem = movs.filter((m) => m.fecha >= lunes && m.fecha <= finSem);
      const entradas = sem.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0);
      const salidas = sem.filter((m) => m.importe < 0).reduce((s, m) => s - m.importe, 0);
      saldo += entradas - salidas;
      semanas.push({
        semana: claveDia(lunes),
        entradas: r2(entradas),
        salidas: r2(salidas),
        saldoAcumulado: r2(saldo),
        negativa: saldo < 0,
      });
      if (!minimo || saldo < minimo.saldo) minimo = { semana: claveDia(lunes), saldo: r2(saldo) };
      lunes = sumarDias(lunes, 7);
    }
  }

  const porMes = Object.entries(porMesGlobal)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      facturacion: r2(v.facturacion),
      coste: r2(v.coste),
      margen: r2(v.facturacion - v.coste),
    }));

  return {
    bloques: resultadosBloques,
    totales: {
      facturacion: r2(facturacionTotal),
      coste: r2(costeTotal),
      margen: r2(margenTotal),
      margenPorc: r2(facturacionTotal > 0 ? (margenTotal / facturacionTotal) * 100 : 0),
      avisoMargenBajo: facturacionTotal > 0 && (margenTotal / facturacionTotal) * 100 < config.umbralMargenAviso,
    },
    porMes,
    caja: {
      semanas,
      semanaMinima: minimo,
      necesidadMaxima: minimo && minimo.saldo < 0 ? r2(-minimo.saldo) : 0,
    },
  };
}

// Calcular un escenario al vuelo (sin guardar)
rutasSimulador.post('/calcular', async (req, res) => {
  const { bloques, saldoInicial } = req.body;
  if (!Array.isArray(bloques) || bloques.length === 0) {
    return res.status(400).json({ error: 'El escenario necesita al menos un bloque' });
  }
  res.json(await calcularEscenario(bloques, Number(saldoInicial) || 0));
});

// ---- Escenarios guardados (para comparar lado a lado) -------------------------
rutasSimulador.get('/escenarios', async (_req, res) => {
  const escenarios = await prisma.escenario.findMany({ orderBy: { creadoEn: 'desc' } });
  res.json(escenarios.map((e) => ({ ...e, datos: JSON.parse(e.datosJson) })));
});

rutasSimulador.post('/escenarios', async (req, res) => {
  const { nombre, bloques, saldoInicial } = req.body;
  const e = await prisma.escenario.create({
    data: { nombre, datosJson: JSON.stringify({ bloques, saldoInicial: saldoInicial || 0 }) },
  });
  res.status(201).json(e);
});

// Comparar varios escenarios guardados lado a lado
rutasSimulador.post('/comparar', async (req, res) => {
  const ids: number[] = req.body.ids || [];
  const escenarios = await prisma.escenario.findMany({ where: { id: { in: ids } } });
  const resultados = [];
  for (const e of escenarios) {
    const datos = JSON.parse(e.datosJson);
    resultados.push({
      id: e.id,
      nombre: e.nombre,
      resultado: await calcularEscenario(datos.bloques, datos.saldoInicial || 0),
    });
  }
  res.json(resultados);
});

rutasSimulador.delete('/escenarios/:id', async (req, res) => {
  await prisma.escenario.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
