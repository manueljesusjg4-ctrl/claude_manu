// Ficha de obra: control económico (coste real vs facturado, margen, horas
// extra), equipo asignado, partes de horas y certificaciones.
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, ErrorApi } from '../lib/api';
import { euros, fecha, fechaInput, hoyInput, numero, porcentaje, etiqueta } from '../lib/formato';
import { Aviso, Badge, CabeceraPagina, Cargando, COLORES_BADGE, IndicadorMargen, Modal, TarjetaKpi } from '../components/ui';
import { FormularioObra } from './Obras';

export function ObraFicha() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [o, setO] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [trabajadores, setTrabajadores] = useState<any[]>([]);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalAsignar, setModalAsignar] = useState(false);
  const [asignarEditar, setAsignarEditar] = useState<any>(null);
  const [modalParte, setModalParte] = useState(false);
  const [parteEditar, setParteEditar] = useState<any>(null);
  const [aviso, setAviso] = useState('');

  const cargar = () => api.get(`/api/obras/${id}`).then(setO);
  useEffect(() => {
    cargar();
    api.get('/api/clientes').then(setClientes);
    api.get('/api/trabajadores').then(setTrabajadores);
  }, [id]);
  if (!o) return <Cargando />;
  const eco = o.economico;

  const guardarObra = async (d: any, confirmarCierre = false) => {
    try {
      await api.put(`/api/obras/${id}`, { ...d, confirmarCierre });
      setModalEditar(false); setAviso(''); cargar();
    } catch (e: any) {
      if (e instanceof ErrorApi && e.requiereConfirmacion) {
        if (confirm(e.message)) return guardarObra(d, true);
      } else setAviso(e.message);
    }
  };

  const asignar = async (d: any, forzar = false) => {
    try {
      await api.post(`/api/obras/${id}/asignaciones`, { ...d, confirmarSinDocumentacion: forzar });
      setModalAsignar(false); cargar();
    } catch (e: any) {
      if (e instanceof ErrorApi && e.requiereConfirmacion) {
        if (confirm(e.message)) return asignar(d, true);
      } else setAviso(e.message);
    }
  };

  const validarParte = async (p: any) => {
    if (p.validado) {
      if (!confirm('¿Quitar la validación de este parte?')) return;
      await api.patch(`/api/obras/partes/${p.id}/validar`, { validado: false });
    } else {
      const nota = prompt(`Confirmar que el encargado${o.encargado ? ' (' + o.encargado.nombre + ' ' + o.encargado.apellidos + ')' : ''} ha dado el visto bueno a estas horas. Nota (opcional):`, '') ?? '';
      await api.patch(`/api/obras/partes/${p.id}/validar`, { validado: true, nota });
    }
    cargar();
  };

  const descargarPdfPartes = () => {
    api.descargar(`/api/obras/${id}/partes/pdf`, `partes-${o.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  const anadirOrden = async (directriz: string) => {
    if (!directriz.trim()) return;
    await api.post(`/api/obras/${id}/ordenes`, { fecha: hoyInput(), encargadoId: o.encargadoId || null, directriz });
    cargar();
  };

  const eliminarOrden = async (oid: number) => {
    if (!confirm('¿Eliminar esta directriz registrada?')) return;
    await api.del(`/api/obras/ordenes/${oid}`);
    cargar();
  };

  return (
    <div>
      <CabeceraPagina titulo={o.nombre} subtitulo={`${o.cliente?.nombre} · ${etiqueta(o.tipo)} · ${etiqueta(o.estado)}${o.encargado ? ` · Encargado: ${o.encargado.nombre} ${o.encargado.apellidos}` : ''}`}>
        <Link to="/obras" className="boton-secundario">← Volver</Link>
        <button className="boton-secundario" onClick={() => setModalEditar(true)}>Editar</button>
        <button
          className="boton-peligro"
          onClick={async () => {
            if (!confirm(`¿Eliminar la obra "${o.nombre}"? Esta acción no se puede deshacer.`)) return;
            try {
              await api.del(`/api/obras/${id}`);
              navegar('/obras');
            } catch (e: any) {
              alert(e.message || 'No se pudo eliminar la obra');
            }
          }}
        >
          Eliminar
        </button>
      </CabeceraPagina>

      {aviso && <div className="mb-4"><Aviso tipo="rojo">{aviso}</Aviso></div>}
      {eco.alertaPresupuesto && <div className="mb-4"><Aviso tipo="rojo">⚠ {eco.alertaPresupuesto}</Aviso></div>}

      {/* KPIs económicos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <TarjetaKpi titulo="Coste real acumulado" valor={euros(eco.costeReal)} secundario={`${numero(eco.horasTotales)} h · ${euros(eco.costeManoObra)} mano de obra`} />
        <TarjetaKpi titulo="Facturado / certificado" valor={euros(eco.facturado)} secundario={`Trabajado: ${euros(eco.facturable)}`} tono="acento" />
        <TarjetaKpi titulo="Pendiente de certificar" valor={euros(eco.pendienteCertificar)} tono={eco.pendienteCertificar > 0 ? 'malo' : 'bueno'} />
        <TarjetaKpi titulo="Horas extra detectadas" valor={`${numero(eco.horasExtra)} h`} secundario=">40 h/semana, con recargo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5 lg:col-span-2">
          {/* Margen */}
          <div className="tarjeta p-5">
            <h3 className="font-bold text-marino mb-3">Rentabilidad</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Margen real (sobre lo certificado)</p>
                <IndicadorMargen margen={eco.margenReal} margenPorc={eco.margenRealPorc} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Margen proyectado (todo lo trabajado)</p>
                <IndicadorMargen margen={eco.margenProyectado} margenPorc={eco.margenProyectadoPorc} />
              </div>
            </div>
            {eco.margenPrevisto != null && (
              <p className="text-sm text-slate-600 mt-3">
                Margen previsto: <b>{porcentaje(eco.margenPrevisto)}</b> · Real: <b>{porcentaje(eco.margenRealPorc)}</b>{' '}
                {eco.margenRealPorc < eco.margenPrevisto ? <span className="text-red-600 font-semibold">(por debajo)</span> : <span className="text-emerald-600 font-semibold">(en línea)</span>}
              </p>
            )}
          </div>

          {/* Detalle por trabajador */}
          <div className="tarjeta overflow-x-auto">
            <div className="px-4 pt-4"><h3 className="font-bold text-marino">Coste y facturable por trabajador</h3></div>
            <table className="w-full">
              <thead><tr><th className="th">Trabajador</th><th className="th">Categoría</th><th className="th">H. normales</th><th className="th">H. extra</th><th className="th">Coste/h</th><th className="th">Venta/h</th><th className="th">Coste</th><th className="th">Facturable</th></tr></thead>
              <tbody>
                {eco.detalle.map((d: any) => (
                  <tr key={d.trabajadorId}>
                    <td className="td font-medium">{d.nombre}</td>
                    <td className="td">{etiqueta(d.categoria)}</td>
                    <td className="td">{numero(d.horasNormales)}</td>
                    <td className="td font-semibold text-acento">{d.horasExtra > 0 ? numero(d.horasExtra) : '—'}</td>
                    <td className="td">{euros(d.costeHora)}</td>
                    <td className="td">{euros(d.precioVentaHora)}</td>
                    <td className="td">{euros(d.coste)}</td>
                    <td className="td font-semibold">{euros(d.facturable)}</td>
                  </tr>
                ))}
                {eco.detalle.length === 0 && <tr><td className="td text-slate-400" colSpan={8}>Sin partes de horas registrados.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Partes de horas */}
          <div className="tarjeta p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-marino">Partes de horas</h3>
              <div className="flex gap-2">
                <button className="boton-secundario text-xs" onClick={descargarPdfPartes}>⬇ PDF</button>
                <button className="boton-secundario text-xs" onClick={() => setModalParte(true)}>+ Añadir parte</button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-2">Validar un parte deja constancia de que el encargado ha dado el visto bueno a esas horas (trazabilidad ante inspección).</p>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead><tr><th className="th">Fecha</th><th className="th">Trabajador</th><th className="th">Horas</th><th className="th">Validado</th><th className="th"></th></tr></thead>
                <tbody>
                  {o.partes.map((p: any) => (
                    <tr key={p.id}>
                      <td className="td">{fecha(p.fecha)}</td>
                      <td className="td">{p.trabajador.nombre} {p.trabajador.apellidos}</td>
                      <td className="td">{numero(p.horas)} h</td>
                      <td className="td">
                        <button
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.validado ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                          title={p.validado ? `Validado el ${fecha(p.validadoEn)}${p.validadoNota ? ': ' + p.validadoNota : ''}` : 'Sin validar'}
                          onClick={() => validarParte(p)}
                        >
                          {p.validado ? '✓ Validado' : 'Validar'}
                        </button>
                      </td>
                      <td className="td">
                        <div className="flex gap-2">
                          <button className="text-xs text-slate-400 hover:text-marino" title="Editar parte" onClick={() => setParteEditar(p)}>✎</button>
                          <button className="text-xs text-slate-300 hover:text-red-500" title="Eliminar parte" onClick={async () => { if (confirm('¿Eliminar este parte de horas?')) { await api.del(`/api/obras/partes/${p.id}`); cargar(); } }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Registro de órdenes/directrices (antisanciones) */}
          <div className="tarjeta p-5">
            <h3 className="font-bold text-marino mb-1">Registro de órdenes a la cuadrilla</h3>
            <p className="text-xs text-slate-400 mb-3">Prueba documental de que el encargado de la empresa dirige el trabajo (protección frente a cesión ilegal).</p>
            <FormOrden alGuardar={anadirOrden} />
            <div className="max-h-48 overflow-y-auto mt-3 space-y-2">
              {o.ordenes.map((or: any) => (
                <div key={or.id} className="flex items-start justify-between gap-2 text-sm border border-slate-200 rounded-lg p-2.5">
                  <div>
                    <p>{or.directriz}</p>
                    <p className="text-xs text-slate-400">{fecha(or.fecha)}{or.encargado ? ` · ${or.encargado.nombre} ${or.encargado.apellidos}` : ''}</p>
                  </div>
                  <button className="text-xs text-slate-300 hover:text-red-500 shrink-0" onClick={() => eliminarOrden(or.id)}>✕</button>
                </div>
              ))}
              {o.ordenes.length === 0 && <p className="text-sm text-slate-400">Sin directrices registradas todavía.</p>}
            </div>
          </div>
        </div>

        {/* Equipo + certificaciones */}
        <div className="space-y-5">
          <div className="tarjeta p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-marino">Equipo asignado</h3>
              <button className="boton-secundario text-xs" onClick={() => setModalAsignar(true)}>+ Asignar</button>
            </div>
            <div className="space-y-2">
              {o.asignaciones.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-sm border border-slate-200 rounded-lg p-2.5">
                  <div>
                    <p className="font-medium">{a.trabajador.nombre} {a.trabajador.apellidos}</p>
                    <p className="text-xs text-slate-500">{etiqueta(a.trabajador.categoria)} · {euros(a.precioVentaHora)}/h · desde {fecha(a.fechaInicio)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="text-xs text-slate-400 hover:text-marino" title="Editar asignación" onClick={() => setAsignarEditar(a)}>✎</button>
                    <button className="text-xs text-slate-300 hover:text-red-500" title="Quitar asignación" onClick={async () => { if (confirm('¿Quitar a este trabajador de la obra?')) { await api.del(`/api/obras/asignaciones/${a.id}`); cargar(); } }}>✕</button>
                  </div>
                </div>
              ))}
              {o.asignaciones.length === 0 && <p className="text-sm text-slate-400">Nadie asignado todavía.</p>}
            </div>
          </div>

          <div className="tarjeta p-5">
            <h3 className="font-bold text-marino mb-3">Certificaciones</h3>
            {o.facturas.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-slate-100">
                <div>
                  <span className="font-semibold">{f.numero}</span> — {euros(f.baseImponible)}{' '}
                  <Badge texto={etiqueta(f.estado)} color={COLORES_BADGE[f.estado]} />
                  <p className="text-xs text-slate-400">{fecha(f.fechaEmision)} · cobro {fecha(f.fechaCobroEsperada)}</p>
                </div>
                <button
                  className="text-xs text-slate-300 hover:text-red-500 shrink-0"
                  title="Eliminar factura"
                  onClick={async () => {
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
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {o.facturas.length === 0 && <p className="text-sm text-slate-400">Sin certificar. <Link to="/tesoreria" className="text-acento">Crear factura →</Link></p>}
          </div>
        </div>
      </div>

      <Modal titulo="Editar obra" abierto={modalEditar} alCerrar={() => setModalEditar(false)}>
        <FormularioObra inicial={{ ...o, fechaInicio: fechaInput(o.fechaInicio), fechaFinPrevista: fechaInput(o.fechaFinPrevista) }} clientes={clientes} trabajadores={trabajadores} alGuardar={(d) => guardarObra(d)} />
      </Modal>

      <Modal titulo="Asignar trabajador" abierto={modalAsignar} alCerrar={() => setModalAsignar(false)} ancho="max-w-md">
        <FormAsignar trabajadores={trabajadores} alGuardar={asignar} />
      </Modal>

      <Modal titulo="Editar asignación" abierto={!!asignarEditar} alCerrar={() => setAsignarEditar(null)} ancho="max-w-md">
        {asignarEditar && (
          <FormAsignar
            trabajadores={trabajadores}
            inicial={asignarEditar}
            alGuardar={async (d) => { await api.put(`/api/obras/asignaciones/${asignarEditar.id}`, d); setAsignarEditar(null); cargar(); }}
          />
        )}
      </Modal>

      <Modal titulo="Añadir parte de horas" abierto={modalParte} alCerrar={() => setModalParte(false)} ancho="max-w-md">
        <FormParte asignaciones={o.asignaciones} alGuardar={async (d) => { await api.post(`/api/obras/${id}/partes`, d); setModalParte(false); cargar(); }} />
      </Modal>

      <Modal titulo="Editar parte de horas" abierto={!!parteEditar} alCerrar={() => setParteEditar(null)} ancho="max-w-md">
        {parteEditar && (
          <FormParte
            asignaciones={o.asignaciones}
            inicial={parteEditar}
            alGuardar={async (d) => { await api.put(`/api/obras/partes/${parteEditar.id}`, d); setParteEditar(null); cargar(); }}
          />
        )}
      </Modal>
    </div>
  );
}

function FormOrden({ alGuardar }: { alGuardar: (directriz: string) => void }) {
  const [texto, setTexto] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e: FormEvent) => { e.preventDefault(); if (!texto.trim()) return; alGuardar(texto); setTexto(''); }}
    >
      <input className="campo" placeholder="Ej. Hoy: hormigonar zapatas zona norte" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <button className="boton-secundario text-xs whitespace-nowrap">+ Añadir</button>
    </form>
  );
}

function FormAsignar({ trabajadores, inicial, alGuardar }: { trabajadores: any[]; inicial?: any; alGuardar: (d: any) => void }) {
  const edicion = !!inicial;
  const [d, setD] = useState(inicial
    ? { trabajadorId: String(inicial.trabajadorId), fechaInicio: fechaInput(inicial.fechaInicio), fechaFin: inicial.fechaFin ? fechaInput(inicial.fechaFin) : '', precioVentaHora: String(inicial.precioVentaHora) }
    : { trabajadorId: '', fechaInicio: hoyInput(), fechaFin: '', precioVentaHora: '' });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar({ ...d, fechaFin: d.fechaFin || null }); }} className="space-y-3">
      <div>
        <label className="etiqueta">Trabajador *</label>
        <select required disabled={edicion} className="campo disabled:bg-slate-100 disabled:text-slate-500" value={d.trabajadorId} onChange={(e) => setD({ ...d, trabajadorId: e.target.value })}>
          <option value="">— Elegir —</option>
          {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre} {t.apellidos} ({etiqueta(t.categoria)})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="etiqueta">Desde *</label><input type="date" required className="campo" value={d.fechaInicio} onChange={(e) => setD({ ...d, fechaInicio: e.target.value })} /></div>
        <div><label className="etiqueta">Hasta</label><input type="date" className="campo" value={d.fechaFin} onChange={(e) => setD({ ...d, fechaFin: e.target.value })} /></div>
      </div>
      <div><label className="etiqueta">Precio de venta por hora (€) *</label><input type="number" step="0.01" required className="campo" value={d.precioVentaHora} onChange={(e) => setD({ ...d, precioVentaHora: e.target.value })} /></div>
      <div className="flex justify-end"><button className="boton-primario">{edicion ? 'Guardar cambios' : 'Asignar'}</button></div>
    </form>
  );
}

function FormParte({ asignaciones, inicial, alGuardar }: { asignaciones: any[]; inicial?: any; alGuardar: (d: any) => void }) {
  const edicion = !!inicial;
  const [d, setD] = useState(inicial
    ? { trabajadorId: String(inicial.trabajadorId), fecha: fechaInput(inicial.fecha), horas: inicial.horas, notas: inicial.notas || '' }
    : { trabajadorId: '', fecha: hoyInput(), horas: 8, notas: '' });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(d); }} className="space-y-3">
      <div>
        <label className="etiqueta">Trabajador *</label>
        <select required className="campo" value={d.trabajadorId} onChange={(e) => setD({ ...d, trabajadorId: e.target.value })}>
          <option value="">— Elegir —</option>
          {asignaciones.map((a) => <option key={a.id} value={a.trabajadorId}>{a.trabajador.nombre} {a.trabajador.apellidos}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="etiqueta">Fecha *</label><input type="date" required className="campo" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></div>
        <div><label className="etiqueta">Horas *</label><input type="number" step="0.5" required className="campo" value={d.horas} onChange={(e) => setD({ ...d, horas: Number(e.target.value) })} /></div>
      </div>
      <div><label className="etiqueta">Notas</label><input className="campo" value={d.notas} onChange={(e) => setD({ ...d, notas: e.target.value })} /></div>
      <div className="flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
