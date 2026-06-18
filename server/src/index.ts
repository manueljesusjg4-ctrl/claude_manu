// Punto de entrada para arrancar la API como servidor tradicional (uso local
// o en cualquier hosting que no sea serverless). En Vercel se usa en su lugar
// api/index.ts, que reutiliza la misma app sin llamar a listen().
import { app } from './app';

const PUERTO = Number(process.env.PORT) || 3001;
app.listen(PUERTO, () => {
  console.log(`✔ API de gestión escuchando en http://localhost:${PUERTO}`);
});
