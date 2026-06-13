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
