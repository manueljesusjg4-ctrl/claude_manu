// Gastos de empresa (fijos y variables) y proveedores.
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { euros, fecha, hoyInput, etiqueta } from '../lib/formato';
import { Badge, CabeceraPagina, Cargando, Modal, TarjetaKpi } from '../components/ui';

const CATEGORIAS_GASTO = ['ESTRUCTURA', 'MATERIALES', 'SUBCONTRATA', 'FINANCIERO', 'OTRO'];

export function Gastos() {
  const [pestania, setPestania] = useState<'gastos' | 'proveedores'>('gastos');
  return (
    <div>
      <CabeceraPagina titulo="Gastos y proveedores" subtitulo="Los gastos fijos alimentan el flujo de caja y el cálculo de overhead" />
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        <button onClick={() => setPestania('gastos')} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${pestania === 'gastos' ? 'border-acento text-acento' : 'border-transparent text-slate-500'}`}>Gastos</button>
        <button onClick={() => setPestania('proveedores')} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${pestania === 'proveedores' ? 'border-acento text-acento' : 'border-transparent text-slate-500'}`}>Proveedores</button>
      </div>
      {pestania === 'gastos' ? <ListaGastos /> : <ListaProveedores />}
    </div>
  );
}

function ListaGastos() {
  const [gastos, setGastos] = useState<any[] | null>(null);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [modal, setModal] = useState<any>(null);

  const cargar = () => {
    api.get('/api/gastos').then(setGastos);
    api.get('/api/proveedores').then(setProveedores);
    api.get('/api/obras').then(setObras);
  };
  useEffect(cargar, []);
  if (!gastos) return <Cargando />;

  const estructuraMes = gastos.filter((g) => g.categoria === 'ESTRUCTURA' && g.esRecurrente).reduce((s, g) => s + g.importe, 0);
  const variablesMes = gastos.filter((g) => !g.esRecurrente).reduce((s, g) => s + g.importe, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <TarjetaKpi titulo="Estructura fija/mes" valor={euros(estructuraMes)} secundario="Se reparte como overhead" tono="acento" />
        <TarjetaKpi titulo="Gastos variables registrados" valor={euros(variablesMes)} />
        <div className="flex items-center justify-end"><button className="boton-primario" onClick={() => setModal({})}>+ Nuevo gasto</button></div>
      </div>

      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Concepto</th><th className="th">Categoría</th><th className="th">Importe</th><th className="th">Tipo</th><th className="th">Fecha</th><th className="th">Proveedor</th><th className="th">Pagado</th><th className="th"></th></tr></thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td className="td font-medium">{g.concepto}{g.obra && <span className="text-xs text-slate-400"> · {g.obra.nombre}</span>}</td>
                <td className="td">{etiqueta(g.categoria)}</td>
                <td className="td font-semibold">{euros(g.importe)}</td>
                <td className="td">{g.esRecurrente ? <Badge texto="Recurrente" color="bg-blue-100 text-blue-700" /> : <Badge texto="Puntual" color="bg-slate-100 text-slate-600" />}</td>
                <td className="td">{fecha(g.fecha)}</td>
                <td className="td">{g.proveedor?.nombre || '—'}</td>
                <td className="td">{g.pagado ? '✓' : <span className="text-amber-600">Pendiente</span>}</td>
                <td className="td"><div className="flex gap-1"><button className="text-xs text-acento" onClick={() => setModal(g)}>Editar</button><button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/gastos/${g.id}`); cargar(); }}>✕</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal titulo={modal?.id ? 'Editar gasto' : 'Nuevo gasto'} abierto={!!modal} alCerrar={() => setModal(null)}>
        {modal && <FormGasto inicial={modal} proveedores={proveedores} obras={obras} alGuardar={async (d) => { if (modal.id) await api.put(`/api/gastos/${modal.id}`, d); else await api.post('/api/gastos', d); setModal(null); cargar(); }} />}
      </Modal>
    </div>
  );
}

function FormGasto({ inicial, proveedores, obras, alGuardar }: { inicial: any; proveedores: any[]; obras: any[]; alGuardar: (d: any) => void }) {
  const [g, setG] = useState({
    concepto: inicial.concepto || '', categoria: inicial.categoria || 'ESTRUCTURA', importe: inicial.importe || '',
    esRecurrente: inicial.esRecurrente || false, fecha: inicial.fecha ? inicial.fecha.slice(0, 10) : hoyInput(),
    pagado: inicial.pagado || false, proveedorId: inicial.proveedorId || '', obraId: inicial.obraId || '', notas: inicial.notas || '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar({ ...g, proveedorId: g.proveedorId || null, obraId: g.obraId || null }); }} className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="etiqueta">Concepto *</label><input required className="campo" value={g.concepto} onChange={(e) => setG({ ...g, concepto: e.target.value })} /></div>
      <div><label className="etiqueta">Categoría *</label><select className="campo" value={g.categoria} onChange={(e) => setG({ ...g, categoria: e.target.value })}>{CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}</select></div>
      <div><label className="etiqueta">Importe (€) *</label><input type="number" step="0.01" required className="campo" value={g.importe} onChange={(e) => setG({ ...g, importe: e.target.value })} /></div>
      <div><label className="etiqueta">Fecha *</label><input type="date" required className="campo" value={g.fecha} onChange={(e) => setG({ ...g, fecha: e.target.value })} /></div>
      <div>
        <label className="etiqueta">Proveedor</label>
        <select className="campo" value={g.proveedorId} onChange={(e) => setG({ ...g, proveedorId: e.target.value })}>
          <option value="">— Ninguno —</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="etiqueta">Obra (imputar)</label>
        <select className="campo" value={g.obraId} onChange={(e) => setG({ ...g, obraId: e.target.value })}>
          <option value="">— Ninguna —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.esRecurrente} onChange={(e) => setG({ ...g, esRecurrente: e.target.checked })} /> Gasto fijo mensual (estructura)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.pagado} onChange={(e) => setG({ ...g, pagado: e.target.checked })} /> Ya pagado</label>
      <div className="col-span-2 flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}

function ListaProveedores() {
  const [proveedores, setProveedores] = useState<any[] | null>(null);
  const [modal, setModal] = useState<any>(null);
  const cargar = () => { api.get('/api/proveedores').then(setProveedores); };
  useEffect(cargar, []);
  if (!proveedores) return <Cargando />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="boton-primario" onClick={() => setModal({})}>+ Nuevo proveedor</button></div>
      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Nombre</th><th className="th">CIF</th><th className="th">Contacto</th><th className="th">Teléfono</th><th className="th">Plazo pago</th><th className="th"></th></tr></thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td className="td font-medium">{p.nombre}</td>
                <td className="td">{p.cif || '—'}</td>
                <td className="td">{p.contacto || '—'}</td>
                <td className="td">{p.telefono || '—'}</td>
                <td className="td">{p.plazoPagoDias} días</td>
                <td className="td"><div className="flex gap-1"><button className="text-xs text-acento" onClick={() => setModal(p)}>Editar</button><button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/proveedores/${p.id}`); cargar(); }}>✕</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal titulo={modal?.id ? 'Editar proveedor' : 'Nuevo proveedor'} abierto={!!modal} alCerrar={() => setModal(null)} ancho="max-w-md">
        {modal && <FormProveedor inicial={modal} alGuardar={async (d) => { if (modal.id) await api.put(`/api/proveedores/${modal.id}`, d); else await api.post('/api/proveedores', d); setModal(null); cargar(); }} />}
      </Modal>
    </div>
  );
}

function FormProveedor({ inicial, alGuardar }: { inicial: any; alGuardar: (d: any) => void }) {
  const [p, setP] = useState({
    nombre: inicial.nombre || '', cif: inicial.cif || '', contacto: inicial.contacto || '',
    telefono: inicial.telefono || '', email: inicial.email || '', plazoPagoDias: inicial.plazoPagoDias || 30, notas: inicial.notas || '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(p); }} className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="etiqueta">Nombre *</label><input required className="campo" value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} /></div>
      <div><label className="etiqueta">CIF</label><input className="campo" value={p.cif} onChange={(e) => setP({ ...p, cif: e.target.value })} /></div>
      <div><label className="etiqueta">Contacto</label><input className="campo" value={p.contacto} onChange={(e) => setP({ ...p, contacto: e.target.value })} /></div>
      <div><label className="etiqueta">Teléfono</label><input className="campo" value={p.telefono} onChange={(e) => setP({ ...p, telefono: e.target.value })} /></div>
      <div><label className="etiqueta">Email</label><input className="campo" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></div>
      <div><label className="etiqueta">Plazo de pago (días)</label><input type="number" className="campo" value={p.plazoPagoDias} onChange={(e) => setP({ ...p, plazoPagoDias: Number(e.target.value) })} /></div>
      <div className="col-span-2 flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
