// Gráfico de flujo de caja semanal: entradas vs salidas y saldo acumulado,
// con las semanas en negativo resaltadas en rojo.
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { euros, fecha } from '../lib/formato';

export interface SemanaGrafico {
  semana: string;
  entradas: number;
  salidas: number;
  saldoAcumulado: number;
  negativa: boolean;
}

export function GraficoCaja({ semanas, alto = 280 }: { semanas: SemanaGrafico[]; alto?: number }) {
  const datos = semanas.map((s) => ({ ...s, etiqueta: fecha(s.semana).slice(0, 5) }));
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <ComposedChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
        <Tooltip
          formatter={(v: number, nombre: string) => [euros(v), nombre]}
          labelFormatter={(_, payload) => `Semana del ${fecha((payload?.[0]?.payload as any)?.semana)}`}
        />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Bar dataKey="entradas" name="Cobros" fill="#10b981" radius={[3, 3, 0, 0]} barSize={10} />
        <Bar dataKey="salidas" name="Pagos" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={10} />
        <Line type="monotone" dataKey="saldoAcumulado" name="Saldo acumulado" stroke="#162D45" strokeWidth={2.5} dot={{ r: 3 }} />
        {/* Resaltar en rojo las semanas con saldo negativo */}
        <Bar dataKey={(d: any) => (d.negativa ? d.saldoAcumulado : 0)} name="Saldo negativo" barSize={10}>
          {datos.map((d, i) => (
            <Cell key={i} fill={d.negativa ? '#dc2626' : 'transparent'} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
