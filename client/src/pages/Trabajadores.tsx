// Listado de trabajadores con coste/hora calculado y estado de documentación.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { euros, fecha, hoyInput, etiqueta, CATEGORIAS } from '../lib/formato';
import { Badge, CabeceraPagina, Cargando, COLORES_BADGE, Modal } from '../components/ui';

const CONTRATOS = ['INDEFINIDO', 'FIJO_OBRA', 'TEMPORAL', 'FIJO_DISCONTINUO'];

export function Trabajadores() {
  const [trabajadores, setTrabajadores] = useState<any[] | null>(null);
  const [modal, setModal] = useState(false);

  const cargar = () => api.get('/api/trabajadores').then(setTrabajadores);
  useEffect(() => { cargar(); }, []);
  if (!trabajadores) return <Cargando />;

  return (
    <div>
      <CabeceraPagina titulo="Trabajadores y personal" subtitulo="Coste/hora real y control de documentación obligatoria">
        <button className="boton-primario" onClick={() => setModal(true)}>+ Nuevo trabajador</button>
      </CabeceraPagina>

      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Nombre</th><th className="th">Categoría</th><th className="th">Coste empresa/mes</th>
            <th className="th">Coste/h mensual</th><th className="th">Coste/h anualizado</th><th className="th">Con estructura</th>
            <th className="th">Estado</th><th className="th">Documentación</th>
          </tr></thead>
          <tbody>
            {trabajadores.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="td"><Link to={`/trabajadores/${t.id}`} className="font-semibold text-marino hover:text-acento">{t.nombre} {t.apellidos}</Link><p className="text-xs text-slate-400">{t.dni}{t.especialidad ? ` · ${t.especialidad}` : ''}</p></td>
                <td className="td">{etiqueta(t.categoria)}</td>
                <td className="td">{euros(t.costeEmpresaMensual)}</td>
                <td className="td">{euros(t.coste.costeHoraMensual)}</td>
                <td className="td font-semibold text-marino">{euros(t.coste.costeHoraAnualizado)}</td>
                <td className="td text-acento">{euros(t.costeHoraCargadoAnualizado)}</td>
                <td className="td">
                  <Badge texto={etiqueta(t.estado)} color={COLORES_BADGE[t.estado]} />
                  {t.obraActual && <p className="text-xs text-slate-400 mt-0.5">en {t.obraActual.nombre}</p>}
                </td>
                <td className="td">
                  {t.docsCaducados > 0 && <Badge texto={`${t.docsCaducados} caducado(s)`} color="bg-red-100 text-red-700" />}
                  {t.docsPorCaducar > 0 && <Badge texto={`${t.docsPorCaducar} por caducar`} color="bg-amber-100 text-amber-700" />}
                  {t.docsCaducados === 0 && t.docsPorCaducar === 0 && <Badge texto="Al día" color="bg-emerald-100 text-emerald-700" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        <b>Coste/h mensual</b>: desembolso de caja (coste con extras ÷ horas de presencia). <b>Coste/h anualizado</b>: coste real para fijar precios (reparte el mes de vacaciones). <b>Con estructura</b>: añade el overhead repartido.
      </p>

      <Modal titulo="Nuevo trabajador" abierto={modal} alCerrar={() => setModal(false)}>
        <FormularioTrabajador alGuardar={async (d) => { await api.post('/api/trabajadores', d); setModal(false); cargar(); }} />
      </Modal>
    </div>
  );
}

export function FormularioTrabajador({ inicial, alGuardar }: { inicial?: any; alGuardar: (d: any) => void }) {
  const [t, setT] = useState<any>(inicial || {
    nombre: '', apellidos: '', dni: '', categoria: 'PEON', especialidad: '', telefono: '',
    fechaAlta: hoyInput(), tipoContrato: 'INDEFINIDO', costeEmpresaMensual: 1976, estado: 'ACTIVO', notas: '',
  });
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(t); }} className="grid grid-cols-2 gap-3">
      <div><label className="etiqueta">Nombre *</label><input required className="campo" value={t.nombre} onChange={(e) => setT({ ...t, nombre: e.target.value })} /></div>
      <div><label className="etiqueta">Apellidos *</label><input required className="campo" value={t.apellidos} onChange={(e) => setT({ ...t, apellidos: e.target.value })} /></div>
      <div><label className="etiqueta">DNI/NIE *</label><input required className="campo" value={t.dni} onChange={(e) => setT({ ...t, dni: e.target.value })} /></div>
      <div><label className="etiqueta">Teléfono</label><input className="campo" value={t.telefono || ''} onChange={(e) => setT({ ...t, telefono: e.target.value })} /></div>
      <div><label className="etiqueta">Categoría *</label><select className="campo" value={t.categoria} onChange={(e) => setT({ ...t, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}</select></div>
      <div><label className="etiqueta">Especialidad</label><input className="campo" value={t.especialidad || ''} onChange={(e) => setT({ ...t, especialidad: e.target.value })} placeholder="Encofrador, ferrallista…" /></div>
      <div><label className="etiqueta">Fecha de alta *</label><input type="date" required className="campo" value={t.fechaAlta} onChange={(e) => setT({ ...t, fechaAlta: e.target.value })} /></div>
      <div><label className="etiqueta">Tipo de contrato</label><select className="campo" value={t.tipoContrato} onChange={(e) => setT({ ...t, tipoContrato: e.target.value })}>{CONTRATOS.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}</select></div>
      <div><label className="etiqueta">Coste empresa €/mes *</label><input type="number" required className="campo" value={t.costeEmpresaMensual} onChange={(e) => setT({ ...t, costeEmpresaMensual: Number(e.target.value) })} /></div>
      <div><label className="etiqueta">Estado</label><select className="campo" value={t.estado} onChange={(e) => setT({ ...t, estado: e.target.value })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></div>
      <div className="col-span-2"><label className="etiqueta">Notas</label><textarea className="campo" rows={2} value={t.notas || ''} onChange={(e) => setT({ ...t, notas: e.target.value })} /></div>
      <div className="col-span-2 flex justify-end"><button className="boton-primario">Guardar</button></div>
    </form>
  );
}
