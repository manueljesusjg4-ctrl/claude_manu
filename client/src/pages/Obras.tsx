// Listado de obras y alta. La ficha detallada está en ObraFicha.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { euros, fecha, hoyInput, etiqueta } from '../lib/formato';
import { Badge, CabeceraPagina, Cargando, COLORES_BADGE, Modal } from '../components/ui';

const TIPOS_OBRA = ['ADMINISTRACION', 'PRECIO_CERRADO', 'REFORMA'];
const ESTADOS_OBRA = ['PRESUPUESTADA', 'ACTIVA', 'FINALIZADA', 'CANCELADA'];

export function Obras() {
  const [obras, setObras] = useState<any[] | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [filtro, setFiltro] = useState('TODAS');

  const cargar = () => { api.get('/api/obras').then(setObras); api.get('/api/clientes').then(setClientes); };
  useEffect(cargar, []);
  if (!obras) return <Cargando />;

  const visibles = filtro === 'TODAS' ? obras : obras.filter((o) => o.estado === filtro);

  return (
    <div>
      <CabeceraPagina titulo="Obras / Proyectos" subtitulo="Control económico, equipo y certificaciones por obra">
        <select className="campo w-44" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="TODAS">Todas</option>
          {ESTADOS_OBRA.map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
        </select>
        <button className="boton-primario" onClick={() => setModal(true)}>+ Nueva obra</button>
      </CabeceraPagina>

      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Obra</th><th className="th">Cliente</th><th className="th">Tipo</th><th className="th">Estado</th><th className="th">Inicio</th><th className="th">Equipo</th><th className="th">Facturado</th><th className="th">Presupuesto cerrado</th></tr></thead>
          <tbody>
            {visibles.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="td"><Link to={`/obras/${o.id}`} className="font-semibold text-marino hover:text-acento">{o.nombre}</Link><p className="text-xs text-slate-400">{o.direccion}</p></td>
                <td className="td">{o.cliente?.nombre}</td>
                <td className="td">{etiqueta(o.tipo)}</td>
                <td className="td"><Badge texto={etiqueta(o.estado)} color={COLORES_BADGE[o.estado]} /></td>
                <td className="td">{fecha(o.fechaInicio)}</td>
                <td className="td text-center">{o.trabajadoresAsignados}</td>
                <td className="td">{euros(o.facturado)}</td>
                <td className="td">{o.presupuestoCerrado ? euros(o.presupuestoCerrado) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal titulo="Nueva obra" abierto={modal} alCerrar={() => setModal(false)}>
        <FormularioObra clientes={clientes} alGuardar={async (d) => { await api.post('/api/obras', d); setModal(false); cargar(); }} />
      </Modal>
    </div>
  );
}

export function FormularioObra({ inicial, clientes, alGuardar }: { inicial?: any; clientes: any[]; alGuardar: (d: any) => void }) {
  const [o, setO] = useState<any>(inicial || {
    clienteId: '', nombre: '', direccion: '', tipo: 'ADMINISTRACION', estado: 'PRESUPUESTADA',
    fechaInicio: hoyInput(), fechaFinPrevista: '', presupuestoCerrado: '', plazoCobroDias: '', margenPrevisto: '', notas: '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(o); }} className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="etiqueta">Nombre de la obra *</label><input required className="campo" value={o.nombre} onChange={(e) => setO({ ...o, nombre: e.target.value })} /></div>
      <div>
        <label className="etiqueta">Cliente *</label>
        <select required className="campo" value={o.clienteId} onChange={(e) => setO({ ...o, clienteId: e.target.value })}>
          <option value="">— Elegir —</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div><label className="etiqueta">Dirección</label><input className="campo" value={o.direccion || ''} onChange={(e) => setO({ ...o, direccion: e.target.value })} /></div>
      <div><label className="etiqueta">Tipo *</label><select className="campo" value={o.tipo} onChange={(e) => setO({ ...o, tipo: e.target.value })}>{TIPOS_OBRA.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}</select></div>
      <div><label className="etiqueta">Estado</label><select className="campo" value={o.estado} onChange={(e) => setO({ ...o, estado: e.target.value })}>{ESTADOS_OBRA.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}</select></div>
      <div><label className="etiqueta">Fecha inicio</label><input type="date" className="campo" value={o.fechaInicio || ''} onChange={(e) => setO({ ...o, fechaInicio: e.target.value })} /></div>
      <div><label className="etiqueta">Fin previsto</label><input type="date" className="campo" value={o.fechaFinPrevista || ''} onChange={(e) => setO({ ...o, fechaFinPrevista: e.target.value })} /></div>
      <div><label className="etiqueta">Presupuesto cerrado (€)</label><input type="number" className="campo" value={o.presupuestoCerrado || ''} onChange={(e) => setO({ ...o, presupuestoCerrado: e.target.value })} placeholder="Solo precio cerrado" /></div>
      <div><label className="etiqueta">Plazo cobro (días)</label><input type="number" className="campo" value={o.plazoCobroDias || ''} onChange={(e) => setO({ ...o, plazoCobroDias: e.target.value })} placeholder="Según cliente" /></div>
      <div><label className="etiqueta">Margen previsto (%)</label><input type="number" className="campo" value={o.margenPrevisto || ''} onChange={(e) => setO({ ...o, margenPrevisto: e.target.value })} /></div>
      <div className="col-span-2"><label className="etiqueta">Notas</label><textarea className="campo" rows={2} value={o.notas || ''} onChange={(e) => setO({ ...o, notas: e.target.value })} /></div>
      <div className="col-span-2 flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
