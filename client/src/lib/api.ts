// Cliente HTTP: añade el token JWT y gestiona errores en español.

let alCaducarSesion: () => void = () => {};
export function registrarCierreSesion(fn: () => void) {
  alCaducarSesion = fn;
}

export class ErrorApi extends Error {
  requiereConfirmacion: boolean;
  constructor(mensaje: string, requiereConfirmacion = false) {
    super(mensaje);
    this.requiereConfirmacion = requiereConfirmacion;
  }
}

async function peticion<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(ruta, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });
  if (res.status === 401 && !ruta.includes('/auth/login')) {
    alCaducarSesion();
    throw new ErrorApi('Sesión caducada');
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ErrorApi(datos.error || `Error ${res.status}`, Boolean(datos.requiereConfirmacion));
  }
  return datos as T;
}

export const api = {
  get: <T = any>(ruta: string) => peticion<T>(ruta),
  post: <T = any>(ruta: string, cuerpo?: unknown) =>
    peticion<T>(ruta, { method: 'POST', body: JSON.stringify(cuerpo ?? {}) }),
  put: <T = any>(ruta: string, cuerpo?: unknown) =>
    peticion<T>(ruta, { method: 'PUT', body: JSON.stringify(cuerpo ?? {}) }),
  patch: <T = any>(ruta: string, cuerpo?: unknown) =>
    peticion<T>(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo ?? {}) }),
  del: <T = any>(ruta: string) => peticion<T>(ruta, { method: 'DELETE' }),
  /** Sube un archivo (PDF/imagen) y devuelve la URL donde quedó guardado. */
  subir: async (archivo: File): Promise<{ url: string; nombre: string }> => {
    const token = localStorage.getItem('token');
    const datos = new FormData();
    datos.append('archivo', archivo);
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: datos,
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      alCaducarSesion();
      throw new ErrorApi('Sesión caducada');
    }
    if (!res.ok) throw new ErrorApi(json.error || `Error ${res.status}`);
    return json;
  },
  /** Descarga un archivo binario (PDF...) de una ruta protegida y lo guarda. */
  descargar: async (ruta: string, nombreSugerido: string): Promise<void> => {
    const token = localStorage.getItem('token');
    const res = await fetch(ruta, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.status === 401) {
      alCaducarSesion();
      throw new ErrorApi('Sesión caducada');
    }
    if (!res.ok) throw new ErrorApi(`Error ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreSugerido;
    a.click();
    URL.revokeObjectURL(url);
  },
};
