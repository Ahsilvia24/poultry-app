import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type PdfTableSection = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export function downloadMortalityPdf(opts: {
  title: string;
  subtitle?: string;
  sections: PdfTableSection[];
  filename?: string;
}) {
  const doc = new jsPDF();
  let y = 14;

  doc.setFontSize(16);
  doc.text(opts.title, 14, y);
  y += 8;

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(opts.subtitle, 14, y);
    doc.setTextColor(0);
    y += 8;
  }

  for (const section of opts.sections) {
    doc.setFontSize(12);
    doc.text(section.title, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [section.headers],
      body: section.rows.map((r) => r.map((c) => String(c))),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [4, 120, 87] },
      margin: { left: 14, right: 14 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 12;
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  }

  doc.save(opts.filename ?? "mortality-report.pdf");
}
