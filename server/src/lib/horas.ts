// ============================================================================
// Detección de horas extraordinarias.
//
// Regla: si un trabajador supera 40 h en una misma semana (L-D, sumando todas
// sus obras), las horas que exceden de 40 se consideran extraordinarias y
// llevan un recargo configurable (por defecto +25%) tanto en coste como en
// facturación. El exceso se imputa a los últimos partes de la semana.
// ============================================================================
import { claveDia, lunesDeSemana } from './fechas';

export interface ParteEntrada {
  id: number;
  trabajadorId: number;
  obraId: number;
  fecha: Date;
  horas: number;
}

export interface ParteClasificado extends ParteEntrada {
  horasNormales: number;
  horasExtra: number;
  semana: string; // clave del lunes de la semana (AAAA-MM-DD)
}

const LIMITE_SEMANAL = 40;

/** Clasifica una lista de partes en horas normales y extra por semana. */
export function clasificarHorasExtra(partes: ParteEntrada[]): ParteClasificado[] {
  // Agrupar por trabajador + semana
  const grupos = new Map<string, ParteEntrada[]>();
  for (const p of partes) {
    const clave = `${p.trabajadorId}|${claveDia(lunesDeSemana(p.fecha))}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(p);
  }

  const resultado: ParteClasificado[] = [];
  for (const [clave, lista] of grupos) {
    const semana = clave.split('|')[1];
    // Orden cronológico: el exceso semanal se marca en los últimos partes
    lista.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id - b.id);
    let acumulado = 0;
    for (const p of lista) {
      const antes = acumulado;
      acumulado += p.horas;
      const normalesDisponibles = Math.max(0, LIMITE_SEMANAL - antes);
      const horasNormales = Math.min(p.horas, normalesDisponibles);
      const horasExtra = p.horas - horasNormales;
      resultado.push({ ...p, horasNormales, horasExtra, semana });
    }
  }
  return resultado;
}
