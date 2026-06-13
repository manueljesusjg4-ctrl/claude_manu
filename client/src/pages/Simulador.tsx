// SIMULADOR DE RENTABILIDAD: uno o varios bloques (equipo+cliente), cálculo al
// instante de facturación, coste real, margen por mes y flujo de caja.
// Permite guardar escenarios y compararlos lado a lado.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { euros, eurosEnteros, fecha, hoyInput, porcentaje, etiqueta, CATEGORIAS } from '../lib/formato';
import { Aviso, CabeceraPagina, Cargando, IndicadorMargen, Modal, TarjetaKpi } from '../components/ui';
import { GraficoCaja } from '../components/GraficoCaja';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Bloque {
  nombre: string; categoria: string; numTrabajadores: number; costeMensualPorTrabajador: number;
  precioVentaHora: number; horasDia: number; diasSemana: number; fechaInicio: string; fechaFin: string;
  plazoCobroDias: number; modoObraCorta: boolean;
}

const bloqueNuevo = (): Bloque => ({
  nombre: 'Equipo 1', categoria: 'PEON', numTrabajadores: 5, costeMensualPorTrabajador: 1976,
  precioVentaHora: 19, horasDia: 8, diasSemana: 5, fechaInicio: hoyInput(),
  fechaFin: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  plazoCobroDias: 60, modoObraCorta: true,
});

export function Simulador() {
  const [bloques, setBloques] = useState<Bloque[]>([bloqueNuevo()]);
  const [saldoInicial, setSaldoInicial] = useState(10000);
  const [resultado, setResultado] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [escenarios, setEscenarios] = useState<any[]>([]);
  const [comparacion, setComparacion] = useState<any[] | null>(null);
  const [modalGuardar, setModalGuardar] = useState(false);
  const [nombreEscenario, setNombreEscenario] = useState('');

  const cargarEscenarios = () => api.get('/api/simulador/escenarios').then(setEscenarios);
  useEffect(() => { api.get('/api/configuracion').then(setConfig); cargarEscenarios(); }, []);

  const calcular = async () => setResultado(await api.post('/api/simulador/calcular', { bloques, saldoInicial }));
  const setBloque = (i: number, campo: keyof Bloque, valor: any) => {
    const nuevos = [...bloques]; nuevos[i] = { ...nuevos[i], [campo]: valor }; setBloques(nuevos);
  };
  const guardar = async () => {
    await api.post('/api/simulador/escenarios', { nombre: nombreEscenario, bloques, saldoInicial });
    setModalGuardar(false); setNombreEscenario(''); cargarEscenarios();
  };
  const cargarEscenario = (e: any) => { setBloques(e.datos.bloques); setSaldoInicial(e.datos.saldoInicial); setResultado(null); setComparacion(null); };

  const [seleccion, setSeleccion] = useState<number[]>([]);
  const comparar = async () => {
    if (seleccion.length < 2) { alert('Selecciona al menos 2 escenarios para comparar.'); return; }
    setComparacion(await api.post('/api/simulador/comparar', { ids: seleccion }));
  };

  if (!config) return <Cargando />;

  return (
    <div>
      <CabeceraPagina titulo="Simulador de rentabilidad" subtitulo="Prueba escenarios y mira margen y caja antes de comprometerte">
        <button className="boton-secundario" onClick={() => setBloques([...bloques, { ...bloqueNuevo(), nombre: `Equipo ${bloques.length + 1}` }])}>+ Añadir equipo/obra</button>
        <button className="boton-primario" onClick={calcular}>Calcular escenario</button>
      </CabeceraPagina>

      {/* Bloques */}
      <div className="space-y-3 mb-5">
        {bloques.map((b, i) => (
          <div key={i} className="tarjeta p-4">
            <div className="flex items-center justify-between mb-3">
              <input className="campo w-64 font-semibold" value={b.nombre} onChange={(e) => setBloque(i, 'nombre', e.target.value)} />
              {bloques.length > 1 && <button className="boton-peligro" onClick={() => setBloques(bloques.filter((_, j) => j !== i))}>Quitar</button>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <div><label className="etiqueta">Categoría</label><select className="campo" value={b.categoria} onChange={(e) => setBloque(i, 'categoria', e.target.value)}>{CATEGORIAS.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}</select></div>
              <div><label className="etiqueta">Nº trabajadores</label><input type="number" min={1} className="campo" value={b.numTrabajadores} onChange={(e) => setBloque(i, 'numTrabajadores', Number(e.target.value))} /></div>
              <div><label className="etiqueta">Coste €/mes c/u</label><input type="number" className="campo" value={b.costeMensualPorTrabajador} onChange={(e) => setBloque(i, 'costeMensualPorTrabajador', Number(e.target.value))} /></div>
              <div><label className="etiqueta">Venta €/h</label><input type="number" step="0.5" className="campo" value={b.precioVentaHora} onChange={(e) => setBloque(i, 'precioVentaHora', Number(e.target.value))} /></div>
              <div><label className="etiqueta">Horas/día</label><input type="number" step="0.5" className="campo" value={b.horasDia} onChange={(e) => setBloque(i, 'horasDia', Number(e.target.value))} /></div>
              <div><label className="etiqueta">Días/semana</label><input type="number" className="campo" value={b.diasSemana} onChange={(e) => setBloque(i, 'diasSemana', Number(e.target.value))} /></div>
              <div><label className="etiqueta">Inicio</label><input type="date" className="campo" value={b.fechaInicio} onChange={(e) => setBloque(i, 'fechaInicio', e.target.value)} /></div>
              <div><label className="etiqueta">Fin</label><input type="date" className="campo" value={b.fechaFin} onChange={(e) => setBloque(i, 'fechaFin', e.target.value)} /></div>
              <div><label className="etiqueta">Plazo cobro (días)</label><input type="number" className="campo" value={b.plazoCobroDias} onChange={(e) => setBloque(i, 'plazoCobroDias', Number(e.target.value))} /></div>
              <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={b.modoObraCorta} onChange={(e) => setBloque(i, 'modoObraCorta', e.target.checked)} /> Obra corta</label></div>
            </div>
          </div>
        ))}
        <div className="flex items-end gap-3">
          <div><label className="etiqueta">Caja disponible al arrancar (€)</label><input type="number" className="campo w-48" value={saldoInicial} onChange={(e) => setSaldoInicial(Number(e.target.value))} /></div>
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <TarjetaKpi titulo="Facturación total" valor={eurosEnteros(resultado.totales.facturacion)} tono="acento" />
            <TarjetaKpi titulo="Coste real total" valor={eurosEnteros(resultado.totales.coste)} />
            <TarjetaKpi titulo="Margen total" valor={eurosEnteros(resultado.totales.margen)} secundario={porcentaje(resultado.totales.margenPorc)} tono={resultado.totales.margen >= 0 ? 'bueno' : 'malo'} />
            <TarjetaKpi titulo="Dinero a adelantar" valor={eurosEnteros(resultado.caja.necesidadMaxima)} secundario={resultado.caja.semanaMinima ? `Mínimo: ${fecha(resultado.caja.semanaMinima.semana)}` : ''} tono={resultado.caja.necesidadMaxima > 0 ? 'malo' : 'bueno'} />
          </div>

          {resultado.totales.avisoMargenBajo && <Aviso tipo="ambar">⚠ El margen global queda por debajo del umbral del {config.umbralMargenAviso}%.</Aviso>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="tarjeta p-5">
              <h3 className="font-bold text-marino mb-3">Margen por mes</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={resultado.porMes}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickFormatter={(m) => m.split('-').reverse().join('/')} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
                  <Tooltip formatter={(v: number) => euros(v)} labelFormatter={(m) => m} />
                  <Legend />
                  <Bar dataKey="facturacion" name="Facturación" fill="#162D45" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="coste" name="Coste" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="margen" name="Margen" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="tarjeta p-5">
              <h3 className="font-bold text-marino mb-3">Flujo de caja consolidado</h3>
              <GraficoCaja semanas={resultado.caja.semanas} alto={260} />
            </div>
          </div>

          {/* Detalle por bloque */}
          <div className="tarjeta overflow-x-auto">
            <div className="px-4 pt-4 flex justify-between items-center">
              <h3 className="font-bold text-marino">Detalle por equipo</h3>
              <button className="boton-secundario text-xs" onClick={() => setModalGuardar(true)}>💾 Guardar escenario</button>
            </div>
            <table className="w-full">
              <thead><tr><th className="th">Equipo</th><th className="th">Trab.</th><th className="th">Horas</th><th className="th">H. extra</th><th className="th">Coste/h</th><th className="th">Venta/h</th><th className="th">Facturación</th><th className="th">Coste</th><th className="th">Margen</th></tr></thead>
              <tbody>
                {resultado.bloques.map((b: any, i: number) => (
                  <tr key={i} className={b.avisoMargenBajo ? 'bg-amber-50' : ''}>
                    <td className="td font-medium">{b.nombre}<p className="text-xs text-slate-400">{b.notaCoste}</p></td>
                    <td className="td">{b.numTrabajadores}</td>
                    <td className="td">{Math.round(b.horasTotales)}</td>
                    <td className="td text-acento">{b.horasExtraTotales > 0 ? Math.round(b.horasExtraTotales) : '—'}</td>
                    <td className="td">{euros(b.costeHora)}</td>
                    <td className="td">{euros(b.precioVentaHora)}</td>
                    <td className="td">{euros(b.facturacion)}</td>
                    <td className="td">{euros(b.coste)}</td>
                    <td className={`td font-bold ${b.margen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euros(b.margen)} ({porcentaje(b.margenPorc)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Escenarios guardados */}
      <div className="tarjeta p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-marino">Escenarios guardados</h3>
          <button className="boton-secundario text-xs" onClick={comparar} disabled={seleccion.length < 2}>Comparar seleccionados ({seleccion.length})</button>
        </div>
        {escenarios.length === 0 && <p className="text-sm text-slate-400">Aún no has guardado escenarios. Calcula uno y pulsa "Guardar escenario".</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {escenarios.map((e) => (
            <div key={e.id} className="border border-slate-200 rounded-lg p-3">
              <label className="flex items-center gap-2 mb-1">
                <input type="checkbox" checked={seleccion.includes(e.id)} onChange={(ev) => setSeleccion(ev.target.checked ? [...seleccion, e.id] : seleccion.filter((x) => x !== e.id))} />
                <span className="font-semibold text-sm text-marino">{e.nombre}</span>
              </label>
              <p className="text-xs text-slate-400">{e.datos.bloques.length} equipo(s)</p>
              <div className="flex gap-2 mt-2">
                <button className="text-xs font-semibold text-acento" onClick={() => cargarEscenario(e)}>Cargar</button>
                <button className="text-xs font-semibold text-red-600" onClick={async () => { await api.del(`/api/simulador/escenarios/${e.id}`); cargarEscenarios(); }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparación lado a lado */}
      {comparacion && (
        <div className="tarjeta p-5 mt-5">
          <h3 className="font-bold text-marino mb-3">Comparación de escenarios</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {comparacion.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-lg p-4">
                <p className="font-bold text-marino mb-2">{c.nombre}</p>
                <IndicadorMargen margen={c.resultado.totales.margen} margenPorc={c.resultado.totales.margenPorc} umbral={config.umbralMargenAviso} />
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Facturación</dt><dd className="font-semibold">{euros(c.resultado.totales.facturacion)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Coste</dt><dd className="font-semibold">{euros(c.resultado.totales.coste)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">A adelantar</dt><dd className="font-semibold text-red-600">{euros(c.resultado.caja.necesidadMaxima)}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal titulo="Guardar escenario" abierto={modalGuardar} alCerrar={() => setModalGuardar(false)} ancho="max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); guardar(); }} className="space-y-3">
          <div><label className="etiqueta">Nombre del escenario *</label><input required className="campo" value={nombreEscenario} onChange={(e) => setNombreEscenario(e.target.value)} placeholder="5 oficiales a 22,5€ con Marcos" /></div>
          <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
        </form>
      </Modal>
    </div>
  );
}
