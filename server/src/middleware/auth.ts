// Autenticación con JWT: login de los dos socios, sin registro público.
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'secreto-desarrollo';

export interface UsuarioToken {
  id: number;
  usuario: string;
  nombre: string;
}

export function firmarToken(u: UsuarioToken): string {
  return jwt.sign(u, SECRET, { expiresIn: '7d' });
}

/** Middleware: exige un token Bearer válido en todas las rutas protegidas. */
export function requiereAuth(req: Request, res: Response, next: NextFunction) {
  const cabecera = req.headers.authorization;
  if (!cabecera?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const datos = jwt.verify(cabecera.slice(7), SECRET) as UsuarioToken;
    (req as any).usuario = datos;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión caducada, vuelve a iniciar sesión' });
  }
}
