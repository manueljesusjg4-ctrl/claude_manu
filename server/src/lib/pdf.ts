// Generación de PDF formal de partes de horas, para adjuntar a facturas o
// enviar a la constructora/promotora como justificante del trabajo realizado.
import PDFDocument from 'pdfkit';

interface ParteConTrabajador {
  fecha: Date;
  horas: number;
  validado: boolean;
  trabajador: { nombre: string; apellidos: string; categoria: string };
}

interface ObraInfo {
  nombre: string;
  direccion: string | null;
  cliente: { nombre: string };
}

const fechaEs = (d: Date) => d.toLocaleDateString('es-ES');
const etiqueta = (s: string) => s.replace(/_/g, ' ');

export function generarPdfPartes(obra: ObraInfo, partes: ParteConTrabajador[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Parte de horas trabajadas', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#444');
    doc.text(`Obra: ${obra.nombre}`);
    if (obra.direccion) doc.text(`Dirección: ${obra.direccion}`);
    doc.text(`Cliente: ${obra.cliente.nombre}`);
    doc.text(`Fecha del documento: ${fechaEs(new Date())}`);
    doc.moveDown(1);
    doc.fillColor('#000');

    // Cabecera de tabla
    const colX = [50, 130, 320, 420, 490];
    const fila = (y: number, fecha: string, trab: string, cat: string, horas: string, val: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5);
      doc.text(fecha, colX[0], y, { width: colX[1] - colX[0] });
      doc.text(trab, colX[1], y, { width: colX[2] - colX[1] });
      doc.text(cat, colX[2], y, { width: colX[3] - colX[2] });
      doc.text(horas, colX[3], y, { width: colX[4] - colX[3] });
      doc.text(val, colX[4], y, { width: 60 });
    };

    let y = doc.y;
    fila(y, 'Fecha', 'Trabajador', 'Categoría', 'Horas', 'Validado', true);
    y += 16;
    doc.moveTo(50, y - 4).lineTo(545, y - 4).strokeColor('#ccc').stroke();

    let total = 0;
    for (const p of partes) {
      if (y > 760) { doc.addPage(); y = 50; }
      fila(
        y,
        fechaEs(p.fecha),
        `${p.trabajador.nombre} ${p.trabajador.apellidos}`,
        etiqueta(p.trabajador.categoria),
        p.horas.toFixed(2),
        p.validado ? 'Sí' : 'No'
      );
      total += p.horas;
      y += 15;
    }

    y += 10;
    doc.moveTo(50, y - 4).lineTo(545, y - 4).strokeColor('#ccc').stroke();
    doc.font('Helvetica-Bold').fontSize(11).text(`Total horas: ${total.toFixed(2)} h`, 50, y + 4);

    doc.end();
  });
}
