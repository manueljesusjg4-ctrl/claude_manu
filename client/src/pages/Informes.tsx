// INFORMES: margen por obra/cliente, facturación, coste laboral y rentabilidad
// por categoría. Exportación a CSV (Excel) y a PDF (impresión).
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { euros, fecha, hoyInput, porcentaje, etiqueta, numero, exportarCSV } from '../lib/formato';
import { CabeceraPagina, Cargando } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORES = ['#162D45', '#E6530C', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

type Pestania = 'obras' | 'facturacion' | 'laboral' | 'categorias' | 'gestoria';

export function Informes() {
  const [pestania, setPestania] = useState<Pestania>('obras');
  const tabs: { id: Pestania; texto: string }[] = [
    { id: 'obras', texto: 'Margen por obra/cliente' },
    { id: 'facturacion', texto: 'Facturación' },
    { id: 'laboral', texto: 'Coste laboral' },
    { id: 'categorias', texto: 'Rentabilidad por categoría' },
    { id: 'gestoria', texto: 'Exportar a gestoría' },
  ];
  return (
    <div>
      <CabeceraPagina titulo="Informes" subtitulo="Análisis del negocio. Exporta a Excel o PDF desde cada informe.">
        <button className="boton-secundario no-imprimir" onClick={() => window.print()}>🖨 PDF</button>
      </CabeceraPagina>
      <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto no-imprimir">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setPestania(t.id)} className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${pestania === t.id ? 'border-acento text-acento' : 'border-transparent text-slate-500'}`}>{t.texto}</button>
        ))}
      </div>
      {pestania === 'obras' && <InformeObras />}
      {pestania === 'facturacion' && <InformeFacturacion />}
      {pestania === 'laboral' && <InformeLaboral />}
      {pestania === 'categorias' && <InformeCategorias />}
      {pestania === 'gestoria' && <InformeGestoria />}
    </div>
  );
}

function InformeObras() {
  const [datos, setDatos] = useState<any>(null);
  useEffect(() => { api.get('/api/informes/margen-obras').then(setDatos); }, []);
  if (!datos) return <Cargando />;
  return (
    <div className="space-y-5">
      <div className="tarjeta overflow-x-auto">
        <div className="px-4 pt-4 flex justify-between"><h3 className="font-bold text-marino">Margen por obra</h3><button className="boton-secundario text-xs no-imprimir" onClick={() => exportarCSV('margen-obras.csv', datos.obras)}>⬇ CSV</button></div>
        <table className="w-full">
          <thead><tr><th className="th">Obra</th><th className="th">Cliente</th><th className="th">Estado</th><th className="th">Horas</th><th className="th">Coste real</th><th className="th">Facturado</th><th className="th">Margen</th><th className="th">% Margen</th></tr></thead>
          <tbody>
            {datos.obras.map((o: any) => (
              <tr key={o.obraId}>
                <td className="td font-medium">{o.obra}</td><td className="td">{o.cliente}</td><td className="td">{etiqueta(o.estado)}</td>
                <td className="td">{numero(o.horas)}</td><td className="td">{euros(o.costeReal)}</td><td className="td">{euros(o.facturado)}</td>
                <td className={`td font-semibold ${o.margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euros(o.margen)}</td>
                <td className="td">{porcentaje(o.margenPorc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tarjeta overflow-x-auto">
        <div className="px-4 pt-4 flex justify-between"><h3 className="font-bold text-marino">Margen por cliente</h3><button className="boton-secundario text-xs no-imprimir" onClick={() => exportarCSV('margen-clientes.csv', datos.clientes)}>⬇ CSV</button></div>
        <table className="w-full">
          <thead><tr><th className="th">Cliente</th><th className="th">Coste real</th><th className="th">Facturado</th><th className="th">Margen</th><th className="th">% Margen</th></tr></thead>
          <tbody>
            {datos.clientes.map((c: any) => (
              <tr key={c.cliente}><td className="td font-medium">{c.cliente}</td><td className="td">{euros(c.costeReal)}</td><td className="td">{euros(c.facturado)}</td><td className={`td font-semibold ${c.margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euros(c.margen)}</td><td className="td">{porcentaje(c.margenPorc)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InformeFacturacion() {
  const [datos, setDatos] = useState<any>(null);
  useEffect(() => { api.get('/api/informes/facturacion').then(setDatos); }, []);
  if (!datos) return <Cargando />;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="tarjeta p-5">
        <div className="flex justify-between mb-3"><h3 className="font-bold text-marino">Facturación por mes</h3><button className="boton-secundario text-xs no-imprimir" onClick={() => exportarCSV('facturacion-mes.csv', datos.porMes)}>⬇ CSV</button></div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={datos.porMes}>
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickFormatter={(m) => m.split('-').reverse().join('/')} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
            <Tooltip formatter={(v: number) => euros(v)} />
            <Bar dataKey="importe" name="Facturación" fill="#162D45" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="tarjeta p-5">
        <div className="flex justify-between mb-3"><h3 className="font-bold text-marino">Facturación por cliente</h3><button className="boton-secundario text-xs no-imprimir" onClick={() => exportarCSV('facturacion-cliente.csv', datos.porCliente)}>⬇ CSV</button></div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={datos.porCliente} dataKey="importe" nameKey="cliente" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.cliente?.slice(0, 12)}>
              {datos.porCliente.map((_: any, i: number) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => euros(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function InformeLaboral() {
  const [datos, setDatos] = useState<any>(null);
  useEffect(() => { api.get('/api/informes/coste-laboral').then(setDatos); }, []);
  if (!datos) return <Cargando />;
  return (
    <div className="space-y-5">
      <div className="tarjeta p-5 max-w-md">
        <p className="text-sm text-slate-500">Coste de plantilla activa al mes (con extras prorrateadas)</p>
        <p className="text-3xl font-bold text-marino mt-1">{euros(datos.costePlantillaMensual)}</p>
      </div>
      <div className="tarjeta p-5">
        <div className="flex justify-between mb-3"><h3 className="font-bold text-marino">Coste laboral imputado a obras por mes</h3><button className="boton-secundario text-xs no-imprimir" onClick={() => exportarCSV('coste-laboral.csv', datos.imputadoPorMes)}>⬇ CSV</button></div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={datos.imputadoPorMes}>
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickFormatter={(m) => m.split('-').reverse().join('/')} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
            <Tooltip formatter={(v: number) => euros(v)} />
            <Bar dataKey="importe" name="Coste imputado" fill="#E6530C" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function InformeCategorias() {
  const [datos, setDatos] = useState<any[] | null>(null);
  useEffect(() => { api.get('/api/informes/rentabilidad-categorias').then(setDatos); }, []);
  if (!datos) return <Cargando />;
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">Para ver qué categorías dejan más margen (normalmente oficiales y especialistas por encima de los peones).</p>
      <div className="tarjeta overflow-x-auto">
        <div className="px-4 pt-4 flex justify-between"><h3 className="font-bold text-marino">Rentabilidad por categoría</h3><button className="boton-secundario text-xs no-imprimir" onClick={() => exportarCSV('rentabilidad-categorias.csv', datos.map((d) => ({ ...d, categoria: etiqueta(d.categoria) })))}>⬇ CSV</button></div>
        <table className="w-full">
          <thead><tr><th className="th">Categoría</th><th className="th">Horas</th><th className="th">Coste</th><th className="th">Facturable</th><th className="th">Margen</th><th className="th">% Margen</th><th className="th">Margen/hora</th></tr></thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.categoria}>
                <td className="td font-medium">{etiqueta(d.categoria)}</td><td className="td">{numero(d.horas)}</td>
                <td className="td">{euros(d.coste)}</td><td className="td">{euros(d.facturable)}</td>
                <td className={`td font-semibold ${d.margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euros(d.margen)}</td>
                <td className="td">{porcentaje(d.margenPorc)}</td><td className="td font-bold text-acento">{euros(d.margenPorHora)}/h</td>
              </tr>
            ))}
            {datos.length === 0 && <tr><td className="td text-slate-400" colSpan={7}>Sin datos de horas todavía.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InformeGestoria() {
  const haceUnMes = new Date(); haceUnMes.setMonth(haceUnMes.getMonth() - 1);
  const [desde, setDesde] = useState(haceUnMes.toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(hoyInput());
  const [movimientos, setMovimientos] = useState<any[] | null>(null);

  const cargar = () => {
    const params = new URLSearchParams({ desde, hasta });
    api.get(`/api/informes/gestoria?${params}`).then(setMovimientos);
  };
  useEffect(cargar, []);

  const totalIngresos = movimientos?.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.total, 0) ?? 0;
  const totalGastos = movimientos?.filter((m) => m.tipo === 'GASTO').reduce((s, m) => s + m.total, 0) ?? 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">Listado de facturas emitidas y gastos del periodo, listo para enviar a la gestoría (CSV importable en Excel/contabilidad).</p>
      <div className="tarjeta p-4 flex flex-wrap items-end gap-3">
        <div><label className="etiqueta">Desde</label><input type="date" className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><label className="etiqueta">Hasta</label><input type="date" className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <button className="boton-secundario" onClick={cargar}>Filtrar</button>
        {movimientos && (
          <button className="boton-primario no-imprimir ml-auto" onClick={() => exportarCSV(`gestoria-${desde}-a-${hasta}.csv`, movimientos)}>⬇ Exportar CSV</button>
        )}
      </div>

      {!movimientos ? <Cargando /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="tarjeta p-4"><p className="text-xs text-slate-500">Ingresos (facturado)</p><p className="text-xl font-bold text-emerald-600">{euros(totalIngresos)}</p></div>
            <div className="tarjeta p-4"><p className="text-xs text-slate-500">Gastos</p><p className="text-xl font-bold text-red-600">{euros(totalGastos)}</p></div>
            <div className="tarjeta p-4"><p className="text-xs text-slate-500">Neto del periodo</p><p className="text-xl font-bold text-marino">{euros(totalIngresos - totalGastos)}</p></div>
          </div>
          <div className="tarjeta overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Fecha</th><th className="th">Tipo</th><th className="th">Concepto</th><th className="th">Contraparte</th><th className="th">Base</th><th className="th">IVA</th><th className="th">Total</th><th className="th">Cobrado/Pagado</th></tr></thead>
              <tbody>
                {movimientos.map((m, i) => (
                  <tr key={i}>
                    <td className="td">{fecha(m.fecha)}</td>
                    <td className="td">{m.tipo === 'INGRESO' ? <span className="text-emerald-600 font-semibold">Ingreso</span> : <span className="text-red-600 font-semibold">Gasto</span>}</td>
                    <td className="td font-medium">{m.concepto}</td>
                    <td className="td">{m.contraparte}</td>
                    <td className="td">{euros(m.baseImponible)}</td>
                    <td className="td">{euros(m.cuotaIva)}</td>
                    <td className="td font-semibold">{euros(m.total)}</td>
                    <td className="td">{m.cobradoOPagado ? '✓' : <span className="text-amber-600">Pendiente</span>}</td>
                  </tr>
                ))}
                {movimientos.length === 0 && <tr><td className="td text-slate-400" colSpan={8}>Sin movimientos en este periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
