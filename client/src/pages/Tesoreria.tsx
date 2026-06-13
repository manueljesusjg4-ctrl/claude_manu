// CAJA Y TESORERÍA: flujo proyectado, gestión de cobros, confirming,
// anticipos de cliente, IVA pendiente y simulador "¿aguanto esta obra?".
import { FormEvent, useEffect, useState } from 'react';
import { api, ErrorApi } from '../lib/api';
import { euros, eurosEnteros, fecha, fechaInput, hoyInput, etiqueta } from '../lib/formato';
import { Aviso, Badge, CabeceraPagina, Cargando, COLORES_BADGE, Modal, TarjetaKpi } from '../components/ui';
import { GraficoCaja, SemanaGrafico } from '../components/GraficoCaja';

type Pestania = 'flujo' | 'cobros' | 'anticipos' | 'iva' | 'simulador';

export function Tesoreria() {
  const [pestania, setPestania] = useState<Pestania>('flujo');
  const pestanias: { id: Pestania; texto: string }[] = [
    { id: 'flujo', texto: 'Flujo de caja' },
    { id: 'cobros', texto: 'Cobros y facturas' },
    { id: 'anticipos', texto: 'Anticipos de cliente' },
    { id: 'iva', texto: 'IVA' },
    { id: 'simulador', texto: '¿Aguanto esta obra?' },
  ];
  return (
    <div>
      <CabeceraPagina titulo="Caja y tesorería" subtitulo="La empresa adelanta nóminas antes de cobrar: aquí se ve si la caja aguanta" />
      <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
        {pestanias.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestania(p.id)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              pestania === p.id ? 'border-acento text-acento' : 'border-transparent text-slate-500 hover:text-marino'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>
      {pestania === 'flujo' && <Flujo />}
      {pestania === 'cobros' && <Cobros />}
      {pestania === 'anticipos' && <Anticipos />}
      {pestania === 'iva' && <Iva />}
      {pestania === 'simulador' && <SimuladorCaja />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Flujo() {
  const [semanas, setSemanas] = useState(12);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [datos, setDatos] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/tesoreria/flujo?semanas=${semanas}&saldoInicial=${saldoInicial}`).then(setDatos);
  }, [semanas, saldoInicial]);

  if (!datos) return <Cargando />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="etiqueta">Horizonte (semanas)</label>
          <select className="campo w-32" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
            {[8, 12, 16, 26, 52].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta">Saldo actual en banco (€)</label>
          <input className="campo w-40" type="number" value={saldoInicial} onChange={(e) => setSaldoInicial(Number(e.target.value))} />
        </div>
        {datos.necesidadMaxima > 0 ? (
          <Aviso tipo="rojo">
            ⚠ Punto más bajo: <b>{eurosEnteros(datos.semanaMinima.saldo)}</b> la semana del {fecha(datos.semanaMinima.semana)}.
            Hace falta cubrir hasta <b>{eurosEnteros(datos.necesidadMaxima)}</b>.
          </Aviso>
        ) : (
          <Aviso tipo="azul">✔ Con este saldo inicial la caja no entra en negativo en el horizonte elegido.</Aviso>
        )}
      </div>

      <div className="tarjeta p-5">
        <h3 className="font-bold text-marino mb-3">Proyección semanal</h3>
        <GraficoCaja semanas={datos.semanas} alto={300} />
      </div>

      {/* Tabla semana a semana con detalle de movimientos */}
      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Semana</th><th className="th">Cobros</th><th className="th">Pagos</th>
              <th className="th">Neto</th><th className="th">Saldo acumulado</th><th className="th">Movimientos</th>
            </tr>
          </thead>
          <tbody>
            {datos.semanas.map((s: any) => (
              <tr key={s.semana} className={s.negativa ? 'bg-red-50' : ''}>
                <td className="td font-semibold">{fecha(s.semana)}</td>
                <td className="td text-emerald-600 font-medium">{s.entradas > 0 ? euros(s.entradas) : '—'}</td>
                <td className="td text-amber-700 font-medium">{s.salidas > 0 ? euros(s.salidas) : '—'}</td>
                <td className={`td font-semibold ${s.neto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{euros(s.neto)}</td>
                <td className={`td font-bold ${s.negativa ? 'text-red-600' : 'text-marino'}`}>{euros(s.saldoAcumulado)} {s.negativa && '⚠'}</td>
                <td className="td text-xs text-slate-500">
                  {s.movimientos.map((m: any, i: number) => (
                    <div key={i}>
                      <span className={m.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-amber-700'}>
                        {m.tipo === 'ENTRADA' ? '+' : '−'}{euros(m.importe)}
                      </span>{' '}
                      {m.concepto}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen mensual */}
      <div className="tarjeta overflow-x-auto">
        <div className="px-4 pt-4"><h3 className="font-bold text-marino">Resumen mes a mes</h3></div>
        <table className="w-full">
          <thead><tr><th className="th">Mes</th><th className="th">Cobros</th><th className="th">Pagos</th><th className="th">Neto</th></tr></thead>
          <tbody>
            {datos.porMes.map((m: any) => (
              <tr key={m.mes}>
                <td className="td font-semibold">{m.mes.split('-').reverse().join('/')}</td>
                <td className="td text-emerald-600">{euros(m.entradas)}</td>
                <td className="td text-amber-700">{euros(m.salidas)}</td>
                <td className={`td font-bold ${m.neto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{euros(m.neto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Cobros() {
  const [facturas, setFacturas] = useState<any[] | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [modalNueva, setModalNueva] = useState(false);
  const [modalConfirming, setModalConfirming] = useState<any>(null);
  const [error, setError] = useState('');

  const cargar = () => {
    api.get('/api/facturas').then(setFacturas);
    api.get('/api/clientes').then(setClientes);
    api.get('/api/obras').then(setObras);
  };
  useEffect(cargar, []);

  if (!facturas) return <Cargando />;
  const pendientes = facturas.filter((f) => f.estadoEfectivo !== 'COBRADA');
  const totalPendiente = pendientes.reduce((s, f) => s + f.aCobrar, 0);
  const vencidas = facturas.filter((f) => f.estadoEfectivo === 'VENCIDA');

  const marcarCobrada = async (f: any) => {
    await api.patch(`/api/facturas/${f.id}/cobro`, { cobrada: f.estado !== 'COBRADA' });
    cargar();
  };

  const eliminarFactura = async (f: any) => {
    const msg = f.anticipoAplicado > 0
      ? `¿Eliminar la factura ${f.numero}? Se devolverán ${euros(f.anticipoAplicado)} de anticipo aplicado a este cliente. Esta acción no se puede deshacer.`
      : `¿Eliminar la factura ${f.numero}? Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;
    try {
      await api.del(`/api/facturas/${f.id}`);
      cargar();
    } catch (e: any) {
      alert(e.message || 'No se pudo eliminar la factura');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <TarjetaKpi titulo="Pendiente de cobro" valor={eurosEnteros(totalPendiente)} secundario={`${pendientes.length} factura(s)`} />
        <TarjetaKpi titulo="Vencidas sin cobrar" valor={eurosEnteros(vencidas.reduce((s, f) => s + f.aCobrar, 0))} secundario={`${vencidas.length} factura(s)`} tono={vencidas.length > 0 ? 'malo' : 'bueno'} />
        <div className="flex items-center justify-end">
          <button className="boton-primario" onClick={() => setModalNueva(true)}>+ Nueva factura / certificación</button>
        </div>
      </div>
      {error && <Aviso tipo="rojo">{error}</Aviso>}

      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Nº</th><th className="th">Cliente / concepto</th><th className="th">Emisión</th>
              <th className="th">Base</th><th className="th">Total (IVA)</th><th className="th">A cobrar</th>
              <th className="th">Cobro esperado</th><th className="th">Estado</th><th className="th">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((f) => (
              <tr key={f.id} className={f.estadoEfectivo === 'VENCIDA' ? 'bg-red-50' : ''}>
                <td className="td font-semibold">{f.numero}</td>
                <td className="td">
                  <p className="font-medium">{f.cliente?.nombre}</p>
                  <p className="text-xs text-slate-500">{f.concepto}</p>
                  {f.anticipadaConfirming && (
                    <p className="text-xs text-blue-600 font-semibold">
                      🏦 Confirming: cobro {fecha(f.fechaAnticipo)} (coste {euros(f.costeFinanciero)})
                    </p>
                  )}
                  {f.anticipoAplicado > 0 && (
                    <p className="text-xs text-violet-600 font-semibold">↳ Anticipo descontado: {euros(f.anticipoAplicado)}</p>
                  )}
                </td>
                <td className="td">{fecha(f.fechaEmision)}</td>
                <td className="td">{euros(f.baseImponible)}</td>
                <td className="td">{euros(f.total)}</td>
                <td className="td font-bold">{euros(f.aCobrar)}</td>
                <td className="td">{fecha(f.fechaCobroEsperada)} <span className="text-xs text-slate-400">({f.plazoDias} d)</span></td>
                <td className="td"><Badge texto={etiqueta(f.estadoEfectivo)} color={COLORES_BADGE[f.estadoEfectivo]} /></td>
                <td className="td">
                  <div className="flex flex-col gap-1">
                    <button className="text-xs font-semibold text-emerald-700 hover:underline text-left" onClick={() => marcarCobrada(f)}>
                      {f.estado === 'COBRADA' ? 'Deshacer cobro' : '✓ Marcar cobrada'}
                    </button>
                    {f.estado !== 'COBRADA' && (
                      <button className="text-xs font-semibold text-blue-700 hover:underline text-left" onClick={() => setModalConfirming(f)}>
                        🏦 Confirming
                      </button>
                    )}
                    <button className="text-xs font-semibold text-red-600 hover:underline text-left" onClick={() => eliminarFactura(f)}>
                      ✕ Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nueva factura */}
      <Modal titulo="Nueva factura / certificación" abierto={modalNueva} alCerrar={() => setModalNueva(false)}>
        <FormularioFactura
          clientes={clientes}
          obras={obras}
          alGuardar={async (datos) => {
            try {
              await api.post('/api/facturas', datos);
              setModalNueva(false);
              setError('');
              cargar();
            } catch (e: any) {
              setError(e.message);
            }
          }}
        />
      </Modal>

      {/* Modal confirming */}
      <Modal titulo={`Anticipar factura ${modalConfirming?.numero} (confirming)`} abierto={!!modalConfirming} alCerrar={() => setModalConfirming(null)} ancho="max-w-md">
        {modalConfirming && (
          <FormularioConfirming
            factura={modalConfirming}
            alGuardar={async (datos) => {
              await api.patch(`/api/facturas/${modalConfirming.id}/confirming`, datos);
              setModalConfirming(null);
              cargar();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function FormularioFactura({ clientes, obras, alGuardar }: { clientes: any[]; obras: any[]; alGuardar: (d: any) => void }) {
  const [f, setF] = useState<any>({
    numero: '', clienteId: '', obraId: '', concepto: '', fechaEmision: hoyInput(),
    baseImponible: '', porcentajeIva: 21, plazoDias: '', aplicarAnticipos: true,
  });
  const cliente = clientes.find((c) => c.id === Number(f.clienteId));
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    alGuardar({ ...f, plazoDias: f.plazoDias === '' ? undefined : Number(f.plazoDias), obraId: f.obraId || null });
  };
  return (
    <form onSubmit={enviar} className="grid grid-cols-2 gap-3">
      <div><label className="etiqueta">Número *</label><input required className="campo" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder="C-2026-004" /></div>
      <div>
        <label className="etiqueta">Cliente *</label>
        <select required className="campo" value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value })}>
          <option value="">— Elegir —</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="col-span-2"><label className="etiqueta">Concepto *</label><input required className="campo" value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} /></div>
      <div>
        <label className="etiqueta">Obra (opcional)</label>
        <select className="campo" value={f.obraId} onChange={(e) => setF({ ...f, obraId: e.target.value })}>
          <option value="">— Sin obra —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>
      <div><label className="etiqueta">Fecha emisión *</label><input required type="date" className="campo" value={f.fechaEmision} onChange={(e) => setF({ ...f, fechaEmision: e.target.value })} /></div>
      <div><label className="etiqueta">Base imponible (€) *</label><input required type="number" step="0.01" className="campo" value={f.baseImponible} onChange={(e) => setF({ ...f, baseImponible: e.target.value })} /></div>
      <div><label className="etiqueta">IVA (%)</label><input type="number" step="0.1" className="campo" value={f.porcentajeIva} onChange={(e) => setF({ ...f, porcentajeIva: e.target.value })} /></div>
      <div>
        <label className="etiqueta">Plazo de pago (días)</label>
        <input type="number" className="campo" value={f.plazoDias} onChange={(e) => setF({ ...f, plazoDias: e.target.value })}
          placeholder={cliente ? `${cliente.plazoPagoDias} (del cliente)` : 'según cliente'} />
      </div>
      <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={f.aplicarAnticipos} onChange={(e) => setF({ ...f, aplicarAnticipos: e.target.checked })} />
        Descontar automáticamente los anticipos pendientes de este cliente
      </label>
      <div className="col-span-2 flex justify-end"><button className="boton-primario">Guardar factura</button></div>
    </form>
  );
}

function FormularioConfirming({ factura, alGuardar }: { factura: any; alGuardar: (d: any) => void }) {
  const [d, setD] = useState({
    anticipadaConfirming: true,
    costeFinanciero: factura.costeFinanciero || '',
    fechaAnticipo: fechaInput(factura.fechaAnticipo) || hoyInput(),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <p className="text-sm text-slate-600">
        Total de la factura: <b>{euros(factura.total)}</b>. Al anticiparla, el banco ingresa el importe
        (menos el coste financiero) en la fecha indicada, y la caja lo refleja.
      </p>
      <div><label className="etiqueta">Coste financiero del anticipo (€)</label><input type="number" step="0.01" required className="campo" value={d.costeFinanciero} onChange={(e) => setD({ ...d, costeFinanciero: e.target.value as any })} /></div>
      <div><label className="etiqueta">Fecha en que entra el dinero</label><input type="date" required className="campo" value={d.fechaAnticipo} onChange={(e) => setD({ ...d, fechaAnticipo: e.target.value })} /></div>
      <div className="flex justify-between">
        {factura.anticipadaConfirming && (
          <button type="button" className="boton-secundario" onClick={() => alGuardar({ anticipadaConfirming: false, costeFinanciero: 0, fechaAnticipo: null })}>
            Quitar confirming
          </button>
        )}
        <button className="boton-primario ml-auto">Guardar</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
function Anticipos() {
  const [anticipos, setAnticipos] = useState<any[] | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [d, setD] = useState<any>({ clienteId: '', obraId: '', fecha: hoyInput(), importe: '', notas: '' });

  const cargar = () => {
    api.get('/api/facturas/anticipos').then(setAnticipos);
    api.get('/api/clientes').then(setClientes);
    api.get('/api/obras').then(setObras);
  };
  useEffect(cargar, []);
  if (!anticipos) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          Anticipos a cuenta de clientes. Al crear una factura del mismo cliente se descuentan automáticamente.
        </p>
        <button className="boton-primario" onClick={() => setModal(true)}>+ Registrar anticipo</button>
      </div>
      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Cliente</th><th className="th">Obra</th><th className="th">Fecha</th><th className="th">Importe</th><th className="th">Aplicado</th><th className="th">Pendiente de aplicar</th><th className="th"></th></tr></thead>
          <tbody>
            {anticipos.map((a) => (
              <tr key={a.id}>
                <td className="td font-medium">{a.cliente?.nombre}</td>
                <td className="td">{a.obra?.nombre || '—'}</td>
                <td className="td">{fecha(a.fecha)}</td>
                <td className="td font-semibold">{euros(a.importe)}</td>
                <td className="td">{euros(a.importeAplicado)}</td>
                <td className="td font-bold text-violet-700">{euros(a.importe - a.importeAplicado)}</td>
                <td className="td"><button className="boton-peligro" onClick={async () => { if (confirm('¿Eliminar anticipo?')) { await api.del(`/api/facturas/anticipos/${a.id}`); cargar(); } }}>Eliminar</button></td>
              </tr>
            ))}
            {anticipos.length === 0 && <tr><td className="td text-slate-400" colSpan={7}>No hay anticipos registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal titulo="Registrar anticipo de cliente" abierto={modal} alCerrar={() => setModal(false)} ancho="max-w-md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await api.post('/api/facturas/anticipos', { ...d, obraId: d.obraId || null });
            setModal(false);
            setD({ clienteId: '', obraId: '', fecha: hoyInput(), importe: '', notas: '' });
            cargar();
          }}
          className="space-y-3"
        >
          <div>
            <label className="etiqueta">Cliente *</label>
            <select required className="campo" value={d.clienteId} onChange={(e) => setD({ ...d, clienteId: e.target.value })}>
              <option value="">— Elegir —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta">Obra (opcional)</label>
            <select className="campo" value={d.obraId} onChange={(e) => setD({ ...d, obraId: e.target.value })}>
              <option value="">— Sin obra —</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>
          <div><label className="etiqueta">Fecha *</label><input required type="date" className="campo" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></div>
          <div><label className="etiqueta">Importe (€) *</label><input required type="number" step="0.01" className="campo" value={d.importe} onChange={(e) => setD({ ...d, importe: e.target.value })} /></div>
          <div><label className="etiqueta">Notas</label><input className="campo" value={d.notas} onChange={(e) => setD({ ...d, notas: e.target.value })} /></div>
          <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Iva() {
  const [datos, setDatos] = useState<any>(null);
  useEffect(() => { api.get('/api/tesoreria/iva').then(setDatos); }, []);
  if (!datos) return <Cargando />;
  return (
    <div className="space-y-4 max-w-2xl">
      <Aviso tipo="ambar">
        ⚠ <b>El IVA repercutido que cobras NO es dinero tuyo:</b> hay que liquidarlo a Hacienda cada trimestre.
        No lo cuentes como caja disponible.
      </Aviso>
      <div className="grid grid-cols-2 gap-3">
        <TarjetaKpi titulo={`IVA cobrado ${datos.trimestreActual}`} valor={eurosEnteros(datos.ivaTrimestreActual)} secundario="Pendiente de liquidar este trimestre" tono="acento" />
        <TarjetaKpi titulo="IVA repercutido cobrado (total)" valor={eurosEnteros(datos.totalRepercutidoCobrado)} />
      </div>
      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Trimestre</th><th className="th">IVA repercutido cobrado</th></tr></thead>
          <tbody>
            {datos.porTrimestre.map((t: any) => (
              <tr key={t.trimestre}><td className="td font-semibold">{t.trimestre}</td><td className="td">{euros(t.importe)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function SimuladorCaja() {
  const [d, setD] = useState({
    numTrabajadores: 5, costeMensualPorTrabajador: 1976, fechaInicio: hoyInput(),
    mesesDuracion: 3, plazoCobroDias: 60, facturacionMensual: 15200, saldoInicial: 10000,
  });
  const [resultado, setResultado] = useState<any>(null);

  const calcular = async (e?: FormEvent) => {
    e?.preventDefault();
    setResultado(await api.post('/api/tesoreria/simulador-caja', d));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 max-w-3xl">
        Antes de aceptar una obra, comprueba <b>cuánto dinero tienes que adelantar</b> hasta que el cliente
        empiece a pagar y <b>en qué semana</b> estará el punto más bajo de la caja.
      </p>
      <form onSubmit={calcular} className="tarjeta p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className="etiqueta">Nº trabajadores</label><input type="number" min={1} className="campo" value={d.numTrabajadores} onChange={(e) => setD({ ...d, numTrabajadores: Number(e.target.value) })} /></div>
        <div><label className="etiqueta">Coste empresa €/mes c/u</label><input type="number" className="campo" value={d.costeMensualPorTrabajador} onChange={(e) => setD({ ...d, costeMensualPorTrabajador: Number(e.target.value) })} /></div>
        <div><label className="etiqueta">Fecha de inicio</label><input type="date" className="campo" value={d.fechaInicio} onChange={(e) => setD({ ...d, fechaInicio: e.target.value })} /></div>
        <div><label className="etiqueta">Duración (meses)</label><input type="number" min={1} className="campo" value={d.mesesDuracion} onChange={(e) => setD({ ...d, mesesDuracion: Number(e.target.value) })} /></div>
        <div><label className="etiqueta">Plazo de cobro (días)</label><input type="number" className="campo" value={d.plazoCobroDias} onChange={(e) => setD({ ...d, plazoCobroDias: Number(e.target.value) })} /></div>
        <div><label className="etiqueta">Certificación €/mes</label><input type="number" className="campo" value={d.facturacionMensual} onChange={(e) => setD({ ...d, facturacionMensual: Number(e.target.value) })} /></div>
        <div><label className="etiqueta">Caja disponible hoy (€)</label><input type="number" className="campo" value={d.saldoInicial} onChange={(e) => setD({ ...d, saldoInicial: Number(e.target.value) })} /></div>
        <div className="flex items-end"><button className="boton-primario w-full justify-center">Calcular</button></div>
      </form>

      {resultado && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TarjetaKpi
              titulo="Dinero a adelantar (máximo)"
              valor={eurosEnteros(resultado.necesidadMaxima)}
              secundario={resultado.necesidadMaxima > 0 ? 'Por encima de tu caja actual' : 'Tu caja aguanta sin financiación'}
              tono={resultado.necesidadMaxima > 0 ? 'malo' : 'bueno'}
            />
            <TarjetaKpi titulo="Semana de caja mínima" valor={fecha(resultado.semanaMinima.semana)} secundario={`Saldo: ${eurosEnteros(resultado.semanaMinima.saldo)}`} />
            <TarjetaKpi titulo="Primer cobro" valor={resultado.primerCobro ? fecha(resultado.primerCobro) : '—'} secundario="Semana en que entra dinero del cliente" />
          </div>
          <div className="tarjeta p-5">
            <GraficoCaja semanas={resultado.semanas} alto={280} />
          </div>
          <div className="tarjeta p-5">
            <h4 className="font-bold text-marino text-sm mb-2">Cómo se ha calculado</h4>
            {resultado.desglose.map((l: any, i: number) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                <span className="text-slate-600">{l.concepto}</span>
                <span className="font-bold text-marino">{euros(l.valor)} <span className="font-normal text-slate-400">{l.unidad.replace('€', '')}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
