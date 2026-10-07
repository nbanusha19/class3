import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "../reports/schema";
import type { Field, Report, Section } from "../reports/types";
import {
  f7LineDisplay,
  f7RowLines,
  f7UsesYImage,
  f7VisibleCharRows,
  withDerivedF7Rows,
} from "../reports/f7-logic";
import { themeById } from "./themes";
import type { PdfRgb, PdfTheme, PdfThemeId } from "./types";

export type ThemedSource = {
  getField: (reportId: string, field: any) => string;
  getRows: (reportId: string, tableKey: string) => Record<string, string>[];
  f7Images?: Record<string, string>;
};

const MARGIN = 10;
const FOOTER = 12;

const fmt = (value: string) => {
  const token = String(value || "").trim();
  if (!token || token === "—" || token === "-" || token === "–") return "";
  return token;
};

function fontOf(doc: jsPDF) {
  try {
    doc.setFont("DejaVuSans", "normal");
    return "DejaVuSans";
  } catch {
    return "helvetica";
  }
}

function rgb(doc: jsPDF, color: PdfRgb, kind: "fill" | "draw" | "text") {
  if (kind === "fill") doc.setFillColor(...color);
  else if (kind === "draw") doc.setDrawColor(...color);
  else doc.setTextColor(...color);
}

function pageW(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

function pageH(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

function contentBottom(doc: jsPDF) {
  return pageH(doc) - FOOTER - 2;
}

function innerW(doc: jsPDF) {
  return pageW(doc) - MARGIN * 2;
}

function fillPage(doc: jsPDF, theme: PdfTheme) {
  rgb(doc, theme.pageBg, "fill");
  doc.rect(0, 0, pageW(doc), pageH(doc), "F");
}

function headerHeight(theme: PdfTheme, report: Report) {
  if (theme.headerStyle === "darkbar") return report.id === "f1" ? 46 : 40;
  return report.id === "f1" ? 44 : 38;
}

function drawModernHeader(doc: jsPDF, report: Report, src: ThemedSource, theme: PdfTheme, logo: string | null, nadcap: string | null) {
  const w = pageW(doc);
  const h = headerHeight(theme, report);
  rgb(doc, theme.headerBg, "fill");
  doc.rect(0, 0, w, h, "F");
  rgb(doc, theme.headerBg2, "fill");
  doc.rect(w * 0.55, 0, w * 0.45, h, "F");
  rgb(doc, theme.accentSoft, "fill");
  doc.rect(0, h - 2.2, w, 2.2, "F");

  if (logo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(MARGIN, 6, 12, 12, 2.4, 2.4, "F");
      doc.addImage(logo, "PNG", MARGIN + 1.2, 7.2, 9.6, 9.6);
    } catch {
      /* skip */
    }
  }
  const font = fontOf(doc);
  rgb(doc, theme.headerText, "text");
  doc.setFont(font, "bold");
  doc.setFontSize(11);
  doc.text(COMPANY.name, MARGIN + 16, 11);
  doc.setFont(font, "normal");
  doc.setFontSize(7.2);
  rgb(doc, theme.headerMuted, "text");
  doc.text(COMPANY.tagline, MARGIN + 16, 16.2);

  doc.setFont(font, "bold");
  doc.setFontSize(report.title.length > 40 ? 13 : 15);
  rgb(doc, theme.headerText, "text");
  doc.text(report.title, MARGIN, 26.5);

  const coc = fmt(src.getField(report.id, { key: "cocNumber", label: "COC Number", shared: "cocNumber" }));
  const chips = [report.code, report.rev, coc ? `COC ${coc}` : ""].filter(Boolean);
  let chipX = MARGIN;
  chips.forEach((chip) => {
    doc.setFont(font, "bold");
    doc.setFontSize(6.6);
    const tw = doc.getTextWidth(chip) + 6;
    rgb(doc, theme.accentSoft, "fill");
    doc.roundedRect(chipX, 30.5, tw, 6.2, 1.6, 1.6, "F");
    rgb(doc, theme.ink, "text");
    doc.text(chip, chipX + 3, 34.7);
    chipX += tw + 2.2;
  });

  if (report.id === "f1" && nadcap) {
    try {
      const props = doc.getImageProperties(nadcap);
      const nw = 26;
      const nh = nw * (props.height / props.width);
      doc.addImage(nadcap, "PNG", w - MARGIN - nw, 8, nw, nh);
    } catch {
      /* skip */
    }
  }
  return h + 6;
}

function drawExecutiveHeader(doc: jsPDF, report: Report, src: ThemedSource, theme: PdfTheme, logo: string | null) {
  const w = pageW(doc);
  const h = headerHeight(theme, report);
  rgb(doc, theme.headerBg, "fill");
  doc.rect(0, 0, w, h, "F");
  rgb(doc, theme.accent, "fill");
  doc.rect(0, 0, 3.2, h, "F");
  rgb(doc, theme.headerBg2, "fill");
  doc.rect(0, h - 1.4, w, 1.4, "F");

  const font = fontOf(doc);
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGIN + 2, 7, 10, 10);
    } catch {
      /* skip */
    }
  }
  rgb(doc, theme.headerMuted, "text");
  doc.setFont(font, "bold");
  doc.setFontSize(8);
  doc.text(COMPANY.name, MARGIN + 15, 11);

  rgb(doc, theme.headerText, "text");
  doc.setFont(font, "bold");
  doc.setFontSize(report.title.length > 42 ? 12.5 : 14.5);
  doc.text(report.title.toUpperCase(), MARGIN + 15, 20.5);

  doc.setFont(font, "normal");
  doc.setFontSize(8);
  rgb(doc, theme.headerMuted, "text");
  const coc = fmt(src.getField(report.id, { key: "cocNumber", label: "COC Number", shared: "cocNumber" }));
  const meta = [report.code, report.rev, coc ? `REPORT ${coc}` : ""].filter(Boolean).join("    ·    ");
  doc.text(meta, MARGIN + 15, 28);

  rgb(doc, theme.accent, "draw");
  doc.setLineWidth(0.35);
  doc.line(MARGIN + 15, 32, w - MARGIN, 32);

  doc.setFontSize(7);
  rgb(doc, theme.headerMuted, "text");
  doc.text(`${COMPANY.address} ${COMPANY.website}`, MARGIN + 15, h - 6);
  return h + 7;
}

function drawHeader(
  doc: jsPDF,
  report: Report,
  src: ThemedSource,
  theme: PdfTheme,
  logo: string | null,
  nadcap: string | null,
) {
  fillPage(doc, theme);
  return theme.headerStyle === "darkbar"
    ? drawExecutiveHeader(doc, report, src, theme, logo)
    : drawModernHeader(doc, report, src, theme, logo, nadcap);
}

function drawThemedFooter(doc: jsPDF, report: Report, theme: PdfTheme, from: number, to: number, total: number) {
  const font = fontOf(doc);
  for (let i = from; i <= to; i++) {
    doc.setPage(i);
    const w = pageW(doc);
    const h = pageH(doc);
    rgb(doc, theme.footerLine, "draw");
    doc.setLineWidth(0.35);
    doc.line(MARGIN, h - 9, w - MARGIN, h - 9);
    doc.setFont(font, "normal");
    doc.setFontSize(7);
    rgb(doc, theme.muted, "text");
    doc.text(`${report.code}  ·  ${report.rev}`, MARGIN, h - 5);
    doc.text(`Page ${i} of ${total}`, w - MARGIN, h - 5, { align: "right" });
  }
}

function newPage(
  doc: jsPDF,
  report: Report,
  src: ThemedSource,
  theme: PdfTheme,
  logo: string | null,
  nadcap: string | null,
) {
  doc.addPage("a4", pageW(doc) > pageH(doc) ? "landscape" : "portrait");
  return drawHeader(doc, report, src, theme, logo, nadcap);
}

function needSpace(
  doc: jsPDF,
  y: number,
  need: number,
  report: Report,
  src: ThemedSource,
  theme: PdfTheme,
  logo: string | null,
  nadcap: string | null,
) {
  if (y + need <= contentBottom(doc)) return y;
  return newPage(doc, report, src, theme, logo, nadcap);
}

function drawSectionTitle(
  doc: jsPDF,
  title: string,
  y: number,
  theme: PdfTheme,
  index: number,
  report: Report,
  src: ThemedSource,
  logo: string | null,
  nadcap: string | null,
) {
  y = needSpace(doc, y, 16, report, src, theme, logo, nadcap);
  const font = fontOf(doc);
  const w = innerW(doc);
  const label = String(title || "")
    .replace(/^\s*0+[\s.)-]+/, "")
    .trim()
    .toUpperCase();
  if (theme.rounded) {
    rgb(doc, theme.accent, "fill");
    doc.roundedRect(MARGIN, y + 0.4, 1.8, 5.2, 0.55, 0.55, "F");
    rgb(doc, theme.ink, "text");
    doc.setFont(font, "bold");
    doc.setFontSize(9.5);
    doc.text(label, MARGIN + 4.6, y + 4.4);
    return y + 12;
  }
  rgb(doc, theme.accent, "fill");
  doc.rect(MARGIN, y + 0.4, 1.8, 5.2, "F");
  rgb(doc, theme.ink, "text");
  doc.setFont(font, "bold");
  doc.setFontSize(10);
  doc.text(label, MARGIN + 4.6, y + 4.6);
  rgb(doc, theme.accentSoft, "draw");
  doc.setLineWidth(0.25);
  doc.line(MARGIN + 4.6, y + 7.2, MARGIN + w, y + 7.2);
  return y + 13;
}

function isBlankSpec(value: string) {
  const token = String(value || "").trim();
  return !token || /^(n\/?a|na|nil|-|—|–)$/i.test(token);
}

function combinedSpec(spec: string, regulatory: string) {
  return [spec, regulatory].map((item) => String(item || "").trim()).filter((item) => !isBlankSpec(item)).join(" & ");
}

function drawLinked(doc: jsPDF, x: number, y: number, theme: PdfTheme) {
  const font = fontOf(doc);
  doc.setFont(font, "bold");
  doc.setFontSize(5.4);
  const label = "LINKED";
  const tw = doc.getTextWidth(label) + 3.2;
  rgb(doc, theme.accentSoft, "fill");
  if (theme.rounded) doc.roundedRect(x, y - 3.1, tw, 4.2, 1, 1, "F");
  else doc.rect(x, y - 3.1, tw, 4.2, "F");
  rgb(doc, theme.accent, "text");
  doc.text(label, x + 1.6, y);
  return tw;
}

function collectFields(section: Extract<Section, { kind: "fields" }>, report: Report, src: ThemedSource) {
  const items: { label: string; value: string; linked: boolean; wide: boolean }[] = [];
  for (const field of section.fields) {
    if (field.key === "regulatoryRequirement" || field.shared === "regulatoryRequirement") continue;
    if (field.key === "specification" || field.shared === "specification") {
      const regulatory =
        src.getField(report.id, {
          key: "regulatoryRequirement",
          label: "Regulatory Requirement",
          shared: "regulatoryRequirement",
        }) ||
        src.getField("f1", {
          key: "regulatoryRequirement",
          label: "Regulatory Requirement",
          shared: "regulatoryRequirement",
        });
      items.push({
        label: "Specification",
        value: fmt(combinedSpec(src.getField(report.id, field), regulatory)),
        linked: Boolean(field.shared),
        wide: true,
      });
      continue;
    }
    items.push({
      label: field.label,
      value: fmt(src.getField(report.id, field)),
      linked: Boolean(field.shared),
      wide: Boolean(field.span && field.span > 1) || field.type === "textarea",
    });
  }
  return items;
}

function drawFields(
  doc: jsPDF,
  report: Report,
  section: Extract<Section, { kind: "fields" }>,
  src: ThemedSource,
  theme: PdfTheme,
  y: number,
  index: number,
  logo: string | null,
  nadcap: string | null,
) {
  if (section.title) y = drawSectionTitle(doc, section.title, y, theme, index, report, src, logo, nadcap);
  const items = collectFields(section, report, src);
  const font = fontOf(doc);
  const w = innerW(doc);
  const colW = (w - 3) / 2;
  let col = 0;
  let rowY = y;

  const drawBox = (item: (typeof items)[0], x: number, boxW: number, yy: number) => {
    const lines = doc.splitTextToSize(item.value || "—", boxW - 6);
    const h = Math.max(12, 8 + lines.length * 4.2);
    rgb(doc, theme.cardBg, "fill");
    rgb(doc, theme.cardBorder, "draw");
    doc.setLineWidth(0.2);
    if (theme.rounded) doc.roundedRect(x, yy, boxW, h, 1.8, 1.8, "FD");
    else doc.rect(x, yy, boxW, h, "FD");
    rgb(doc, theme.label, "text");
    doc.setFont(font, "bold");
    doc.setFontSize(6.4);
    doc.text(item.label.toUpperCase(), x + 2.4, yy + 3.8);
    if (item.linked) drawLinked(doc, x + boxW - 16, yy + 3.8, theme);
    rgb(doc, theme.ink, "text");
    doc.setFont(font, "normal");
    doc.setFontSize(9.4);
    doc.text(lines, x + 2.4, yy + 8.6);
    return h;
  };

  items.forEach((item) => {
    const wide = item.wide || col === 0 && items.length === 1;
    if (wide && col === 1) {
      col = 0;
      y = rowY + 2.2;
    }
    y = needSpace(doc, y, 16, report, src, theme, logo, nadcap);
    if (wide) {
      const h = drawBox(item, MARGIN, w, y);
      y += h + 2.2;
      col = 0;
      rowY = y;
      return;
    }
    const x = col === 0 ? MARGIN : MARGIN + colW + 3;
    const h = drawBox(item, x, colW, y);
    if (col === 0) {
      rowY = y + h;
      col = 1;
    } else {
      y = Math.max(rowY, y + h) + 2.2;
      col = 0;
      rowY = y;
    }
  });
  if (col === 1) y = rowY + 2.2;
  return y + 2;
}

function drawTable(
  doc: jsPDF,
  report: Report,
  section: Extract<Section, { kind: "table" }>,
  src: ThemedSource,
  theme: PdfTheme,
  y: number,
  index: number,
  logo: string | null,
  nadcap: string | null,
) {
  if (section.title) y = drawSectionTitle(doc, section.title, y, theme, index, report, src, logo, nadcap);
  y = needSpace(doc, y, 22, report, src, theme, logo, nadcap);
  const rows = src.getRows(report.id, section.key);
  const head = [section.columns.map((col) => col.label.toUpperCase())];
  const body = (rows.length ? rows : [{}]).map((row) => section.columns.map((col) => fmt(row[col.key] || "") || "—"));
  const font = fontOf(doc);
  const startPage = doc.getNumberOfPages();
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: headerHeight(theme, report) + 4, bottom: FOOTER },
    tableWidth: innerW(doc),
    theme: "grid",
    head,
    body,
    styles: {
      font,
      fontSize: 8.4,
      textColor: theme.ink,
      lineColor: theme.tableLine,
      lineWidth: 0.16,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.8, right: 1.8 },
      valign: "middle",
    },
    headStyles: {
      font,
      fillColor: theme.tableHead,
      textColor: theme.tableHeadText,
      fontStyle: "bold",
      fontSize: 7.4,
      halign: "center",
    },
    didDrawPage: (data: any) => {
      if (doc.getNumberOfPages() === startPage && data.pageNumber === 1) return;
      drawHeader(doc, report, src, theme, logo, nadcap);
    },
  });
  return ((doc as any).lastAutoTable?.finalY || y) + 5;
}

function drawNote(
  doc: jsPDF,
  report: Report,
  section: Extract<Section, { kind: "note" }>,
  src: ThemedSource,
  theme: PdfTheme,
  y: number,
  index: number,
  logo: string | null,
  nadcap: string | null,
) {
  if (section.title) y = drawSectionTitle(doc, section.title, y, theme, index, report, src, logo, nadcap);
  const font = fontOf(doc);
  const w = innerW(doc);
  const paragraphs = String(section.text || "")
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  doc.setFont(font, "normal");
  doc.setFontSize(9);
  const lines = paragraphs.flatMap((para, i) => {
    const wrapped = doc.splitTextToSize(para, w - 8) as string[];
    return i < paragraphs.length - 1 ? [...wrapped, ""] : wrapped;
  });
  const h = Math.max(18, lines.length * 4.4 + 8);
  y = needSpace(doc, y, Math.min(h, 40), report, src, theme, logo, nadcap);
  rgb(doc, theme.accentSoft, "fill");
  rgb(doc, theme.cardBorder, "draw");
  doc.setLineWidth(0.2);
  if (theme.rounded) doc.roundedRect(MARGIN, y, w, h, 2.4, 2.4, "FD");
  else doc.rect(MARGIN, y, w, h, "FD");
  rgb(doc, theme.ink, "text");
  doc.setFont(font, "normal");
  doc.setFontSize(9);
  doc.text(lines, MARGIN + 4, y + 6);
  return y + h + 5;
}

function drawSignoff(
  doc: jsPDF,
  report: Report,
  section: Extract<Section, { kind: "signoff" }>,
  src: ThemedSource,
  theme: PdfTheme,
  y: number,
  index: number,
  logo: string | null,
  nadcap: string | null,
) {
  if (section.title) y = drawSectionTitle(doc, section.title, y, theme, index, report, src, logo, nadcap);
  const columns = section.columns?.length ? section.columns : [{ title: "", fields: section.fields ?? [] }];
  const w = innerW(doc);
  const colW = (w - (columns.length - 1) * 3) / columns.length;
  const rows = Math.max(...columns.map((col) => col.fields.length), 1);
  const h = 10 + rows * 12;
  y = needSpace(doc, y, h + 4, report, src, theme, logo, nadcap);
  const font = fontOf(doc);
  columns.forEach((col, i) => {
    const x = MARGIN + i * (colW + 3);
    rgb(doc, theme.cardBg, "fill");
    rgb(doc, theme.cardBorder, "draw");
    doc.setLineWidth(0.2);
    if (theme.rounded) doc.roundedRect(x, y, colW, h, 2, 2, "FD");
    else doc.rect(x, y, colW, h, "FD");
    if (col.title) {
      rgb(doc, theme.accent, "text");
      doc.setFont(font, "bold");
      doc.setFontSize(8);
      doc.text(col.title.toUpperCase(), x + 3, y + 5.4);
    }
    col.fields.forEach((field: Field, fi) => {
      const yy = y + (col.title ? 10 : 5) + fi * 12;
      rgb(doc, theme.label, "text");
      doc.setFont(font, "bold");
      doc.setFontSize(6.2);
      doc.text(field.label.toUpperCase(), x + 3, yy);
      rgb(doc, theme.ink, "text");
      doc.setFont(font, "normal");
      doc.setFontSize(9);
      doc.text(fmt(src.getField(report.id, field)) || " ", x + 3, yy + 4.6);
      rgb(doc, theme.tableLine, "draw");
      doc.setLineWidth(0.2);
      doc.line(x + 3, yy + 5.8, x + colW - 3, yy + 5.8);
    });
  });
  return y + h + 5;
}

function drawThemedF7(
  doc: jsPDF,
  report: Report,
  src: ThemedSource,
  theme: PdfTheme,
  logo: string | null,
  nadcap: string | null,
  y: number,
) {
  const layers = src.getField("f1", { key: "layers", label: "layers", shared: "layers" }) || "";
  const viaProtection = src.getField("f1", { key: "viaProtection", label: "viaProtection", shared: "viaProtection" }) || "";
  const pcbType = src.getField("f1", { key: "pcbType", label: "pcbType" }) || "";
  const specification = src.getField("f1", { key: "specification", label: "specification", shared: "specification" }) || "";
  const regulatory = src.getField("f1", { key: "regulatoryRequirement", label: "regulatoryRequirement", shared: "regulatoryRequirement" }) || "";
  const rows = f7VisibleCharRows(withDerivedF7Rows(src.getRows("f7", "characteristics"), specification, regulatory, layers), layers, viaProtection, pcbType);
  const font = fontOf(doc);
  rows.forEach((row, index) => {
    if (index > 0) y = newPage(doc, report, src, theme, logo, nadcap);
    y = drawSectionTitle(doc, `${row.sl}. ${row.characteristic}`, y, theme, index + 1, report, src, logo, nadcap);
    const w = innerW(doc);
    const imgH = 62;
    const showY = f7UsesYImage(row.sl || "", layers);
    const gap = 3;
    const imgW = showY ? (w - gap) / 2 : w;
    const drawImg = (x: number, key: string, label: string) => {
      rgb(doc, theme.cardBg, "fill");
      rgb(doc, theme.cardBorder, "draw");
      if (theme.rounded) doc.roundedRect(x, y, imgW, imgH, 2, 2, "FD");
      else doc.rect(x, y, imgW, imgH, "FD");
      rgb(doc, theme.label, "text");
      doc.setFont(font, "bold");
      doc.setFontSize(7);
      doc.text(label, x + 3, y + 5);
      const dataUrl = src.f7Images?.[key];
      if (dataUrl) {
        try {
          const fmtType = /image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
          doc.addImage(dataUrl, fmtType, x + 3, y + 8, imgW - 6, imgH - 12);
        } catch {
          /* skip */
        }
      } else {
        rgb(doc, theme.muted, "text");
        doc.setFont(font, "normal");
        doc.setFontSize(9);
        doc.text("No image", x + imgW / 2, y + imgH / 2, { align: "center" });
      }
    };
    drawImg(MARGIN, `${row.sl || index}-x`, showY ? "X-DIRECTION" : "MICROSECTION IMAGE");
    if (showY) drawImg(MARGIN + imgW + gap, `${row.sl || index}-y`, "Y-DIRECTION");
    y += imgH + 5;
    const lines = f7RowLines(row);
    const body = lines.map((line) => {
      const display = f7LineDisplay(line);
      return [fmt(display.layer), fmt(display.requirement), fmt(line.measuredX), fmt(line.measuredY), fmt(line.result), fmt(line.remarks)];
    });
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: headerHeight(theme, report) + 4, bottom: FOOTER },
      tableWidth: w,
      theme: "grid",
      head: [["LAYER", "REQUIREMENT", "X", "Y", "RESULT", "REMARKS"]],
      body: body.length ? body : [["—", "—", "—", "—", "—", "—"]],
      styles: {
        font,
        fontSize: 8.2,
        textColor: theme.ink,
        lineColor: theme.tableLine,
        cellPadding: 1.4,
      },
      headStyles: { font, fillColor: theme.tableHead, textColor: theme.tableHeadText, fontStyle: "bold", fontSize: 7.2 },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 4;
  });
  return y;
}

export function renderThemedReport(
  doc: jsPDF,
  report: Report,
  src: ThemedSource,
  themeId: PdfThemeId,
  logo: string | null,
  nadcap: string | null,
) {
  const theme = themeById(themeId);
  let y = drawHeader(doc, report, src, theme, logo, nadcap);
  let sectionNo = 1;
  for (const section of report.sections as Section[]) {
    if (section.kind === "fields" && section.title === "Order Lookup") continue;
    if (report.id === "f7" && section.kind === "table" && section.key === "characteristics") {
      y = drawThemedF7(doc, report, src, theme, logo, nadcap, y);
      continue;
    }
    if (section.kind === "fields") y = drawFields(doc, report, section, src, theme, y, sectionNo++, logo, nadcap);
    else if (section.kind === "table") y = drawTable(doc, report, section, src, theme, y, sectionNo++, logo, nadcap);
    else if (section.kind === "note") y = drawNote(doc, report, section, src, theme, y, sectionNo++, logo, nadcap);
    else y = drawSignoff(doc, report, section, src, theme, y, sectionNo++, logo, nadcap);
  }
  drawThemedFooter(doc, report, theme, 1, doc.getNumberOfPages(), doc.getNumberOfPages());
}

export function renderThemedPack(
  doc: jsPDF,
  reports: Report[],
  src: ThemedSource,
  themeId: PdfThemeId,
  logo: string | null,
  nadcap: string | null,
  landscapeOf: (report: Report) => boolean,
) {
  const ranges: { report: Report; from: number; to: number }[] = [];
  reports.forEach((report, i) => {
    const landscape = landscapeOf(report);
    if (i === 0) {
      if (landscape) {
        doc.addPage("a4", "landscape");
        doc.deletePage(1);
      }
    } else {
      doc.addPage("a4", landscape ? "landscape" : "portrait");
    }
    const from = doc.getNumberOfPages();
    const theme = themeById(themeId);
    let y = drawHeader(doc, report, src, theme, logo, nadcap);
    let sectionNo = 1;
    for (const section of report.sections as Section[]) {
      if (section.kind === "fields" && section.title === "Order Lookup") continue;
      if (report.id === "f7" && section.kind === "table" && section.key === "characteristics") {
        y = drawThemedF7(doc, report, src, theme, logo, nadcap, y);
        continue;
      }
      if (section.kind === "fields") y = drawFields(doc, report, section, src, theme, y, sectionNo++, logo, nadcap);
      else if (section.kind === "table") y = drawTable(doc, report, section, src, theme, y, sectionNo++, logo, nadcap);
      else if (section.kind === "note") y = drawNote(doc, report, section, src, theme, y, sectionNo++, logo, nadcap);
      else y = drawSignoff(doc, report, section, src, theme, y, sectionNo++, logo, nadcap);
    }
    ranges.push({ report, from, to: doc.getNumberOfPages() });
  });
  const total = doc.getNumberOfPages();
  ranges.forEach(({ report, from, to }) => drawThemedFooter(doc, report, themeById(themeId), from, to, total));
}
