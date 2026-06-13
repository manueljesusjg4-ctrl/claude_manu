// ============================================================================
// MOTOR DE CÁLCULO DE COSTES — la lógica de negocio más importante de la app.
//
// El coste real de un trabajador NO es su nómina mensual:
//   1) Coste empresa mensual base (salario + SS empresa), ej. peón 1.976 €/mes.
//   2) + Pagas extra prorrateadas (~16%, configurable): se devengan mes a mes
//      aunque se paguen en junio/diciembre o en el finiquito.
//   3) Coste/hora en DOS modos:
//        - MENSUAL:    coste mensual con extras ÷ horas de presencia/mes (160 h).
//          Útil para ver el desembolso de caja de cada mes.
//        - ANUALIZADO: coste anual total ÷ horas efectivas/año (1.736 h según
//          convenio de Valencia, ya descontando vacaciones). Es el coste REAL
//          para fijar precios, porque reparte el mes de vacaciones (cobrado
//          pero no trabajado).
//        - OBRA CORTA: para contratos cortos sin disfrute de vacaciones, se
//          usa el coste del periodo ÷ horas realmente trabajadas.
//   4) + Costes adicionales por trabajador: EPIs y reconocimiento médico.
//   5) + (opcional) Overhead de estructura: gastos fijos mensuales repartidos
//      entre los operarios activos. Se muestra CON y SIN estructura.
//
// Cada función devuelve además un "desglose" legible para que el usuario vea
// de dónde sale cada número.
// ============================================================================

export interface ParametrosCostes {
  porcentajePagasExtra: number;      // ej. 16 (%)
  horasMes: number;                  // ej. 160
  horasAnio: number;                 // ej. 1736
  costeEpisAnual: number;            // ej. 91 €
  costeReconocimientoAnual: number;  // ej. 45 €
  recargoHoraExtra: number;          // ej. 25 (%)
}

export interface LineaDesglose {
  concepto: string;
  formula: string;
  valor: number;
  unidad: string; // '€', '€/mes', '€/h', 'h', '%'
}

export interface CosteTrabajador {
  costeBaseMensual: number;
  extrasProrrateadasMes: number;     // € que añaden las pagas extra cada mes
  costeMensualConExtras: number;     // base * (1 + %extras)
  adicionalesAnual: number;          // EPIs + reconocimiento médico
  adicionalesPorHora: number;        // adicionales ÷ horas año
  costeAnualTotal: number;           // 12 × mensual con extras + adicionales
  costeHoraMensual: number;          // SIN estructura
  costeHoraAnualizado: number;       // SIN estructura (el "real" para precios)
  desglose: LineaDesglose[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Calcula el coste completo de un trabajador a partir de su coste empresa mensual base. */
export function calcularCosteTrabajador(
  costeBaseMensual: number,
  p: ParametrosCostes
): CosteTrabajador {
  const extrasProrrateadasMes = costeBaseMensual * (p.porcentajePagasExtra / 100);
  const costeMensualConExtras = costeBaseMensual + extrasProrrateadasMes;
  const adicionalesAnual = p.costeEpisAnual + p.costeReconocimientoAnual;
  const adicionalesPorHora = p.horasAnio > 0 ? adicionalesAnual / p.horasAnio : 0;
  const costeAnualTotal = costeMensualConExtras * 12 + adicionalesAnual;

  // Modo mensual: desembolso ÷ horas de presencia al mes (+ adicionales/h)
  const costeHoraMensual =
    (p.horasMes > 0 ? costeMensualConExtras / p.horasMes : 0) + adicionalesPorHora;

  // Modo anualizado: coste anual ÷ horas efectivamente trabajadas al año
  const costeHoraAnualizado = p.horasAnio > 0 ? costeAnualTotal / p.horasAnio : 0;

  const desglose: LineaDesglose[] = [
    {
      concepto: 'Coste empresa mensual base (salario + SS empresa)',
      formula: 'Dato de nómina',
      valor: r2(costeBaseMensual),
      unidad: '€/mes',
    },
    {
      concepto: `Pagas extra prorrateadas (${p.porcentajePagasExtra}%)`,
      formula: `${r2(costeBaseMensual)} × ${p.porcentajePagasExtra}%`,
      valor: r2(extrasProrrateadasMes),
      unidad: '€/mes',
    },
    {
      concepto: 'Coste mensual CON extras',
      formula: `${r2(costeBaseMensual)} + ${r2(extrasProrrateadasMes)}`,
      valor: r2(costeMensualConExtras),
      unidad: '€/mes',
    },
    {
      concepto: 'Adicionales anuales (EPIs + reconocimiento médico)',
      formula: `${p.costeEpisAnual} + ${p.costeReconocimientoAnual}`,
      valor: r2(adicionalesAnual),
      unidad: '€/año',
    },
    {
      concepto: 'Coste anual total',
      formula: `${r2(costeMensualConExtras)} × 12 + ${r2(adicionalesAnual)}`,
      valor: r2(costeAnualTotal),
      unidad: '€/año',
    },
    {
      concepto: 'Coste/hora MENSUAL (caja)',
      formula: `${r2(costeMensualConExtras)} ÷ ${p.horasMes} h + ${r2(adicionalesPorHora)} €/h adicionales`,
      valor: r2(costeHoraMensual),
      unidad: '€/h',
    },
    {
      concepto: 'Coste/hora ANUALIZADO (real, para fijar precios)',
      formula: `${r2(costeAnualTotal)} ÷ ${p.horasAnio} h`,
      valor: r2(costeHoraAnualizado),
      unidad: '€/h',
    },
  ];

  return {
    costeBaseMensual: r2(costeBaseMensual),
    extrasProrrateadasMes: r2(extrasProrrateadasMes),
    costeMensualConExtras: r2(costeMensualConExtras),
    adicionalesAnual: r2(adicionalesAnual),
    adicionalesPorHora: r2(adicionalesPorHora),
    costeAnualTotal: r2(costeAnualTotal),
    costeHoraMensual: r2(costeHoraMensual),
    costeHoraAnualizado: r2(costeHoraAnualizado),
    desglose,
  };
}

export interface Overhead {
  gastosEstructuraMes: number;   // suma de gastos fijos mensuales
  operariosActivos: number;
  overheadPorOperarioMes: number;
  overheadPorHoraMensual: number;    // sobre horas de presencia/mes
  overheadPorHoraAnualizado: number; // sobre horas efectivas/año
  desglose: LineaDesglose[];
}

/** Reparte los gastos fijos de estructura entre los operarios activos. */
export function calcularOverhead(
  gastosEstructuraMes: number,
  operariosActivos: number,
  p: ParametrosCostes
): Overhead {
  const n = Math.max(1, operariosActivos);
  const porOperarioMes = gastosEstructuraMes / n;
  const porHoraMensual = p.horasMes > 0 ? porOperarioMes / p.horasMes : 0;
  const porHoraAnualizado = p.horasAnio > 0 ? (porOperarioMes * 12) / p.horasAnio : 0;
  return {
    gastosEstructuraMes: r2(gastosEstructuraMes),
    operariosActivos,
    overheadPorOperarioMes: r2(porOperarioMes),
    overheadPorHoraMensual: r2(porHoraMensual),
    overheadPorHoraAnualizado: r2(porHoraAnualizado),
    desglose: [
      {
        concepto: 'Gastos fijos de estructura al mes (SPA, RC, gestoría, oficina...)',
        formula: 'Suma de gastos recurrentes de categoría ESTRUCTURA',
        valor: r2(gastosEstructuraMes),
        unidad: '€/mes',
      },
      {
        concepto: `Reparto entre ${operariosActivos} operario(s) activo(s)`,
        formula: `${r2(gastosEstructuraMes)} ÷ ${n}`,
        valor: r2(porOperarioMes),
        unidad: '€/mes por operario',
      },
      {
        concepto: 'Overhead por hora (modo mensual)',
        formula: `${r2(porOperarioMes)} ÷ ${p.horasMes} h`,
        valor: r2(porHoraMensual),
        unidad: '€/h',
      },
      {
        concepto: 'Overhead por hora (modo anualizado)',
        formula: `${r2(porOperarioMes)} × 12 ÷ ${p.horasAnio} h`,
        valor: r2(porHoraAnualizado),
        unidad: '€/h',
      },
    ],
  };
}

export interface CosteObraCorta {
  meses: number;
  costePeriodo: number;
  horasTrabajadas: number;
  costeHora: number;
  desglose: LineaDesglose[];
}

/**
 * Modo "obra corta": contrato corto sin disfrute de vacaciones.
 * Coste del periodo (con extras devengadas, que se pagan en el finiquito)
 * dividido entre las horas realmente trabajadas en el periodo.
 */
export function calcularCosteObraCorta(
  costeBaseMensual: number,
  meses: number,
  horasTrabajadas: number,
  p: ParametrosCostes
): CosteObraCorta {
  const costeMensualConExtras = costeBaseMensual * (1 + p.porcentajePagasExtra / 100);
  const adicionales = (p.costeEpisAnual + p.costeReconocimientoAnual) * Math.min(1, meses / 12);
  const costePeriodo = costeMensualConExtras * meses + adicionales;
  const costeHora = horasTrabajadas > 0 ? costePeriodo / horasTrabajadas : 0;
  return {
    meses: r2(meses),
    costePeriodo: r2(costePeriodo),
    horasTrabajadas: r2(horasTrabajadas),
    costeHora: r2(costeHora),
    desglose: [
      {
        concepto: 'Coste mensual con extras devengadas (se pagan en finiquito)',
        formula: `${r2(costeBaseMensual)} × (1 + ${p.porcentajePagasExtra}%)`,
        valor: r2(costeMensualConExtras),
        unidad: '€/mes',
      },
      {
        concepto: `Coste del periodo (${r2(meses)} meses) + adicionales proporcionales`,
        formula: `${r2(costeMensualConExtras)} × ${r2(meses)} + ${r2(adicionales)}`,
        valor: r2(costePeriodo),
        unidad: '€',
      },
      {
        concepto: 'Coste/hora obra corta',
        formula: `${r2(costePeriodo)} ÷ ${r2(horasTrabajadas)} h trabajadas`,
        valor: r2(costeHora),
        unidad: '€/h',
      },
    ],
  };
}
