// Tesorería: flujo de caja proyectado, resumen de IVA y simulador de caja
// "¿aguanto esta obra?".
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { generarMovimientos, proyectarSemanas } from '../lib/tesoreria';
import { claveDia, claveMes, finDeMes, finDeMesSiguiente, lunesDeSemana, sumarDias } from '../lib/fechas';

export const rutasTesoreria = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;

// Flujo de caja proyectado por semanas (8-12 por defecto) y por meses
rutasTesoreria.get('/flujo', async (req, res) => {
  const numSemanas = Math.min(52, Math.max(4, Number(req.query.semanas) || 12));
  const saldoInicial = Number(req.query.saldoInicial) || 0;
  const hoy = new Date();
  const desde = lunesDeSemana(hoy);
  const hasta = sumarDias(desde, numSemanas * 7);

  const movimientos = await generarMovimientos(desde, hasta);
  const proyeccion = proyectarSemanas(movimientos, hoy, numSemanas, saldoInicial);

  // Agregado mensual para la vista "mes a mes"
  const meses: Record<string, { mes: string; entradas: number; salidas: number }> = {};
  for (const m of movimientos) {
    const clave = m.fecha.slice(0, 7);
    if (!meses[clave]) meses[clave] = { mes: clave, entradas: 0, salidas: 0 };
    if (m.tipo === 'ENTRADA') meses[clave].entradas += m.importe;
    else meses[clave].salidas += m.importe;
  }
  const porMes = Object.values(meses)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => ({ ...m, entradas: r2(m.entradas), salidas: r2(m.salidas), neto: r2(m.entradas - m.salidas) }));

  res.json({ ...proyeccion, porMes });
});

// Resumen de IVA repercutido (cobrado) pendiente de liquidar a Hacienda.
// Recordatorio clave: ese dinero NO es de la empresa.
rutasTesoreria.get('/iva', async (_req, res) => {
  const facturas = await prisma.factura.findMany({ where: { estado: 'COBRADA' } });
  const porTrimestre: Record<string, number> = {};
  let totalRepercutidoCobrado = 0;
  for (const f of facturas) {
    const iva = f.baseImponible * (f.porcentajeIva / 100);
    totalRepercutidoCobrado += iva;
    const fecha = f.fechaCobroReal || f.fechaCobroEsperada;
    const t = `${fecha.getFullYear()}-T${Math.floor(fecha.getMonth() / 3) + 1}`;
    porTrimestre[t] = (porTrimestre[t] || 0) + iva;
  }
  // IVA del trimestre en curso (aún no liquidado)
  const hoy = new Date();
  const trimestreActual = `${hoy.getFullYear()}-T${Math.floor(hoy.getMonth() / 3) + 1}`;
  res.json({
    totalRepercutidoCobrado: r2(totalRepercutidoCobrado),
    trimestreActual,
    ivaTrimestreActual: r2(porTrimestre[trimestreActual] || 0),
    porTrimestre: Object.entries(porTrimestre)
      .sort()
      .map(([trimestre, importe]) => ({ trimestre, importe: r2(importe) })),
  });
});

// ---------------------------------------------------------------------------
// Simulador de caja "¿aguanto esta obra?": cuánto dinero hay que adelantar
// antes del primer cobro y en qué semana está el punto más bajo de caja.
// ---------------------------------------------------------------------------
rutasTesoreria.post('/simulador-caja', async (req, res) => {
  const config = await prisma.configuracion.findFirstOrThrow();
  const {
    numTrabajadores,        // nº de trabajadores
    costeMensualPorTrabajador, // coste empresa mensual base de cada uno
    fechaInicio,            // inicio de la obra
    mesesDuracion,          // duración en meses
    plazoCobroDias,         // plazo de pago del cliente
    facturacionMensual,     // lo que se certifica cada mes
    saldoInicial,           // caja disponible al arrancar
  } = req.body;

  const inicio = new Date(fechaInicio);
  const meses = Number(mesesDuracion);
  const n = Number(numTrabajadores);
  const costeBase = Number(costeMensualPorTrabajador);
  const plazo = Number(plazoCobroDias);
  const factMes = Number(facturacionMensual);

  const porcSS = config.porcentajeSeguridadSocial / 100;
  const costeMensualTotal = n * costeBase;
  const salarioMes = costeMensualTotal * (1 - porcSS);
  const ssMes = costeMensualTotal * porcSS;
  const extrasMes = costeMensualTotal * (config.porcentajePagasExtra / 100); // devengo (se paga al final/finiquito)

  // Generar movimientos mes a mes
  type Mov = { fecha: Date; importe: number; concepto: string };
  const movs: Mov[] = [];
  for (let m = 0; m < meses; m++) {
    const mesCursor = new Date(inicio.getFullYear(), inicio.getMonth() + m, 1);
    const fdm = finDeMes(mesCursor);
    movs.push({ fecha: fdm, importe: -salarioMes, concepto: `Nóminas mes ${m + 1}` });
    movs.push({ fecha: finDeMesSiguiente(mesCursor), importe: -ssMes, concepto: `Seguridad Social mes ${m + 1}` });
    // Certificación a fin de mes, cobro tras el plazo del cliente
    movs.push({ fecha: sumarDias(fdm, plazo), importe: factMes, concepto: `Cobro certificación mes ${m + 1}` });
  }
  // Finiquito de extras devengadas al acabar la obra
  movs.push({
    fecha: finDeMes(new Date(inicio.getFullYear(), inicio.getMonth() + meses - 1, 1)),
    importe: -extrasMes * meses,
    concepto: 'Pagas extra devengadas (finiquito)',
  });

  movs.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  // Proyección semanal hasta cubrir todos los movimientos
  const ultimaFecha = movs[movs.length - 1].fecha;
  const numSemanas = Math.ceil((ultimaFecha.getTime() - inicio.getTime()) / (7 * 86400000)) + 2;
  let lunes = lunesDeSemana(inicio);
  let saldo = Number(saldoInicial) || 0;
  let minimo = { semana: claveDia(lunes), saldo };
  let primerCobro: string | null = null;
  const semanas: { semana: string; entradas: number; salidas: number; saldoAcumulado: number; negativa: boolean }[] = [];

  for (let i = 0; i < numSemanas; i++) {
    const ini = lunes;
    const fin = sumarDias(lunes, 6);
    const delaSemana = movs.filter((m) => m.fecha >= ini && m.fecha <= fin);
    const entradas = delaSemana.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0);
    const salidas = delaSemana.filter((m) => m.importe < 0).reduce((s, m) => s - m.importe, 0);
    if (entradas > 0 && !primerCobro) primerCobro = claveDia(ini);
    saldo += entradas - salidas;
    semanas.push({
      semana: claveDia(ini),
      entradas: r2(entradas),
      salidas: r2(salidas),
      saldoAcumulado: r2(saldo),
      negativa: saldo < 0,
    });
    if (saldo < minimo.saldo) minimo = { semana: claveDia(ini), saldo: r2(saldo) };
    lunes = sumarDias(lunes, 7);
  }

  res.json({
    semanas,
    semanaMinima: minimo,
    necesidadMaxima: minimo.saldo < 0 ? r2(-minimo.saldo) : 0,
    primerCobro,
    desglose: [
      { concepto: `Coste mensual del equipo (${n} × ${costeBase} €)`, valor: r2(costeMensualTotal), unidad: '€/mes' },
      { concepto: `· Salarios a fin de mes (${100 - config.porcentajeSeguridadSocial}%)`, valor: r2(salarioMes), unidad: '€/mes' },
      { concepto: `· Seguridad Social al mes siguiente (${config.porcentajeSeguridadSocial}%)`, valor: r2(ssMes), unidad: '€/mes' },
      { concepto: `· Extras devengadas (${config.porcentajePagasExtra}%, se pagan al finiquito)`, valor: r2(extrasMes), unidad: '€/mes' },
      { concepto: `Certificación mensual, cobrada a ${plazo} días`, valor: r2(factMes), unidad: '€/mes' },
    ],
  });
});
