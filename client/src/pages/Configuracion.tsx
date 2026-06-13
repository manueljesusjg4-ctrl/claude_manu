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

      <div className="tarjeta p-5 mt-5">
        <h3 className="font-bold text-marino mb-1">Usuarios</h3>
        <p className="text-sm text-slate-500">Esta aplicación está pensada para los dos socios. Los accesos se gestionan en el servidor (seed inicial): <b>socio1</b> y <b>socio2</b>. Para cambiar las contraseñas, edita el archivo <code className="text-xs bg-slate-100 px-1 rounded">server/prisma/seed.ts</code> y vuelve a ejecutar la preparación de datos.</p>
      </div>
    </div>
  );
}
