// Listado de presupuestos con su estado (enlazado al CRM) y margen.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { euros, fecha, porcentaje, etiqueta } from '../lib/formato';
import { Badge, CabeceraPagina, Cargando, COLORES_BADGE } from '../components/ui';

export function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState<any[] | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const navegar = useNavigate();

  const cargar = () => {
    api.get('/api/presupuestos').then(setPresupuestos);
    api.get('/api/clientes').then(setClientes);
  };
  useEffect(cargar, []);
  if (!presupuestos) return <Cargando />;

  const nuevo = async () => {
    if (clientes.length === 0) { alert('Crea primero un cliente.'); return; }
    const p = await api.post('/api/presupuestos', {
      clienteId: clientes[0].id, fecha: new Date().toISOString().slice(0, 10),
      tipo: 'ADMINISTRACION', estado: 'BORRADOR', lineas: [],
    });
    navegar(`/presupuestos/${p.id}`);
  };

  const eliminar = async (p: any) => {
    if (!confirm(`¿Eliminar el presupuesto ${p.numero}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.del(`/api/presupuestos/${p.id}`);
      cargar();
    } catch (e: any) {
      alert(e.message || 'No se pudo eliminar el presupuesto');
    }
  };

  return (
    <div>
      <CabeceraPagina titulo="Presupuestos y tarifas" subtitulo="Generador con margen en tiempo real y exportación a PDF">
        <button className="boton-primario" onClick={nuevo}>+ Nuevo presupuesto</button>
      </CabeceraPagina>

      <div className="tarjeta overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Número</th><th className="th">Cliente</th><th className="th">Fecha</th><th className="th">Tipo</th><th className="th">Total</th><th className="th">Margen</th><th className="th">Estado</th><th className="th"></th></tr></thead>
          <tbody>
            {presupuestos.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="td"><Link to={`/presupuestos/${p.id}`} className="font-semibold text-marino hover:text-acento">{p.numero}</Link></td>
                <td className="td">{p.cliente?.nombre}</td>
                <td className="td">{fecha(p.fecha)}</td>
                <td className="td">{etiqueta(p.tipo)}</td>
                <td className="td font-semibold">{euros(p.total)}</td>
                <td className="td"><span className={p.avisoMargenBajo ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>{euros(p.margen)} ({porcentaje(p.margenPorc)})</span></td>
                <td className="td"><Badge texto={etiqueta(p.estado)} color={COLORES_BADGE[p.estado]} /></td>
                <td className="td"><button className="text-xs font-semibold text-red-600 hover:underline" onClick={() => eliminar(p)}>✕ Eliminar</button></td>
              </tr>
            ))}
            {presupuestos.length === 0 && <tr><td className="td text-slate-400" colSpan={8}>No hay presupuestos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
