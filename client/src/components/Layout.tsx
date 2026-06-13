// Estructura general: sidebar de navegación a la izquierda, contenido a la derecha.
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const SECCIONES = [
  { ruta: '/', icono: '📊', texto: 'Dashboard' },
  { ruta: '/tesoreria', icono: '💶', texto: 'Caja y tesorería' },
  { ruta: '/crm', icono: '🤝', texto: 'CRM / Clientes' },
  { ruta: '/obras', icono: '🏗️', texto: 'Obras' },
  { ruta: '/trabajadores', icono: '👷', texto: 'Trabajadores' },
  { ruta: '/presupuestos', icono: '📝', texto: 'Presupuestos' },
  { ruta: '/simulador', icono: '🧮', texto: 'Simulador' },
  { ruta: '/documentacion', icono: '📁', texto: 'Documentación' },
  { ruta: '/gastos', icono: '🧾', texto: 'Gastos y proveedores' },
  { ruta: '/informes', icono: '📈', texto: 'Informes' },
  { ruta: '/configuracion', icono: '⚙️', texto: 'Configuración' },
];

export function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const navegacion = (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {SECCIONES.map((s) => (
        <NavLink
          key={s.ruta}
          to={s.ruta}
          end={s.ruta === '/'}
          onClick={() => setMenuAbierto(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-acento text-white' : 'text-slate-300 hover:bg-marino-claro hover:text-white'
            }`
          }
        >
          <span className="text-base">{s.icono}</span>
          {s.texto}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar escritorio */}
      <aside className="no-imprimir hidden lg:flex w-60 bg-marino flex-col fixed inset-y-0">
        <div className="px-5 py-5 border-b border-marino-claro">
          <p className="text-white font-extrabold text-lg leading-tight">Gestión<span className="text-acento">Obra</span></p>
          <p className="text-slate-400 text-xs mt-0.5">Construcción · Valencia</p>
        </div>
        {navegacion}
        <div className="px-5 py-4 border-t border-marino-claro">
          <p className="text-slate-300 text-sm font-medium">{usuario?.nombre}</p>
          <button onClick={cerrarSesion} className="text-xs text-slate-400 hover:text-white mt-1">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Barra superior móvil */}
      <div className="no-imprimir lg:hidden fixed top-0 inset-x-0 z-40 bg-marino text-white flex items-center justify-between px-4 py-3">
        <p className="font-extrabold">Gestión<span className="text-acento">Obra</span></p>
        <button onClick={() => setMenuAbierto(!menuAbierto)} className="text-2xl leading-none">☰</button>
      </div>
      {menuAbierto && (
        <div className="no-imprimir lg:hidden fixed inset-0 z-30 bg-marino pt-14 flex flex-col">
          {navegacion}
          <div className="px-5 py-4 border-t border-marino-claro">
            <button onClick={cerrarSesion} className="text-sm text-slate-300">Cerrar sesión ({usuario?.nombre})</button>
          </div>
        </div>
      )}

      {/* Contenido */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0">
        <div className="p-4 lg:p-6 max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
