# GestiónObra — Aplicación de gestión para constructora (Valencia)

Aplicación web interna para gestionar de cero a cien una empresa de construcción
que subcontrata mano de obra y ejecuta partidas de obra y reformas. Pensada para
uso en oficina por los dos socios.

- **Frontend**: React + Vite + TypeScript + Tailwind CSS (dashboard tipo SaaS).
- **Backend**: Node.js + Express + TypeScript (API REST).
- **Base de datos**: PostgreSQL mediante Prisma ORM (en la nube, no se pierde al actualizar).
- **Despliegue**: Vercel, con dominio propio gratuito (`tuapp.vercel.app`).
- **Gráficos**: Recharts. **Idioma**: todo en español, euros y fechas DD/MM/AAAA.

---

## 1. Requisitos previos

- **Node.js 18 o superior** (recomendado 20+). Para comprobarlo:

  ```bash
  node --version
  ```

  Si no lo tienes, descárgalo de https://nodejs.org (versión "LTS").

- **Una base de datos PostgreSQL gratuita en la nube** (necesaria incluso para
  desarrollar en tu ordenador, así nunca se pierden los datos al actualizar el
  código). La opción más sencilla es [Neon](https://neon.tech) o
  [Supabase](https://supabase.com): crea una cuenta gratuita, crea un proyecto
  y copia la cadena de conexión (algo como
  `postgresql://usuario:contrasena@host/basededatos?sslmode=require`).

---

## 2. Arranque paso a paso (la primera vez)

Abre una terminal **en la carpeta del proyecto** y ejecuta estos comandos en orden:

```bash
# 1) Instalar las dependencias del servidor y del cliente
npm run instalar

# 2) Pegar tu cadena de conexión de PostgreSQL en server/.env (DATABASE_URL)

# 3) Crear las tablas y cargar los datos de ejemplo
npm run preparar-bd

# 4) Arrancar la aplicación (servidor + web a la vez)
npm run dev
```

Cuando veas el mensaje de que el cliente está listo, abre el navegador en:

> **http://localhost:5173**

### Usuarios de acceso (datos de ejemplo)

| Usuario  | Contraseña    |
|----------|---------------|
| `socio1` | `valencia2026` |
| `socio2` | `valencia2026` |

---

## 3. Arranques posteriores

Una vez instalado, para usar la app solo necesitas:

```bash
npm run dev
```

Y abrir **http://localhost:5173**.

---

## 4. Módulos de la aplicación

1. **Dashboard** — Caja proyectada a 12 semanas (resalta en rojo las semanas
   negativas), KPIs de facturación y margen, alertas (documentos caducados,
   cobros vencidos, obras sin certificar, clientes sin solvencia, "gatillo de
   cobro" al cerrar quincena/mes con horas sin facturar) y próximas acciones
   del CRM.
2. **Caja y tesorería** — Flujo de caja semanal y mensual, gestión de cobros y
   facturas, confirming/anticipo de facturas, anticipos de cliente, resumen de
   IVA y simulador *"¿aguanto esta obra?"*.
3. **CRM / Clientes** — Pipeline Kanban (arrastrar tarjetas) y lista,
   interacciones, seguimientos, control de solvencia y métricas.
4. **Obras** — Control económico (coste real vs facturado, margen real y
   previsto), equipo asignado, encargado responsable, registro de órdenes
   dadas a la cuadrilla (protección frente a cesión ilegal), partes de horas
   con validación del encargado, detección de horas extra (>40 h/semana con
   recargo) y generación de PDF de partes para adjuntar a facturas.
5. **Trabajadores** — Coste/hora real (mensual, anualizado y con estructura) con
   desglose, documentación obligatoria con caducidades, entrega de EPIs/PRL
   con firma digital y gestión de llamamientos para fijos discontinuos.
6. **Presupuestos** — Generador con margen en tiempo real y exportación a PDF.
7. **Simulador de rentabilidad** — Escenarios con uno o varios equipos,
   facturación, coste, margen por mes y flujo de caja; guardar y comparar.
8. **Documentación de empresa** — REA, RC, SPA, certificados… con caducidades y
   generador de packs documentales para clientes.
9. **Gastos y proveedores** — Gastos fijos (estructura) y variables.
10. **Informes** — Margen por obra/cliente, facturación, coste laboral y
    rentabilidad por categoría. Exportación a CSV y PDF.
11. **Configuración** — Todos los parámetros de cálculo editables, tarifario y
    copia de seguridad (exportar/importar).

---

## 5. La lógica de costes (lo más importante)

El coste real de un trabajador **no es su nómina mensual**. La app calcula:

1. **Coste empresa mensual base** (salario + SS empresa). Ej. peón: 1.976 €/mes.
2. **+ Pagas extra prorrateadas** (~16 %, configurable): se devengan mes a mes.
3. **Coste/hora en dos modos**:
   - *Mensual*: coste con extras ÷ horas de presencia/mes (160 h) → desembolso de caja.
   - *Anualizado*: coste anual total ÷ horas efectivas/año (1.736 h de convenio
     de Valencia) → **coste real para fijar precios** (reparte el mes de vacaciones).
   - *Obra corta*: para contratos cortos sin vacaciones, usa las horas realmente trabajadas.
4. **+ EPIs y reconocimiento médico**.
5. **+ Overhead de estructura** (opcional): gastos fijos repartidos entre operarios.

Todos estos parámetros se editan en **Configuración**, y cada coste o margen
muestra su **desglose** para entender de dónde sale cada número.

---

## 6. Estructura del proyecto

```
claude_manu/
├── package.json          ← scripts globales (instalar, preparar-bd, dev, build)
├── server/               ← API REST (Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma  ← modelo de datos
│   │   └── seed.ts        ← datos de ejemplo
│   └── src/
│       ├── lib/           ← motor de costes, tesorería, horas extra
│       ├── routes/        ← endpoints por módulo
│       └── index.ts       ← arranque del servidor
└── client/               ← interfaz React
    └── src/
        ├── pages/         ← una página por módulo
        ├── components/    ← UI reutilizable y gráficos
        └── lib/           ← formato (€, fechas) y cliente HTTP
```

---

## 7. Puesta en producción: desplegar en Vercel

La app está pensada para vivir en la nube en [Vercel](https://vercel.com), de
forma que **actualizar el código nunca borra los datos guardados** (la base
de datos vive en PostgreSQL, fuera de Vercel) y no hace falta compilar nada
a mano: cada vez que subes cambios a GitHub, Vercel reconstruye y publica la
app sola.

1. **Sube el proyecto a un repositorio de GitHub** (si no lo está ya).
2. **Crea la base de datos** en [Neon](https://neon.tech) o
   [Supabase](https://supabase.com) (gratis) y copia su `DATABASE_URL`.
3. En [vercel.com](https://vercel.com), pulsa **Add New → Project** e importa
   el repositorio. Vercel detecta automáticamente el archivo `vercel.json` de
   la raíz, que ya indica cómo construir el cliente y la API.
4. En **Settings → Environment Variables** del proyecto de Vercel, añade:
   - `DATABASE_URL` → la cadena de conexión de Neon/Supabase del paso 2.
   - `JWT_SECRET` → cualquier frase larga y secreta (para firmar los inicios de sesión).
   - `BLOB_READ_WRITE_TOKEN` *(opcional, recomendado)* → solo si vas a subir
     documentos de trabajadores o firmas de EPI. Se obtiene creando un
     "Blob Store" gratuito en **Storage → Blob** dentro del propio panel de
     Vercel; sin este token, los archivos subidos en producción no se
     conservarían porque el disco del servidor es temporal.
5. Pulsa **Deploy**. Cuando termine, la primera vez tienes que crear las
   tablas en la base de datos nueva: desde tu ordenador, ejecuta una vez
   `npm run preparar-bd --prefix server` con el `DATABASE_URL` de producción
   puesto en `server/.env` (luego puedes volver a poner ahí tu base de datos
   de desarrollo si usas una distinta).
6. Tu app queda publicada en una URL tipo `tuapp.vercel.app` (puedes añadir un
   dominio propio gratis desde **Settings → Domains**). A partir de aquí,
   cada `git push` a la rama conectada actualiza la app sola, sin tocar los
   datos guardados.

### Actualizaciones posteriores

Para publicar cambios solo hace falta subirlos a GitHub (`git push`); Vercel
los detecta y los despliega automáticamente. No necesitas compilar nada a
mano ni preocuparte por perder datos: la base de datos vive aparte, en
Neon/Supabase, y no se reinstala ni se borra en cada despliegue.

---

## 8. Copias de seguridad

Aunque los datos viven en una base de datos en la nube (no se pierden al
actualizar), conviene guardar copias periódicas en tu ordenador por si acaso.
Desde **Configuración → Copia de seguridad** puedes exportar toda la base de
datos a un archivo JSON y volver a importarla cuando quieras.
