// Utilidades de formato: euros con separador de miles, fechas DD/MM/AAAA.

const fmtEuros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const fmtEurosEnteros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** 1234.56 → "1.234,56 €" */
export function euros(n: number | null | undefined): string {
  return fmtEuros.format(n ?? 0);
}

/** 1234.56 → "1.235 €" (para KPIs grandes) */
export function eurosEnteros(n: number | null | undefined): string {
  return fmtEurosEnteros.format(n ?? 0);
}

/** Fecha → "DD/MM/AAAA" */
export function fecha(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid',
  });
}

/** Fecha para inputs type="date" (AAAA-MM-DD) */
export function fechaInput(d: string | Date | null | undefined): string {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Hoy en formato input */
export function hoyInput(): string {
  return fechaInput(new Date());
}

/** 12.345 → "12,35 %" */
export function porcentaje(n: number | null | undefined): string {
  return `${(n ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
}

/** Número con separador español */
export function numero(n: number | null | undefined, decimales = 1): string {
  return (n ?? 0).toLocaleString('es-ES', { maximumFractionDigits: decimales });
}

// Etiquetas en español de los valores internos
export const ETIQUETAS: Record<string, string> = {
  // Categorías de trabajador
  PEON: 'Peón', OFICIAL_1: 'Oficial 1ª', OFICIAL_2: 'Oficial 2ª',
  ESPECIALISTA: 'Especialista', ENCARGADO: 'Encargado',
  // Tipos de cliente
  PROMOTORA: 'Promotora', CONSTRUCTORA: 'Constructora', INTERMEDIARIO: 'Intermediario',
  PARTICULAR: 'Particular', ARQUITECTO: 'Arquitecto',
  // Pipeline
  FRIO: 'Frío', CONTACTADO: 'Contactado', PROPUESTA: 'Propuesta enviada',
  NEGOCIACION: 'Negociación', GANADO: 'Cerrado ganado', PERDIDO: 'Cerrado perdido',
  // Obras
  ADMINISTRACION: 'Por administración', PRECIO_CERRADO: 'Precio cerrado', REFORMA: 'Reforma integral',
  PRESUPUESTADA: 'Presupuestada', ACTIVA: 'Activa', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada',
  // Facturas
  PENDIENTE: 'Pendiente', COBRADA: 'Cobrada', VENCIDA: 'Vencida',
  // Presupuestos
  BORRADOR: 'Borrador', ENVIADO: 'Enviado', ACEPTADO: 'Aceptado', RECHAZADO: 'Rechazado',
  // Documentos de trabajador
  ALTA_SS: 'Alta Seguridad Social', TPC: 'Tarjeta Profesional Construcción (TPC)',
  PRL_20H: 'Curso PRL 20h', RECONOCIMIENTO_MEDICO: 'Reconocimiento médico', OTRO: 'Otro',
  // Documentos de empresa
  REA: 'Inscripción REA', RC: 'Póliza Resp. Civil', SPA: 'Contrato SPA',
  CERT_AEAT: 'Certificado AEAT', CERT_SS: 'Certificado Seg. Social',
  ESCRITURA: 'Escritura / CNAE', PODERES: 'Escritura de poderes', TC1_TC2: 'TC1/TC2', CIF: 'CIF',
  // Documentos de proveedor/subcontratista
  TC2: 'TC2 (Seg. Social trabajadores)', SEGURO_RC: 'Seguro Resp. Civil', ALTA_AUTONOMO: 'Alta de autónomo',
  // Contratos
  INDEFINIDO: 'Indefinido', FIJO_OBRA: 'Fijo de obra', TEMPORAL: 'Temporal', FIJO_DISCONTINUO: 'Fijo discontinuo',
  // Interacciones
  LLAMADA: 'Llamada', EMAIL: 'Email', VISITA: 'Visita', REUNION: 'Reunión',
  // Gastos
  ESTRUCTURA: 'Estructura', MATERIALES: 'Materiales', SUBCONTRATA: 'Subcontrata', FINANCIERO: 'Financiero',
};

export const etiqueta = (v: string | null | undefined) => (v ? ETIQUETAS[v] ?? v : '—');

export const CATEGORIAS = ['PEON', 'OFICIAL_2', 'OFICIAL_1', 'ESPECIALISTA', 'ENCARGADO'];
export const ESTADOS_PIPELINE = ['FRIO', 'CONTACTADO', 'PROPUESTA', 'NEGOCIACION', 'GANADO', 'PERDIDO'];

/** Exporta filas a CSV (separador ; para Excel en español) y lo descarga. */
export function exportarCSV(nombreArchivo: string, filas: Record<string, unknown>[]) {
  if (filas.length === 0) return;
  const cabeceras = Object.keys(filas[0]);
  const lineas = [
    cabeceras.join(';'),
    ...filas.map((f) =>
      cabeceras
        .map((c) => {
          const v = f[c];
          const texto = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
          return `"${texto.replace(/"/g, '""')}"`;
        })
        .join(';')
    ),
  ];
  const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
