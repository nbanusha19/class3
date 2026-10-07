import type { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PdfTemplateId } from "../pdf/types";
import { COMPANY } from "./schema";
import type { Report, Section } from "./types";
import { f7LineDisplay, f7ReportNumber, f7RowLines, f7UsesLayer, f7UsesSide, f7UsesYImage, f7VisibleCharRows, withDerivedF7Rows, type F7MeasureLine } from "./f7-logic";

/** Presentation-only F7 PDF source. Same data as the web form; no business logic. */
export type F7PdfSource = {
  getField: (reportId: string, field: any) => string;
  getRows: (reportId: string, tableKey: string) => Record<string, string>[];
  f7Images?: Record<string, string>;
};

const STOCK_ACCENT: [number, number, number] = [59, 111, 160];
const STOCK_ACCENT_DARK: [number, number, number] = [36, 72, 112];
const STOCK_LIGHT: [number, number, number] = [232, 237, 243];
const STOCK_LINE: [number, number, number] = [176, 184, 196];
const STOCK_INK: [number, number, number] = [28, 35, 48];
const STOCK_MUTED: [number, number, number] = [70, 80, 96];
let ACCENT: [number, number, number] = STOCK_ACCENT;
let ACCENT_DARK: [number, number, number] = STOCK_ACCENT_DARK;
let LIGHT: [number, number, number] = STOCK_LIGHT;
let LINE: [number, number, number] = STOCK_LINE;
let INK: [number, number, number] = STOCK_INK;
let MUTED: [number, number, number] = STOCK_MUTED;
const FAIL: [number, number, number] = [178, 38, 38];
const MARGIN = 6;

type RGB = [number, number, number];
let f7Skin: PdfTemplateId = "current";
let PAGE_BG: RGB | null = null;
let IMAGE_BG: RGB = [252, 253, 254];
let IMAGE_BORDER: RGB = STOCK_LINE;
let IMAGE_TEXT: RGB = STOCK_ACCENT_DARK;
let BADGE_ETCH_BG: RGB = STOCK_ACCENT_DARK;
let BADGE_ETCH_TEXT: RGB = [255, 255, 255];
let BADGE_PASS_BG: RGB = [255, 255, 255];
let BADGE_PASS_TEXT: RGB = [255, 255, 255];
let TABLE_HEAD: RGB = STOCK_LIGHT;
let TABLE_HEAD_TEXT: RGB = STOCK_ACCENT_DARK;
let TABLE_ZEBRA: RGB | null = null;
let HEADER_BG: RGB | null = null;
let HEADER_BG2: RGB | null = null;
let HEADER_TEXT: RGB = STOCK_ACCENT;
let HEADER_MUTED: RGB = STOCK_INK;

function applyF7Skin(template: PdfTemplateId) {
  f7Skin = template;
  if (template === "modern") {
    ACCENT = [15, 118, 110];
    ACCENT_DARK = [13, 148, 136];
    LIGHT = [240, 253, 250];
    LINE = [153, 246, 228];
    INK = [15, 46, 41];
    MUTED = [13, 148, 136];
    PAGE_BG = [247, 252, 250];
    IMAGE_BG = [240, 253, 250];
    IMAGE_BORDER = [204, 251, 241];
    IMAGE_TEXT = [13, 148, 136];
    BADGE_ETCH_BG = [240, 253, 244];
    BADGE_ETCH_TEXT = [22, 101, 52];
    BADGE_PASS_BG = [15, 118, 110];
    BADGE_PASS_TEXT = [255, 255, 255];
    TABLE_HEAD = [15, 118, 110];
    TABLE_HEAD_TEXT = [255, 255, 255];
    TABLE_ZEBRA = [240, 253, 250];
    HEADER_BG = [13, 148, 136];
    HEADER_BG2 = [5, 150, 105];
    HEADER_TEXT = [255, 255, 255];
    HEADER_MUTED = [204, 251, 241];
    return;
  }
  if (template === "executive") {
    ACCENT = [15, 23, 42];
    ACCENT_DARK = [30, 41, 71];
    LIGHT = [241, 245, 249];
    LINE = [226, 232, 240];
    INK = [15, 23, 42];
    MUTED = [71, 85, 105];
    PAGE_BG = [248, 250, 252];
    IMAGE_BG = [248, 250, 252];
    IMAGE_BORDER = [203, 213, 225];
    IMAGE_TEXT = [71, 85, 105];
    BADGE_ETCH_BG = [241, 245, 249];
    BADGE_ETCH_TEXT = [51, 65, 85];
    BADGE_PASS_BG = [15, 23, 42];
    BADGE_PASS_TEXT = [56, 189, 248];
    TABLE_HEAD = [15, 23, 42];
    TABLE_HEAD_TEXT = [255, 255, 255];
    TABLE_ZEBRA = null;
    HEADER_BG = [15, 23, 42];
    HEADER_BG2 = [30, 27, 75];
    HEADER_TEXT = [248, 250, 252];
    HEADER_MUTED = [165, 180, 214];
    return;
  }
  ACCENT = STOCK_ACCENT;
  ACCENT_DARK = STOCK_ACCENT_DARK;
  LIGHT = STOCK_LIGHT;
  LINE = STOCK_LINE;
  INK = STOCK_INK;
  MUTED = STOCK_MUTED;
  PAGE_BG = null;
  IMAGE_BG = [252, 253, 254];
  IMAGE_BORDER = STOCK_LINE;
  IMAGE_TEXT = STOCK_ACCENT_DARK;
  BADGE_ETCH_BG = STOCK_ACCENT_DARK;
  BADGE_ETCH_TEXT = [255, 255, 255];
  BADGE_PASS_BG = [255, 255, 255];
  BADGE_PASS_TEXT = [255, 255, 255];
  TABLE_HEAD = STOCK_LIGHT;
  TABLE_HEAD_TEXT = STOCK_ACCENT_DARK;
  TABLE_ZEBRA = null;
  HEADER_BG = null;
  HEADER_BG2 = null;
  HEADER_TEXT = STOCK_ACCENT;
  HEADER_MUTED = STOCK_INK;
}

function paintF7Page(doc: jsPDF) {
  if (!PAGE_BG) return;
  doc.setFillColor(...PAGE_BG);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F");
}

function fontOf(doc: jsPDF) {
  return doc.getFont()?.fontName || "helvetica";
}

function f7Plain(value: string) {
  return String(value || "")
    .replace(/[—–]/g, "-")
    .replace(/[µμ]/g, "u")
    .trim();
}

function fmt(value: string) {
  const token = f7Plain(value);
  if (!token || token === "-" || token === "—") return "";
  return token;
}

function formatDisplayDate(value: string) {
  const raw = (value || "").trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  }
  return raw;
}

function innerWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth() - MARGIN * 2;
}

function pageBottom(doc: jsPDF) {
  return doc.internal.pageSize.getHeight() - 9;
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return /image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
}

function placeFittedImage(doc: jsPDF, dataUrl: string, x: number, y: number, maxW: number, maxH: number) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const ratio = Math.min(maxW / props.width, maxH / props.height);
    const w = props.width * ratio;
    const h = props.height * ratio;
    doc.addImage(dataUrl, imageFormat(dataUrl), x + (maxW - w) / 2, y + (maxH - h) / 2, w, h);
  } catch {
    /* skip broken image */
  }
}

function placeLogo(doc: jsPDF, logo: string | null, x: number, y: number, size: number) {
  if (logo) {
    try {
      doc.addImage(logo, "PNG", x, y, size, size);
      return;
    } catch {
      /* fall through */
    }
  }
  doc.setFillColor(245, 166, 35);
  doc.roundedRect(x, y, size, size, 1.4, 1.4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontOf(doc), "bold");
  doc.setFontSize(size * 0.5);
  doc.text("Hi", x + size / 2, y + size * 0.68, { align: "center" });
}

function resultColor(result: string): RGB {
  return /^fail$/i.test(result) ? FAIL : /^na$/i.test(result) ? MUTED : ACCENT;
}

function overallResult(row: Record<string, string>, lines: F7MeasureLine[]) {
  const fromLines = lines.map((line) => line.result.trim()).filter(Boolean);
  const pool = fromLines.length ? fromLines : [row.result || ""];
  if (pool.some((item) => /^fail$/i.test(item))) return "Fail";
  if (pool.length && pool.every((item) => /^na$/i.test(item))) return "NA";
  if (pool.some((item) => /^pass$/i.test(item))) return "Pass";
  return fmt(row.result || pool[0] || "");
}

function measureLines(row: Record<string, string>): F7MeasureLine[] {
  const lines = f7RowLines(row);
  if (lines.length) return lines;
  return [
    {
      layer: "",
      requirement: row.requirement || "",
      measuredX: row.measuredX || "",
      measuredY: row.measuredY || "",
      result: row.result || "",
      remarks: row.remarks || "",
      side: "",
    },
  ];
}

function ident(report: Report, src: F7PdfSource) {
  const reportNo = f7ReportNumber(
    src.getField("f1", { key: "cocNumber", label: "cocNumber", shared: "cocNumber" }),
  );
  const batch = src.getField("f1", { key: "batchCode", label: "batchCode", shared: "batchCode" });
  const week = src.getField("f1", { key: "weekCode", label: "weekCode", shared: "weekCode" });
  const panel = src.getField("f7", { key: "panelNumber", label: "panelNumber" });
  return { reportNo, batch, week, panel };
}

/** Same certificate chrome as F1–F6: logo, company, title, ident row. */
export function drawF7PdfHeader(doc: jsPDF, report: Report, src: F7PdfSource, logo: string | null) {
  if (f7Skin !== "current") return drawThemedF7Header(doc, report, src, logo);
  const pageW = doc.internal.pageSize.getWidth();
  const font = fontOf(doc);
  const { reportNo, batch, week, panel } = ident(report, src);
  const m = MARGIN;
  const cx = pageW / 2;

  placeLogo(doc, logo, m, 6, 13);
  doc.setFont(font, "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT);
  doc.text(COMPANY.name, m + 16, 11.5);
  doc.setFont(font, "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...INK);
  doc.text(COMPANY.tagline, m + 16, 16);

  doc.setFontSize(7.4);
  doc.setTextColor(...INK);
  doc.text(COMPANY.address, pageW - m, 10, { align: "right" });
  doc.text(COMPANY.website, pageW - m, 14.5, { align: "right" });

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.1);
  doc.line(m, 22, pageW - m, 22);

  doc.setFont("times", "bold");
  doc.setFontSize(report.title.length > 36 ? 15 : 18);
  doc.setTextColor(...ACCENT);
  doc.text(report.title, cx, 34, { align: "center" });

  const reportBoxW = 80;
  const reportBoxH = 8.5;
  const reportBoxX = pageW - m - reportBoxW;
  const reportBoxY = 36;
  const reportLabelW = 28;
  doc.setDrawColor(176, 184, 196);
  doc.setLineWidth(0.25);
  doc.rect(reportBoxX, reportBoxY, reportBoxW, reportBoxH);
  doc.line(reportBoxX + reportLabelW, reportBoxY, reportBoxX + reportLabelW, reportBoxY + reportBoxH);
  doc.setFont(font, "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...ACCENT_DARK);
  doc.text("Report No.", reportBoxX + 2.4, reportBoxY + 5.4);
  doc.setTextColor(...ACCENT);
  doc.text(fmt(reportNo) || "—", reportBoxX + reportLabelW + 2.4, reportBoxY + 5.4, {
    maxWidth: reportBoxW - reportLabelW - 4.8,
  });

  const meta = [
    ["BATCH NO'S", fmt(batch)],
    ["WEEK CODE", fmt(week)],
    ["PANEL NO.", fmt(panel)],
  ] as const;
  const metaY = 47.5;
  const gap = (pageW - m * 2) / meta.length;
  meta.forEach(([label, value], i) => {
    const x = m + i * gap + gap / 2;
    doc.setFont(font, "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...ACCENT);
    doc.text(label, x, metaY, { align: "center" });
    doc.setFont(font, "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...MUTED);
    doc.text(value || "—", x, metaY + 5.2, { align: "center" });
  });

  doc.setDrawColor(200, 208, 218);
  doc.setLineWidth(0.35);
  doc.line(m, 58, pageW - m, 58);

  return 61;
}

function drawThemedF7Header(doc: jsPDF, report: Report, src: F7PdfSource, logo: string | null) {
  const pageW = doc.internal.pageSize.getWidth();
  const font = fontOf(doc);
  const { reportNo, batch, week, panel } = ident(report, src);
  const m = MARGIN;
  const bannerH = 32;
  if (HEADER_BG) {
    doc.setFillColor(...HEADER_BG);
    doc.rect(0, 0, pageW, bannerH, "F");
  }
  if (HEADER_BG2 && f7Skin === "modern") {
    doc.setFillColor(...HEADER_BG2);
    doc.rect(pageW * 0.58, 0, pageW * 0.42, bannerH, "F");
    doc.setFillColor(204, 251, 241);
    doc.rect(0, bannerH - 1.8, pageW, 1.8, "F");
  }
  if (f7Skin === "executive") {
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 3.2, bannerH, "F");
    if (HEADER_BG2) {
      doc.setFillColor(...HEADER_BG2);
      doc.rect(0, bannerH - 1.4, pageW, 1.4, "F");
    }
  }

  if (f7Skin === "modern") {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(m, 5, 12.4, 12.4, 2, 2, "F");
    placeLogo(doc, logo, m + 0.6, 5.6, 11.2);
  } else {
    placeLogo(doc, logo, m + 5, 5, 11);
  }

  const nameX = f7Skin === "executive" ? m + 19 : m + 16;
  doc.setFont(font, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...HEADER_TEXT);
  doc.text(COMPANY.name, nameX, 10.2);
  doc.setFont(font, "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(...HEADER_MUTED);
  doc.text(COMPANY.tagline, nameX, 14.8);

  doc.setFont("times", "bold");
  doc.setFontSize(report.title.length > 36 ? 12.5 : 14);
  doc.setTextColor(...HEADER_TEXT);
  doc.text(report.title, pageW / 2, 24.4, { align: "center" });

  doc.setFont(font, "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...HEADER_MUTED);
  doc.text(`${COMPANY.address} ${COMPANY.website}`, pageW / 2, 29.2, { align: "center" });

  const meta = [
    ["REPORT NUMBER", fmt(reportNo)],
    ["PART NUMBER", fmt(part)],
    ["DATE", fmt(date)],
    ["WEEK CODE", fmt(week)],
    ["PANEL NUMBER", fmt(panel)],
  ] as const;
  const y = bannerH + 3.2;
  const colW = (pageW - m * 2) / meta.length;
  const headH = 5.6;
  const valH = 7.4;
  meta.forEach(([label, value], i) => {
    const x = m + i * colW;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.setFillColor(...TABLE_HEAD);
    doc.rect(x, y, colW, headH, "FD");
    doc.setFont(font, "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(...TABLE_HEAD_TEXT);
    doc.text(label, x + colW / 2, y + 3.8, { align: "center", maxWidth: colW - 2 });
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y + headH, colW, valH, "FD");
    doc.setFontSize(8.6);
    doc.setTextColor(...INK);
    doc.text(value || "—", x + colW / 2, y + headH + 5, { align: "center", maxWidth: colW - 2 });
  });
  return y + headH + valH + 3.2;
}

function badgeWidth(doc: jsPDF, text: string) {
  doc.setFont(fontOf(doc), "bold");
  doc.setFontSize(6.8);
  return doc.getTextWidth(text) + 6;
}

function drawBadge(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  bg: RGB,
  fg: RGB,
  rounded: boolean,
) {
  const bw = badgeWidth(doc, text);
  const h = 4.8;
  doc.setFillColor(...bg);
  if (rounded) doc.roundedRect(x, y, bw, h, 2.4, 2.4, "F");
  else {
    doc.rect(x, y, bw, h, "F");
    doc.setDrawColor(...IMAGE_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(x, y, bw, h);
  }
  doc.setTextColor(...fg);
  doc.text(text, x + bw / 2, y + 3.4, { align: "center" });
  return bw;
}

function drawTitleBar(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  name: string,
  stage: string,
  result: string,
) {
  const font = fontOf(doc);
  const resultLabel = result ? `RESULT: ${result.toUpperCase()}` : "";
  const badge = stage ? f7Plain(stage).toUpperCase() : "";

  if (f7Skin === "current") {
    const h = 8.2;
    doc.setFillColor(...ACCENT);
    doc.rect(x, y, w, h, "F");
    doc.setFont(font, "bold");
    doc.setFontSize(10.2);
    doc.setTextColor(255, 255, 255);
    const resultW = resultLabel ? doc.getTextWidth(resultLabel) + 6 : 0;
    let stageW = 0;
    if (badge) stageW = doc.getTextWidth(badge) + 8;
    const nameMax = Math.max(40, w - resultW - stageW - 8);
    const nameLines = doc.splitTextToSize(f7Plain(name).toUpperCase(), nameMax);
    doc.text(nameLines[0] || "", x + 2.2, y + 5.4);
    let right = x + w - 2.2;
    if (resultLabel) {
      doc.setFontSize(8.6);
      doc.text(resultLabel, right, y + 5.4, { align: "right" });
      right -= resultW;
    }
    if (badge) {
      const bw = stageW - 4;
      const bx = right - bw;
      if (bx > x + 50) {
        doc.setFillColor(...ACCENT_DARK);
        doc.roundedRect(bx, y + 1.8, bw, 4.6, 0.6, 0.6, "F");
        doc.setFontSize(6.8);
        doc.setTextColor(255, 255, 255);
        doc.text(badge, bx + bw / 2, y + 5.1, { align: "center" });
      }
    }
    return y + h + 2.4;
  }

  const h = 8.6;
  if (f7Skin === "modern") {
    doc.setFillColor(...ACCENT);
    doc.roundedRect(x, y + 0.8, 1.8, 5.4, 0.7, 0.7, "F");
  } else {
    doc.setFillColor(...ACCENT);
    doc.rect(x, y + 0.4, 1.1, 7.2, "F");
  }
  doc.setFont(font, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ACCENT);
  const nameMax = Math.max(40, w - 72);
  const nameLines = doc.splitTextToSize(f7Plain(name).toUpperCase(), nameMax);
  doc.text(nameLines[0] || "", x + 4.6, y + 5.4);

  let right = x + w;
  if (resultLabel) {
    const pass = /^result:\s*pass$/i.test(resultLabel);
    const bw = badgeWidth(doc, resultLabel);
    right -= bw;
    drawBadge(
      doc,
      resultLabel,
      right,
      y + 1.6,
      pass ? BADGE_PASS_BG : BADGE_ETCH_BG,
      pass ? BADGE_PASS_TEXT : BADGE_ETCH_TEXT,
      f7Skin === "modern",
    );
    right -= 2.2;
  }
  if (badge) {
    const bw = badgeWidth(doc, badge);
    drawBadge(doc, badge, right - bw, y + 1.6, BADGE_ETCH_BG, BADGE_ETCH_TEXT, f7Skin === "modern");
  }
  return y + h + 2.4;
}

function drawImagePanel(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, dataUrl?: string) {
  const font = fontOf(doc);
  const bannerH = 7;
  const boxH = Math.max(h, 36);
  const radius = f7Skin === "modern" ? 1.8 : 0;
  doc.setDrawColor(...IMAGE_BORDER);
  doc.setLineWidth(0.28);
  doc.setFillColor(...IMAGE_BG);
  if (radius) doc.roundedRect(x, y, w, boxH, radius, radius, "FD");
  else doc.rect(x, y, w, boxH, "FD");
  doc.setFillColor(...(f7Skin === "modern" ? IMAGE_BORDER : LIGHT));
  if (radius) {
    doc.roundedRect(x, y, w, bannerH, radius, radius, "F");
    doc.setFillColor(...IMAGE_BG);
    doc.rect(x, y + bannerH - 1.2, w, 1.4, "F");
  } else {
    doc.rect(x, y, w, bannerH, "F");
  }
  doc.setDrawColor(...IMAGE_BORDER);
  if (!radius) {
    doc.rect(x, y, w, bannerH);
    doc.rect(x, y, w, boxH);
  }
  doc.setFont(font, f7Skin === "executive" ? "normal" : "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(...IMAGE_TEXT);
  doc.text(label, x + w / 2, y + 4.6, { align: "center", maxWidth: w - 4 });
  const bodyTop = y + bannerH;
  const bodyH = boxH - bannerH;
  if (dataUrl) {
    placeFittedImage(doc, dataUrl, x + 2.2, bodyTop + 2, w - 4.4, bodyH - 4);
    return boxH;
  }
  doc.setFont(font, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("No image", x + w / 2, bodyTop + bodyH / 2 + 1.2, { align: "center" });
  return boxH;
}

function imageKey(row: Record<string, string>, index: number, dir: "x" | "y") {
  return `${row.sl || index}-${dir}`;
}

function newF7Page(doc: jsPDF, report: Report, src: F7PdfSource, logo: string | null) {
  doc.addPage("a4", "landscape");
  paintF7Page(doc);
  return drawF7PdfHeader(doc, report, src, logo);
}

function drawCharTitle(
  doc: jsPDF,
  row: Record<string, string>,
  index: number,
  result: string,
  y: number,
) {
  return drawTitleBar(
    doc,
    MARGIN,
    y,
    innerWidth(doc),
    f7Skin === "current"
      ? row.characteristic || `Characteristic ${index + 1}`
      : `${row.sl || index + 1}. ${row.characteristic || `Characteristic ${index + 1}`}`,
    row.stage || "",
    result,
  );
}

function drawRequirementBand(doc: jsPDF, text: string, y: number) {
  if (!text) return y;
  const font = fontOf(doc);
  const w = innerWidth(doc);
  doc.setFont(font, "normal");
  doc.setFontSize(10.5);
  const lines = doc.splitTextToSize(`Requirement: ${text}`, w - 4);
  const h = Math.max(6.2, lines.length * 4.2 + 2.2);
  doc.setFillColor(...(f7Skin === "current" ? ([248, 250, 252] as RGB) : LIGHT));
  doc.rect(MARGIN, y, w, h, "F");
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.18);
  doc.rect(MARGIN, y, w, h);
  doc.setTextColor(...INK);
  doc.text(lines, MARGIN + 2, y + 3.4);
  return y + h;
}

function drawSectionHint(doc: jsPDF, label: string, y: number) {
  const font = fontOf(doc);
  doc.setFont(font, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...ACCENT_DARK);
  doc.text(label, MARGIN, y + 3.2);
  return y + 5.4;
}

/** Compact X/Y images kept with the measurement table on the same page. */
function drawF7PdfImagePage(
  doc: jsPDF,
  src: F7PdfSource,
  row: Record<string, string>,
  index: number,
  y: number,
  result: string,
) {
  const layers = src.getField("f1", { key: "layers", label: "layers", shared: "layers" }) || "";
  const x = MARGIN;
  const w = innerWidth(doc);
  y = drawCharTitle(doc, row, index, result, y);
  y = drawSectionHint(doc, "MICROSECTION IMAGES", y);
  const gap = 2.2;
  const imgH = 40;
 if (f7UsesYImage(row.baseSl || row.sl || "", layers)) {
    const imgW = (w - gap) / 2;
    drawImagePanel(doc, x, y, imgW, imgH, "X-DIRECTION", src.f7Images?.[imageKey(row, index, "x")]);
    drawImagePanel(doc, x + imgW + gap, y, imgW, imgH, "Y-DIRECTION", src.f7Images?.[imageKey(row, index, "y")]);
  } else {
    drawImagePanel(doc, x, y, w, imgH, "MICROSECTION IMAGE", src.f7Images?.[imageKey(row, index, "x")]);
  }
  return y + imgH + 4;
}

/** Measurement / requirement details on the page after the images. */
function drawF7PdfDetailsPage(
  doc: jsPDF,
  src: F7PdfSource,
  row: Record<string, string>,
  index: number,
  y: number,
  result: string,
  report: Report,
  logo: string | null,
  grouped = false,
) {
  const lines = measureLines(row);
  const showSide = f7UsesSide(row.characteristic || "");
  const showLayer = f7UsesLayer(row.characteristic || "", row.baseSl || row.sl || "");
  const w = innerWidth(doc);
  const font = fontOf(doc);
  if (!grouped) y = drawCharTitle(doc, row, index, result, y);
  else y += 1.6;
  y = drawSectionHint(doc, "MEASUREMENTS", y);
  const req = fmt(row.requirement || "");
  if (req) y = drawRequirementBand(doc, req, y);

  const body = lines.map((line) => {
    const display = f7LineDisplay(line);
    const cells: string[] = [];
    if (showSide) cells.push(fmt(line.side) || "—");
    if (showLayer) cells.push(fmt(display.layer) || "—");
    cells.push(
      fmt(display.requirement),
      fmt(line.measuredX),
      fmt(line.measuredY),
      fmt(line.result).toUpperCase(),
      fmt(line.remarks),
    );
    return cells;
  });

  const headRow = [
    ...(showSide ? ["SIDE"] : []),
    ...(showLayer ? ["LAYER"] : []),
    "REQUIREMENT",
    "X-DIRECTION",
    "Y-DIRECTION",
    "RESULT",
    "REMARKS",
  ];
  const resultCol = (showSide ? 1 : 0) + (showLayer ? 1 : 0) + 3;
  const reqWidth = showSide && showLayer ? 0.28 : showLayer || showSide ? 0.34 : 0.4;
  let col = 0;
  const columnStyles: Record<number, { cellWidth: number; halign: "left" | "center"; fontStyle?: "bold" }> = {};
  if (showSide) columnStyles[col++] = { cellWidth: w * 0.08, halign: "center" };
  if (showLayer) columnStyles[col++] = { cellWidth: w * 0.1, halign: "left" };
  columnStyles[col++] = { cellWidth: w * reqWidth, halign: "left" };
  columnStyles[col++] = { cellWidth: w * 0.12, halign: "center" };
  columnStyles[col++] = { cellWidth: w * 0.12, halign: "center" };
  columnStyles[col++] = { cellWidth: w * 0.1, halign: "center", fontStyle: "bold" };
  columnStyles[col] = { cellWidth: w * (showSide && showLayer ? 0.2 : 0.24), halign: "left" };

  const startPage = doc.getNumberOfPages();
  autoTable(doc, {
    startY: y + 1,
    margin: { left: MARGIN, right: MARGIN, top: 62, bottom: 10 },
    tableWidth: w,
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    head: [headRow],
    body,
    styles: {
      font,
      fontSize: 10.8,
      textColor: INK,
      lineColor: LINE,
      lineWidth: f7Skin === "current" ? 0.16 : 0.22,
      valign: "middle",
      cellPadding: { top: 2, bottom: 2, left: 1.8, right: 1.8 },
      overflow: "linebreak",
      minCellHeight: 7.4,
    },
    headStyles: {
      font,
      fillColor: TABLE_HEAD,
      textColor: TABLE_HEAD_TEXT,
      fontStyle: "bold",
      fontSize: 9.2,
      halign: "center",
      valign: "middle",
      minCellHeight: 6,
    },
    alternateRowStyles: TABLE_ZEBRA ? { fillColor: TABLE_ZEBRA } : undefined,
    columnStyles,
    didParseCell: (data: any) => {
      data.cell.styles.font = font;
      if (data.section === "body" && data.column.index === resultCol) {
        const raw = String(data.cell.raw || "");
        data.cell.styles.textColor = resultColor(raw);
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: (data: any) => {
      if (doc.getNumberOfPages() === startPage && data.pageNumber === 1) return;
      const top = drawF7PdfHeader(doc, report, src, logo);
      drawCharTitle(doc, row, index, result, top);
    },
  });

  return ((doc as any).lastAutoTable?.finalY || y) + 2.4;
}

export function drawF7PdfCharacteristic(
  doc: jsPDF,
  src: F7PdfSource,
  row: Record<string, string>,
  index: number,
  y: number,
  report: Report,
  logo: string | null,
  startOnNewPage: boolean,
) {
  const lines = measureLines(row);
  const result = overallResult(row, lines);
  if (startOnNewPage) y = newF7Page(doc, report, src, logo);
  y = drawF7PdfImagePage(doc, src, row, index, y, result) + 2.2;
  return drawF7PdfDetailsPage(doc, src, row, index, y, result, report, logo, true);
}

/** Compact horizontal analysed / tested / date block. */
export function drawF7PdfSignOff(doc: jsPDF, report: Report, src: F7PdfSource, y: number, logo: string | null) {
  const signoff = (report.sections as Section[]).find((section) => section.kind === "signoff");
  const fields = signoff && signoff.kind === "signoff" ? signoff.fields || [] : [];
  const analysed =
    src.getField("f7", fields.find((f) => /analys/i.test(f.label) || f.key === "testedBy") || { key: "testedBy", label: "Analysed by" }) ||
    src.getField("f7", { key: "testedBy", label: "Analysed by" });
  const tested =
    src.getField("f7", fields.find((f) => /tested by/i.test(f.label) && f.key !== "testedBy") || { key: "testedByName", label: "Tested by" }) ||
    "";
  const date = formatDisplayDate(
    src.getField("f7", fields.find((f) => f.type === "date" || /date/i.test(f.key)) || { key: "testedDate", label: "Date" }) ||
      src.getField("f7", { key: "testedDate", label: "Date" }),
  );

  if (y + 28 > pageBottom(doc) && y > 62) y = newF7Page(doc, report, src, logo);
  const x = MARGIN;
  const w = innerWidth(doc);
  const font = fontOf(doc);
  doc.setFont(font, "bold");
  doc.setFontSize(10.8);
  doc.setTextColor(...ACCENT_DARK);
  doc.text("SIGN-OFF", x, y + 1);
  y += 3.6;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 9 },
    tableWidth: w,
    theme: "grid",
    head: [["ANALYSED BY", "DATE"]],
    body: [[fmt(analysed) || " ", fmt(date) || " "]],
    styles: {
      font,
      fontSize: 10.8,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.18,
      valign: "middle",
      minCellHeight: 13,
      cellPadding: { top: 3.2, bottom: 3.2, left: 2.4, right: 2.4 },
    },
    headStyles: {
      font,
      fillColor: TABLE_HEAD,
      textColor: TABLE_HEAD_TEXT,
      fontStyle: "bold",
      fontSize: 8.8,
      minCellHeight: 5.4,
      cellPadding: { top: 1.2, bottom: 1.2, left: 2.4, right: 2.4 },
    },
  });

  return ((doc as any).lastAutoTable?.finalY || y) + 2;
}

/**
 * Dedicated F7 PDF renderer: A4 landscape, compact professional inspection report.
 * Does not alter the interactive F7 web form.
 */
export function renderF7LandscapeReport(
  doc: jsPDF,
  report: Report,
  src: F7PdfSource,
  logo: string | null,
  template: PdfTemplateId = "current",
) {
  applyF7Skin(template);
  try {
    const layers =
      src.getField("f1", { key: "layers", label: "layers", shared: "layers" }) ||
      src.getField("f7", { key: "layers", label: "layers", shared: "layers" }) ||
      "";
    const viaProtection =
      src.getField("f1", { key: "viaProtection", label: "viaProtection", shared: "viaProtection" }) ||
      src.getField("f7", { key: "viaProtection", label: "viaProtection", shared: "viaProtection" }) ||
      "";
    const specification =
      src.getField("f1", { key: "specification", label: "specification", shared: "specification" }) || "";
    const regulatoryRequirement =
      src.getField("f1", { key: "regulatoryRequirement", label: "regulatoryRequirement", shared: "regulatoryRequirement" }) ||
      "";
    const pcbType = src.getField("f1", { key: "pcbType", label: "pcbType" }) || "";
    const rows = f7VisibleCharRows(
      withDerivedF7Rows(src.getRows("f7", "characteristics"), specification, regulatoryRequirement, layers),
      layers,
      viaProtection,
      pcbType,
    );
    paintF7Page(doc);
    let y = drawF7PdfHeader(doc, report, src, logo);

    rows.forEach((row, index) => {
      y = drawF7PdfCharacteristic(doc, src, row, index, y, report, logo, index > 0);
    });

    drawF7PdfSignOff(doc, report, src, y, logo);
  } finally {
    applyF7Skin("current");
  }
}
