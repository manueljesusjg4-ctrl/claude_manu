// Ficha completa de cliente: datos, solvencia, interacciones, seguimientos,
// obras, facturas, presupuestos y packs documentales enviados.
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { euros, fecha, fechaInput, hoyInput, etiqueta } from '../lib/formato';
import { Aviso, Badge, CabeceraPagina, Cargando, COLORES_BADGE, Modal } from '../components/ui';
import { FormularioCliente } from './Crm';

export function ClienteFicha() {
  const { id } = useParams();
  const [c, setC] = useState<any>(null);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalInter, setModalInter] = useState(false);
  const [modalSeg, setModalSeg] = useState(false);
  const [modalSolv, setModalSolv] = useState(false);

  const cargar = () => api.get(`/api/clientes/${id}`).then(setC);
  useEffect(() => { cargar(); }, [id]);
  if (!c) return <Cargando />;

  const sinSolvencia = !c.solvenciaConsultada && ['PROMOTORA', 'CONSTRUCTORA'].includes(c.tipo);

  return (
    <div>
      <CabeceraPagina titulo={c.nombre} subtitulo={`${etiqueta(c.tipo)} · ${c.origen || 'Sin origen'}`}>
        <Link to="/crm" className="boton-secundario">← Volver</Link>
        <button className="boton-secundario" onClick={() => setModalEditar(true)}>Editar</button>
      </CabeceraPagina>

      {sinSolvencia && (
        <div className="mb-4"><Aviso tipo="ambar">⚠ Cliente grande sin informe de solvencia. Conviene consultar eInforma/Axesor antes de empezar a trabajar.</Aviso></div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Datos + solvencia */}
        <div className="space-y-5">
          <div className="tarjeta p-5">
            <h3 className="font-bold text-marino mb-3">Datos</h3>
            <dl className="space-y-1.5 text-sm">
              <Dato k="CIF/NIF" v={c.cif} />
              <Dato k="Contacto" v={c.personaContacto} />
              <Dato k="Teléfono" v={c.telefono} />
              <Dato k="Email" v={c.email} />
              <Dato k="Plazo de pago" v={`${c.plazoPagoDias} días`} />
              <Dato k="Estado" v={<Badge texto={etiqueta(c.estadoPipeline)} color={COLORES_BADGE[c.estadoPipeline]} />} />
            </dl>
            {c.notas && <p className="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-100">{c.notas}</p>}
          </div>

          <div className="tarjeta p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-marino">Solvencia</h3>
              <button className="text-xs font-semibold text-acento" onClick={() => setModalSolv(true)}>Editar</button>
            </div>
            {c.solvenciaConsultada ? (
              <div className="text-sm">
                <Badge texto="Consultada" color="bg-emerald-100 text-emerald-700" />
                <p className="mt-2 text-slate-700">{c.solvenciaResultado}</p>
                <p className="text-xs text-slate-400 mt-1">Fecha: {fecha(c.solvenciaFecha)}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No consultada todavía.</p>
            )}
          </div>
        </div>

        {/* Interacciones + seguimientos */}
        <div className="space-y-5 lg:col-span-2">
          <div className="tarjeta p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-marino">Próximas acciones</h3>
              <button className="boton-secundario text-xs" onClick={() => setModalSeg(true)}>+ Seguimiento</button>
            </div>
            <div className="space-y-2">
              {c.seguimientos.filter((s: any) => !s.completado).map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg p-2.5">
                  <input type="checkbox" onChange={async () => { await api.patch(`/api/clientes/seguimientos/${s.id}`, { completado: true }); cargar(); }} />
                  <span className="font-semibold text-marino">{fecha(s.fechaPrevista)}</span>
                  <span className="text-slate-700">{s.descripcion}</span>
                </div>
              ))}
              {c.seguimientos.filter((s: any) => !s.completado).length === 0 && <p className="text-sm text-slate-400">Sin seguimientos pendientes.</p>}
            </div>
          </div>

          <div className="tarjeta p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-marino">Historial de interacciones</h3>
              <button className="boton-secundario text-xs" onClick={() => setModalInter(true)}>+ Interacción</button>
            </div>
            <div className="space-y-2">
              {c.interacciones.map((i: any) => (
                <div key={i.id} className="flex gap-3 text-sm border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-400 w-20 shrink-0">{fecha(i.fecha)}</span>
                  <div className="flex-1">
                    <Badge texto={etiqueta(i.tipo)} color="bg-slate-100 text-slate-600" />
                    <p className="text-slate-700 mt-1">{i.resumen}</p>
                    {i.resultado && <p className="text-xs text-slate-500 mt-0.5">→ {i.resultado}</p>}
                  </div>
                  <button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/clientes/interacciones/${i.id}`); cargar(); }}>✕</button>
                </div>
              ))}
              {c.interacciones.length === 0 && <p className="text-sm text-slate-400">Sin interacciones registradas.</p>}
            </div>
          </div>

          {/* Obras y facturas resumidas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="tarjeta p-5">
              <h3 className="font-bold text-marino mb-3">Obras ({c.obras.length})</h3>
              {c.obras.map((o: any) => (
                <Link key={o.id} to={`/obras/${o.id}`} className="block text-sm py-1.5 border-b border-slate-100 hover:text-acento">
                  {o.nombre} <Badge texto={etiqueta(o.estado)} color={COLORES_BADGE[o.estado]} />
                </Link>
              ))}
              {c.obras.length === 0 && <p className="text-sm text-slate-400">Sin obras.</p>}
            </div>
            <div className="tarjeta p-5">
              <h3 className="font-bold text-marino mb-3">Packs documentales enviados</h3>
              {c.packs.map((p: any) => (
                <div key={p.id} className="text-sm py-1.5 border-b border-slate-100">
                  {fecha(p.fecha)} — {p.items.length} documento(s)
                  <p className="text-xs text-slate-400">{p.items.map((it: any) => etiqueta(it.documento.tipo)).join(', ')}</p>
                </div>
              ))}
              {c.packs.length === 0 && <p className="text-sm text-slate-400">No se ha enviado ningún pack.</p>}
            </div>
          </div>
        </div>
      </div>

      <Modal titulo="Editar cliente" abierto={modalEditar} alCerrar={() => setModalEditar(false)}>
        <FormularioCliente inicial={c} alGuardar={async (d) => { await api.put(`/api/clientes/${id}`, d); setModalEditar(false); cargar(); }} />
      </Modal>

      <Modal titulo="Nueva interacción" abierto={modalInter} alCerrar={() => setModalInter(false)} ancho="max-w-md">
        <FormInteraccion alGuardar={async (d) => { await api.post(`/api/clientes/${id}/interacciones`, d); setModalInter(false); cargar(); }} />
      </Modal>

      <Modal titulo="Programar seguimiento" abierto={modalSeg} alCerrar={() => setModalSeg(false)} ancho="max-w-md">
        <FormSeguimiento alGuardar={async (d) => { await api.post(`/api/clientes/${id}/seguimientos`, d); setModalSeg(false); cargar(); }} />
      </Modal>

      <Modal titulo="Actualizar solvencia" abierto={modalSolv} alCerrar={() => setModalSolv(false)} ancho="max-w-md">
        <FormSolvencia cliente={c} alGuardar={async (d) => { await api.put(`/api/clientes/${id}`, { ...c, ...d }); setModalSolv(false); cargar(); }} />
      </Modal>
    </div>
  );
}

const Dato = ({ k, v }: { k: string; v: any }) => (
  <div className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-800 text-right">{v || '—'}</dd></div>
);

function FormInteraccion({ alGuardar }: { alGuardar: (d: any) => void }) {
  const [d, setD] = useState({ fecha: hoyInput(), tipo: 'LLAMADA', resumen: '', resultado: '' });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="etiqueta">Fecha</label><input type="date" className="campo" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></div>
        <div><label className="etiqueta">Tipo</label><select className="campo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>{['LLAMADA', 'EMAIL', 'VISITA', 'REUNION', 'OTRO'].map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}</select></div>
      </div>
      <div><label className="etiqueta">Resumen *</label><textarea required className="campo" rows={2} value={d.resumen} onChange={(e) => setD({ ...d, resumen: e.target.value })} /></div>
      <div><label className="etiqueta">Resultado</label><input className="campo" value={d.resultado} onChange={(e) => setD({ ...d, resultado: e.target.value })} /></div>
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}

function FormSeguimiento({ alGuardar }: { alGuardar: (d: any) => void }) {
  const [d, setD] = useState({ fechaPrevista: hoyInput(), descripcion: '' });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div><label className="etiqueta">Fecha prevista *</label><input type="date" required className="campo" value={d.fechaPrevista} onChange={(e) => setD({ ...d, fechaPrevista: e.target.value })} /></div>
      <div><label className="etiqueta">Descripción *</label><input required className="campo" value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} placeholder="Llamar para…" /></div>
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}

function FormSolvencia({ cliente, alGuardar }: { cliente: any; alGuardar: (d: any) => void }) {
  const [d, setD] = useState({
    solvenciaConsultada: cliente.solvenciaConsultada,
    solvenciaResultado: cliente.solvenciaResultado || '',
    solvenciaFecha: fechaInput(cliente.solvenciaFecha) || hoyInput(),
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.solvenciaConsultada} onChange={(e) => setD({ ...d, solvenciaConsultada: e.target.checked })} /> Informe de solvencia consultado</label>
      <div><label className="etiqueta">Resultado</label><input className="campo" value={d.solvenciaResultado} onChange={(e) => setD({ ...d, solvenciaResultado: e.target.value })} placeholder="Favorable (eInforma, rating 7/10)" /></div>
      <div><label className="etiqueta">Fecha de consulta</label><input type="date" className="campo" value={d.solvenciaFecha} onChange={(e) => setD({ ...d, solvenciaFecha: e.target.value })} /></div>
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
