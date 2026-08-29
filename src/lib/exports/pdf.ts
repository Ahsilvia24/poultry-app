import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type PdfTableSection = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export type PdfBlock =
  | { type: "heading"; text: string }
  | { type: "table"; title?: string; headers: string[]; rows: Array<Array<string | number>> };

function ensurePageSpace(doc: jsPDF, y: number, needed: number) {
  if (y + needed <= 270) return y;
  doc.addPage();
  return 14;
}

export function downloadReportPdf(opts: {
  title: string;
  subtitle?: string;
  filename?: string;
  blocks: PdfBlock[];
}) {
  const doc = new jsPDF();
  let y = 14;

  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(opts.title, 14, y);
  y += 8;

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(opts.subtitle, 14, y);
    doc.setTextColor(0);
    y += 8;
  }

  for (const block of opts.blocks) {
    if (block.type === "heading") {
      y = ensurePageSpace(doc, y, 14);
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(block.text, 14, y);
      y += 8;
      continue;
    }

    if (block.title) {
      y = ensurePageSpace(doc, y, 12);
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(block.title, 14, y);
      y += 4;
    }

    autoTable(doc, {
      startY: y,
      head: [block.headers],
      body: block.rows.map((r) => r.map((c) => String(c))),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [4, 120, 87] },
      margin: { left: 14, right: 14 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  }

  doc.save(opts.filename ?? "report.pdf");
}

export function downloadMortalityPdf(opts: {
  title: string;
  subtitle?: string;
  sections: PdfTableSection[];
  filename?: string;
}) {
  downloadReportPdf({
    title: opts.title,
    subtitle: opts.subtitle,
    filename: opts.filename ?? "mortality-report.pdf",
    blocks: opts.sections.map((section) => ({
      type: "table" as const,
      title: section.title,
      headers: section.headers,
      rows: section.rows,
    })),
  });
}
