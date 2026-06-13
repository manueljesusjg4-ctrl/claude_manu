// Contexto de autenticación: sesión de los socios con JWT en localStorage.
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, registrarCierreSesion } from '../lib/api';

interface Usuario {
  id: number;
  usuario: string;
  nombre: string;
}

interface ContextoAuth {
  usuario: Usuario | null;
  cargando: boolean;
  iniciarSesion: (usuario: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
}

const Contexto = createContext<ContextoAuth>(null!);

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    setUsuario(null);
  };

  useEffect(() => {
    registrarCierreSesion(cerrarSesion);
    const token = localStorage.getItem('token');
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .get<{ usuario: Usuario }>('/api/auth/yo')
      .then((r) => setUsuario(r.usuario))
      .catch(() => cerrarSesion())
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = async (u: string, password: string) => {
    const r = await api.post<{ token: string; usuario: Usuario }>('/api/auth/login', {
      usuario: u,
      password,
    });
    localStorage.setItem('token', r.token);
    setUsuario(r.usuario);
  };

  return (
    <Contexto.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </Contexto.Provider>
  );
}

export const useAuth = () => useContext(Contexto);
