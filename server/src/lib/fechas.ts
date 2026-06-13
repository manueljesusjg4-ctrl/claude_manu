// Utilidades de fechas. Trabajamos siempre con fechas "de calendario"
// (sin componente horario relevante) en zona Europa/Madrid.

/** Devuelve una nueva fecha sumando `dias` días. */
export function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

/** Último día del mes de la fecha dada. */
export function finDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
}

/** Último día del mes SIGUIENTE (fecha de pago de la Seguridad Social). */
export function finDeMesSiguiente(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 2, 0);
}

/** Lunes de la semana ISO a la que pertenece la fecha. */
export function lunesDeSemana(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dia = d.getDay(); // 0 = domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  return sumarDias(d, diff);
}

/** Clave AAAA-MM-DD (para agrupar por día/semana de forma estable). */
export function claveDia(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Clave AAAA-MM (para agrupar por mes). */
export function claveMes(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

/** Número de meses (con fracción por días) entre dos fechas. */
export function mesesEntre(inicio: Date, fin: Date): number {
  const ms = fin.getTime() - inicio.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 30.44));
}

/** Días laborables (L-V) entre dos fechas, ambas incluidas. */
export function diasLaborablesEntre(inicio: Date, fin: Date): number {
  let n = 0;
  const d = new Date(inicio);
  while (d <= fin) {
    const dia = d.getDay();
    if (dia >= 1 && dia <= 5) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}
