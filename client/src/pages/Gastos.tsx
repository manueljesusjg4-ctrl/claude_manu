// Gastos de empresa (fijos y variables) y proveedores/subcontratas, con su
// documentación legal (REA, TC2, certificados...) para evitar riesgo de
// responsabilidad solidaria (Ley 32/2006 de subcontratación en construcción).
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { euros, fecha, hoyInput, etiqueta } from '../lib/formato';
import { Badge, CabeceraPagina, CampoArchivo, Cargando, COLORES_BADGE, Modal, TarjetaKpi } from '../components/ui';

const CATEGORIAS_GASTO = ['ESTRUCTURA', 'MATERIALES', 'SUBCONTRATA', 'FINANCIERO', 'OTRO'];
const TIPOS_DOC_PROVEEDOR = ['REA', 'TC2', 'CERT_AEAT', 'CERT_SS', 'SEGURO_RC', 'ALTA_AUTONOMO', 'OTRO'];

const estadoDoc = (d: any) => {
  if (!d.fechaCaducidad) return 'SIN_CADUCIDAD';
  const hoy = new Date(); const cad = new Date(d.fechaCaducidad);
  if (cad < hoy) return 'CADUCADO';
  if (cad <= new Date(hoy.getTime() + 30 * 86400000)) return 'POR_CADUCAR';
  return 'VIGENTE';
};

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
  const [modalDocs, setModalDocs] = useState<any>(null);
  const cargar = () => { api.get('/api/proveedores').then(setProveedores); };
  useEffect(cargar, []);
  if (!proveedores) return <Cargando />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="boton-primario" onClick={() => setModal({})}>+ Nuevo proveedor</button></div>
      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Nombre</th><th className="th">CIF</th><th className="th">Contacto</th><th className="th">Teléfono</th><th className="th">Plazo pago</th><th className="th">Tipo</th><th className="th"></th></tr></thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td className="td font-medium">{p.nombre}</td>
                <td className="td">{p.cif || '—'}</td>
                <td className="td">{p.contacto || '—'}</td>
                <td className="td">{p.telefono || '—'}</td>
                <td className="td">{p.plazoPagoDias} días</td>
                <td className="td">
                  {p.esSubcontratista
                    ? <Badge texto={`Subcontrata${p.documentos?.length ? ` (${p.documentos.length} doc.)` : ''}`} color="bg-violet-100 text-violet-700" />
                    : <span className="text-xs text-slate-400">Proveedor</span>}
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    {p.esSubcontratista && <button className="text-xs text-acento" onClick={() => setModalDocs(p)}>Documentación</button>}
                    <button className="text-xs text-acento" onClick={() => setModal(p)}>Editar</button>
                    <button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/proveedores/${p.id}`); cargar(); }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal titulo={modal?.id ? 'Editar proveedor' : 'Nuevo proveedor'} abierto={!!modal} alCerrar={() => setModal(null)} ancho="max-w-md">
        {modal && <FormProveedor inicial={modal} alGuardar={async (d) => { if (modal.id) await api.put(`/api/proveedores/${modal.id}`, d); else await api.post('/api/proveedores', d); setModal(null); cargar(); }} />}
      </Modal>
      <Modal titulo={`Documentación — ${modalDocs?.nombre || ''}`} abierto={!!modalDocs} alCerrar={() => setModalDocs(null)} ancho="max-w-lg">
        {modalDocs && (
          <DocumentosProveedor
            proveedor={modalDocs}
            alCambiar={(actualizado) => { setModalDocs(actualizado); cargar(); }}
          />
        )}
      </Modal>
    </div>
  );
}

function FormProveedor({ inicial, alGuardar }: { inicial: any; alGuardar: (d: any) => void }) {
  const [p, setP] = useState({
    nombre: inicial.nombre || '', cif: inicial.cif || '', contacto: inicial.contacto || '',
    telefono: inicial.telefono || '', email: inicial.email || '', plazoPagoDias: inicial.plazoPagoDias || 30,
    esSubcontratista: inicial.esSubcontratista || false, notas: inicial.notas || '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(p); }} className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="etiqueta">Nombre *</label><input required className="campo" value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} /></div>
      <div><label className="etiqueta">CIF</label><input className="campo" value={p.cif} onChange={(e) => setP({ ...p, cif: e.target.value })} /></div>
      <div><label className="etiqueta">Contacto</label><input className="campo" value={p.contacto} onChange={(e) => setP({ ...p, contacto: e.target.value })} /></div>
      <div><label className="etiqueta">Teléfono</label><input className="campo" value={p.telefono} onChange={(e) => setP({ ...p, telefono: e.target.value })} /></div>
      <div><label className="etiqueta">Email</label><input className="campo" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></div>
      <div><label className="etiqueta">Plazo de pago (días)</label><input type="number" className="campo" value={p.plazoPagoDias} onChange={(e) => setP({ ...p, plazoPagoDias: Number(e.target.value) })} /></div>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.esSubcontratista} onChange={(e) => setP({ ...p, esSubcontratista: e.target.checked })} />
        Es subcontratista/autónomo (requiere documentación: REA, TC2, certificados...)
      </label>
      <div className="col-span-2 flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}

function DocumentosProveedor({ proveedor, alCambiar }: { proveedor: any; alCambiar: (p: any) => void }) {
  const [modalDoc, setModalDoc] = useState<any>(null);
  const documentos = proveedor.documentos || [];

  const recargar = async () => {
    const lista = await api.get<any[]>('/api/proveedores');
    const actualizado = lista.find((p) => p.id === proveedor.id);
    if (actualizado) alCambiar(actualizado);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button className="boton-secundario text-xs" onClick={() => setModalDoc({})}>+ Documento</button></div>
      <div className="space-y-2">
        {documentos.map((d: any) => {
          const est = estadoDoc(d);
          return (
            <div key={d.id} className="flex items-center justify-between text-sm border border-slate-200 rounded-lg p-2.5">
              <div>
                <p className="font-medium">{etiqueta(d.tipo)}</p>
                <p className="text-xs text-slate-500">{d.nombre}{d.fechaCaducidad ? ` · caduca ${fecha(d.fechaCaducidad)}` : ''}</p>
                {d.archivoUrl && <a href={d.archivoUrl} target="_blank" rel="noreferrer" className="text-xs text-acento">Ver archivo →</a>}
              </div>
              <div className="flex items-center gap-2">
                <Badge texto={est === 'SIN_CADUCIDAD' ? 'Sin caducidad' : est === 'VIGENTE' ? 'Vigente' : est === 'POR_CADUCAR' ? 'Por caducar' : 'Caducado'} color={COLORES_BADGE[est]} />
                <button className="text-xs text-acento" onClick={() => setModalDoc(d)}>Editar</button>
                <button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/proveedores/documentos/${d.id}`); recargar(); }}>✕</button>
              </div>
            </div>
          );
        })}
        {documentos.length === 0 && <p className="text-sm text-slate-400">Sin documentos. Recomendado: inscripción REA, TC2 y certificados de estar al corriente (SS/AEAT) antes de subcontratar.</p>}
      </div>

      <Modal titulo={modalDoc?.id ? 'Editar documento' : 'Añadir documento'} abierto={!!modalDoc} alCerrar={() => setModalDoc(null)} ancho="max-w-md">
        {modalDoc && (
          <FormDocProveedor
            inicial={modalDoc}
            alGuardar={async (d) => {
              if (modalDoc.id) await api.put(`/api/proveedores/documentos/${modalDoc.id}`, d);
              else await api.post(`/api/proveedores/${proveedor.id}/documentos`, d);
              setModalDoc(null);
              recargar();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function FormDocProveedor({ inicial, alGuardar }: { inicial: any; alGuardar: (d: any) => void }) {
  const [d, setD] = useState({
    tipo: inicial.tipo || 'REA', nombre: inicial.nombre || '',
    fechaEmision: inicial.fechaEmision ? inicial.fechaEmision.slice(0, 10) : hoyInput(),
    fechaCaducidad: inicial.fechaCaducidad ? inicial.fechaCaducidad.slice(0, 10) : '',
    archivoUrl: inicial.archivoUrl || '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div><label className="etiqueta">Tipo *</label><select className="campo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>{TIPOS_DOC_PROVEEDOR.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}</select></div>
      <div><label className="etiqueta">Nombre / descripción *</label><input required className="campo" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="etiqueta">Emisión</label><input type="date" className="campo" value={d.fechaEmision} onChange={(e) => setD({ ...d, fechaEmision: e.target.value })} /></div>
        <div><label className="etiqueta">Caducidad</label><input type="date" className="campo" value={d.fechaCaducidad} onChange={(e) => setD({ ...d, fechaCaducidad: e.target.value })} /></div>
      </div>
      <CampoArchivo valor={d.archivoUrl} alCambiar={(url) => setD({ ...d, archivoUrl: url })} />
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
