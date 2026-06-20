// Configuración global de costes y parámetros + tarifario por categoría.
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const rutasConfiguracion = Router();

// Leer la configuración (fila única)
rutasConfiguracion.get('/', async (_req, res) => {
  const config = await prisma.configuracion.findFirstOrThrow();
  res.json(config);
});

// Actualizar parámetros
rutasConfiguracion.put('/', async (req, res) => {
  const datos = req.body;
  const config = await prisma.configuracion.update({
    where: { id: 1 },
    data: {
      porcentajePagasExtra: Number(datos.porcentajePagasExtra),
      horasMes: Number(datos.horasMes),
      horasAnio: Number(datos.horasAnio),
      costeEpisAnual: Number(datos.costeEpisAnual),
      costeReconocimientoAnual: Number(datos.costeReconocimientoAnual),
      recargoHoraExtra: Number(datos.recargoHoraExtra),
      umbralMargenAviso: Number(datos.umbralMargenAviso),
      plazoCobroDefecto: Number(datos.plazoCobroDefecto),
      porcentajeIva: Number(datos.porcentajeIva),
      porcentajeSeguridadSocial: Number(datos.porcentajeSeguridadSocial),
      umbralSobrecosteHora: Number(datos.umbralSobrecosteHora),
    },
  });
  res.json(config);
});

// Tarifario de venta por categoría
rutasConfiguracion.get('/tarifas', async (_req, res) => {
  const tarifas = await prisma.tarifaCategoria.findMany({ orderBy: { id: 'asc' } });
  res.json(tarifas);
});

rutasConfiguracion.put('/tarifas/:id', async (req, res) => {
  const tarifa = await prisma.tarifaCategoria.update({
    where: { id: Number(req.params.id) },
    data: { precioHoraVenta: Number(req.body.precioHoraVenta) },
  });
  res.json(tarifa);
});
