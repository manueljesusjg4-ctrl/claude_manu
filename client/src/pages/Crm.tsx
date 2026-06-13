// CRM: pipeline Kanban (con arrastre) + vista lista, métricas y alta de clientes.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { euros, eurosEnteros, etiqueta, porcentaje, ESTADOS_PIPELINE } from '../lib/formato';
import { Badge, CabeceraPagina, Cargando, COLORES_BADGE, Modal, TarjetaKpi } from '../components/ui';

const TIPOS_CLIENTE = ['PROMOTORA', 'CONSTRUCTORA', 'INTERMEDIARIO', 'PARTICULAR', 'ARQUITECTO'];

export function Crm() {
  const [clientes, setClientes] = useState<any[] | null>(null);
  const [metricas, setMetricas] = useState<any>(null);
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban');
  const [modal, setModal] = useState(false);
  const [arrastrado, setArrastrado] = useState<number | null>(null);

  const cargar = () => {
    api.get('/api/clientes').then(setClientes);
    api.get('/api/clientes/metricas').then(setMetricas);
  };
  useEffect(cargar, []);
  if (!clientes || !metricas) return <Cargando />;

  const moverPipeline = async (clienteId: number, estado: string) => {
    await api.patch(`/api/clientes/${clienteId}/pipeline`, { estadoPipeline: estado });
    cargar();
  };

  const eliminarCliente = async (c: any) => {
    if (!confirm(`¿Eliminar el cliente/lead "${c.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.del(`/api/clientes/${c.id}`);
      cargar();
    } catch (e: any) {
      alert(e.message || 'No se pudo eliminar el cliente');
    }
  };

  return (
    <div>
      <CabeceraPagina titulo="CRM / Clientes" subtitulo="Captación, pipeline de ventas y seguimiento comercial">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          <button onClick={() => setVista('kanban')} className={`px-3 py-1.5 text-sm font-semibold ${vista === 'kanban' ? 'bg-marino text-white' : 'bg-white text-slate-600'}`}>Kanban</button>
          <button onClick={() => setVista('lista')} className={`px-3 py-1.5 text-sm font-semibold ${vista === 'lista' ? 'bg-marino text-white' : 'bg-white text-slate-600'}`}>Lista</button>
        </div>
        <button className="boton-primario" onClick={() => setModal(true)}>+ Nuevo cliente / lead</button>
      </CabeceraPagina>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <TarjetaKpi titulo="Valor del pipeline" valor={eurosEnteros(metricas.valorPipeline)} secundario="Negocio en curso (sin cerrados)" tono="acento" />
        <TarjetaKpi titulo="Tasa de conversión" valor={porcentaje(metricas.tasaConversion)} secundario="Ganados / cerrados" />
        <TarjetaKpi titulo="Total clientes/leads" valor={String(metricas.totalClientes)} />
        <TarjetaKpi titulo="En negociación" valor={String(metricas.porEstado?.NEGOCIACION || 0)} />
      </div>

      {vista === 'kanban' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {ESTADOS_PIPELINE.map((estado) => {
            const cols = clientes.filter((c) => c.estadoPipeline === estado);
            return (
              <div
                key={estado}
                className="bg-slate-100 rounded-xl p-2 min-h-[200px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (arrastrado != null) moverPipeline(arrastrado, estado); setArrastrado(null); }}
              >
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase">{etiqueta(estado)}</span>
                  <span className="text-xs font-bold text-slate-400">{cols.length}</span>
                </div>
                <div className="space-y-2">
                  {cols.map((c) => (
                    <Link
                      key={c.id}
                      to={`/crm/${c.id}`}
                      draggable
                      onDragStart={() => setArrastrado(c.id)}
                      className="block tarjeta p-2.5 hover:shadow-md cursor-grab active:cursor-grabbing"
                    >
                      <p className="font-semibold text-sm text-marino leading-tight">{c.nombre}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{etiqueta(c.tipo)}</p>
                      {c.valorEstimado > 0 && <p className="text-xs font-bold text-acento mt-1">{eurosEnteros(c.valorEstimado)}</p>}
                      {!c.solvenciaConsultada && ['PROMOTORA', 'CONSTRUCTORA'].includes(c.tipo) && (
                        <p className="text-[10px] text-amber-600 font-semibold mt-1">⚠ Sin solvencia</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Cliente</th><th className="th">Tipo</th><th className="th">Contacto</th><th className="th">Origen</th><th className="th">Estado</th><th className="th">Valor</th><th className="th">Plazo pago</th><th className="th"></th></tr></thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="td"><Link to={`/crm/${c.id}`} className="font-semibold text-marino hover:text-acento">{c.nombre}</Link></td>
                  <td className="td">{etiqueta(c.tipo)}</td>
                  <td className="td text-xs">{c.personaContacto}<br /><span className="text-slate-400">{c.telefono}</span></td>
                  <td className="td text-xs">{c.origen || '—'}</td>
                  <td className="td"><Badge texto={etiqueta(c.estadoPipeline)} color={COLORES_BADGE[c.estadoPipeline]} /></td>
                  <td className="td">{c.valorEstimado > 0 ? euros(c.valorEstimado) : '—'}</td>
                  <td className="td">{c.plazoPagoDias} días</td>
                  <td className="td"><button className="text-xs text-slate-300 hover:text-red-500" title="Eliminar cliente" onClick={() => eliminarCliente(c)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal titulo="Nuevo cliente / lead" abierto={modal} alCerrar={() => setModal(false)}>
        <FormularioCliente alGuardar={async (d) => { await api.post('/api/clientes', d); setModal(false); cargar(); }} />
      </Modal>
    </div>
  );
}

export function FormularioCliente({ inicial, alGuardar }: { inicial?: any; alGuardar: (d: any) => void }) {
  const [c, setC] = useState<any>(inicial || {
    nombre: '', cif: '', tipo: 'CONSTRUCTORA', personaContacto: '', telefono: '', email: '',
    origen: '', plazoPagoDias: 60, estadoPipeline: 'FRIO', valorEstimado: 0, notas: '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(c); }} className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="etiqueta">Nombre / razón social *</label><input required className="campo" value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} /></div>
      <div><label className="etiqueta">CIF/NIF</label><input className="campo" value={c.cif || ''} onChange={(e) => setC({ ...c, cif: e.target.value })} /></div>
      <div>
        <label className="etiqueta">Tipo *</label>
        <select className="campo" value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value })}>
          {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
        </select>
      </div>
      <div><label className="etiqueta">Persona de contacto</label><input className="campo" value={c.personaContacto || ''} onChange={(e) => setC({ ...c, personaContacto: e.target.value })} /></div>
      <div><label className="etiqueta">Teléfono</label><input className="campo" value={c.telefono || ''} onChange={(e) => setC({ ...c, telefono: e.target.value })} /></div>
      <div><label className="etiqueta">Email</label><input className="campo" value={c.email || ''} onChange={(e) => setC({ ...c, email: e.target.value })} /></div>
      <div><label className="etiqueta">Origen</label><input className="campo" value={c.origen || ''} onChange={(e) => setC({ ...c, origen: e.target.value })} placeholder="Referido, Milanuncios, visita a obra…" /></div>
      <div>
        <label className="etiqueta">Estado pipeline</label>
        <select className="campo" value={c.estadoPipeline} onChange={(e) => setC({ ...c, estadoPipeline: e.target.value })}>
          {ESTADOS_PIPELINE.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
        </select>
      </div>
      <div><label className="etiqueta">Valor estimado (€)</label><input type="number" className="campo" value={c.valorEstimado} onChange={(e) => setC({ ...c, valorEstimado: Number(e.target.value) })} /></div>
      <div><label className="etiqueta">Plazo de pago (días)</label><input type="number" className="campo" value={c.plazoPagoDias} onChange={(e) => setC({ ...c, plazoPagoDias: Number(e.target.value) })} /></div>
      <div className="col-span-2"><label className="etiqueta">Notas</label><textarea className="campo" rows={2} value={c.notas || ''} onChange={(e) => setC({ ...c, notas: e.target.value })} /></div>
      <div className="col-span-2 flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
