// Ficha de trabajador: desglose completo del coste/hora (mensual, anualizado,
// con/sin estructura), documentación con caducidades, entrega de EPIs/PRL con
// firma y gestión de llamamientos (fijos discontinuos).
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { euros, fecha, fechaInput, hoyInput, etiqueta } from '../lib/formato';
import { Badge, CabeceraPagina, CampoArchivo, Cargando, COLORES_BADGE, Desglose, Modal, TarjetaKpi } from '../components/ui';
import { FormularioTrabajador } from './Trabajadores';

const TIPOS_DOC = ['ALTA_SS', 'TPC', 'PRL_20H', 'RECONOCIMIENTO_MEDICO', 'OTRO'];

export function TrabajadorFicha() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [t, setT] = useState<any>(null);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalDoc, setModalDoc] = useState<any>(null);
  const [modalEpi, setModalEpi] = useState(false);
  const [epiEditar, setEpiEditar] = useState<any>(null);
  const [modalLlamamiento, setModalLlamamiento] = useState(false);

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

  const guardarCosteBase = async (nuevoValor: number) => {
    if (!nuevoValor || nuevoValor === t.costeEmpresaMensual) return;
    await api.put(`/api/trabajadores/${id}`, { ...t, costeEmpresaMensual: nuevoValor });
    cargar();
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
                {i === 0 ? (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <input
                      type="number" step="0.01" defaultValue={t.costeEmpresaMensual} key={t.costeEmpresaMensual}
                      onBlur={(e) => guardarCosteBase(Number(e.target.value))}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-24 text-right font-bold text-marino border border-slate-200 rounded px-1.5 py-0.5 focus:border-acento focus:outline-none"
                    />
                    <span className="font-normal text-slate-400 text-xs">{l.unidad.replace('€', '').trim()}</span>
                  </span>
                ) : (
                  <span className="font-bold text-marino whitespace-nowrap">{l.unidad.startsWith('€') ? euros(l.valor) : l.valor} <span className="font-normal text-slate-400 text-xs">{l.unidad.replace('€', '').trim()}</span></span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">✎ El coste base es editable aquí (haz clic en el número y cambia el valor). Los demás porcentajes y horas (pagas extra, EPIs, horas/año…) son <Link to="/configuracion" className="text-acento font-semibold">parámetros generales</Link> y afectan a todos los trabajadores.</p>
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-sm font-semibold text-marino mb-1">Overhead de estructura</p>
            <Desglose lineas={t.overhead.desglose} titulo="Ver reparto de la estructura" />
          </div>
        </div>

        {/* Documentación */}
        <div className="tarjeta p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-marino">Documentación obligatoria</h3>
            <button className="boton-secundario text-xs" onClick={() => setModalDoc({})}>+ Documento</button>
          </div>
          <div className="space-y-2">
            {t.documentos.map((d: any) => {
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
                    <button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/trabajadores/documentos/${d.id}`); cargar(); }}>✕</button>
                  </div>
                </div>
              );
            })}
            {t.documentos.length === 0 && <p className="text-sm text-slate-400">Sin documentos. Recuerda: TPC, PRL 20h, alta SS y reconocimiento médico son obligatorios.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        {/* Entrega de EPIs / PRL con firma */}
        <div className="tarjeta p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-marino">Entrega de EPIs y PRL</h3>
            <button className="boton-secundario text-xs" onClick={() => setModalEpi(true)}>+ Registrar entrega</button>
          </div>
          <p className="text-xs text-slate-500 mb-3">Registro firmado de equipos de protección entregados y de la información de riesgos recibida.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {t.entregasEpi.map((e: any) => (
              <div key={e.id} className="flex items-start justify-between gap-2 text-sm border border-slate-200 rounded-lg p-2.5">
                <div>
                  <p className="font-medium">{e.items}</p>
                  <p className="text-xs text-slate-500">{fecha(e.fecha)} · {e.riesgosLeidos ? 'Riesgos PRL informados' : 'Sin confirmar riesgos PRL'}</p>
                  {e.firmaUrl && <img src={e.firmaUrl} alt="Firma" className="h-10 mt-1 border border-slate-100 rounded bg-white" />}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="text-xs text-slate-400 hover:text-marino" title="Editar entrega" onClick={() => setEpiEditar(e)}>✎</button>
                  <button className="text-xs text-slate-300 hover:text-red-500" title="Eliminar entrega" onClick={async () => { if (confirm('¿Eliminar esta entrega de EPIs?')) { await api.del(`/api/trabajadores/epis/${e.id}`); cargar(); } }}>✕</button>
                </div>
              </div>
            ))}
            {t.entregasEpi.length === 0 && <p className="text-sm text-slate-400">Sin entregas registradas.</p>}
          </div>
        </div>

        {/* Llamamientos (solo fijos discontinuos) */}
        {t.tipoContrato === 'FIJO_DISCONTINUO' && (
          <div className="tarjeta p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-marino">Llamamientos</h3>
              <button className="boton-secundario text-xs" onClick={() => setModalLlamamiento(true)}>+ Nuevo llamamiento</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">Periodos de actividad/espera, para controlar y optimizar la rotación de fijos discontinuos.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {t.llamamientos.map((l: any) => (
                <div key={l.id} className="flex items-start justify-between gap-2 text-sm border border-slate-200 rounded-lg p-2.5">
                  <div>
                    <p className="font-medium">{l.motivo || 'Llamamiento'}</p>
                    <p className="text-xs text-slate-500">Desde {fecha(l.fechaInicio)}{l.fechaFin ? ` hasta ${fecha(l.fechaFin)}` : ' · activo'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!l.fechaFin && (
                      <button className="text-xs text-acento" onClick={async () => { await api.put(`/api/trabajadores/llamamientos/${l.id}`, { ...l, fechaFin: hoyInput() }); cargar(); }}>
                        Finalizar
                      </button>
                    )}
                    <button className="text-xs text-slate-300 hover:text-red-500" onClick={async () => { await api.del(`/api/trabajadores/llamamientos/${l.id}`); cargar(); }}>✕</button>
                  </div>
                </div>
              ))}
              {t.llamamientos.length === 0 && <p className="text-sm text-slate-400">Sin llamamientos registrados.</p>}
            </div>
          </div>
        )}
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

      <Modal titulo={modalDoc?.id ? 'Editar documento' : 'Añadir documento'} abierto={!!modalDoc} alCerrar={() => setModalDoc(null)} ancho="max-w-md">
        {modalDoc && (
          <FormDoc
            inicial={modalDoc}
            alGuardar={async (d) => {
              if (modalDoc.id) await api.put(`/api/trabajadores/documentos/${modalDoc.id}`, d);
              else await api.post(`/api/trabajadores/${id}/documentos`, d);
              setModalDoc(null);
              cargar();
            }}
          />
        )}
      </Modal>

      <Modal titulo="Registrar entrega de EPIs / PRL" abierto={modalEpi} alCerrar={() => setModalEpi(false)} ancho="max-w-md">
        <FormEpi alGuardar={async (d) => { await api.post(`/api/trabajadores/${id}/epis`, d); setModalEpi(false); cargar(); }} />
      </Modal>

      <Modal titulo="Editar entrega de EPIs / PRL" abierto={!!epiEditar} alCerrar={() => setEpiEditar(null)} ancho="max-w-md">
        {epiEditar && (
          <FormEpi inicial={epiEditar} alGuardar={async (d) => { await api.put(`/api/trabajadores/epis/${epiEditar.id}`, d); setEpiEditar(null); cargar(); }} />
        )}
      </Modal>

      <Modal titulo="Nuevo llamamiento" abierto={modalLlamamiento} alCerrar={() => setModalLlamamiento(false)} ancho="max-w-md">
        <FormLlamamiento alGuardar={async (d) => { await api.post(`/api/trabajadores/${id}/llamamientos`, d); setModalLlamamiento(false); cargar(); }} />
      </Modal>
    </div>
  );
}

function FormDoc({ inicial, alGuardar }: { inicial: any; alGuardar: (d: any) => void }) {
  const [d, setD] = useState({
    tipo: inicial.tipo || 'TPC', nombre: inicial.nombre || '',
    fechaEmision: inicial.fechaEmision ? inicial.fechaEmision.slice(0, 10) : hoyInput(),
    fechaCaducidad: inicial.fechaCaducidad ? inicial.fechaCaducidad.slice(0, 10) : '',
    archivoUrl: inicial.archivoUrl || '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div><label className="etiqueta">Tipo *</label><select className="campo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>{TIPOS_DOC.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}</select></div>
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

function FormEpi({ inicial, alGuardar }: { inicial?: any; alGuardar: (d: any) => void }) {
  const [d, setD] = useState(inicial
    ? { fecha: fechaInput(inicial.fecha), items: inicial.items, riesgosLeidos: inicial.riesgosLeidos, firmaUrl: inicial.firmaUrl || '', notas: inicial.notas || '' }
    : { fecha: hoyInput(), items: '', riesgosLeidos: false, firmaUrl: '', notas: '' });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div><label className="etiqueta">Fecha *</label><input type="date" required className="campo" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></div>
      <div><label className="etiqueta">EPIs entregados *</label><input required className="campo" placeholder="Casco, botas, guantes, arnés..." value={d.items} onChange={(e) => setD({ ...d, items: e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={d.riesgosLeidos} onChange={(e) => setD({ ...d, riesgosLeidos: e.target.checked })} />
        El trabajador confirma haber recibido la información de riesgos del puesto (PRL)
      </label>
      <div>
        <label className="etiqueta">Firma del trabajador</label>
        {d.firmaUrl && <img src={d.firmaUrl} alt="Firma actual" className="h-12 mb-1 border border-slate-100 rounded bg-white" />}
        <PadFirma alFirmar={(url) => setD({ ...d, firmaUrl: url })} />
        {d.firmaUrl && <p className="text-xs text-emerald-600 mt-1">✓ Firma guardada{inicial ? ' (vuelve a firmar arriba solo si quieres sustituirla)' : ''}</p>}
      </div>
      <div><label className="etiqueta">Notas</label><input className="campo" value={d.notas} onChange={(e) => setD({ ...d, notas: e.target.value })} /></div>
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}

function PadFirma({ alFirmar }: { alFirmar: (url: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [subiendo, setSubiendo] = useState(false);
  const [hayTrazo, setHayTrazo] = useState(false);

  const coords = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const punto = e.touches ? e.touches[0] : e;
    return { x: punto.clientX - rect.left, y: punto.clientY - rect.top };
  };

  const iniciar = (e: any) => {
    e.preventDefault();
    dibujando.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = coords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const mover = (e: any) => {
    if (!dibujando.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = coords(e, canvas);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();
    setHayTrazo(true);
  };
  const soltar = () => { dibujando.current = false; };
  const limpiar = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHayTrazo(false);
  };
  const guardar = () => {
    const canvas = canvasRef.current!;
    setSubiendo(true);
    canvas.toBlob(async (blob) => {
      if (!blob) { setSubiendo(false); return; }
      const archivo = new File([blob], `firma-${Date.now()}.png`, { type: 'image/png' });
      const { url } = await api.subir(archivo);
      setSubiendo(false);
      alFirmar(url);
    }, 'image/png');
  };

  return (
    <div>
      <canvas
        ref={canvasRef} width={300} height={120}
        className="border border-slate-300 rounded-lg w-full touch-none bg-white cursor-crosshair"
        onMouseDown={iniciar} onMouseMove={mover} onMouseUp={soltar} onMouseLeave={soltar}
        onTouchStart={iniciar} onTouchMove={mover} onTouchEnd={soltar}
      />
      <div className="flex justify-between mt-1">
        <button type="button" className="text-xs text-slate-400" onClick={limpiar}>Borrar</button>
        <button type="button" className="text-xs text-acento font-semibold" disabled={!hayTrazo || subiendo} onClick={guardar}>
          {subiendo ? 'Guardando…' : 'Confirmar firma'}
        </button>
      </div>
    </div>
  );
}

function FormLlamamiento({ alGuardar }: { alGuardar: (d: any) => void }) {
  const [d, setD] = useState({ fechaInicio: hoyInput(), motivo: '', notas: '' });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div><label className="etiqueta">Fecha de inicio *</label><input type="date" required className="campo" value={d.fechaInicio} onChange={(e) => setD({ ...d, fechaInicio: e.target.value })} /></div>
      <div><label className="etiqueta">Motivo</label><input className="campo" placeholder="Ej. Inicio obra Marcos" value={d.motivo} onChange={(e) => setD({ ...d, motivo: e.target.value })} /></div>
      <div><label className="etiqueta">Notas</label><input className="campo" value={d.notas} onChange={(e) => setD({ ...d, notas: e.target.value })} /></div>
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
