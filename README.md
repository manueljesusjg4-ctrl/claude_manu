# GestiónObra — Aplicación de gestión para constructora (Valencia)

Aplicación web interna para gestionar de cero a cien una empresa de construcción
que subcontrata mano de obra y ejecuta partidas de obra y reformas. Pensada para
uso en oficina por los dos socios.

- **Frontend**: React + Vite + TypeScript + Tailwind CSS (dashboard tipo SaaS).
- **Backend**: Node.js + Express + TypeScript (API REST).
- **Base de datos**: SQLite mediante Prisma ORM (arranca sin configuración).
- **Gráficos**: Recharts. **Idioma**: todo en español, euros y fechas DD/MM/AAAA.

---

## 1. Requisitos previos

Solo necesitas tener instalado **Node.js 18 o superior** (recomendado 20+).
Para comprobarlo, abre una terminal y escribe:

```bash
node --version
```

Si no lo tienes, descárgalo de https://nodejs.org (versión "LTS").

---

## 2. Arranque paso a paso (la primera vez)

Abre una terminal **en la carpeta del proyecto** y ejecuta estos comandos en orden:

```bash
# 1) Instalar las dependencias del servidor y del cliente
npm run instalar

# 2) Crear la base de datos y cargar los datos de ejemplo
npm run preparar-bd

# 3) Arrancar la aplicación (servidor + web a la vez)
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
   cobros vencidos, obras sin certificar, clientes sin solvencia) y próximas
   acciones del CRM.
2. **Caja y tesorería** — Flujo de caja semanal y mensual, gestión de cobros y
   facturas, confirming/anticipo de facturas, anticipos de cliente, resumen de
   IVA y simulador *"¿aguanto esta obra?"*.
3. **CRM / Clientes** — Pipeline Kanban (arrastrar tarjetas) y lista,
   interacciones, seguimientos, control de solvencia y métricas.
4. **Obras** — Control económico (coste real vs facturado, margen real y
   previsto), equipo asignado, partes de horas y detección de horas extra
   (>40 h/semana con recargo).
5. **Trabajadores** — Coste/hora real (mensual, anualizado y con estructura) con
   desglose, documentación obligatoria con caducidades.
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

## 7. Puesta en producción (opcional)

Para servir todo desde un único proceso:

```bash
npm run build      # compila cliente y servidor
npm start          # sirve API + web en http://localhost:3001
```

---

## 8. Migrar a PostgreSQL en el futuro

El código está preparado: solo hay que cambiar en `server/prisma/schema.prisma`
el `provider` a `"postgresql"` y la variable `DATABASE_URL` en `server/.env`,
y volver a ejecutar `npm run preparar-bd`. El resto del código no cambia.

---

## 9. Copias de seguridad

Desde **Configuración → Copia de seguridad** puedes exportar toda la base de
datos a un archivo JSON y volver a importarla cuando quieras.
