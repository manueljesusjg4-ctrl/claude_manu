// Ficha de trabajador: desglose completo del coste/hora (mensual, anualizado,
// con/sin estructura) y documentación con caducidades.
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { euros, fecha, fechaInput, hoyInput, etiqueta } from '../lib/formato';
import { Badge, CabeceraPagina, Cargando, COLORES_BADGE, Desglose, Modal, TarjetaKpi } from '../components/ui';
import { FormularioTrabajador } from './Trabajadores';

const TIPOS_DOC = ['ALTA_SS', 'TPC', 'PRL_20H', 'RECONOCIMIENTO_MEDICO', 'OTRO'];

export function TrabajadorFicha() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [t, setT] = useState<any>(null);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalDoc, setModalDoc] = useState(false);

  const cargar = () => api.get(`/api/trabajadores/${id}`).then(setT);
  useEffect(() => { cargar(); }, [id]);
  if (!t) return <Cargando />;

  const estadoDoc = (d: any) => {
    if (!d.fechaCaducidad) return 'SIN_CADUCIDAD';
    const hoy = new Date(); const cad = new Date(d.fechaCaducidad);
    if (cad < hoy) return 'CADUCADO';
    if (cad <= new Date(hoy.getTime() + 30 * 86400000)) return 'POR_CADUCAR';
    return 'VIGENTE';
  };

  return (
    <div>
      <CabeceraPagina titulo={`${t.nombre} ${t.apellidos}`} subtitulo={`${etiqueta(t.categoria)}${t.especialidad ? ` · ${t.especialidad}` : ''} · ${t.dni}`}>
        <Link to="/trabajadores" className="boton-secundario">← Volver</Link>
        <button className="boton-secundario" onClick={() => setModalEditar(true)}>Editar</button>
        <button className="boton-peligro" onClick={async () => { if (confirm('¿Eliminar trabajador y todo su historial?')) { await api.del(`/api/trabajadores/${id}`); navegar('/trabajadores'); } }}>Eliminar</button>
      </CabeceraPagina>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <TarjetaKpi titulo="Coste empresa/mes" valor={euros(t.costeEmpresaMensual)} secundario="Base (sin extras)" />
        <TarjetaKpi titulo="Coste/h mensual" valor={euros(t.coste.costeHoraMensual)} secundario="Caja" />
        <TarjetaKpi titulo="Coste/h anualizado" valor={euros(t.coste.costeHoraAnualizado)} secundario="Real para precios" tono="acento" />
        <TarjetaKpi titulo="Coste/h con estructura" valor={euros(t.costeHoraCargadoAnualizado)} secundario="Overhead incluido" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Desglose del coste */}
        <div className="tarjeta p-5">
          <h3 className="font-bold text-marino mb-2">Cómo se calcula el coste/hora</h3>
          <p className="text-xs text-slate-500 mb-3">El coste real no es la nómina: incluye pagas extra prorrateadas, EPIs, reconocimiento médico y, opcionalmente, la estructura.</p>
          <div className="space-y-1.5">
            {t.coste.desglose.map((l: any, i: number) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-sm py-1 border-b border-slate-100 last:border-0">
                <div><span className="text-slate-700 font-medium">{l.concepto}</span><span className="block text-xs text-slate-400 font-mono">{l.formula}</span></div>
                <span className="font-bold text-marino whitespace-nowrap">{l.unidad.startsWith('€') ? euros(l.valor) : l.valor} <span className="font-normal text-slate-400 text-xs">{l.unidad.replace('€', '').trim()}</span></span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-sm font-semibold text-marino mb-1">Overhead de estructura</p>
            <Desglose lineas={t.overhead.desglose} titulo="Ver reparto de la estructura" />
          </div>
        </div>

        {/* Documentación */}
        <div className="tarjeta p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-marino">Documentación obligatoria</h3>
            <button className="boton-secundario text-xs" onClick={() => setModalDoc(true)}>+ Documento</button>
          </div>
          <div className="space-y-2">
            {t.documentos.map((d: any) => {
              const est = estadoDoc(d);
              return (
                <div key={d.id} className="flex items-center justify-between text-sm border border-slate-200 rounded-lg p-2.5">
                  <div>
                    <p className="font-medium">{etiqueta(d.tipo)}</p>
                    <p className="text-xs text-slate-500">{d.nombre}{d.fechaCaducidad ? ` · caduca ${fecha(d.fechaCaducidad)}` : ''}</p>
                    {d.archivoUrl && <a href={d.archivoUrl} target="_blank" className="text-xs text-acento">Ver PDF →</a>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge texto={est === 'SIN_CADUCIDAD' ? 'Sin caducidad' : est === 'VIGENTE' ? 'Vigente' : est === 'POR_CADUCAR' ? 'Por caducar' : 'Caducado'} color={COLORES_BADGE[est]} />
                    <button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/trabajadores/documentos/${d.id}`); cargar(); }}>✕</button>
                  </div>
                </div>
              );
            })}
            {t.documentos.length === 0 && <p className="text-sm text-slate-400">Sin documentos. Recuerda: TPC, PRL 20h, alta SS y reconocimiento médico son obligatorios.</p>}
          </div>
        </div>
      </div>

      {/* Histórico de obras */}
      <div className="tarjeta p-5 mt-5">
        <h3 className="font-bold text-marino mb-3">Obras y asignaciones</h3>
        {t.asignaciones.map((a: any) => (
          <div key={a.id} className="text-sm py-1.5 border-b border-slate-100">
            <Link to={`/obras/${a.obraId}`} className="font-medium text-marino hover:text-acento">{a.obra.nombre}</Link>
            <span className="text-xs text-slate-400 ml-2">{euros(a.precioVentaHora)}/h · desde {fecha(a.fechaInicio)}{a.fechaFin ? ` hasta ${fecha(a.fechaFin)}` : ' (activa)'}</span>
          </div>
        ))}
        {t.asignaciones.length === 0 && <p className="text-sm text-slate-400">Sin asignaciones.</p>}
      </div>

      <Modal titulo="Editar trabajador" abierto={modalEditar} alCerrar={() => setModalEditar(false)}>
        <FormularioTrabajador inicial={{ ...t, fechaAlta: fechaInput(t.fechaAlta) }} alGuardar={async (d) => { await api.put(`/api/trabajadores/${id}`, d); setModalEditar(false); cargar(); }} />
      </Modal>

      <Modal titulo="Añadir documento" abierto={modalDoc} alCerrar={() => setModalDoc(false)} ancho="max-w-md">
        <FormDoc alGuardar={async (d) => { await api.post(`/api/trabajadores/${id}/documentos`, d); setModalDoc(false); cargar(); }} />
      </Modal>
    </div>
  );
}

function FormDoc({ alGuardar }: { alGuardar: (d: any) => void }) {
  const [d, setD] = useState({ tipo: 'TPC', nombre: '', fechaEmision: hoyInput(), fechaCaducidad: '', archivoUrl: '' });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div><label className="etiqueta">Tipo *</label><select className="campo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>{TIPOS_DOC.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}</select></div>
      <div><label className="etiqueta">Nombre / descripción *</label><input required className="campo" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="etiqueta">Emisión</label><input type="date" className="campo" value={d.fechaEmision} onChange={(e) => setD({ ...d, fechaEmision: e.target.value })} /></div>
        <div><label className="etiqueta">Caducidad</label><input type="date" className="campo" value={d.fechaCaducidad} onChange={(e) => setD({ ...d, fechaCaducidad: e.target.value })} /></div>
      </div>
      <div><label className="etiqueta">Enlace al PDF</label><input className="campo" value={d.archivoUrl} onChange={(e) => setD({ ...d, archivoUrl: e.target.value })} placeholder="https://… o ruta local" /></div>
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
