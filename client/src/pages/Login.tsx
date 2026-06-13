// Pantalla de inicio de sesión.
import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { iniciarSesion } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await iniciarSesion(usuario, password);
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-marino flex items-center justify-center p-4">
      <div className="tarjeta w-full max-w-sm p-8">
        <p className="text-2xl font-extrabold text-marino text-center">
          Gestión<span className="text-acento">Obra</span>
        </p>
        <p className="text-sm text-slate-500 text-center mt-1 mb-6">
          Gestión integral · Construcción Valencia
        </p>
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="etiqueta">Usuario</label>
            <input className="campo" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="etiqueta">Contraseña</label>
            <input className="campo" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <button className="boton-primario w-full justify-center" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="text-xs text-slate-400 text-center mt-5">
          Datos de ejemplo: <b>socio1</b> / <b>valencia2026</b>
        </p>
      </div>
    </div>
  );
}
