// Punto de entrada para Vercel: la misma app Express, expuesta como función
// serverless (Vercel la invoca como un manejador (req, res) normal).
import { app } from '../src/app';

export default app;
