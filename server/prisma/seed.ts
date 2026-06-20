// ============================================================================
// DATOS DE EJEMPLO — constructora tipo de Valencia.
// Las fechas se generan RELATIVAS al día en que se ejecuta el seed, para que
// el dashboard, la caja proyectada y las alertas se vean vivos desde el
// primer arranque.
//
// Usuarios creados:  socio1 / valencia2026   y   socio2 / valencia2026
// ============================================================================
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hoy = new Date();
/** Fecha desplazada N días desde hoy (negativo = pasado). */
const dias = (n: number) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n);

async function main() {
  console.log('→ Limpiando base de datos...');
  // Orden inverso a las dependencias
  await prisma.envioPackItem.deleteMany();
  await prisma.envioPack.deleteMany();
  await prisma.lineaPresupuesto.deleteMany();
  await prisma.presupuesto.deleteMany();
  await prisma.escenario.deleteMany();
  await prisma.gasto.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.anticipo.deleteMany();
  await prisma.factura.deleteMany();
  await prisma.parteHoras.deleteMany();
  await prisma.asignacion.deleteMany();
  await prisma.obra.deleteMany();
  await prisma.seguimiento.deleteMany();
  await prisma.interaccion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.documentoTrabajador.deleteMany();
  await prisma.trabajador.deleteMany();
  await prisma.documentoEmpresa.deleteMany();
  await prisma.tarifaCategoria.deleteMany();
  await prisma.configuracion.deleteMany();
  await prisma.usuario.deleteMany();

  console.log('→ Usuarios (los dos socios)...');
  const hash = await bcrypt.hash('valencia2026', 10);
  await prisma.usuario.createMany({
    data: [
      { nombre: 'Socio 1', usuario: 'socio1', passwordHash: hash },
      { nombre: 'Socio 2', usuario: 'socio2', passwordHash: hash },
    ],
  });

  console.log('→ Configuración de costes...');
  await prisma.configuracion.create({
    data: {
      id: 1,
      porcentajePagasExtra: 16,
      horasMes: 160,
      horasAnio: 1736, // convenio construcción Valencia (descontando vacaciones)
      costeEpisAnual: 91,
      costeReconocimientoAnual: 45,
      recargoHoraExtra: 25,
      umbralMargenAviso: 15,
      plazoCobroDefecto: 60,
      porcentajeIva: 21,
      porcentajeSeguridadSocial: 31.5,
    },
  });

  console.log('→ Tarifario de venta por categoría...');
  await prisma.tarifaCategoria.createMany({
    data: [
      { categoria: 'PEON', precioHoraVenta: 19 },
      { categoria: 'OFICIAL_2', precioHoraVenta: 21.5 },
      { categoria: 'OFICIAL_1', precioHoraVenta: 22.5 },
      { categoria: 'ESPECIALISTA', precioHoraVenta: 24.5 },
      { categoria: 'ENCARGADO', precioHoraVenta: 27 },
    ],
  });

  console.log('→ Trabajadores con documentación...');
  const ahmed = await prisma.trabajador.create({
    data: {
      nombre: 'Ahmed', apellidos: 'El Mansouri', dni: 'X4821903L', categoria: 'PEON',
      fechaAlta: dias(-220), tipoContrato: 'INDEFINIDO', costeEmpresaMensual: 1976,
      telefono: '612 345 001',
      documentos: {
        create: [
          { tipo: 'ALTA_SS', nombre: 'Alta en Seguridad Social', fechaEmision: dias(-220) },
          { tipo: 'TPC', nombre: 'Tarjeta Profesional de la Construcción', fechaEmision: dias(-400), fechaCaducidad: dias(1400) },
          { tipo: 'PRL_20H', nombre: 'Curso PRL 20h albañilería', fechaEmision: dias(-400) },
          { tipo: 'RECONOCIMIENTO_MEDICO', nombre: 'Reconocimiento médico anual', fechaEmision: dias(-350), fechaCaducidad: dias(15) }, // ¡caduca pronto!
        ],
      },
    },
  });
  const jorge = await prisma.trabajador.create({
    data: {
      nombre: 'Jorge', apellidos: 'Martínez Soler', dni: '44523187Q', categoria: 'PEON',
      fechaAlta: dias(-90), tipoContrato: 'FIJO_OBRA', costeEmpresaMensual: 1976,
      telefono: '612 345 002',
      documentos: {
        create: [
          { tipo: 'ALTA_SS', nombre: 'Alta en Seguridad Social', fechaEmision: dias(-90) },
          { tipo: 'TPC', nombre: 'Tarjeta Profesional de la Construcción', fechaEmision: dias(-100), fechaCaducidad: dias(1700) },
          { tipo: 'PRL_20H', nombre: 'Curso PRL 20h albañilería', fechaEmision: dias(-100) },
          { tipo: 'RECONOCIMIENTO_MEDICO', nombre: 'Reconocimiento médico anual', fechaEmision: dias(-90), fechaCaducidad: dias(275) },
        ],
      },
    },
  });
  const dumitru = await prisma.trabajador.create({
    data: {
      nombre: 'Dumitru', apellidos: 'Popescu', dni: 'Y7301284T', categoria: 'OFICIAL_2',
      fechaAlta: dias(-300), tipoContrato: 'INDEFINIDO', costeEmpresaMensual: 2149,
      telefono: '612 345 003',
      documentos: {
        create: [
          { tipo: 'ALTA_SS', nombre: 'Alta en Seguridad Social', fechaEmision: dias(-300) },
          { tipo: 'TPC', nombre: 'Tarjeta Profesional de la Construcción', fechaEmision: dias(-600), fechaCaducidad: dias(1200) },
          { tipo: 'PRL_20H', nombre: 'Curso PRL 20h albañilería', fechaEmision: dias(-600) },
          { tipo: 'RECONOCIMIENTO_MEDICO', nombre: 'Reconocimiento médico anual', fechaEmision: dias(-380), fechaCaducidad: dias(-15) }, // ¡CADUCADO!
        ],
      },
    },
  });
  const vicente = await prisma.trabajador.create({
    data: {
      nombre: 'Vicente', apellidos: 'Ferrer Blasco', dni: '20481736M', categoria: 'OFICIAL_1',
      fechaAlta: dias(-500), tipoContrato: 'INDEFINIDO', costeEmpresaMensual: 2310,
      telefono: '612 345 004',
      documentos: {
        create: [
          { tipo: 'ALTA_SS', nombre: 'Alta en Seguridad Social', fechaEmision: dias(-500) },
          { tipo: 'TPC', nombre: 'Tarjeta Profesional de la Construcción', fechaEmision: dias(-700), fechaCaducidad: dias(1100) },
          { tipo: 'PRL_20H', nombre: 'Curso PRL 20h albañilería', fechaEmision: dias(-700) },
          { tipo: 'RECONOCIMIENTO_MEDICO', nombre: 'Reconocimiento médico anual', fechaEmision: dias(-100), fechaCaducidad: dias(265) },
        ],
      },
    },
  });
  const ionel = await prisma.trabajador.create({
    data: {
      nombre: 'Ionel', apellidos: 'Stancu', dni: 'X9162048R', categoria: 'ESPECIALISTA',
      especialidad: 'Encofrador', fechaAlta: dias(-150), tipoContrato: 'INDEFINIDO',
      costeEmpresaMensual: 2480, telefono: '612 345 005',
      documentos: {
        create: [
          { tipo: 'ALTA_SS', nombre: 'Alta en Seguridad Social', fechaEmision: dias(-150) },
          { tipo: 'TPC', nombre: 'Tarjeta Profesional de la Construcción', fechaEmision: dias(-200), fechaCaducidad: dias(1600) },
          { tipo: 'PRL_20H', nombre: 'Curso PRL 20h encofrados', fechaEmision: dias(-200) },
          { tipo: 'RECONOCIMIENTO_MEDICO', nombre: 'Reconocimiento médico anual', fechaEmision: dias(-150), fechaCaducidad: dias(215) },
        ],
      },
    },
  });

  console.log('→ Clientes y CRM...');
  const marcos = await prisma.cliente.create({
    data: {
      nombre: 'Construcciones Marcos Levante SL', cif: 'B98123456', tipo: 'CONSTRUCTORA',
      personaContacto: 'Marcos Gil', telefono: '963 11 22 33', email: 'marcos@marcoslevante.es',
      origen: 'Referido por jefe de obra de Malilla', plazoPagoDias: 30, estadoPipeline: 'GANADO',
      valorEstimado: 120000, solvenciaConsultada: true, solvenciaResultado: 'Favorable (eInforma, rating 7/10)',
      solvenciaFecha: dias(-80),
      notas: 'Cliente principal. Paga puntual a 30 días. Pide pack documental actualizado cada trimestre.',
      interacciones: {
        create: [
          { fecha: dias(-75), tipo: 'REUNION', resumen: 'Reunión inicial en obra de Malilla', resultado: 'Acuerdo para 3 operarios por administración' },
          { fecha: dias(-30), tipo: 'LLAMADA', resumen: 'Repaso de certificación mensual', resultado: 'Conforme, certificación aprobada' },
        ],
      },
      seguimientos: {
        create: [{ fechaPrevista: dias(4), descripcion: 'Llamar a Marcos: ampliar equipo a 5 personas en julio' }],
      },
    },
  });
  const giticsa = await prisma.cliente.create({
    data: {
      nombre: 'Giticsa Promociones SL', cif: 'B97654321', tipo: 'PROMOTORA',
      personaContacto: 'Lucía Tormo', telefono: '961 44 55 66', email: 'lucia@giticsa.com',
      origen: 'Visita a obra en Patraix', plazoPagoDias: 60, estadoPipeline: 'NEGOCIACION',
      valorEstimado: 85000, solvenciaConsultada: false,
      notas: 'Promotora mediana. Quieren 5 peones para verano. OJO: pedir informe de solvencia antes de firmar.',
      interacciones: {
        create: [
          { fecha: dias(-12), tipo: 'VISITA', resumen: 'Visita a su promoción de Patraix', resultado: 'Interesados, piden oferta de 5 peones' },
          { fecha: dias(-5), tipo: 'EMAIL', resumen: 'Enviada propuesta 5 peones a 19 €/h', resultado: 'Pendiente de respuesta' },
        ],
      },
      seguimientos: {
        create: [{ fechaPrevista: dias(2), descripcion: 'Seguimiento propuesta 5 peones (llamar a Lucía)' }],
      },
    },
  });
  const intermediario = await prisma.cliente.create({
    data: {
      nombre: 'Obras y Servicios Turia SL', cif: 'B96111222', tipo: 'INTERMEDIARIO',
      personaContacto: 'Paco Andreu', telefono: '617 88 99 00', email: 'paco@oyturia.es',
      origen: 'Milanuncios', plazoPagoDias: 60, estadoPipeline: 'PROPUESTA',
      valorEstimado: 40000,
      notas: 'Intermediario que revende mano de obra. Margen más justo, pero da volumen.',
      interacciones: {
        create: [{ fecha: dias(-8), tipo: 'LLAMADA', resumen: 'Primera toma de contacto', resultado: 'Piden tarifa de oficiales 1ª' }],
      },
      seguimientos: {
        create: [{ fechaPrevista: dias(-1), descripcion: 'Enviar tarifario actualizado a Paco (¡pendiente!)' }],
      },
    },
  });
  await prisma.cliente.create({
    data: {
      nombre: 'Estudio Arquitectura Cabanyal', tipo: 'ARQUITECTO',
      personaContacto: 'Marta Ribes', telefono: '600 12 34 56', email: 'marta@eacabanyal.com',
      origen: 'Referido por cliente de reforma', plazoPagoDias: 30, estadoPipeline: 'CONTACTADO',
      valorEstimado: 25000,
      notas: 'Estudio que dirige reformas integrales en el Cabanyal. Posible fuente recurrente de reformas.',
    },
  });
  const particular = await prisma.cliente.create({
    data: {
      nombre: 'Familia Navarro (reforma Ruzafa)', tipo: 'PARTICULAR',
      personaContacto: 'José Navarro', telefono: '655 43 21 09', email: 'jnavarro@gmail.com',
      origen: 'Recomendación vecino', plazoPagoDias: 15, estadoPipeline: 'GANADO',
      valorEstimado: 28500,
      notas: 'Reforma integral de piso en Ruzafa. Anticipo de 7.000 € al arranque.',
    },
  });

  console.log('→ Obras, asignaciones y partes de horas...');
  const obraMalilla = await prisma.obra.create({
    data: {
      clienteId: marcos.id, nombre: 'Residencial Malilla — estructura',
      direccion: 'C/ Bernat Descoll, Valencia', tipo: 'ADMINISTRACION', estado: 'ACTIVA',
      fechaInicio: dias(-60), fechaFinPrevista: dias(60), plazoCobroDias: 30, margenPrevisto: 18,
      notas: 'Mano de obra por administración: 1 oficial 1ª, 1 oficial 2ª y 1 especialista.',
    },
  });
  const obraRuzafa = await prisma.obra.create({
    data: {
      clienteId: particular.id, nombre: 'Reforma integral piso Ruzafa',
      direccion: 'C/ Sueca 42, Valencia', tipo: 'PRECIO_CERRADO', estado: 'ACTIVA',
      fechaInicio: dias(-30), fechaFinPrevista: dias(45), presupuestoCerrado: 28500,
      plazoCobroDias: 15, margenPrevisto: 22,
      notas: 'Precio cerrado 28.500 € + IVA. Anticipo de 7.000 € recibido.',
    },
  });
  await prisma.obra.create({
    data: {
      clienteId: giticsa.id, nombre: 'Promoción Patraix — albañilería (oferta)',
      direccion: 'C/ Salabert, Valencia', tipo: 'ADMINISTRACION', estado: 'PRESUPUESTADA',
      fechaInicio: dias(20), fechaFinPrevista: dias(110), plazoCobroDias: 60, margenPrevisto: 15,
      notas: 'Oferta enviada: 5 peones a 19 €/h durante el verano.',
    },
  });

  // Asignaciones con precio de venta por hora
  await prisma.asignacion.createMany({
    data: [
      { obraId: obraMalilla.id, trabajadorId: vicente.id, fechaInicio: dias(-60), precioVentaHora: 22.5 },
      { obraId: obraMalilla.id, trabajadorId: dumitru.id, fechaInicio: dias(-60), precioVentaHora: 21.5 },
      { obraId: obraMalilla.id, trabajadorId: ionel.id, fechaInicio: dias(-45), precioVentaHora: 24.5 },
      { obraId: obraRuzafa.id, trabajadorId: ahmed.id, fechaInicio: dias(-30), precioVentaHora: 19 },
      { obraId: obraRuzafa.id, trabajadorId: jorge.id, fechaInicio: dias(-30), precioVentaHora: 19 },
    ],
  });

  // Partes de horas de las últimas ~6 semanas (L-V, 8 h/día; alguna semana con
  // horas extra en Malilla para que se vea la detección de >40 h/semana)
  const partes: { obraId: number; trabajadorId: number; fecha: Date; horas: number }[] = [];
  for (let d = -42; d <= 0; d++) {
    const fecha = dias(d);
    const diaSemana = fecha.getDay();
    if (diaSemana === 0 || diaSemana === 6) continue; // fin de semana
    // Malilla: Vicente y Dumitru desde -42; Ionel desde -42 también
    for (const t of [vicente.id, dumitru.id, ionel.id]) {
      // Dos semanas con punta de trabajo: 9,5 h/día (genera horas extra)
      const punta = d >= -21 && d <= -10;
      partes.push({ obraId: obraMalilla.id, trabajadorId: t, fecha, horas: punta ? 9.5 : 8 });
    }
    // Ruzafa: Ahmed y Jorge desde el inicio de la reforma (-30)
    if (d >= -30) {
      for (const t of [ahmed.id, jorge.id]) {
        partes.push({ obraId: obraRuzafa.id, trabajadorId: t, fecha, horas: 8 });
      }
    }
  }
  await prisma.parteHoras.createMany({ data: partes });

  console.log('→ Facturas, anticipos y confirming...');
  // Certificaciones de Malilla: dos cobradas, una pendiente (a 30 días)
  await prisma.factura.create({
    data: {
      numero: 'C-2026-001', clienteId: marcos.id, obraId: obraMalilla.id,
      concepto: 'Certificación nº 1 — mano de obra Malilla (mes 1)',
      fechaEmision: dias(-55), baseImponible: 10080, porcentajeIva: 21, plazoDias: 30,
      fechaCobroEsperada: dias(-25), estado: 'COBRADA', fechaCobroReal: dias(-24),
    },
  });
  await prisma.factura.create({
    data: {
      numero: 'C-2026-002', clienteId: marcos.id, obraId: obraMalilla.id,
      concepto: 'Certificación nº 2 — mano de obra Malilla (mes 2)',
      fechaEmision: dias(-25), baseImponible: 11900, porcentajeIva: 21, plazoDias: 30,
      fechaCobroEsperada: dias(5), estado: 'PENDIENTE',
    },
  });
  // Factura anticipada vía confirming (el banco adelanta el dinero con coste)
  await prisma.factura.create({
    data: {
      numero: 'C-2026-003', clienteId: marcos.id, obraId: obraMalilla.id,
      concepto: 'Certificación nº 3 — mano de obra Malilla (mes 3, con horas extra)',
      fechaEmision: dias(-2), baseImponible: 13150, porcentajeIva: 21, plazoDias: 30,
      fechaCobroEsperada: dias(28), estado: 'PENDIENTE',
      anticipadaConfirming: true, costeFinanciero: 185, fechaAnticipo: dias(3),
    },
  });
  // Anticipo del particular (7.000 €) y primera certificación de la reforma
  await prisma.anticipo.create({
    data: {
      clienteId: particular.id, obraId: obraRuzafa.id, fecha: dias(-30), importe: 7000,
      importeAplicado: 7000, notas: 'Anticipo al arranque de la reforma',
    },
  });
  await prisma.factura.create({
    data: {
      numero: 'F-2026-014', clienteId: particular.id, obraId: obraRuzafa.id,
      concepto: 'Reforma Ruzafa — 1ª fase (demoliciones e instalaciones)',
      fechaEmision: dias(-10), baseImponible: 9500, porcentajeIva: 10, plazoDias: 15,
      fechaCobroEsperada: dias(5), estado: 'PENDIENTE', anticipoAplicado: 7000,
      // El anticipo de 7.000 € se descuenta: solo quedan por cobrar 3.450 €
    },
  });
  // Una factura VENCIDA de un trabajo antiguo con el intermediario (para la alerta)
  await prisma.factura.create({
    data: {
      numero: 'F-2026-009', clienteId: intermediario.id,
      concepto: 'Refuerzo de equipo — obra Torrent (marzo)',
      fechaEmision: dias(-80), baseImponible: 4560, porcentajeIva: 21, plazoDias: 60,
      fechaCobroEsperada: dias(-20), estado: 'PENDIENTE',
    },
  });

  console.log('→ Proveedores y gastos...');
  const prevencion = await prisma.proveedor.create({
    data: { nombre: 'Previs SPA SL', cif: 'B40111222', contacto: 'Dpto. clientes', telefono: '960 00 11 22', plazoPagoDias: 30, notas: 'Servicio de Prevención Ajeno' },
  });
  const gestoria = await prisma.proveedor.create({
    data: { nombre: 'Gestoría Climent', cif: 'B46999888', contacto: 'Amparo Climent', telefono: '963 33 44 55', plazoPagoDias: 15, notas: 'Nóminas, contratos y fiscal' },
  });
  const ferreteria = await prisma.proveedor.create({
    data: { nombre: 'Suministros Levante', cif: 'B46555444', contacto: 'Mostrador', telefono: '961 77 88 99', plazoPagoDias: 30, notas: 'EPIs, pequeño material y herramienta' },
  });
  const subcontrataYesos = await prisma.proveedor.create({
    data: {
      nombre: 'Yesos y Pladur Pla SL', cif: 'B46222111', contacto: 'Vicente Pla', telefono: '655 11 22 33',
      plazoPagoDias: 30, esSubcontratista: true, notas: 'Subcontrata de tabiquería y pladur',
    },
  });
  await prisma.documentoProveedor.createMany({
    data: [
      { proveedorId: subcontrataYesos.id, tipo: 'REA', nombre: 'Inscripción REA', fechaEmision: dias(-300), fechaCaducidad: dias(20) }, // ¡caduca pronto!
      { proveedorId: subcontrataYesos.id, tipo: 'CERT_SS', nombre: 'Certificado estar al corriente SS', fechaEmision: dias(-25), fechaCaducidad: dias(65) },
    ],
  });

  // Gastos fijos de estructura (alimentan el overhead y el flujo de caja)
  await prisma.gasto.createMany({
    data: [
      { concepto: 'Servicio de Prevención Ajeno (SPA)', categoria: 'ESTRUCTURA', importe: 95, esRecurrente: true, fecha: dias(-200), proveedorId: prevencion.id, pagado: true },
      { concepto: 'Seguro Responsabilidad Civil', categoria: 'ESTRUCTURA', importe: 210, esRecurrente: true, fecha: dias(-200), pagado: true },
      { concepto: 'Gestoría (nóminas + fiscal)', categoria: 'ESTRUCTURA', importe: 150, esRecurrente: true, fecha: dias(-200), proveedorId: gestoria.id, pagado: true },
      { concepto: 'Alquiler oficina (Quart de Poblet)', categoria: 'ESTRUCTURA', importe: 350, esRecurrente: true, fecha: dias(-200), pagado: true },
      { concepto: 'Teléfono + software', categoria: 'ESTRUCTURA', importe: 60, esRecurrente: true, fecha: dias(-200), pagado: true },
      // Gastos variables
      { concepto: 'EPIs renovación (5 trabajadores)', categoria: 'MATERIALES', importe: 240, esRecurrente: false, fecha: dias(-15), proveedorId: ferreteria.id, pagado: true },
      { concepto: 'Material reforma Ruzafa (fontanería)', categoria: 'MATERIALES', importe: 1850, esRecurrente: false, fecha: dias(-12), proveedorId: ferreteria.id, pagado: true, obraId: obraRuzafa.id },
      { concepto: 'Alquiler contenedor escombros Ruzafa', categoria: 'SUBCONTRATA', importe: 380, esRecurrente: false, fecha: dias(10), pagado: false, obraId: obraRuzafa.id },
      { concepto: 'Tabiquería pladur Ruzafa', categoria: 'SUBCONTRATA', importe: 1450, esRecurrente: false, fecha: dias(5), proveedorId: subcontrataYesos.id, pagado: false, obraId: obraRuzafa.id },
    ],
  });

  console.log('→ Documentación de empresa...');
  await prisma.documentoEmpresa.createMany({
    data: [
      { tipo: 'REA', nombre: 'Inscripción REA Comunitat Valenciana', fechaEmision: dias(-400), fechaCaducidad: dias(695) },
      { tipo: 'RC', nombre: 'Póliza Responsabilidad Civil (recibo anual)', fechaEmision: dias(-340), fechaCaducidad: dias(25) }, // ¡caduca pronto!
      { tipo: 'SPA', nombre: 'Contrato Servicio de Prevención Ajeno', fechaEmision: dias(-200), fechaCaducidad: dias(165) },
      { tipo: 'CERT_AEAT', nombre: 'Certificado corriente de pago AEAT', fechaEmision: dias(-200), fechaCaducidad: dias(-20) }, // ¡CADUCADO!
      { tipo: 'CERT_SS', nombre: 'Certificado corriente Seguridad Social', fechaEmision: dias(-20), fechaCaducidad: dias(10) },
      { tipo: 'ESCRITURA', nombre: 'Escritura de constitución y CNAE' },
      { tipo: 'PODERES', nombre: 'Escritura de poderes de los administradores' },
      { tipo: 'TC1_TC2', nombre: 'TC1/TC2 último mes', fechaEmision: dias(-12), fechaCaducidad: dias(18) },
      { tipo: 'CIF', nombre: 'Tarjeta CIF de la sociedad' },
    ],
  });

  // Pack documental enviado a Marcos (es recurrente: lo piden antes de contratar)
  const docsEmpresa = await prisma.documentoEmpresa.findMany();
  const idsParaPack = docsEmpresa
    .filter((d) => ['REA', 'RC', 'SPA', 'CERT_SS', 'CIF'].includes(d.tipo))
    .map((d) => ({ documentoId: d.id }));
  await prisma.envioPack.create({
    data: {
      clienteId: marcos.id, fecha: dias(-70),
      notas: 'Pack inicial solicitado antes de firmar el contrato de Malilla',
      items: { create: idsParaPack },
    },
  });

  console.log('→ Presupuesto de ejemplo...');
  await prisma.presupuesto.create({
    data: {
      numero: 'P-2026-001', clienteId: giticsa.id, fecha: dias(-5), tipo: 'ADMINISTRACION',
      estado: 'ENVIADO',
      condiciones: 'Precios por hora efectiva de trabajo. Facturación mensual por certificación. Pago a 60 días. EPIs y seguros incluidos.',
      notas: 'Oferta verano: 5 peones para Patraix',
      lineas: {
        create: [
          { descripcion: 'Peón — 5 personas × 160 h/mes × 3 meses', categoria: 'PEON', cantidad: 2400, precioUnitario: 19, costeUnitario: 15.1 },
        ],
      },
    },
  });

  console.log('→ Escenario de ejemplo del simulador...');
  await prisma.escenario.create({
    data: {
      nombre: '5 peones con Giticsa (verano, cobro a 60 días)',
      datosJson: JSON.stringify({
        saldoInicial: 12000,
        bloques: [
          {
            nombre: '5 peones Giticsa',
            categoria: 'PEON',
            numTrabajadores: 5,
            costeMensualPorTrabajador: 1976,
            precioVentaHora: 19,
            horasDia: 8,
            diasSemana: 5,
            fechaInicio: dias(20).toISOString().slice(0, 10),
            fechaFin: dias(110).toISOString().slice(0, 10),
            plazoCobroDias: 60,
            modoObraCorta: true,
          },
        ],
      }),
    },
  });

  console.log('✔ Datos de ejemplo cargados. Usuarios: socio1 / socio2 — contraseña: valencia2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
