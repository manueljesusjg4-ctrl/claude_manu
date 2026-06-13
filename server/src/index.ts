// Punto de entrada del servidor API.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { requiereAuth } from './middleware/auth';
import { rutasAuth } from './routes/auth';
import { rutasConfiguracion } from './routes/configuracion';
import { rutasTrabajadores } from './routes/trabajadores';
import { rutasClientes } from './routes/clientes';
import { rutasObras } from './routes/obras';
import { rutasFacturas } from './routes/facturas';
import { rutasGastos, rutasProveedores } from './routes/gastos';
import { rutasPresupuestos } from './routes/presupuestos';
import { rutasDocumentosEmpresa, rutasPacks } from './routes/documentosEmpresa';
import { rutasTesoreria } from './routes/tesoreria';
import { rutasSimulador } from './routes/simulador';
import { rutasDashboard } from './routes/dashboard';
import { rutasInformes } from './routes/informes';
import { rutasBackup } from './routes/backup';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // límite amplio para importar backups

// Rutas públicas
app.use('/api/auth', rutasAuth);

// Rutas protegidas (requieren sesión)
app.use('/api/configuracion', requiereAuth, rutasConfiguracion);
app.use('/api/trabajadores', requiereAuth, rutasTrabajadores);
app.use('/api/clientes', requiereAuth, rutasClientes);
app.use('/api/obras', requiereAuth, rutasObras);
app.use('/api/facturas', requiereAuth, rutasFacturas);
app.use('/api/gastos', requiereAuth, rutasGastos);
app.use('/api/proveedores', requiereAuth, rutasProveedores);
app.use('/api/presupuestos', requiereAuth, rutasPresupuestos);
app.use('/api/documentos-empresa', requiereAuth, rutasDocumentosEmpresa);
app.use('/api/packs', requiereAuth, rutasPacks);
app.use('/api/tesoreria', requiereAuth, rutasTesoreria);
app.use('/api/simulador', requiereAuth, rutasSimulador);
app.use('/api/dashboard', requiereAuth, rutasDashboard);
app.use('/api/informes', requiereAuth, rutasInformes);
app.use('/api/backup', requiereAuth, rutasBackup);

// En producción servimos también el frontend compilado
const dirCliente = path.join(__dirname, '../../client/dist');
app.use(express.static(dirCliente));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(dirCliente, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend no compilado. Usa "npm run dev" para desarrollo.');
  });
});

// Manejo centralizado de errores
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

const PUERTO = Number(process.env.PORT) || 3001;
app.listen(PUERTO, () => {
  console.log(`✔ API de gestión escuchando en http://localhost:${PUERTO}`);
});
