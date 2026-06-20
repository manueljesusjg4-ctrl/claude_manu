// DASHBOARD: caja proyectada, KPIs, alertas y próximas acciones del CRM.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { eurosEnteros, fecha } from '../lib/formato';
import { CabeceraPagina, Cargando, TarjetaKpi, Aviso } from '../components/ui';
import { GraficoCaja, SemanaGrafico } from '../components/GraficoCaja';

interface DatosDashboard {
  caja: { semanas: SemanaGrafico[]; semanaMinima: { semana: string; saldo: number } | null; necesidadMaxima: number };
  kpis: {
    facturacionMes: number; facturacionAnio: number;
    margenMesEstimado: number; margenAnioEstimado: number;
    costeLaboralMes: number; gastosFijosMes: number;
    obrasActivas: number; trabajadoresActivos: number; enObraHoy: number;
    fondoManiobra: number; porCobrar: number; porPagar: number;
  };
  alertas: { tipo: string; nivel: 'ROJO' | 'AMBAR'; mensaje: string; enlace: string }[];
  seguimientos: { id: number; fechaPrevista: string; descripcion: string; cliente: { id: number; nombre: string }; vencido: boolean }[];
}

export function Dashboard() {
  const [datos, setDatos] = useState<DatosDashboard | null>(null);
  const [margenObras, setMargenObras] = useState<{ obras: { facturado: number; margen: number }[] } | null>(null);

  useEffect(() => {
    api.get<DatosDashboard>('/api/dashboard').then(setDatos);
    api.get('/api/informes/margen-obras').then(setMargenObras);
  }, []);

  if (!datos) return <Cargando />;
  const { kpis, caja } = datos;
  const semanasNegativas = caja.semanas.filter((s) => s.negativa).length;

  // Margen bruto en tiempo real: agregado de todas las obras, calculado al
  // vuelo a partir de los partes de horas y facturas actuales (no es un dato
  // guardado, así que siempre refleja la situación real de hoy).
  const facturadoTotal = margenObras?.obras.reduce((s, o) => s + o.facturado, 0) ?? 0;
  const margenBrutoTotal = margenObras?.obras.reduce((s, o) => s + o.margen, 0) ?? 0;
  const margenBrutoPorc = facturadoTotal > 0 ? (margenBrutoTotal / facturadoTotal) * 100 : 0;

  return (
    <div>
      <CabeceraPagina titulo="Dashboard" subtitulo="Vista general del negocio a día de hoy" />

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <TarjetaKpi titulo="Facturación del mes" valor={eurosEnteros(kpis.facturacionMes)} secundario={`Año: ${eurosEnteros(kpis.facturacionAnio)}`} tono="acento" />
        <TarjetaKpi
          titulo="Margen del mes (est.)"
          valor={eurosEnteros(kpis.margenMesEstimado)}
          secundario={`Año: ${eurosEnteros(kpis.margenAnioEstimado)}`}
          tono={kpis.margenMesEstimado >= 0 ? 'bueno' : 'malo'}
        />
        <TarjetaKpi titulo="Coste laboral/mes" valor={eurosEnteros(kpis.costeLaboralMes)} secundario="Con extras prorrateadas" />
        <TarjetaKpi titulo="Obras activas" valor={String(kpis.obrasActivas)} />
        <TarjetaKpi titulo="Trabajadores activos" valor={String(kpis.trabajadoresActivos)} />
        <TarjetaKpi titulo="Hoy en obra" valor={String(kpis.enObraHoy)} />
        <TarjetaKpi
          titulo="Margen bruto en tiempo real"
          valor={`${margenBrutoPorc.toFixed(1)}%`}
          secundario={`${eurosEnteros(margenBrutoTotal)} sobre lo facturado`}
          tono={margenBrutoTotal >= 0 ? 'bueno' : 'malo'}
        />
        <TarjetaKpi
          titulo="Fondo de maniobra"
          valor={eurosEnteros(kpis.fondoManiobra)}
          secundario={`Por cobrar ${eurosEnteros(kpis.porCobrar)} · por pagar ${eurosEnteros(kpis.porPagar)}`}
          tono={kpis.fondoManiobra >= 0 ? 'bueno' : 'malo'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Caja proyectada */}
        <div className="tarjeta p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-marino">Caja proyectada — próximas 12 semanas</h2>
            <Link to="/tesoreria" className="text-xs font-semibold text-acento hover:underline">Ver tesorería →</Link>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Cobros esperados vs pagos (nóminas, Seguridad Social, gastos fijos). Las semanas en rojo quedan en negativo.
          </p>
          {semanasNegativas > 0 && (
            <div className="mb-3">
              <Aviso tipo="rojo">
                ⚠ <b>{semanasNegativas} semana(s) con caja negativa.</b> Punto más bajo:{' '}
                <b>{eurosEnteros(caja.semanaMinima?.saldo ?? 0)}</b> la semana del {fecha(caja.semanaMinima?.semana)}.
                Necesitas adelantar hasta <b>{eurosEnteros(caja.necesidadMaxima)}</b>.
              </Aviso>
            </div>
          )}
          <GraficoCaja semanas={caja.semanas} />
        </div>

        {/* Alertas */}
        <div className="tarjeta p-5">
          <h2 className="font-bold text-marino mb-3">Alertas ({datos.alertas.length})</h2>
          {datos.alertas.length === 0 && <p className="text-sm text-slate-400">Sin alertas. Todo en orden ✔</p>}
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {datos.alertas.map((a, i) => (
              <Link key={i} to={a.enlace} className="block">
                <div className={`rounded-lg border p-2.5 text-xs font-medium hover:opacity-80 ${a.nivel === 'ROJO' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  {a.mensaje}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Próximas acciones CRM */}
      <div className="tarjeta p-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-marino">Próximas acciones comerciales</h2>
          <Link to="/crm" className="text-xs font-semibold text-acento hover:underline">Ir al CRM →</Link>
        </div>
        {datos.seguimientos.length === 0 && <p className="text-sm text-slate-400">No hay seguimientos pendientes.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {datos.seguimientos.map((s) => (
            <Link key={s.id} to={`/crm/${s.cliente.id}`}>
              <div className={`rounded-lg border p-3 text-sm hover:bg-slate-50 ${s.vencido ? 'border-red-300' : 'border-slate-200'}`}>
                <span className={`font-bold ${s.vencido ? 'text-red-600' : 'text-marino'}`}>{fecha(s.fechaPrevista)}</span>
                {s.vencido && <span className="text-xs text-red-600 font-semibold ml-2">¡Atrasado!</span>}
                <p className="text-slate-700 mt-0.5">{s.descripcion}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.cliente.nombre}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
