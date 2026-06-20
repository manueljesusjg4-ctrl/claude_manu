// CONFIGURACIÓN: parámetros de coste (editables sin tocar código), tarifario,
// simulador de coste/hora y copia de seguridad (exportar/importar).
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { euros, etiqueta } from '../lib/formato';
import { Aviso, CabeceraPagina, Cargando, Desglose, TarjetaKpi } from '../components/ui';

export function Configuracion() {
  const [config, setConfig] = useState<any>(null);
  const [tarifas, setTarifas] = useState<any[]>([]);
  const [guardado, setGuardado] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = () => {
    api.get('/api/configuracion').then(setConfig);
    api.get('/api/configuracion/tarifas').then(setTarifas);
  };
  useEffect(cargar, []);
  if (!config) return <Cargando />;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    await api.put('/api/configuracion', config);
    setGuardado('Parámetros guardados ✓');
    setTimeout(() => setGuardado(''), 2500);
  };
  const guardarTarifa = async (t: any) => { await api.put(`/api/configuracion/tarifas/${t.id}`, { precioHoraVenta: t.precioHoraVenta }); };

  // Simulador de coste/hora con los parámetros actuales
  const base = 1976;
  const conExtras = base * (1 + config.porcentajePagasExtra / 100);
  const adicionales = config.costeEpisAnual + config.costeReconocimientoAnual;
  const anual = conExtras * 12 + adicionales;
  const horaMensual = conExtras / config.horasMes + adicionales / config.horasAnio;
  const horaAnualizado = anual / config.horasAnio;

  const exportar = async () => {
    const datos = await api.get('/api/backup/exportar');
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `backup-gestion-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Esto SUSTITUIRÁ todos los datos actuales por los del archivo. ¿Continuar?')) return;
    const texto = await file.text();
    const datos = JSON.parse(texto);
    await api.post('/api/backup/importar', datos);
    alert('Copia restaurada. La página se recargará.');
    location.reload();
  };

  const campo = (k: string, label: string, sufijo?: string) => (
    <div>
      <label className="etiqueta">{label}</label>
      <div className="relative">
        <input type="number" step="0.01" className="campo" value={config[k]} onChange={(e) => setConfig({ ...config, [k]: Number(e.target.value) })} />
        {sufijo && <span className="absolute right-3 top-2.5 text-xs text-slate-400">{sufijo}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <CabeceraPagina titulo="Configuración" subtitulo="Todos los supuestos del cálculo, editables sin tocar código" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Parámetros de coste */}
        <form onSubmit={guardar} className="tarjeta p-5">
          <h3 className="font-bold text-marino mb-3">Parámetros de coste</h3>
          <div className="grid grid-cols-2 gap-3">
            {campo('porcentajePagasExtra', 'Pagas extra prorrateadas', '%')}
            {campo('porcentajeSeguridadSocial', 'Seg. Social empresa', '%')}
            {campo('horasMes', 'Horas presencia/mes', 'h')}
            {campo('horasAnio', 'Horas efectivas/año', 'h')}
            {campo('costeEpisAnual', 'EPIs por trabajador/año', '€')}
            {campo('costeReconocimientoAnual', 'Reconocimiento médico/año', '€')}
            {campo('recargoHoraExtra', 'Recargo horas extra', '%')}
            {campo('umbralMargenAviso', 'Aviso de margen bajo si <', '%')}
            {campo('umbralSobrecosteHora', 'Aviso de sobrecoste laboral si supera en', '€/h')}
            {campo('plazoCobroDefecto', 'Plazo cobro por defecto', 'días')}
            {campo('porcentajeIva', 'IVA por defecto', '%')}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button className="boton-primario">Guardar parámetros</button>
            {guardado && <span className="text-sm text-emerald-600 font-semibold">{guardado}</span>}
          </div>
        </form>

        {/* Simulador de coste/hora */}
        <div className="space-y-5">
          <div className="tarjeta p-5">
            <h3 className="font-bold text-marino mb-3">Vista previa del cálculo (peón a {euros(base)}/mes)</h3>
            <div className="grid grid-cols-2 gap-3">
              <TarjetaKpi titulo="Coste/h mensual" valor={euros(horaMensual)} secundario="Caja" />
              <TarjetaKpi titulo="Coste/h anualizado" valor={euros(horaAnualizado)} secundario="Real para precios" tono="acento" />
            </div>
            <Desglose
              titulo="Ver desglose con los parámetros actuales"
              lineas={[
                { concepto: 'Coste base mensual', formula: 'ejemplo peón', valor: base, unidad: '€/mes' },
                { concepto: `Con extras (${config.porcentajePagasExtra}%)`, formula: `${base} × ${1 + config.porcentajePagasExtra / 100}`, valor: Math.round(conExtras * 100) / 100, unidad: '€/mes' },
                { concepto: 'Adicionales (EPIs + médico)', formula: `${config.costeEpisAnual} + ${config.costeReconocimientoAnual}`, valor: adicionales, unidad: '€/año' },
                { concepto: 'Coste anual total', formula: `${Math.round(conExtras)} × 12 + ${adicionales}`, valor: Math.round(anual * 100) / 100, unidad: '€/año' },
                { concepto: 'Coste/h anualizado', formula: `${Math.round(anual)} ÷ ${config.horasAnio}`, valor: Math.round(horaAnualizado * 100) / 100, unidad: '€/h' },
              ]}
            />
          </div>

          {/* Tarifario */}
          <div className="tarjeta p-5">
            <h3 className="font-bold text-marino mb-3">Tarifario de venta por categoría</h3>
            <div className="space-y-2">
              {tarifas.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700 w-32">{etiqueta(t.categoria)}</span>
                  <input type="number" step="0.5" className="campo w-32" value={t.precioHoraVenta}
                    onChange={(e) => { const nuevas = [...tarifas]; nuevas[i] = { ...t, precioHoraVenta: Number(e.target.value) }; setTarifas(nuevas); }}
                    onBlur={() => guardarTarifa(tarifas[i])} />
                  <span className="text-xs text-slate-400">€/h</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Se guarda automáticamente al salir de cada campo.</p>
          </div>
        </div>
      </div>

      {/* Copia de seguridad */}
      <div className="tarjeta p-5 mt-5">
        <h3 className="font-bold text-marino mb-2">Copia de seguridad</h3>
        <Aviso tipo="azul">Exporta toda la base de datos a un archivo para guardarla. Importar SUSTITUYE todos los datos actuales.</Aviso>
        <div className="flex gap-3 mt-3">
          <button className="boton-secundario" onClick={exportar}>⬇ Exportar copia (JSON)</button>
          <button className="boton-secundario" onClick={() => fileRef.current?.click()}>⬆ Importar copia</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importar} />
        </div>
      </div>

      <CambiarPassword />
    </div>
  );
}

/** Formulario para que el usuario conectado cambie su propia contraseña. */
function CambiarPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    if (nueva !== repetir) {
      setMensaje({ texto: 'La nueva contraseña y su repetición no coinciden.', ok: false });
      return;
    }
    if (nueva.length < 6) {
      setMensaje({ texto: 'La nueva contraseña debe tener al menos 6 caracteres.', ok: false });
      return;
    }
    setEnviando(true);
    try {
      await api.put('/api/auth/password', { actual, nueva });
      setMensaje({ texto: 'Contraseña cambiada correctamente ✓', ok: true });
      setActual(''); setNueva(''); setRepetir('');
    } catch (err: any) {
      setMensaje({ texto: err.message || 'No se pudo cambiar la contraseña', ok: false });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="tarjeta p-5 mt-5 max-w-md">
      <h3 className="font-bold text-marino mb-1">Cambiar mi contraseña</h3>
      <p className="text-sm text-slate-500 mb-3">Cambia la contraseña con la que entras en la aplicación. Cada socio debe hacerlo desde su propia sesión.</p>
      <form onSubmit={guardar} className="space-y-3">
        <div>
          <label className="etiqueta">Contraseña actual</label>
          <input type="password" className="campo" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <label className="etiqueta">Nueva contraseña</label>
          <input type="password" className="campo" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className="etiqueta">Repite la nueva contraseña</label>
          <input type="password" className="campo" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
        </div>
        {mensaje && <p className={`text-sm font-semibold ${mensaje.ok ? 'text-emerald-600' : 'text-red-600'}`}>{mensaje.texto}</p>}
        <button className="boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </form>
    </div>
  );
}
