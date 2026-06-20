// Enrutado principal de la aplicación.
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { avisar } from './lib/api';
import { Layout } from './components/Layout';
import { Cargando, Notificaciones } from './components/ui';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Tesoreria } from './pages/Tesoreria';
import { Crm } from './pages/Crm';
import { ClienteFicha } from './pages/ClienteFicha';
import { Obras } from './pages/Obras';
import { ObraFicha } from './pages/ObraFicha';
import { Trabajadores } from './pages/Trabajadores';
import { TrabajadorFicha } from './pages/TrabajadorFicha';
import { Presupuestos } from './pages/Presupuestos';
import { PresupuestoEditor } from './pages/PresupuestoEditor';
import { Simulador } from './pages/Simulador';
import { Documentacion } from './pages/Documentacion';
import { Gastos } from './pages/Gastos';
import { Informes } from './pages/Informes';
import { Configuracion } from './pages/Configuracion';

export default function App() {
  const { usuario, cargando } = useAuth();

  // Si una llamada al servidor falla sin que la pantalla lo gestione, en vez
  // de quedarse colgada en silencio mostramos un aviso claro al usuario.
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      const mensaje = e?.reason?.message;
      if (mensaje && mensaje !== 'Sesión caducada') {
        avisar('No se pudo completar la operación: ' + mensaje);
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  return (
    <>
      <Notificaciones />
      {cargando ? (
        <Cargando />
      ) : !usuario ? (
        <Login />
      ) : (
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tesoreria" element={<Tesoreria />} />
            <Route path="/crm" element={<Crm />} />
            <Route path="/crm/:id" element={<ClienteFicha />} />
            <Route path="/obras" element={<Obras />} />
            <Route path="/obras/:id" element={<ObraFicha />} />
            <Route path="/trabajadores" element={<Trabajadores />} />
            <Route path="/trabajadores/:id" element={<TrabajadorFicha />} />
            <Route path="/presupuestos" element={<Presupuestos />} />
            <Route path="/presupuestos/:id" element={<PresupuestoEditor />} />
            <Route path="/simulador" element={<Simulador />} />
            <Route path="/documentacion" element={<Documentacion />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/informes" element={<Informes />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </>
  );
}
