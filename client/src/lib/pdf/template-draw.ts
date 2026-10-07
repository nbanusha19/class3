import type { jsPDF } from "jspdf";
import type { PdfRgb, PdfTemplateId, PdfTheme } from "./types";
import { themeById } from "./themes";

export type KvItem = {
  label: string;
  value: string;
  span?: 1 | 2;
  linked?: boolean;
};

const SLATE_50: PdfRgb = [248, 250, 252];
const SLATE_100: PdfRgb = [241, 245, 249];
const SLATE_200: PdfRgb = [226, 232, 240];
const SLATE_300: PdfRgb = [203, 213, 225];
const SLATE_400: PdfRgb = [148, 163, 184];
const SLATE_600: PdfRgb = [71, 85, 105];
const SLATE_700: PdfRgb = [51, 65, 85];
const SLATE_800: PdfRgb = [30, 41, 59];
const SLATE_900: PdfRgb = [15, 23, 42];
const TEAL_700: PdfRgb = [15, 118, 110];
const TEAL_600: PdfRgb = [13, 148, 136];
const MINT_50: PdfRgb = [240, 253, 250];
const MINT_100: PdfRgb = [204, 251, 241];
const MINT_200: PdfRgb = [153, 246, 228];
const LINK_BG: PdfRgb = [224, 242, 254];
const LINK_FG: PdfRgb = [3, 105, 161];
const EXEC_BLUE: PdfRgb = [37, 99, 235];

function cellText(cell: any): string {
  if (cell == null) return "";
  if (typeof cell === "string" || typeof cell === "number") return String(cell);
  return String(cell.content ?? "");
}

export function identItemsFromBody(body: any[]): KvItem[] {
  const items: KvItem[] = [];
  for (const row of body || []) {
    let i = 0;
    while (i < row.length) {
      const label = cellText(row[i]);
      const next = row[i + 1];
      const value = cellText(next);
      const colSpan = typeof next === "object" && next ? Number(next.colSpan || 1) : 1;
      items.push({ label, value, span: colSpan >= 3 ? 2 : 1 });
      i += 2;
    }
  }
  return items.filter((item) => item.label);
}

export function themeOf(skin: PdfTemplateId): PdfTheme | null {
  return skin === "current" ? null : themeById(skin);
}

function innerWidth(doc: jsPDF, margin: number) {
  return doc.internal.pageSize.getWidth() - margin * 2;
}

export function drawThemedSectionTitle(
  doc: jsPDF,
  skin: PdfTemplateId,
  font: string,
  margin: number,
  title: string,
  subtitle: string | undefined,
  y: number,
) {
  const w = innerWidth(doc, margin);
  const label = title.toUpperCase();
  if (skin === "modern") {
    doc.setFillColor(...TEAL_700);
    doc.roundedRect(margin, y, 1.8, 5.2, 0.55, 0.55, "F");
    doc.setFont(font, "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(...TEAL_700);
    doc.text(label, margin + 4.6, y + 4);
    if (subtitle) {
      doc.setFont(font, "normal");
      doc.setFontSize(7.4);
      doc.setTextColor(...SLATE_600);
      doc.text(subtitle, margin + 4.6, y + 9.2);
      return y + 14;
    }
    return y + 10;
  }

  doc.setFillColor(...EXEC_BLUE);
  doc.rect(margin, y, 1.8, 5.2, "F");
  doc.setFont(font, "bold");
  doc.setFontSize(8.6);
  doc.setTextColor(...SLATE_900);
  doc.text(label, margin + 4.6, y + 4);
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.3);
  doc.line(margin + 4.6, y + (subtitle ? 9.8 : 6.2), margin + w, y + (subtitle ? 9.8 : 6.2));
  if (subtitle) {
    doc.setFont(font, "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...SLATE_600);
    doc.text(subtitle, margin + 4.6, y + 9);
    return y + 14;
  }
  return y + 11;
}

function drawLinkedBadge(doc: jsPDF, font: string, x: number, y: number) {
  const label = "LINKED";
  doc.setFont(font, "bold");
  doc.setFontSize(5.6);
  const tw = doc.getTextWidth(label) + 4.2;
  doc.setFillColor(...LINK_BG);
  doc.roundedRect(x, y - 2.4, tw, 4.4, 0.8, 0.8, "F");
  doc.setTextColor(...LINK_FG);
  doc.text(label, x + 2.1, y + 0.7);
  return tw;
}

function layoutRows(items: KvItem[], cols: number) {
  const rows: KvItem[][] = [];
  let row: KvItem[] = [];
  let used = 0;
  for (const item of items) {
    const span: 1 | 2 = Math.min(item.span || 1, cols) === 2 ? 2 : 1;
    if (used + span > cols) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push({ ...item, span });
    used += span;
    if (used >= cols) {
      rows.push(row);
      row = [];
      used = 0;
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

export function drawKvCard(
  doc: jsPDF,
  skin: PdfTemplateId,
  font: string,
  margin: number,
  y: number,
  title: string,
  items: KvItem[],
  cols = 2,
) {
  if (!items.length && !title) return y;
  const w = innerWidth(doc, margin);
  const rows = layoutRows(items, cols);
  const rowH = 11.6;
  const headH = title ? (skin === "modern" ? 8.4 : 8.8) : 0;
  const pad = 2.4;
  const h = headH + rows.length * rowH + pad * 2;
  const x = margin;

  if (skin === "modern") {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.28);
    doc.roundedRect(x, y, w, h, 1.8, 1.8, "FD");
    if (title) {
      doc.setFillColor(...MINT_50);
      doc.rect(x + 0.15, y + 0.15, w - 0.3, headH, "F");
      doc.setDrawColor(...MINT_200);
      doc.setLineWidth(0.25);
      doc.line(x, y + headH, x + w, y + headH);
      doc.setFont(font, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...TEAL_700);
      doc.text(title.toUpperCase(), x + 4, y + 5.6);
    }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...SLATE_300);
    doc.setLineWidth(0.28);
    doc.rect(x, y, w, h, "FD");
    doc.setFillColor(...SLATE_900);
    doc.rect(x, y, w, 1.8, "F");
    if (title) {
      doc.setFont(font, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...SLATE_900);
      doc.text(title.toUpperCase(), x + 4, y + 7.2);
      doc.setDrawColor(...SLATE_200);
      doc.setLineWidth(0.25);
      doc.line(x, y + headH, x + w, y + headH);
    }
  }

  const gridY = y + headH + pad;
  const colW = (w - pad * 2) / cols;
  rows.forEach((row, ri) => {
    let col = 0;
    row.forEach((item) => {
      const span = item.span || 1;
      const cx = x + pad + col * colW;
      const cy = gridY + ri * rowH;
      const cw = colW * span;
      if (skin === "executive") {
        doc.setDrawColor(...SLATE_100);
        doc.setLineWidth(0.2);
        doc.line(cx + cw, cy - 0.6, cx + cw, cy + rowH - 1.2);
        doc.line(cx, cy + rowH - 1.2, cx + cw, cy + rowH - 1.2);
      }
      doc.setFont(font, "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(...(skin === "modern" ? SLATE_600 : SLATE_600));
      const label = item.label.toUpperCase();
      doc.text(label, cx + 1.4, cy + 3.2);
      if (item.linked) {
        const lw = doc.getTextWidth(label);
        drawLinkedBadge(doc, font, cx + 3 + lw, cy + 2.6);
      }
      doc.setFont(font, "bold");
      doc.setFontSize(9);
      doc.setTextColor(...SLATE_900);
      const value = item.value || " ";
      const lines = doc.splitTextToSize(value, cw - 3) as string[];
      doc.text(lines.slice(0, 2), cx + 1.4, cy + 8.2);
      col += span;
    });
  });

  return y + h + 4.5;
}

export function drawThemedSignoff(
  doc: jsPDF,
  skin: PdfTemplateId,
  font: string,
  margin: number,
  y: number,
  columns: { title: string; fields: { label: string; value: string }[] }[],
) {
  const w = innerWidth(doc, margin);
  const gap = 3;
  const colW = (w - gap * (columns.length - 1)) / Math.max(columns.length, 1);
  const rows = Math.max(...columns.map((c) => c.fields.length), 1);
  const innerH = 10 + rows * 13;
  const h = innerH + (skin === "modern" ? 2 : 3);

  columns.forEach((col, i) => {
    const x = margin + i * (colW + gap);
    if (skin === "modern") {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...TEAL_600);
      doc.setLineWidth(0.35);
      doc.roundedRect(x, y, colW, h, 2, 2, "FD");
      doc.setFillColor(...MINT_50);
      doc.roundedRect(x + 0.3, y + 0.3, colW - 0.6, 7.2, 1.6, 1.6, "F");
      doc.setFont(font, "bold");
      doc.setFontSize(7.4);
      doc.setTextColor(...TEAL_700);
      doc.text((col.title || "SIGN-OFF").toUpperCase(), x + 3.2, y + 5.2);
      let yy = y + 14;
      col.fields.forEach((field) => {
        doc.setFont(font, "bold");
        doc.setFontSize(6.2);
        doc.setTextColor(...SLATE_600);
        doc.text(field.label.toUpperCase(), x + 3.2, yy);
        doc.setFont(font, "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...SLATE_900);
        doc.text(field.value || " ", x + 3.2, yy + 4.4);
        doc.setDrawColor(...MINT_200);
        doc.setLineWidth(0.3);
        doc.line(x + 3.2, yy + 6.2, x + colW - 3.2, yy + 6.2);
        yy += 13;
      });
      return;
    }

    doc.setDrawColor(...SLATE_900);
    doc.setLineWidth(0.7);
    doc.rect(x, y, colW, h);
    doc.setLineWidth(0.25);
    doc.rect(x + 1.1, y + 1.1, colW - 2.2, h - 2.2);
    doc.setFillColor(...SLATE_900);
    doc.rect(x, y, colW, 7.4, "F");
    doc.setFont(font, "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text((col.title || "VERIFICATION").toUpperCase(), x + 3.2, y + 5.1);
    let yy = y + 14.5;
    col.fields.forEach((field) => {
      doc.setFont(font, "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(...SLATE_600);
      doc.text(field.label.toUpperCase(), x + 3.4, yy);
      doc.setFont(font, "bold");
      doc.setFontSize(9.2);
      doc.setTextColor(...SLATE_900);
      doc.text(field.value || " ", x + 3.4, yy + 4.4);
      doc.setDrawColor(...SLATE_300);
      doc.setLineWidth(0.35);
      doc.line(x + 3.4, yy + 6.4, x + colW - 3.4, yy + 6.4);
      yy += 13;
    });
  });

  return y + h + 4;
}

export function applyThemedTableOptions(skin: PdfTemplateId, doc: jsPDF, options: any) {
  if (skin === "current") return options;
  const prevParse = options.didParseCell;
  const prevDraw = options.didDrawCell;

  if (skin === "modern") {
    return {
      ...options,
      theme: "plain",
      styles: {
        fontSize: 8.2,
        textColor: SLATE_900,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.2, right: 2.2 },
        overflow: "linebreak",
        valign: "middle",
        ...(options.styles || {}),
        lineWidth: 0,
        lineColor: SLATE_200,
      },
      headStyles: {
        fontStyle: "bold",
        fontSize: 7.4,
        cellPadding: { top: 2.1, bottom: 2.1, left: 2.2, right: 2.2 },
        ...(options.headStyles || {}),
        fillColor: TEAL_700,
        textColor: [255, 255, 255],
        lineWidth: 0,
      },
      alternateRowStyles: { ...(options.alternateRowStyles || {}), fillColor: SLATE_50 },
      didParseCell: (data: any) => {
        prevParse?.(data);
        if (data.section === "head") {
          data.cell.styles.fillColor = TEAL_700;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.lineWidth = 0;
        } else if (data.section === "body") {
          data.cell.styles.lineWidth = 0;
          if (data.row.index % 2 === 1) data.cell.styles.fillColor = SLATE_50;
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === "head" || data.section === "body") {
          doc.setDrawColor(...(data.section === "head" ? TEAL_600 : SLATE_200));
          doc.setLineWidth(0.22);
          const { x, y, width, height } = data.cell;
          doc.line(x, y + height, x + width, y + height);
        }
        prevDraw?.(data);
      },
    };
  }

  return {
    ...options,
    theme: "grid",
    styles: {
      fontSize: 8,
      textColor: SLATE_900,
      cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
      overflow: "linebreak",
      valign: "middle",
      ...(options.styles || {}),
      lineColor: SLATE_200,
      lineWidth: 0.22,
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 7.4,
      lineWidth: 0.28,
      ...(options.headStyles || {}),
      fillColor: SLATE_800,
      textColor: [255, 255, 255],
      lineColor: SLATE_700,
    },
    alternateRowStyles: { ...(options.alternateRowStyles || {}), fillColor: SLATE_50 },
    didParseCell: (data: any) => {
      prevParse?.(data);
      if (data.section === "head") {
        data.cell.styles.fillColor = SLATE_800;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.lineColor = SLATE_700;
      } else if (data.section === "body") {
        data.cell.styles.lineColor = SLATE_200;
        if (data.row.index % 2 === 1) data.cell.styles.fillColor = SLATE_50;
      }
    },
  };
}

export const THEME_HEADER_H = {
  current: 54,
  modern: 54,
  executive: 58,
} as const;

export { MINT_50, MINT_100, TEAL_600, TEAL_700, SLATE_200, SLATE_400, SLATE_800, SLATE_900, EXEC_BLUE };
