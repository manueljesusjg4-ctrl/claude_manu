// Componentes pequeños reutilizables de la interfaz.
import { ChangeEvent, ReactNode, useEffect, useState } from 'react';
import { api, registrarAvisador } from '../lib/api';
import { euros, porcentaje } from '../lib/formato';

/** Avisos flotantes (toasts). Se monta una sola vez en la app y muestra los
 * mensajes que cualquier parte de la app lance con avisar(). */
export function Notificaciones() {
  const [avisos, setAvisos] = useState<{ id: number; mensaje: string; tipo: 'error' | 'ok' }[]>([]);
  useEffect(() => {
    registrarAvisador((mensaje, tipo = 'error') => {
      const id = Date.now() + Math.random();
      setAvisos((a) => [...a, { id, mensaje, tipo }]);
      setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 6000);
    });
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {avisos.map((a) => (
        <div
          key={a.id}
          onClick={() => setAvisos((x) => x.filter((y) => y.id !== a.id))}
          className={`rounded-lg border p-3 text-sm shadow-lg cursor-pointer ${a.tipo === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}
        >
          {a.tipo === 'ok' ? '✓ ' : '⚠ '}{a.mensaje}
        </div>
      ))}
    </div>
  );
}

/** Tarjeta KPI del dashboard. */
export function TarjetaKpi({
  titulo, valor, secundario, tono = 'normal',
}: {
  titulo: string; valor: string; secundario?: string;
  tono?: 'normal' | 'bueno' | 'malo' | 'acento';
}) {
  const colorValor =
    tono === 'bueno' ? 'text-emerald-600' : tono === 'malo' ? 'text-red-600' : tono === 'acento' ? 'text-acento' : 'text-marino';
  return (
    <div className="tarjeta p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${colorValor}`}>{valor}</p>
      {secundario && <p className="text-xs text-slate-500 mt-1">{secundario}</p>}
    </div>
  );
}

/** Etiqueta de estado con color. */
export function Badge({ texto, color }: { texto: string; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {texto}
    </span>
  );
}

export const COLORES_BADGE: Record<string, string> = {
  ACTIVO: 'bg-emerald-100 text-emerald-700', INACTIVO: 'bg-slate-200 text-slate-600',
  ACTIVA: 'bg-emerald-100 text-emerald-700', PRESUPUESTADA: 'bg-blue-100 text-blue-700',
  FINALIZADA: 'bg-slate-200 text-slate-600', CANCELADA: 'bg-red-100 text-red-700',
  PENDIENTE: 'bg-amber-100 text-amber-700', COBRADA: 'bg-emerald-100 text-emerald-700',
  VENCIDA: 'bg-red-100 text-red-700',
  BORRADOR: 'bg-slate-200 text-slate-600', ENVIADO: 'bg-blue-100 text-blue-700',
  ACEPTADO: 'bg-emerald-100 text-emerald-700', RECHAZADO: 'bg-red-100 text-red-700',
  FRIO: 'bg-slate-200 text-slate-600', CONTACTADO: 'bg-sky-100 text-sky-700',
  PROPUESTA: 'bg-blue-100 text-blue-700', NEGOCIACION: 'bg-amber-100 text-amber-700',
  GANADO: 'bg-emerald-100 text-emerald-700', PERDIDO: 'bg-red-100 text-red-700',
  CADUCADO: 'bg-red-100 text-red-700', POR_CADUCAR: 'bg-amber-100 text-amber-700',
  VIGENTE: 'bg-emerald-100 text-emerald-700', SIN_CADUCIDAD: 'bg-slate-100 text-slate-500',
};

/** Ventana modal sencilla. */
export function Modal({
  titulo, abierto, alCerrar, children, ancho = 'max-w-2xl',
}: {
  titulo: string; abierto: boolean; alCerrar: () => void; children: ReactNode; ancho?: string;
}) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-marino/60 p-4 overflow-y-auto" onClick={alCerrar}>
      <div className={`tarjeta w-full ${ancho} mt-10 mb-10`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-marino">{titulo}</h3>
          <button onClick={alCerrar} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Desglose de un cálculo: el usuario quiere VER de dónde sale cada número. */
export function Desglose({
  lineas, titulo = 'Ver desglose del cálculo',
}: {
  lineas: { concepto: string; formula?: string; valor: number; unidad: string }[];
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setAbierto(!abierto)}
        className="text-xs font-semibold text-acento hover:text-acento-claro"
      >
        {abierto ? '▾ Ocultar desglose' : `▸ ${titulo}`}
      </button>
      {abierto && (
        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5">
          {lineas.map((l, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-700 font-medium">{l.concepto}</span>
                {l.formula && <span className="text-slate-400 ml-2 font-mono">{l.formula}</span>}
              </div>
              <span className="font-bold text-marino whitespace-nowrap">
                {l.unidad.startsWith('€') ? euros(l.valor) : l.valor.toLocaleString('es-ES')}{' '}
                <span className="font-normal text-slate-400">{l.unidad.replace('€', '').trim()}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Indicador de margen con aviso por debajo del umbral. */
export function IndicadorMargen({
  margen, margenPorc, umbral = 15,
}: { margen: number; margenPorc: number; umbral?: number }) {
  const malo = margenPorc < umbral;
  const negativo = margen < 0;
  return (
    <div className={`rounded-lg p-3 border ${negativo ? 'bg-red-50 border-red-200' : malo ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-600">Margen</span>
        <span className={`text-lg font-bold ${negativo ? 'text-red-600' : malo ? 'text-amber-600' : 'text-emerald-600'}`}>
          {euros(margen)} <span className="text-sm">({porcentaje(margenPorc)})</span>
        </span>
      </div>
      {negativo && <p className="text-xs text-red-700 mt-1 font-semibold">⚠ MARGEN NEGATIVO: esta operación pierde dinero.</p>}
      {!negativo && malo && <p className="text-xs text-amber-700 mt-1 font-semibold">⚠ Margen por debajo del umbral del {umbral}%.</p>}
    </div>
  );
}

/** Aviso/banner reutilizable. */
export function Aviso({ tipo, children }: { tipo: 'rojo' | 'ambar' | 'azul'; children: ReactNode }) {
  const estilos = {
    rojo: 'bg-red-50 border-red-200 text-red-800',
    ambar: 'bg-amber-50 border-amber-200 text-amber-800',
    azul: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return <div className={`rounded-lg border p-3 text-sm ${estilos[tipo]}`}>{children}</div>;
}

/** Cabecera de página con título y acciones. */
export function CabeceraPagina({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-marino">{titulo}</h1>
        {subtitulo && <p className="text-sm text-slate-500 mt-0.5">{subtitulo}</p>}
      </div>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
  );
}

/** Estado de carga. */
export function Cargando() {
  return <div className="p-10 text-center text-slate-400 text-sm">Cargando…</div>;
}

/** Campo para subir un PDF o imagen (foto del documento) y guardarlo en el servidor. */
export function CampoArchivo({
  valor, alCambiar, etiqueta = 'Archivo (PDF o foto)',
}: { valor: string; alCambiar: (url: string) => void; etiqueta?: string }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const manejarArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    try {
      const { url } = await api.subir(archivo);
      alCambiar(url);
    } catch (err: any) {
      setError(err.message || 'Error al subir el archivo');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <label className="etiqueta">{etiqueta}</label>
      <input type="file" accept="application/pdf,image/*" className="campo" onChange={manejarArchivo} disabled={subiendo} />
      {subiendo && <p className="text-xs text-slate-400 mt-1">Subiendo…</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {valor && !subiendo && (
        <p className="text-xs text-emerald-600 mt-1">
          ✓ Archivo guardado — <a href={valor} target="_blank" rel="noreferrer" className="text-acento font-semibold">abrir / ver →</a> (sube otro archivo para sustituirlo)
        </p>
      )}
    </div>
  );
}
