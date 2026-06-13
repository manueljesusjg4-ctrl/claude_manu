// Editor de presupuesto: líneas de mano de obra o partidas a precio cerrado,
// con margen recalculado en tiempo real y exportación a PDF (window.print).
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { euros, fecha, fechaInput, porcentaje, etiqueta, CATEGORIAS } from '../lib/formato';
import { Aviso, CabeceraPagina, Cargando, IndicadorMargen } from '../components/ui';

interface Linea { descripcion: string; categoria: string; cantidad: number; precioUnitario: number; costeUnitario: number; }

export function PresupuestoEditor() {
  const { id } = useParams();
  const [p, setP] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [tarifas, setTarifas] = useState<any[]>([]);
  const [trabajadores, setTrabajadores] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [guardado, setGuardado] = useState(true);

  useEffect(() => {
    api.get(`/api/presupuestos/${id}`).then((r) => { setP(r); setLineas(r.lineas); });
    api.get('/api/clientes').then(setClientes);
    api.get('/api/configuracion/tarifas').then(setTarifas);
    api.get('/api/trabajadores').then(setTrabajadores);
    api.get('/api/configuracion').then(setConfig);
  }, [id]);

  // Coste/hora medio anualizado por categoría (a partir de los trabajadores reales)
  const costePorCategoria = useMemo(() => {
    const m: Record<string, { suma: number; n: number }> = {};
    for (const t of trabajadores) {
      if (!m[t.categoria]) m[t.categoria] = { suma: 0, n: 0 };
      m[t.categoria].suma += t.coste.costeHoraAnualizado; m[t.categoria].n++;
    }
    const r: Record<string, number> = {};
    for (const c of CATEGORIAS) r[c] = m[c] ? m[c].suma / m[c].n : 0;
    return r;
  }, [trabajadores]);

  const totales = useMemo(() => {
    const total = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);
    const coste = lineas.reduce((s, l) => s + l.cantidad * l.costeUnitario, 0);
    const margen = total - coste;
    return { total, coste, margen, margenPorc: total > 0 ? (margen / total) * 100 : 0 };
  }, [lineas]);

  if (!p || !config) return <Cargando />;

  const actualizar = (campo: string, valor: any) => { setP({ ...p, [campo]: valor }); setGuardado(false); };
  const setLinea = (i: number, campo: keyof Linea, valor: any) => {
    const nuevas = [...lineas];
    nuevas[i] = { ...nuevas[i], [campo]: valor };
    // Al elegir categoría en una línea de mano de obra, sugerir precio (tarifa) y coste (real)
    if (campo === 'categoria') {
      const tarifa = tarifas.find((t) => t.categoria === valor);
      if (tarifa && !nuevas[i].precioUnitario) nuevas[i].precioUnitario = tarifa.precioHoraVenta;
      nuevas[i].costeUnitario = Math.round((costePorCategoria[valor] || 0) * 100) / 100;
    }
    setLineas(nuevas); setGuardado(false);
  };
  const añadirLinea = () => {
    const esMO = p.tipo === 'ADMINISTRACION';
    setLineas([...lineas, { descripcion: '', categoria: esMO ? 'PEON' : '', cantidad: 1, precioUnitario: esMO ? (tarifas.find((t) => t.categoria === 'PEON')?.precioHoraVenta || 0) : 0, costeUnitario: esMO ? Math.round((costePorCategoria['PEON'] || 0) * 100) / 100 : 0 }]);
    setGuardado(false);
  };
  const guardar = async () => {
    await api.put(`/api/presupuestos/${id}`, { ...p, lineas });
    setGuardado(true);
  };

  return (
    <div>
      <CabeceraPagina titulo={`Presupuesto ${p.numero}`} subtitulo={`${etiqueta(p.tipo)} · ${etiqueta(p.estado)}`}>
        <Link to="/presupuestos" className="boton-secundario no-imprimir">← Volver</Link>
        <button className="boton-secundario no-imprimir" onClick={() => window.print()}>🖨 Exportar PDF</button>
        <button className="boton-primario no-imprimir" onClick={guardar} disabled={guardado}>{guardado ? 'Guardado ✓' : 'Guardar cambios'}</button>
      </CabeceraPagina>

      {/* Cabecera editable (oculta en impresión los selects) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="tarjeta p-5 no-imprimir">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="etiqueta">Cliente</label>
                <select className="campo" value={p.clienteId} onChange={(e) => actualizar('clienteId', Number(e.target.value))}>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label className="etiqueta">Fecha</label><input type="date" className="campo" value={fechaInput(p.fecha)} onChange={(e) => actualizar('fecha', e.target.value)} /></div>
              <div><label className="etiqueta">Tipo</label><select className="campo" value={p.tipo} onChange={(e) => actualizar('tipo', e.target.value)}><option value="ADMINISTRACION">Mano de obra</option><option value="PRECIO_CERRADO">Precio cerrado</option></select></div>
              <div><label className="etiqueta">Estado</label><select className="campo" value={p.estado} onChange={(e) => actualizar('estado', e.target.value)}>{['BORRADOR', 'ENVIADO', 'ACEPTADO', 'RECHAZADO'].map((s) => <option key={s} value={s}>{etiqueta(s)}</option>)}</select></div>
            </div>
          </div>

          {/* Documento imprimible */}
          <div className="tarjeta p-6">
            <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-marino">
              <div>
                <p className="text-xl font-extrabold text-marino">Gestión<span className="text-acento">Obra</span></p>
                <p className="text-xs text-slate-500">Construcción y reformas · Valencia</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold text-marino">Presupuesto {p.numero}</p>
                <p className="text-slate-500">{fecha(p.fecha)}</p>
                <p className="text-slate-700 mt-1">{clientes.find((c) => c.id === p.clienteId)?.nombre}</p>
              </div>
            </div>

            <table className="w-full mb-4">
              <thead><tr>
                <th className="th">Descripción</th>
                {p.tipo === 'ADMINISTRACION' && <th className="th no-imprimir">Categoría</th>}
                <th className="th">{p.tipo === 'ADMINISTRACION' ? 'Horas' : 'Medición'}</th>
                <th className="th">€/ud</th><th className="th">Importe</th>
                <th className="th no-imprimir">Coste/ud</th><th className="th no-imprimir"></th>
              </tr></thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td className="td"><input className="campo" value={l.descripcion} onChange={(e) => setLinea(i, 'descripcion', e.target.value)} placeholder="Descripción de la partida" /></td>
                    {p.tipo === 'ADMINISTRACION' && (
                      <td className="td no-imprimir"><select className="campo" value={l.categoria} onChange={(e) => setLinea(i, 'categoria', e.target.value)}>{CATEGORIAS.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}</select></td>
                    )}
                    <td className="td"><input type="number" step="0.01" className="campo w-24" value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', Number(e.target.value))} /></td>
                    <td className="td"><input type="number" step="0.01" className="campo w-24" value={l.precioUnitario} onChange={(e) => setLinea(i, 'precioUnitario', Number(e.target.value))} /></td>
                    <td className="td font-semibold">{euros(l.cantidad * l.precioUnitario)}</td>
                    <td className="td no-imprimir"><input type="number" step="0.01" className="campo w-24" value={l.costeUnitario} onChange={(e) => setLinea(i, 'costeUnitario', Number(e.target.value))} /></td>
                    <td className="td no-imprimir"><button className="text-slate-300 hover:text-red-500" onClick={() => { setLineas(lineas.filter((_, j) => j !== i)); setGuardado(false); }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="boton-secundario text-xs no-imprimir mb-4" onClick={añadirLinea}>+ Añadir línea</button>

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Base imponible</span><span className="font-semibold">{euros(totales.total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">IVA ({config.porcentajeIva}%)</span><span>{euros(totales.total * config.porcentajeIva / 100)}</span></div>
                <div className="flex justify-between text-base font-bold text-marino pt-1 border-t border-slate-200"><span>TOTAL</span><span>{euros(totales.total * (1 + config.porcentajeIva / 100))}</span></div>
              </div>
            </div>

            <div className="mt-6">
              <label className="etiqueta no-imprimir">Condiciones</label>
              <textarea className="campo no-imprimir" rows={2} value={p.condiciones || ''} onChange={(e) => actualizar('condiciones', e.target.value)} placeholder="Forma de pago, validez de la oferta…" />
              {p.condiciones && <p className="text-xs text-slate-500 mt-2 hidden print:block">{p.condiciones}</p>}
            </div>
          </div>
        </div>

        {/* Panel de margen en tiempo real */}
        <div className="space-y-4 no-imprimir">
          <div className="tarjeta p-5">
            <h3 className="font-bold text-marino mb-3">Margen en tiempo real</h3>
            <IndicadorMargen margen={totales.margen} margenPorc={totales.margenPorc} umbral={config.umbralMargenAviso} />
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Venta</dt><dd className="font-semibold">{euros(totales.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Coste estimado</dt><dd className="font-semibold">{euros(totales.coste)}</dd></div>
            </dl>
            <p className="text-xs text-slate-400 mt-3">El coste/ud de las líneas de mano de obra se rellena con el coste/hora anualizado real de cada categoría. Puedes ajustarlo a mano.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
