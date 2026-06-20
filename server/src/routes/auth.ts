// Rutas de autenticación: login y datos del usuario actual.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { firmarToken, requiereAuth } from '../middleware/auth';

export const rutasAuth = Router();

rutasAuth.post('/login', async (req, res) => {
  const { usuario, password } = req.body ?? {};
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }
  const u = await prisma.usuario.findUnique({ where: { usuario } });
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const token = firmarToken({ id: u.id, usuario: u.usuario, nombre: u.nombre });
  res.json({ token, usuario: { id: u.id, usuario: u.usuario, nombre: u.nombre } });
});

rutasAuth.get('/yo', requiereAuth, (req, res) => {
  res.json({ usuario: (req as any).usuario });
});

// Cambio de contraseña del usuario que está conectado. Pide la contraseña
// actual para confirmar identidad antes de cambiarla.
rutasAuth.put('/password', requiereAuth, async (req, res) => {
  const { actual, nueva } = req.body ?? {};
  if (!actual || !nueva) {
    return res.status(400).json({ error: 'Indica la contraseña actual y la nueva' });
  }
  if (String(nueva).length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  const yo = (req as any).usuario;
  const u = await prisma.usuario.findUnique({ where: { id: yo.id } });
  if (!u || !(await bcrypt.compare(actual, u.passwordHash))) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }
  const passwordHash = await bcrypt.hash(nueva, 10);
  await prisma.usuario.update({ where: { id: u.id }, data: { passwordHash } });
  res.json({ ok: true });
});
