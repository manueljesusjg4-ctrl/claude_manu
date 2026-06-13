// Documentación de empresa con caducidades + generador de packs documentales.
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fecha, hoyInput, etiqueta } from '../lib/formato';
import { Aviso, Badge, CabeceraPagina, Cargando, COLORES_BADGE, Modal } from '../components/ui';

const TIPOS_DOC = ['REA', 'RC', 'SPA', 'CERT_AEAT', 'CERT_SS', 'ESCRITURA', 'PODERES', 'TC1_TC2', 'CIF', 'OTRO'];

export function Documentacion() {
  const [docs, setDocs] = useState<any[] | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [modalDoc, setModalDoc] = useState<any>(null);
  const [modalPack, setModalPack] = useState(false);

  const cargar = () => {
    api.get('/api/documentos-empresa').then(setDocs);
    api.get('/api/clientes').then(setClientes);
    api.get('/api/packs').then(setPacks);
  };
  useEffect(cargar, []);
  if (!docs) return <Cargando />;

  const caducados = docs.filter((d) => d.estadoCaducidad === 'CADUCADO');
  const porCaducar = docs.filter((d) => d.estadoCaducidad === 'POR_CADUCAR');

  return (
    <div>
      <CabeceraPagina titulo="Documentación de empresa" subtitulo="Documentos clave, caducidades y packs para clientes">
        <button className="boton-secundario" onClick={() => setModalPack(true)}>📦 Generar pack para cliente</button>
        <button className="boton-primario" onClick={() => setModalDoc({})}>+ Documento</button>
      </CabeceraPagina>

      {(caducados.length > 0 || porCaducar.length > 0) && (
        <div className="mb-4 space-y-2">
          {caducados.length > 0 && <Aviso tipo="rojo">⚠ {caducados.length} documento(s) CADUCADO(s): {caducados.map((d) => etiqueta(d.tipo)).join(', ')}. Los clientes los piden actualizados.</Aviso>}
          {porCaducar.length > 0 && <Aviso tipo="ambar">⏰ {porCaducar.length} documento(s) caducan en menos de 30 días: {porCaducar.map((d) => etiqueta(d.tipo)).join(', ')}.</Aviso>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 tarjeta overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Tipo</th><th className="th">Documento</th><th className="th">Emisión</th><th className="th">Caducidad</th><th className="th">Estado</th><th className="th"></th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="td font-semibold">{etiqueta(d.tipo)}</td>
                  <td className="td">{d.nombre}{d.archivoUrl && <a href={d.archivoUrl} target="_blank" className="text-acento text-xs ml-2">PDF →</a>}</td>
                  <td className="td">{fecha(d.fechaEmision)}</td>
                  <td className="td">{fecha(d.fechaCaducidad)}</td>
                  <td className="td"><Badge texto={d.estadoCaducidad === 'SIN_CADUCIDAD' ? 'Sin caducidad' : d.estadoCaducidad === 'VIGENTE' ? 'Vigente' : d.estadoCaducidad === 'POR_CADUCAR' ? 'Por caducar' : 'Caducado'} color={COLORES_BADGE[d.estadoCaducidad]} /></td>
                  <td className="td"><div className="flex gap-1"><button className="text-xs text-acento" onClick={() => setModalDoc(d)}>Editar</button><button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/documentos-empresa/${d.id}`); cargar(); }}>✕</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tarjeta p-5">
          <h3 className="font-bold text-marino mb-3">Packs enviados</h3>
          {packs.map((p) => (
            <div key={p.id} className="text-sm py-2 border-b border-slate-100">
              <p className="font-medium">{p.cliente?.nombre}</p>
              <p className="text-xs text-slate-400">{fecha(p.fecha)} · {p.items.length} doc.</p>
              <p className="text-xs text-slate-500">{p.items.map((it: any) => etiqueta(it.documento.tipo)).join(', ')}</p>
              <button className="text-xs text-red-600 mt-1" onClick={async () => { await api.del(`/api/packs/${p.id}`); cargar(); }}>Eliminar</button>
            </div>
          ))}
          {packs.length === 0 && <p className="text-sm text-slate-400">Aún no se ha enviado ningún pack.</p>}
        </div>
      </div>

      <Modal titulo={modalDoc?.id ? 'Editar documento' : 'Nuevo documento'} abierto={!!modalDoc} alCerrar={() => setModalDoc(null)} ancho="max-w-md">
        {modalDoc && <FormDocEmpresa inicial={modalDoc} alGuardar={async (d) => { if (modalDoc.id) await api.put(`/api/documentos-empresa/${modalDoc.id}`, d); else await api.post('/api/documentos-empresa', d); setModalDoc(null); cargar(); }} />}
      </Modal>

      <Modal titulo="Generar pack documental para un cliente" abierto={modalPack} alCerrar={() => setModalPack(false)}>
        <FormPack docs={docs} clientes={clientes} alGuardar={async (d) => { await api.post('/api/packs', d); setModalPack(false); cargar(); }} />
      </Modal>
    </div>
  );
}

function FormDocEmpresa({ inicial, alGuardar }: { inicial: any; alGuardar: (d: any) => void }) {
  const [d, setD] = useState({
    tipo: inicial.tipo || 'REA', nombre: inicial.nombre || '',
    fechaEmision: inicial.fechaEmision ? inicial.fechaEmision.slice(0, 10) : '',
    fechaCaducidad: inicial.fechaCaducidad ? inicial.fechaCaducidad.slice(0, 10) : '',
    archivoUrl: inicial.archivoUrl || '', notas: inicial.notas || '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div><label className="etiqueta">Tipo *</label><select className="campo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>{TIPOS_DOC.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}</select></div>
      <div><label className="etiqueta">Nombre *</label><input required className="campo" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="etiqueta">Emisión</label><input type="date" className="campo" value={d.fechaEmision} onChange={(e) => setD({ ...d, fechaEmision: e.target.value })} /></div>
        <div><label className="etiqueta">Caducidad</label><input type="date" className="campo" value={d.fechaCaducidad} onChange={(e) => setD({ ...d, fechaCaducidad: e.target.value })} /></div>
      </div>
      <div><label className="etiqueta">Enlace al PDF</label><input className="campo" value={d.archivoUrl} onChange={(e) => setD({ ...d, archivoUrl: e.target.value })} /></div>
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}

function FormPack({ docs, clientes, alGuardar }: { docs: any[]; clientes: any[]; alGuardar: (d: any) => void }) {
  const [clienteId, setClienteId] = useState('');
  const [seleccion, setSeleccion] = useState<number[]>([]);
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar({ clienteId, documentoIds: seleccion, fecha: hoyInput() }); }} className="space-y-3">
      <div>
        <label className="etiqueta">Cliente *</label>
        <select required className="campo" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">— Elegir —</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="etiqueta">Documentos a incluir</label>
        <div className="space-y-1 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2">
          {docs.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" checked={seleccion.includes(d.id)} onChange={(e) => setSeleccion(e.target.checked ? [...seleccion, d.id] : seleccion.filter((x) => x !== d.id))} />
              <span>{etiqueta(d.tipo)} — {d.nombre}</span>
              {d.estadoCaducidad === 'CADUCADO' && <span className="text-xs text-red-600 font-semibold">(caducado)</span>}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end"><button className="boton-primario" disabled={!clienteId || seleccion.length === 0}>Registrar envío</button></div>
    </form>
  );
}
