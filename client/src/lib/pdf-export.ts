import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "./reports/schema";
import type { Report, Section } from "./reports/types";
import { buildF2PrintModel, buildSerials, chunkSerials, f2ReportNumber, groupF2PrintBoards, mergeF2State, type F2PrintBoard, type F2PrintModel, type F2State } from "./reports/f2-logic";
import { PDF_TYPOGRAPHY as TYPO } from "./reports/typography";
import {
  F3_CERT_TEXT,
  f3CertMerge,
  f3ReportNumber,
  parseF3Attachments,
} from "./reports/f3-logic";
import {
  F4_CERT_TEXT,
  F4_TEST_LEVEL,
  F4_YES,
  f4ApplicableStandard,
  f4IsolationRequirement,
  f4ParamRow,
  f4QtyPassed,
  f4ReportNumber,
  f4SourceDataLine,
  f4TestMethodLine,
} from "./reports/f4-logic";
import {
  F5_SAMPLES_PER_PAGE,
  f5BoardReadingOut,
  f5ChunkUnits,
  f5DrillReadingOut,
  f5LaserOut,
  f5LaserReq,
  f5MeasureUnits,
  f5NormalizePicked,
  f5ParseReadings,
  f5Plated,
  f5QtyNos,
  f5ReadingText,
  f5ReportNumber,
  f5UnitHeadingStacked,
  type F5Unit,
} from "./reports/f5-logic";
import {
  F6_MARK_ACCEPTED,
  F6_MARK_NOT_ACCEPTED,
  F6_PANELS_PER_PAGE,
  f6AcceptedPanelLabels,
  f6ChunkPanels,
  f6PanelPrintLabel,
  f6ReportNumber,
} from "./reports/f6-logic";
import { F15_STANDARD, f15ReportNumber, f15ResultDisplay } from "./reports/f15-logic";
import { f16ReportNumber, f16ResultDisplay } from "./reports/f16-logic";
import { f7EnsureCharRows, parseF7Image } from "./reports/f7-logic";
import { renderF7LandscapeReport } from "./reports/f7-pdf";
import { fetchReportFileDataUrl } from "./api";
import type { PdfRgb, PdfTemplateId } from "./pdf/types";
import { themeById } from "./pdf/themes";
import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { fetchReportFileBlob } from "./api";

const PDF_FONT = TYPO.family.embedded;
let pdfFontFamily: string = TYPO.family.fallback;
const CONTENT_FONT = TYPO.size.body;
const CONTENT_LABEL = TYPO.size.label;
const CONTENT_HEAD = TYPO.size.tableHeading;

const CURRENT_ACCENT: PdfRgb = [59, 111, 160];
const CURRENT_LIGHT: PdfRgb = [232, 237, 243];
const CURRENT_INK: PdfRgb = [28, 35, 48];
const CURRENT_MUTED: PdfRgb = [55, 64, 78];
let ACCENT: PdfRgb = CURRENT_ACCENT;
let LIGHT: PdfRgb = CURRENT_LIGHT;
let INK: PdfRgb = CURRENT_INK;
let MUTED: PdfRgb = CURRENT_MUTED;
let pdfSkin: PdfTemplateId = "current";
const WARN_FILL: [number, number, number] = [253, 234, 234];
const WARN_TEXT: [number, number, number] = [192, 57, 43];
const PAGE_MARGIN = 8;
const PAGE_BOTTOM = 12;

export interface ExportSource {
  getField: (reportId: string, field: any) => string;
  getRows: (reportId: string, tableKey: string) => Record<string, string>[];
  f2?: F2State;
  reportId?: string | null;
  f7Images?: Record<string, string>;
}

/** Helvetica cannot draw Ω / ≥; with DejaVu those symbols print correctly. */
function pdfSafe(value: string) {
  const text = String(value);
  if (pdfFontFamily === PDF_FONT) return text;
  return text
    .replace(/M[ΩΩ]/g, "Mohm")
    .replace(/[ΩΩ]/g, "ohm")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/μ/g, "u");
}

const fmt = (v: string) => {
  const token = (v || "").trim();
  if (!token || token === "—" || token === "-" || token === "–") return "";
  return pdfSafe(token);
};

function f5PdfCell(text: string, warn = false) {
  const content = fmt(text);
  if (!warn) return content;
  return {
    content,
    styles: {
      fillColor: WARN_FILL,
      textColor: WARN_TEXT,
      fontStyle: "bold" as const,
      halign: "center" as const,
    },
  };
}

const HIQ_LOGO_URL = `${import.meta.env.BASE_URL}hiq-logo.png`;
const NADCAP_LOGO_URL = `${import.meta.env.BASE_URL}nadcaplogo.png`;
const PDF_FONT_REGULAR_URL = `${import.meta.env.BASE_URL}fonts/CourierPrime-Regular.ttf`;
const PDF_FONT_BOLD_URL = `${import.meta.env.BASE_URL}fonts/CourierPrime-Bold.ttf`; 
let unicodeFontFiles: { regular: string; bold: string } | null = null;
let unicodeFontsLoaded = false;
let hiqLogoDataUrl: string | null = null;
let nadcapLogoDataUrl: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      resolve(url.includes(",") ? url.slice(url.indexOf(",") + 1) : url);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([buffer]));
  });
}

async function loadUnicodeFonts() {
  if (unicodeFontsLoaded) return unicodeFontFiles;
  unicodeFontsLoaded = true;
  try {
    const [regularRes, boldRes] = await Promise.all([fetch(PDF_FONT_REGULAR_URL), fetch(PDF_FONT_BOLD_URL)]);
    if (!regularRes.ok || !boldRes.ok) return null;
    const [regular, bold] = await Promise.all([regularRes.arrayBuffer(), boldRes.arrayBuffer()]);
    unicodeFontFiles = {
      regular: await arrayBufferToBase64(regular),
      bold: await arrayBufferToBase64(bold),
    };
    return unicodeFontFiles;
  } catch {
    unicodeFontFiles = null;
    return null;
  }
}

function registerUnicodeFont(doc: jsPDF) {
  pdfFontFamily = TYPO.family.fallback;
  doc.setFont(pdfFontFamily, TYPO.weight.normal);
  return false;
}


type PageChrome = {
  report: Report;
  src: ExportSource;
  logo: string | null;
  nadcap: string | null;
  reportNo: string;
  pageNote: string;
  sectionTitle: string;
};

let pageChrome: PageChrome | null = null;
let drawingPageChrome = false;
let lastHeaderBottom = 56;
let identLabel = { fontStyle: "bold" as const, textColor: ACCENT, fontSize: CONTENT_LABEL };
let identValue = { textColor: INK, fontStyle: "normal" as const };

function applyPdfSkin(skin: PdfTemplateId) {
  pdfSkin = skin;
  if (skin === "current") {
    ACCENT = CURRENT_ACCENT;
    LIGHT = CURRENT_LIGHT;
    INK = CURRENT_INK;
    MUTED = CURRENT_MUTED;
  } else {
    const theme = themeById(skin);
    ACCENT = theme.accent;
    LIGHT = theme.accentSoft;
    INK = theme.ink;
    MUTED = theme.muted;
  }
  identLabel = { fontStyle: "bold", textColor: ACCENT, fontSize: CONTENT_LABEL };
  identValue = { textColor: INK, fontStyle: "normal" };
}

function paintPageBackground(doc: jsPDF) {
  if (pdfSkin === "current") return;
  const theme = themeById(pdfSkin);
  doc.setFillColor(...theme.pageBg);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F");
}

function pageContentBottom(doc: jsPDF) {
  return doc.internal.pageSize.getHeight() - PAGE_BOTTOM - 2;
}

function pdfIsLandscape(doc: jsPDF) {
  return doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight();
}

function chromeTopMargin() {
  if (!pageChrome) return PAGE_MARGIN;
  let top = Math.max(lastHeaderBottom + 2, pdfSkin === "current" ? 58 : 68);
  if (pageChrome.sectionTitle) top += 13;
  if (pageChrome.pageNote) top += 8;
  return top;
}

function addPdfPage(doc: jsPDF) {
  doc.addPage("a4", pdfIsLandscape(doc) ? "landscape" : "portrait");
  paintPageBackground(doc);
  return drawContinuationChrome(doc);
}

function pdfTable(doc: jsPDF, options: any) {
  const font = pdfFontFamily;
  const prevParse = options.didParseCell;
  const prevWill = options.willDrawPage;
  const prevPage = options.didDrawPage;
  const margin = {
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    bottom: PAGE_BOTTOM,
    ...(options.margin || {}),
  };
  if (pageChrome && !drawingPageChrome) {
    margin.top = Math.max(Number(margin.top) || 0, chromeTopMargin());
  }
  autoTable(doc, {
    ...options,
    margin,
    pageBreak: options.pageBreak ?? "auto",
    rowPageBreak: options.rowPageBreak ?? "avoid",
    styles: {
      font,
      overflow: "linebreak",
      valign: "middle",
      cellPadding: { top: 1.8, bottom: 1.8, left: 2.1, right: 2.1 },
      ...(options.styles || {}),
    },
    headStyles: { font, ...(options.headStyles || {}) },
    bodyStyles: { font, ...(options.bodyStyles || {}) },
    didParseCell: (data: any) => {
      data.cell.styles.font = font;
      prevParse?.(data);
    },
    // willDrawPage runs before cells. didDrawPage runs after and was painting the header over the first rows.
    willDrawPage: (data: any) => {
      if (!drawingPageChrome && data.pageNumber > 1 && pageChrome) {
        paintPageBackground(doc);
        drawContinuationChrome(doc);
      }
      prevWill?.(data);
    },
    didDrawPage: (data: any) => {
      prevPage?.(data);
    },
  });
}

async function pngDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function getHiqLogoDataUrl(): Promise<string | null> {
  if (hiqLogoDataUrl) return hiqLogoDataUrl;
  hiqLogoDataUrl = await pngDataUrl(HIQ_LOGO_URL);
  return hiqLogoDataUrl;
}

async function getNadcapLogoDataUrl(): Promise<string | null> {
  if (nadcapLogoDataUrl) return nadcapLogoDataUrl;
  nadcapLogoDataUrl = await pngDataUrl(NADCAP_LOGO_URL);
  return nadcapLogoDataUrl;
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

function placeHiqLogo(doc: jsPDF, logo: string | null, x: number, y: number, size = 12) {
  if (logo) {
    try {
      doc.addImage(logo, "PNG", x, y, size, size);
      return;
    } catch {
      /* fall through */
    }
  }
  // Fallback if image fails to load
  doc.setFillColor(245, 166, 35);
  doc.roundedRect(x, y, size, size, 2.2, 2.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(size * 0.55);
  doc.text("Hi", x + size / 2, y + size * 0.68, { align: "center" });
}

/** Nadcap Accredited mark — 396×132 (3:1). Returns the drawn width so address can sit beside it. */
function placeNadcapLogo(doc: jsPDF, logo: string | null, right: number, y: number, width = 28) {
  if (!logo) return 0;
  try {
    const props = doc.getImageProperties(logo);
    const height = width * (props.height / props.width);
    doc.addImage(logo, "PNG", right - width, y, width, height);
    return width;
  } catch {
    return 0;
  }
}

function fieldValue(report: Report, src: ExportSource, key: string, shared?: string) {
  return src.getField(report.id, { key, label: key, shared });
}

function reportDate(report: Report, src: ExportSource) {
  const keys = [
    { key: "date", shared: "cocDate" },
    { key: "testedDate" },
    { key: "inspectedDate" },
    { key: "approvedDate" },
  ];
  for (const item of keys) {
    const value = fieldValue(report, src, item.key, item.shared);
    if (value?.trim()) return formatDisplayDate(value);
  }
  return "";
}

function companyContactLine() {
  return `${COMPANY.address} ${COMPANY.website}`;
}

function f1HeaderMeta(report: Report, src: ExportSource) {
  return [
    ["HI-Q NCAGE CODE", COMPANY.ncage],
    ["HI-Q UL FILE NO", COMPANY.ulFile],
    [report.id === "f1" ? "COC NUMBER" : "REPORT NO", fmt(resolveReportNo(report, src))],
    ["DATE", reportDate(report, src)],
  ] as const;
}

function drawThemedMetaTable(doc: jsPDF, report: Report, src: ExportSource, y: number) {
  const theme = themeById(pdfSkin === "executive" ? "executive" : "modern");
  const items = f1HeaderMeta(report, src);
  const w = doc.internal.pageSize.getWidth();
  const m = PAGE_MARGIN;
  const colW = (w - m * 2) / items.length;
  const headH = 6.4;
  const valH = 9.2;
  items.forEach(([label, value], i) => {
    const x = m + i * colW;
    doc.setDrawColor(...theme.tableLine);
    doc.setLineWidth(0.28);
    doc.setFillColor(...theme.tableHead);
    doc.rect(x, y, colW, headH, "FD");
    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(6.7);
    doc.setTextColor(...theme.tableHeadText);
    doc.text(label, x + colW / 2, y + 4.2, { align: "center", maxWidth: colW - 2.4 });

    doc.setFillColor(...theme.cardBg);
    doc.rect(x, y + headH, colW, valH, "FD");
    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(9.6);
    doc.setTextColor(...theme.ink);
    doc.text(String(value || ""), x + colW / 2, y + headH + 5.6, { align: "center", maxWidth: colW - 2.4 });
  });
  return y + headH + valH + 8;
}

function placeNadcapOnBanner(doc: jsPDF, nadcap: string | null, right: number, y: number, width = 28) {
  if (!nadcap) return;
  try {
    const props = doc.getImageProperties(nadcap);
    const height = width * (props.height / props.width);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(right - width - 1.2, y - 1, width + 2.4, height + 2, 1.2, 1.2, "F");
    doc.addImage(nadcap, "PNG", right - width, y, width, height);
  } catch {
    placeNadcapLogo(doc, nadcap, right, y, width);
  }
}

function drawModernCertificateHeader(
  doc: jsPDF,
  report: Report,
  src: ExportSource,
  logo: string | null,
  nadcap: string | null,
) {
  const theme = themeById("modern");
  const w = doc.internal.pageSize.getWidth();
  const m = PAGE_MARGIN;
  const bannerH = 42;
  doc.setFillColor(...theme.headerBg);
  doc.rect(0, 0, w, bannerH, "F");
  doc.setFillColor(...theme.headerBg2);
  doc.rect(w * 0.58, 0, w * 0.42, bannerH, "F");
  doc.setFillColor(...theme.accentSoft);
  doc.rect(0, bannerH - 2, w, 2, "F");

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(m, 5, 13.4, 13.4, 2.2, 2.2, "F");
  placeHiqLogo(doc, logo, m + 0.7, 5.7, 12);

  doc.setTextColor(...theme.headerText);
  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(11);
  doc.text(COMPANY.name, m + 16, 10.4);
  doc.setFont(pdfFontFamily, "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(...theme.headerMuted);
  doc.text(COMPANY.tagline, m + 16, 15);

  if (report.id === "f1") placeNadcapOnBanner(doc, nadcap, w - m, 5.5, 28);

  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(report.title.length > 36 ? 13 : 15);
  doc.setTextColor(...theme.headerText);
  doc.text(report.title, w / 2, 27.2, { align: "center" });

  doc.setFont(pdfFontFamily, "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...theme.headerMuted);
  doc.text(companyContactLine(), w / 2, 36.4, { align: "center" });

  return drawThemedMetaTable(doc, report, src, bannerH + 4);
}

function drawExecutiveCertificateHeader(
  doc: jsPDF,
  report: Report,
  src: ExportSource,
  logo: string | null,
  nadcap: string | null,
) {
  const theme = themeById("executive");
  const w = doc.internal.pageSize.getWidth();
  const m = PAGE_MARGIN;
  const bannerH = 42;
  doc.setFillColor(...theme.headerBg);
  doc.rect(0, 0, w, bannerH, "F");
  doc.setFillColor(...theme.accent);
  doc.rect(0, 0, 3.2, bannerH, "F");
  doc.setFillColor(...theme.headerBg2);
  doc.rect(0, bannerH - 1.4, w, 1.4, "F");

  placeHiqLogo(doc, logo, m + 5, 5, 12);
  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...theme.headerText);
  doc.text(COMPANY.name, m + 20, 10.2);
  doc.setFont(pdfFontFamily, "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(...theme.headerMuted);
  doc.text(COMPANY.tagline, m + 20, 15);

  if (report.id === "f1") placeNadcapOnBanner(doc, nadcap, w - m, 5, 26);

  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(report.title.length > 42 ? 12.5 : 14.5);
  doc.setTextColor(...theme.headerText);
  doc.text(report.title, w / 2, 27.2, { align: "center" });

  doc.setFont(pdfFontFamily, "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...theme.headerMuted);
  doc.text(companyContactLine(), w / 2, 36.4, { align: "center" });

  return drawThemedMetaTable(doc, report, src, bannerH + 4);
}

/** Certificate chrome used on every form — logo, Times title, blue rule (F1 layout). */
function drawF1CertificateHeader(
  doc: jsPDF,
  report: Report,
  src: ExportSource,
  logo: string | null = null,
  nadcap: string | null = null,
) {
  const y =
    pdfSkin === "modern"
      ? drawModernCertificateHeader(doc, report, src, logo, nadcap)
      : pdfSkin === "executive"
        ? drawExecutiveCertificateHeader(doc, report, src, logo, nadcap)
        : drawCurrentCertificateHeader(doc, report, src, logo, nadcap);
  lastHeaderBottom = y;
  return y;
}

function drawCurrentCertificateHeader(
  doc: jsPDF,
  report: Report,
  src: ExportSource,
  logo: string | null,
  nadcap: string | null,
) {
  const w = doc.internal.pageSize.getWidth();
  const cx = w / 2;
  const m = PAGE_MARGIN;

  placeHiqLogo(doc, logo, m, 6, 13);
  doc.setTextColor(...ACCENT);
  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(12);
  doc.text(COMPANY.name, m + 16, 11.5);
  doc.setFont(pdfFontFamily, "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...INK);
  doc.text(COMPANY.tagline, m + 16, 16);

  doc.setFontSize(7.4);
  doc.setTextColor(...INK);
  doc.text(COMPANY.address, w - m, 10, { align: "right" });
  doc.text(COMPANY.website, w - m, 14.5, { align: "right" });

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.1);
  doc.line(m, 22, w - m, 22);

  const title = report.title;
 doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(title.length > 36 ? 15 : 18);
  doc.setTextColor(...ACCENT);
  doc.text(title, cx, 34, { align: "center" });
  if (report.id === "f1") placeNadcapLogo(doc, nadcap, w - m, 27.5, 28);

  if (report.id !== "f1") {
    doc.setDrawColor(200, 208, 218);
    doc.setLineWidth(0.35);
    doc.line(m, 39, w - m, 39);
    return 44;
  }

    const batch = src.getField("f1", {
    key: "batchCode",
    label: "Batch Code",
    shared: "batchCode",
  });
  const week = src.getField("f1", {
    key: "weekCode",
    label: "Week Code",
    shared: "weekCode",
  });
  const panel =
    src.f2?.lines.map((line) => line.panels).filter(Boolean).join(", ") ?? "";

  const meta = [
    ["HI-Q NCAGE CODE", COMPANY.ncage],
    ["HI-Q UL FILE NO", COMPANY.ulFile],
    ["BATCH NO'S", fmt(batch)],
    ["WEEK CODE", fmt(week)],
    ["PANEL NO.", fmt(panel)],
  ] as const;

  const metaY = 42;
  const gap = (w - m * 2) / meta.length;
  meta.forEach(([label, value], i) => {
    const x = m + i * gap + gap / 2;
    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...ACCENT);
    doc.text(label, x, metaY, { align: "center" });
    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(10.2);
    doc.setTextColor(...INK);
    doc.text(value, x, metaY + 5.2, { align: "center" });
  });

  doc.setDrawColor(200, 208, 218);
  doc.setLineWidth(0.35);
  doc.line(m, metaY + 9, w - m, metaY + 9);

  return 56;
}

/** F3 ident block under the title — Customer, P.O. Number, report number, part, week code, specification. */
function identTable(doc: jsPDF, y: number, body: any[]) {
  pdfTable(doc, {
    startY: y,
    body,
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.4, right: 2.4 },
      lineColor: LIGHT,
      lineWidth: 0.2,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 46 },
      2: { cellWidth: 42 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

function renderF3IdentBlock(doc: jsPDF, report: Report, src: ExportSource, y: number) {
  const label = { fontStyle: "bold" as const, textColor: ACCENT, fontSize: CONTENT_LABEL };
  const value = { textColor: INK, fontStyle: "normal" as const };
  pdfTable(doc, {
    startY: y,
    body: [
  [
    { content: "Customer", styles: label },
    { content: fmt(fieldValue(report, src, "customer", "customer")), styles: value },
    { content: "Part Number", styles: label },
    { content: fmt(fieldValue(report, src, "partNumber", "partNumber")), styles: value },
  ],
  [
    { content: "P.O. Number", styles: label },
    { content: fmt(fieldValue(report, src, "poNumber", "poNumber")), styles: value },
    { content: "Specification", styles: label },
    { content: fmt(fieldValue(report, src, "specification", "specification")), styles: value },
  ],
  [
    { content: "Week Code", styles: label },
    { content: fmt(fieldValue(report, src, "weekCode", "weekCode")), styles: value },
    { content: "Batch Code", styles: label },
    { content: fmt(fieldValue(report, src, "batchCode", "batchCode")), styles: value },
  ],
],
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.4, right: 2.4 },
      lineColor: LIGHT,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 44 },
      2: { cellWidth: 44 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 10;
}

function f4Shared(src: ExportSource, key: string) {
  return src.getField("f4", { key, label: key, shared: key });
}

function renderF4ReportNo(doc: jsPDF, reportNo: string, y: number) {
  const w = doc.internal.pageSize.getWidth();
  pdfTable(doc, {
    startY: y,
    body: [
      [
        { content: "Report No.", styles: identLabel },
        { content: fmt(reportNo), styles: { ...identValue, fontStyle: "bold", textColor: ACCENT } },
      ],
    ],
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.4, right: 2.4 },
      lineColor: LIGHT,
      lineWidth: 0.2,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 52, halign: "left" },
    },
    margin: { left: w - PAGE_MARGIN - 80, right: PAGE_MARGIN },
    tableWidth: 80,
  });
  return (doc as any).lastAutoTable.finalY + 4;
}

function productionOrderOf(src: ExportSource) {
  return src.getField("f1", { key: "productionOrder", label: "productionOrder" }).trim();
}

function reportDateValue(report: Report, src: ExportSource) {
  return fieldValue(report, src, "testedDate") || fieldValue(report, src, "date", "cocDate");
}

function resolveReportNo(report: Report, src: ExportSource) {
  const coc = src.getField("f1", { key: "cocNumber", label: "COC Number", shared: "cocNumber" });
  const productionOrder = productionOrderOf(src);
  const date = reportDateValue(report, src);
  if (report.id === "f1") return fmt(fieldValue(report, src, "cocNumber", "cocNumber"));
  if (report.id === "f2") return f2ReportNumber(coc);
  if (report.id === "f3") return f3ReportNumber(coc);
  if (report.id === "f4") return f4ReportNumber(productionOrder || f4Shared(src, "batchCode"), date);
  if (report.id === "f5") return f5ReportNumber(productionOrder || f5Shared(src, "batchCode"), date);
  if (report.id === "f6") return f6ReportNumber(productionOrder || f6Shared(src, "batchCode"), date);
  if (report.id === "f15") return f15ReportNumber(productionOrder, date);
  if (report.id === "f16") return f16ReportNumber(productionOrder, date);
  return fmt(src.getField(report.id, { key: "reportNumber", label: "Report Number" }) || coc);
}

function drawReportNoBand(doc: jsPDF, reportNo: string, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const boxW = 80;
  const labelW = 28;
  const h = 9;
  const x = pageW - PAGE_MARGIN - boxW;
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, labelW, h, "FD");
  doc.rect(x + labelW, y, boxW - labelW, h, "FD");
  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...ACCENT);
  doc.text("Report No.", x + 2.4, y + 6);
  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...ACCENT);
  doc.text(fmt(reportNo) || "—", x + labelW + 2.4, y + 6.2);
  return y + h + 4;
}

function drawContinuationChrome(doc: jsPDF) {
  if (!pageChrome) return 16;
  drawingPageChrome = true;
  try {
    const { report, src, logo, nadcap, reportNo, pageNote, sectionTitle: heading } = pageChrome;
    let y = drawF1CertificateHeader(doc, report, src, logo, nadcap);
    if (pdfSkin === "current" && report.id !== "f1" && reportNo) y = drawReportNoBand(doc, reportNo, y);
    if (heading) y = sectionTitle(doc, heading, pageNote || undefined, y);
    else if (pageNote) {
      doc.setFont(pdfFontFamily, "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(pageNote, doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2);
      doc.text(lines, PAGE_MARGIN, y);
      y += Math.max(6, lines.length * 3.8 + 2);
    }
    return y;
  } finally {
    drawingPageChrome = false;
  }
}

function renderF4Body(doc: jsPDF, report: Report, src: ExportSource, y: number) {
  const params = src.getRows(report.id, "params");
  const continuity = f4ParamRow(params, /continuity/i);
  const isolation = f4ParamRow(params, /isolation/i);
  const voltage = f4ParamRow(params, /test voltage/i);
  const adjacency = f4ParamRow(params, /adjacency/i);
  const horizontal = f4ParamRow(params, /horizontal/i);
  const vertical = f4ParamRow(params, /vertical/i);

  const productionOrder = src.getField("f1", { key: "productionOrder", label: "productionOrder" }).trim();
  const testedDate = fieldValue(report, src, "testedDate");
  const reportDateValue = testedDate || fieldValue(report, src, "date", "cocDate");
  const reportNo = f4ReportNumber(productionOrder || f4Shared(src, "batchCode"), reportDateValue);
  const batch = f4Shared(src, "batchCode") || productionOrder;

  y = renderF4ReportNo(doc, reportNo, y);

  y = identTable(doc, y, [
    [
      { content: "Customer", styles: identLabel },
      { content: fmt(f4Shared(src, "customer")), colSpan: 3, styles: identValue },
    ],
    [
      { content: "Address", styles: identLabel },
      { content: fmt(f4Shared(src, "customerAddress")), colSpan: 3, styles: identValue },
    ],
    [
      { content: "Part Number", styles: identLabel },
      { content: fmt(f4Shared(src, "partNumber")), styles: identValue },
      { content: "Rev No", styles: identLabel },
      { content: fmt(f4Shared(src, "partRev")), styles: identValue },
    ],
    [
      { content: "P.O. Number", styles: identLabel },
      { content: fmt(f4Shared(src, "poNumber")), colSpan: 3, styles: identValue },
    ],
    [
      { content: "Test Level", styles: identLabel },
      { content: fmt(fieldValue(report, src, "testLevel") || F4_TEST_LEVEL), styles: identValue },
      { content: "Batch Code", styles: identLabel },
      { content: fmt(batch), styles: identValue },
    ],
    [
      { content: "Quantity Passed", styles: identLabel },
      { content: fmt(f4QtyPassed(fieldValue(report, src, "qtyPassed"))), styles: identValue },
      { content: "Week Code", styles: identLabel },
      { content: fmt(f4Shared(src, "weekCode")), styles: identValue },
    ],
    [
      { content: "Applicable Standard", styles: identLabel },
      { content: fmt(fieldValue(report, src, "standard") || f4ApplicableStandard(f4Shared(src, "specification"))), colSpan: 3, styles: identValue },
    ],
    [
      { content: "Test Method", styles: identLabel },
      { content: f4TestMethodLine(fieldValue(report, src, "testMethod")), colSpan: 3, styles: identValue },
    ],
    [
      { content: "Source Data Used", styles: identLabel },
      { content: f4SourceDataLine(fieldValue(report, src, "sourceData")), colSpan: 3, styles: identValue },
    ],
    [
      { content: "Data Retention", styles: identLabel },
      { content: fmt(fieldValue(report, src, "dataRetention") || F4_YES).toUpperCase(), styles: identValue },
      { content: "Traceability by Serial No", styles: identLabel },
      { content: fmt(fieldValue(report, src, "traceability") || F4_YES).toUpperCase(), styles: identValue },
    ],
  ]);

 y = sectionTitle(doc, "Parameters", undefined, y);
pdfTable(doc, {
  startY: y,
  head: [["Parameter", "Requirement", "Result"]],
  body: [
    ["Continuity (Opens)", fmt(continuity?.value || ""), fmt(continuity?.result || "")],
    [
      "Isolation (Shorts)",
      fmt(f4IsolationRequirement(isolation?.value || "", voltage?.value || "")),
      fmt(isolation?.result || ""),
    ],
    ["Adjacency Test method Used?", fmt(adjacency?.value || ""), ""],
    ["Horizontal Distance", fmt(horizontal?.value || ""), ""],
    ["Vertical Distance", fmt(vertical?.value || ""), ""],
  ],
  theme: "grid",
  headStyles: {
    fillColor: LIGHT,
    textColor: ACCENT,
    fontSize: CONTENT_HEAD,
    fontStyle: "bold",
    cellPadding: 1.2,
    lineColor: ACCENT,
    lineWidth: 0.35,
  },
  styles: {
    fontSize: CONTENT_FONT,
    cellPadding: 1.2,
    lineColor: LIGHT,
    lineWidth: 0.2,
    textColor: INK,
    valign: "middle",
  },
  alternateRowStyles: { fillColor: [248, 250, 252] },
  columnStyles: {
    0: { cellWidth: 62 },
    1: { cellWidth: 70 },
  },
  margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  didParseCell: (data: any) => {
    const raw = String(data.cell.raw ?? "");
    if (data.section === "head") {
      data.cell.styles.fillColor = LIGHT;
      data.cell.styles.textColor = ACCENT;
    }
    if (data.section === "body" && data.column.index === 2) {
      if (raw === "Pass") {
        data.cell.styles.textColor = ACCENT;
        data.cell.styles.fontStyle = "bold";
      }
      if (raw === "Fail") {
        data.cell.styles.textColor = [178, 38, 38];
        data.cell.styles.fontStyle = "bold";
      }
    }
  },
});
y = (doc as any).lastAutoTable.finalY + 3;

  y = renderNote(doc, { title: "Certification", text: F4_CERT_TEXT }, y, true);

  const signoff = report.sections.find((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff");
  if (signoff) {
    y = renderSignoff(doc, report, signoff, src, y);
  }
  return y;
}

function f5Shared(src: ExportSource, key: string) {
  return src.getField("f5", { key, label: key, shared: key });
}

function f5UnitsForExport(src: ExportSource): F5Unit[] {
  const spec = src.getField("f5", { key: "specification", label: "specification", shared: "specification" });
  const f2 = mergeF2State(src.f2 || null);
  const good = buildSerials(f2, spec).filter((row) => !row.rejected);
  const picked = f5NormalizePicked(src.getField("f5", { key: "sampledSerials", label: "sampled" }), good);
  return f5MeasureUnits(f2, spec, picked);
}

function f5AqlDisplay(raw: string) {
  const token = String(raw || "").trim();
  const match = /([0-9]+(?:\.[0-9]+)?)/.exec(token);
  return match ? match[1]! : token;
}

function f5PartDisplay(part: string, rev: string) {
  const p = String(part || "").trim();
  const r = String(rev || "").trim();
  if (p && r && !p.endsWith(`-${r}`)) return `${p}-${r}`;
  return p;
}

const F5_LANDSCAPE_SAMPLES_PER_PAGE = 6;

function f5SamplesPerPage(doc: jsPDF) {
  return pdfIsLandscape(doc) ? F5_LANDSCAPE_SAMPLES_PER_PAGE : F5_SAMPLES_PER_PAGE;
}

function f5SampleRangeNote(chunkIndex: number, chunk: F5Unit[], total: number, perPage: number) {
  if (!(total > perPage) || !chunk.length) return "";
  const from = chunkIndex * perPage + 1;
  const to = from + chunk.length - 1;
  return `Actual measurement · samples ${from}–${to} of ${total}`;
}

function f5FilledRows(rows: Record<string, string>[], keys: string[]) {
  return rows.filter((row) => {
    const raw = String(row.readings || "").replace(/\s/g, "");
    if (raw && raw !== "{}" && raw !== "null") return true;
    return keys.some((key) => String(row[key] || "").trim());
  });
}

function renderF5ReportNo(doc: jsPDF, reportNo: string, y: number) {
  const w = doc.internal.pageSize.getWidth();
  pdfTable(doc, {
    startY: y,
    body: [
      [
        { content: "Report No.", styles: identLabel },
        { content: fmt(reportNo), styles: { ...identValue, fontStyle: "bold", textColor: ACCENT } },
      ],
    ],
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.4, right: 2.4 },
      lineColor: LIGHT,
      lineWidth: 0.2,
      valign: "middle",
    },
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 52 } },
    margin: { left: w - PAGE_MARGIN - 80, right: PAGE_MARGIN },
    tableWidth: 80,
  });
  return (doc as any).lastAutoTable.finalY + 4;
}

function renderF5Ident(doc: jsPDF, src: ExportSource, y: number) {
  const aql = f5AqlDisplay(src.getField("f5", { key: "aql", label: "aql" }) || "AQL 4.0");
  const lot = f5QtyNos(src.getField("f5", { key: "lotSize", label: "lotSize" }) || f5Shared(src, "quantity"));
  const sample = f5QtyNos(src.getField("f5", { key: "sampleSize", label: "sampleSize" }));
  const part = f5PartDisplay(f5Shared(src, "partNumber"), f5Shared(src, "partRev"));
  const supply = f5Shared(src, "supplyForm") || src.f2?.supplyForm || "";
  return identTable(doc, y, [
    [
      { content: "Customer", styles: identLabel },
      { content: fmt(f5Shared(src, "customer")), styles: identValue },
      { content: "Lot Size", styles: identLabel },
      { content: fmt(lot), styles: identValue },
    ],
    [
      { content: "Part No", styles: identLabel },
      { content: fmt(part), styles: identValue },
      { content: "AQL", styles: identLabel },
      { content: fmt(aql), styles: identValue },
    ],
    [
      { content: "Drawing No", styles: identLabel },
      { content: fmt(src.getField("f5", { key: "drawingNo", label: "drawingNo" }) || f5Shared(src, "camNumber")), styles: identValue },
      { content: "Supply Format", styles: identLabel },
      { content: fmt(supply), styles: identValue },
    ],
    [
      { content: "Week Code", styles: identLabel },
      { content: fmt(f5Shared(src, "weekCode")), styles: identValue },
      { content: "Sample Size", styles: identLabel },
      { content: fmt(sample), styles: identValue },
    ],
  ]);
}

function f5MeasureAutoTable(
  doc: jsPDF,
  report: Report,
  src: ExportSource,
  logo: string | null,
  y: number,
  head: any[],
  body: any[],
  colStyles: Record<number, object>,
  note: string,
  title = "",
) {
  if (pageChrome) {
    pageChrome.pageNote = note || "";
    pageChrome.sectionTitle = title || "";
  }
  pdfTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: chromeTopMargin(), bottom: PAGE_BOTTOM },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      fontSize: 9.2,
      cellPadding: { top: 1.8, bottom: 1.8, left: 1.6, right: 1.6 },
      overflow: "linebreak",
      valign: "middle",
      textColor: INK,
      lineColor: LIGHT,
      lineWidth: 0.2,
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: LIGHT,
      textColor: ACCENT,
      fontStyle: "bold",
      fontSize: 9.4,
      lineColor: ACCENT,
      lineWidth: 0.3,
      halign: "center",
      valign: "middle",
    },
    columnStyles: colStyles,
    didParseCell: (data: any) => {
      const fill = data.cell?.styles?.fillColor;
      if (Array.isArray(fill) && fill[0] === WARN_FILL[0] && fill[1] === WARN_FILL[1] && fill[2] === WARN_FILL[2]) {
        data.cell.styles.fillColor = WARN_FILL;
        data.cell.styles.textColor = WARN_TEXT;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  return (doc as any).lastAutoTable.finalY + 3;
}

type F5PrintRow = {
  sl: string;
  dim: string;
  plated: string;
  holes: string;
  plus: string;
  minus: string;
  uom: string;
  remarks: string;
  lw: boolean;
  readings: string;
  kind: "drill" | "board";
  raw: Record<string, string>;
};

function f5MechanicalRows(drill: Record<string, string>[]): F5PrintRow[] {
  const out: F5PrintRow[] = [];
  for (const row of drill) {
    const lw = row.mode === "L x W";
    const dim = lw ? [`L ${row.dimL || ""}`, `W ${row.dimW || ""}`].join(" × ") : row.dim || "";
    out.push({
      sl: "",
      dim,
      plated: f5Plated(row.type || ""),
      holes: row.holes || "",
      plus: lw ? [row.tolPlusL, row.tolPlusW].filter(Boolean).join(" / ") : row.tolPlus || "",
      minus: lw ? [row.tolMinusL, row.tolMinusW].filter(Boolean).join(" / ") : row.tolMinus || "",
      uom: row.uom || "mm",
      remarks: row.remarks || "",
      lw,
      readings: row.readings || "",
      kind: "drill",
      raw: row,
    });
  }
  return out.map((row, index) => ({ ...row, sl: String(index + 1) }));
}

function f5ColWidths(doc: jsPDF, weights: number[], extras?: Record<number, object>) {
  const avail = innerContentWidth(doc);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const out: Record<number, object> = {};
  weights.forEach((weight, i) => {
    out[i] = { cellWidth: (weight / sum) * avail, overflow: "linebreak", valign: "middle", ...(extras?.[i] || {}) };
  });
  return out;
}

function f5NeedPage(doc: jsPDF, y: number, minRemain = 48) {
  return y > doc.internal.pageSize.getHeight() - minRemain;
}

function f5LwTolerance(length: string | undefined, width: string | undefined): string {
  const values = [length, width]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (values.length === 2 && values[0] === values[1]) {
    return values[0]!;
  }

  return values.join(" / ");
}

function f5SectionMinRemain(bodyRows: number) {
  return 16 + 20 + Math.min(Math.max(bodyRows, 1), 5) * 10 + 12;
}

function f5ChunkedSection(
  doc: jsPDF,
  report: Report,
  src: ExportSource,
  logo: string | null,
  y: number,
  reportNo: string,
  title: string,
  units: F5Unit[],
  make: (chunk: F5Unit[]) => { head: any[]; body: any[]; colStyles: Record<number, object> },
) {
  const perPage = f5SamplesPerPage(doc);
  const chunks = f5ChunkUnits(units, perPage);
  chunks.forEach((chunk, index) => {
    const note = f5SampleRangeNote(index, chunk, units.length, perPage);
    const table = make(chunk);
    if (f5NeedPage(doc, y, f5SectionMinRemain(table.body.length))) {
      if (pageChrome) {
        pageChrome.pageNote = "";
        pageChrome.sectionTitle = "";
      }
      y = addPdfPage(doc);
    }
    if (pageChrome) {
      pageChrome.pageNote = note || "";
      pageChrome.sectionTitle = title;
    }
    y = sectionTitle(doc, title, note || undefined, y);
    y = f5MeasureAutoTable(doc, report, src, logo, y, table.head, table.body, table.colStyles, note, title);
  });
  if (pageChrome) {
    pageChrome.pageNote = "";
    pageChrome.sectionTitle = "";
  }
  return y;
}

function f5SampleHead(chunk: F5Unit[]) {
  if (!chunk.length) return [{ content: "", styles: { fontSize: 8.6 } }];
  return chunk.map((unit) => ({
    content: f5UnitHeadingStacked(unit),
    styles: { fontSize: 9.2, overflow: "linebreak", minCellHeight: 12, valign: "middle" },
  }));
}

function renderF5Body(doc: jsPDF, report: Report, src: ExportSource, y: number, logo: string | null) {
  const units = f5UnitsForExport(src);
  const productionOrder = src.getField("f1", { key: "productionOrder", label: "productionOrder" }).trim();
  const testedDate = fieldValue(report, src, "testedDate");
  const reportDateValue = testedDate || fieldValue(report, src, "date", "cocDate");
  const reportNo = f5ReportNumber(productionOrder || f5Shared(src, "batchCode"), reportDateValue);
  const drill = f5FilledRows(src.getRows("f5", "drill"), ["dim", "dimL", "dimW", "holes", "type"]);
  const board = f5FilledRows(src.getRows("f5", "board"), ["dim", "tolPlus", "tolMinus", "remarks", "characteristic"]);
  const countersink = f5FilledRows(src.getRows("f5", "countersink"), [
    "dim",
    "dimL",
    "dimW",
    "holes",
    "remarks",
    "type",
    "feature",
    "tolPlus",
    "tolMinus",
  ]);
  const laser = f5FilledRows(src.getRows("f5", "laser"), ["size", "holes", "remarks", "characteristic"]);
  const mechanical = f5MechanicalRows(drill);

  y = renderF5ReportNo(doc, reportNo, y);
  y = renderF5Ident(doc, src, y);

  if (mechanical.length) {
    y = f5ChunkedSection(doc, report, src, logo, y, reportNo, "Mechanical measurements", units, (chunk) => {
      const sampleCount = Math.max(chunk.length, 1);
      const head = [
        [
          { content: "Sl No.", rowSpan: 2 },
          { content: "Dimension Requirement", rowSpan: 2 },
          { content: "Plated?", rowSpan: 2 },
          { content: "No. of Holes", rowSpan: 2 },
          { content: "+Ve", rowSpan: 2 },
          { content: "-Ve", rowSpan: 2 },
          { content: "UOM", rowSpan: 2 },
          { content: "Actual Measurement", colSpan: sampleCount },
          { content: "Remarks", rowSpan: 2 },
        ],
        f5SampleHead(chunk),
      ];
      const body = mechanical.map((row) => {
        const readings = f5ParseReadings(row.readings);
        const samples = chunk.length
          ? chunk.map((unit) => f5PdfCell(f5ReadingText(readings[unit.id], row.lw), f5DrillReadingOut(readings[unit.id], row.raw)))
          : [fmt("")];
        return [row.sl, fmt(row.dim), fmt(row.plated), fmt(row.holes), fmt(row.plus), fmt(row.minus), fmt(row.uom), ...samples, fmt(row.remarks)];
      });
      const sampleWeights = Array.from({ length: sampleCount }, () => 12);
      const colStyles = f5ColWidths(doc, [10, 28, 14, 16, 12, 12, 12, ...sampleWeights, 22], {
        0: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
        6: { halign: "center" },
      });
      return { head, body, colStyles };
    });
  }

  if (countersink.length) {
    y = f5ChunkedSection(doc, report, src, logo, y, reportNo, "Counter Sink, Cutout, Slot Measurements", units, (chunk) => {
      const sampleCount = Math.max(chunk.length, 1);
      const head = [
        [
          { content: "Sl No.", rowSpan: 2 },
          { content: "Characteristics", rowSpan: 2 },
          { content: "Feature", rowSpan: 2 },
          { content: "Requirement", rowSpan: 2 },
          { content: "Holes/Slots", rowSpan: 2 },
          { content: "+Ve", rowSpan: 2 },
          { content: "-Ve", rowSpan: 2 },
          { content: "UOM", rowSpan: 2 },
          { content: "Actual Measurement", colSpan: sampleCount },
          { content: "Remarks", rowSpan: 2 },
        ],
        f5SampleHead(chunk),
      ];
      const body = countersink.map((row, index) => {
        const lw = row.mode === "L x W";
        const dim = lw
        ? [row.dimL, row.dimW]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" × ")
        : row.dim || "";
        const readings = f5ParseReadings(row.readings);
        const samples = chunk.length
          ? chunk.map((unit) => f5PdfCell(f5ReadingText(readings[unit.id], lw), f5DrillReadingOut(readings[unit.id], row)))
          : [fmt("")];
        return [
          row.sl || String(index + 1),
          fmt(row.type),
          fmt(row.feature || "Counter Sink"),
          fmt(dim),
          fmt(row.holes),
          fmt(lw ? f5LwTolerance(row.tolPlusL, row.tolPlusW) : row.tolPlus),
          fmt(lw ? f5LwTolerance(row.tolMinusL, row.tolMinusW) : row.tolMinus),
          fmt(row.uom || "mm"),
          ...samples,
          fmt(row.remarks),
        ];
      });
      const sampleWeights = Array.from({ length: sampleCount }, () => 12);
      return {
        head,
        body,
        colStyles: f5ColWidths(doc, [10, 18, 22, 32, 16, 14, 14, 12, ...sampleWeights, 20], {
          0: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "center" },
          6: { halign: "center" },
          7: { halign: "center" },
        }),
      };
    });
  }

  if (laser.length) {
    y = f5ChunkedSection(doc, report, src, logo, y, reportNo, "Dimple & Bump Measurements", units, (chunk) => {
      const sampleCount = Math.max(chunk.length, 1);
      const head = [
        [
          { content: "Sl No.", rowSpan: 2 },
          { content: "Characteristics", rowSpan: 2 },
          { content: "Drill Size", rowSpan: 2 },
          { content: "Requirement", rowSpan: 2 },
          { content: "Holes/Slots", rowSpan: 2 },
          { content: "Actual Measurement", colSpan: sampleCount },
          { content: "Remarks", rowSpan: 2 },
        ],
        f5SampleHead(chunk),
      ];
      const groups: { char: string; rows: Record<string, string>[] }[] = [];
      laser.forEach((row) => {
        const cells: any[] = [row.sl || "", fmt(row.feature || "Via Hole")];
        const char = row.characteristic || "Dimple";
        const last = groups[groups.length - 1];
        if (last && last.char === char) last.rows.push(row);
        else groups.push({ char, rows: [row] });
      });
      const body: any[] = [];
      groups.forEach((group) => {
        group.rows.forEach((row, index) => {
          const readings = f5ParseReadings(row.readings);
          const samples = chunk.length
            ? chunk.map((unit) =>
                f5PdfCell(
                  f5ReadingText(readings[unit.id]),
                  f5LaserOut(readings[unit.id]?.actual || "", row.size || "", row.characteristic || ""),
                ),
              )
            : [fmt("")];
          const cells: any[] = [row.sl || ""];
          if (index === 0) {
            cells.push({
              content: fmt(group.char),
              rowSpan: group.rows.length,
              styles: { valign: "middle", overflow: "linebreak" },
            });
          }
          cells.push(
            fmt(row.size),
            fmt(f5LaserReq(row.size || "", row.characteristic || "")),
            fmt(row.holes),
            ...samples,
            fmt(row.remarks),
          );
          body.push(cells);
        });
      });
      const sampleWeights = Array.from({ length: sampleCount }, () => 14);
      return {
        head,
        body,
        colStyles: f5ColWidths(doc, [10, 18, 24, 18, 28, 16, ...sampleWeights, 22], {
          0: { halign: "center" },
          2: { halign: "center" },
          4: { halign: "center" },
        }),
      };
    });
  }

  if (board.length) {
    y = f5ChunkedSection(doc, report, src, logo, y, reportNo, "Board dimensional", units, (chunk) => {
      const sampleCount = Math.max(chunk.length, 1);
      const head = [
        [
          { content: "Sl No.", rowSpan: 2 },
          { content: "Characteristic", rowSpan: 2 },
          { content: "Requirement", rowSpan: 2 },
          { content: "+Ve", rowSpan: 2 },
          { content: "-Ve", rowSpan: 2 },
          { content: "UOM", rowSpan: 2 },
          { content: "Actual Measurement", colSpan: sampleCount },
          { content: "Remarks", rowSpan: 2 },
        ],
        f5SampleHead(chunk),
      ];
      const body = board.map((row, index) => {
        const bow = /bow/i.test(row.characteristic || "");
        const req = bow && row.bowMode && row.bowMode !== "Custom" ? row.bowMode : row.dim || "";
        const readings = f5ParseReadings(row.readings);
        const samples = chunk.length
          ? chunk.map((unit) =>
              f5PdfCell(f5ReadingText(readings[unit.id]), f5BoardReadingOut(readings[unit.id], row)),
            )
          : [fmt("")];
        return [
          row.sl || String(index + 1),
          fmt(row.characteristic || "Board thickness"),
          fmt(req),
          fmt(bow ? "" : row.tolPlus),
          fmt(bow ? "" : row.tolMinus),
          fmt(bow ? "%" : row.uom || "mm"),
          ...samples,
          fmt(row.remarks),
        ];
      });
      const sampleWeights = Array.from({ length: sampleCount }, () => 14);
      return {
        head,
        body,
        colStyles: f5ColWidths(doc, [10, 36, 28, 14, 14, 12, ...sampleWeights, 22], {
          0: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "center" },
        }),
      };
    });
  }

  const inspected = f5QtyNos(src.getField("f5", { key: "sampleSize", label: "sampleSize" }));
  const accepted = f5QtyNos(src.getField("f5", { key: "lotSize", label: "lotSize" }) || f5Shared(src, "quantity"));
  if (f5NeedPage(doc, y, 40)) {
    if (pageChrome) pageChrome.pageNote = "";
    y = addPdfPage(doc);
  }
  y = identTable(doc, y, [
    [
      { content: "Qty Inspected", styles: identLabel },
      { content: fmt(inspected), styles: identValue },
      { content: "Qty Accepted", styles: identLabel },
      { content: fmt(accepted), styles: identValue },
    ],
  ]);

  const signoff = report.sections.find((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff");
  if (signoff) y = renderSignoff(doc, report, signoff, src, y);
  return y;
}

function f6Shared(src: ExportSource, key: string) {
  return src.getField("f6", { key, label: key, shared: key });
}

function renderF6ReportNo(doc: jsPDF, reportNo: string, y: number) {
  const w = doc.internal.pageSize.getWidth();
  pdfTable(doc, {
    startY: y,
    body: [
      [
        { content: "Report No.", styles: identLabel },
        { content: fmt(reportNo), styles: { ...identValue, fontStyle: "bold", textColor: ACCENT } },
      ],
    ],
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.4, right: 2.4 },
      lineColor: LIGHT,
      lineWidth: 0.2,
      valign: "middle",
    },
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 52 } },
    margin: { left: w - PAGE_MARGIN - 80, right: PAGE_MARGIN },
    tableWidth: 80,
  });
  return (doc as any).lastAutoTable.finalY + 4;
}

function renderF6Ident(doc: jsPDF, src: ExportSource, y: number, acceptedPanels: number) {
  const part = f5PartDisplay(f6Shared(src, "partNumber"), f6Shared(src, "partRev"));
  return identTable(doc, y, [
    [
      { content: "Customer", styles: identLabel },
      { content: fmt(f6Shared(src, "customer")), colSpan: 3, styles: identValue },
    ],
    [
      { content: "P.O. Number", styles: identLabel },
      { content: fmt(f6Shared(src, "poNumber")), styles: identValue },
      { content: "Total Accepted Panels", styles: identLabel },
      { content: fmt(acceptedPanels ? String(acceptedPanels) : ""), styles: identValue },
    ],
    [
      { content: "Part Number", styles: identLabel },
      { content: fmt(part), styles: identValue },
      { content: "Week Code", styles: identLabel },
      { content: fmt(f6Shared(src, "weekCode")), styles: identValue },
    ],
  ]);
}

function f6PanelRangeNote(chunkIndex: number, chunk: string[], total: number) {
  if (!(total > F6_PANELS_PER_PAGE) || !chunk.filter(Boolean).length) return "";
  const from = chunkIndex * F6_PANELS_PER_PAGE + 1;
  const to = from + chunk.length - 1;
  return `HI-Q production panel number · ${from}–${to} of ${total}`;
}

function drawF6Tick(doc: jsPDF, x: number, y: number, size: number, accepted: boolean) {
  doc.setLineCap("round");
  doc.setLineJoin("round");
  doc.setLineWidth(Math.max(0.7, size * 0.14));
  if (accepted) {
    doc.setDrawColor(...ACCENT);
    doc.line(x + size * 0.1, y + size * 0.52, x + size * 0.38, y + size * 0.84);
    doc.line(x + size * 0.38, y + size * 0.84, x + size * 0.92, y + size * 0.16);
    return;
  }
  doc.setDrawColor(...WARN_TEXT);
  const p = size * 0.22;
  doc.line(x + p, y + p, x + size - p, y + size - p);
  doc.line(x + size - p, y + p, x + p, y + size - p);
}

function renderF6MarkLegend(doc: jsPDF, y: number, x = PAGE_MARGIN) {
  const icon = 4.6;
  const gap = 2.2;
  const space = 9;
  const iconY = y - 3.6;
  drawF6Tick(doc, x, iconY, icon, true);
  doc.setFont(pdfFontFamily, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  let cx = x + icon + gap;
  doc.text("Accepted", cx, y);
  cx += doc.getTextWidth("Accepted") + space;
  drawF6Tick(doc, cx, iconY, icon, false);
  cx += icon + gap;
  doc.text("Not accepted", cx, y);
  cx += doc.getTextWidth("Not accepted") + space;
  doc.text("NA  Not applicable", cx, y);
  return y + 6;
}

function f6MarkLegendWidth(doc: jsPDF) {
  doc.setFont(pdfFontFamily, "normal");
  doc.setFontSize(9.5);
  const icon = 4.6;
  const gap = 2.2;
  const space = 9;
  return (
    icon + gap + doc.getTextWidth("Accepted") + space +
    icon + gap + doc.getTextWidth("Not accepted") + space +
    doc.getTextWidth("NA  Not applicable")
  );
}

function renderF6Body(doc: jsPDF, report: Report, src: ExportSource, y: number, logo: string | null) {
  const f2 = mergeF2State(src.f2 || null);
  const panels = f6AcceptedPanelLabels(f2);
  const chunks = f6ChunkPanels(panels);
  const rows = src.getRows(report.id, "structural");
  const productionOrder = src.getField("f1", { key: "productionOrder", label: "productionOrder" }).trim();
  const testedDate = fieldValue(report, src, "testedDate");
  const reportDateValue = testedDate || fieldValue(report, src, "date", "cocDate");
  const reportNo = f6ReportNumber(productionOrder || f6Shared(src, "batchCode"), reportDateValue);

  y = renderF6ReportNo(doc, reportNo, y);
  y = renderF6Ident(doc, src, y, panels.length);

  chunks.forEach((chunk, index) => {
    const note = f6PanelRangeNote(index, chunk, panels.length);
    if (index > 0 || y > doc.internal.pageSize.getHeight() - 70) {
      if (pageChrome) {
  pageChrome.pageNote = "";
  pageChrome.sectionTitle = "";
}
      y = addPdfPage(doc);
      y = renderF6Ident(doc, src, y, panels.length);
    }

    const sampleCount = Math.max(chunk.length, 1);
    const head = [
      [
        { content: "Inspection", rowSpan: 2 },
        { content: "Requirement (IPC-6012)", rowSpan: 2 },
        { content: "HI-Q Production Panel Number", colSpan: sampleCount },
        { content: "Remarks", rowSpan: 2 },
      ],
      chunk.map((label) => ({ content: label || "", styles: { fontSize: 9.5, halign: "center" as const } })),
    ];
    const body = rows.map((row) => {
      const status = f6PanelPrintLabel(row.panel1 || "");
      const samples = chunk.map(() => fmt(status));
      return [fmt(row.inspection), fmt(row.req), ...samples, fmt(row.remarks)];
    });
    const colStyles: Record<number, object> = {
      0: { cellWidth: 52 },
      1: { cellWidth: 32, fontSize: 10 },
    };

    pdfTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: chromeTopMargin(), bottom: 22 },
      showHead: "everyPage",
      rowPageBreak: "avoid",
      styles: {
        fontSize: CONTENT_FONT,
        cellPadding: 1.5,
        overflow: "linebreak",
        valign: "middle",
        textColor: INK,
        lineColor: LIGHT,
        lineWidth: 0.2,
        halign: "center",
        minCellHeight: 10,
      },
      headStyles: {
        fillColor: LIGHT,
        textColor: ACCENT,
        fontStyle: "bold",
        fontSize: CONTENT_HEAD,
        lineColor: ACCENT,
        lineWidth: 0.3,
        halign: "center",
        valign: "middle",
      },
      columnStyles: {
        ...colStyles,
        0: { ...colStyles[0], halign: "left" },
        [2 + sampleCount - 1 + 1]: { halign: "left", cellWidth: 24 },
      },
      didParseCell: (data: any) => {
        const raw = String(data.cell.raw ?? "");
        if (data.section === "head") {
          data.cell.styles.fillColor = LIGHT;
          data.cell.styles.textColor = ACCENT;
        }
        if (data.section === "body" && data.column.index >= 2 && data.column.index < 2 + sampleCount) {
          data.cell.styles.overflow = "hidden";
          data.cell.styles.cellPadding = { top: 1.4, bottom: 1.4, left: 0.4, right: 0.4 };
          if (raw === F6_MARK_ACCEPTED || raw === F6_MARK_NOT_ACCEPTED) {
            data.cell.text = [""];
          }
        }
      },
      didDrawCell: (data: any) => {
        if (data.section !== "body" || data.column.index < 2 || data.column.index >= 2 + sampleCount) return;
        // Split-row leftovers are a few mm tall; drawing the mark there sits on top of Back Drill (X).
        if (data.cell.height < 7) return;
        const raw = String(data.cell.raw ?? "");
        if (raw !== F6_MARK_ACCEPTED && raw !== F6_MARK_NOT_ACCEPTED) return;
        const size = Math.min(data.cell.width, data.cell.height) * 0.62;
        const x = data.cell.x + (data.cell.width - size) / 2;
        const y = data.cell.y + (data.cell.height - size) / 2;
        drawF6Tick(doc, x, y, size, raw === F6_MARK_ACCEPTED);
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  });

  const signoff = report.sections.find((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff");
  if (signoff) y = renderSignoff(doc, report, signoff, src, y);
  return y;
}

function panelsPhrase(value: string) {
  const token = String(value || "").trim();
  if (!token) return "";
  if (/panel/i.test(token)) return token;
  return /^\d+(\.\d+)?$/.test(token) ? `${token} Panels` : token;
}

function sampleAql(value: string) {
  const token = String(value || "").trim();
  const match = /([0-9]+(?:\.[0-9]+)?)/.exec(token);
  return match ? `Sample ${match[1]}` : token;
}

function localField(src: ExportSource, reportId: string, key: string, fallback = "") {
  return src.getField(reportId, { key, label: key }) || fallback;
}

function jobIdentRows(src: ExportSource, extra: any[] = []) {
  const part = f5PartDisplay(
    src.getField("f1", { key: "partNumber", label: "partNumber", shared: "partNumber" }),
    src.getField("f1", { key: "partRev", label: "partRev", shared: "partRev" }),
  );
  return [
    [
      { content: "Customer", styles: identLabel },
      { content: fmt(src.getField("f1", { key: "customer", label: "customer", shared: "customer" })), colSpan: 3, styles: identValue },
    ],
    [
      { content: "Part Number", styles: identLabel },
      { content: fmt(part), styles: identValue },
      { content: "P.O. Number", styles: identLabel },
      { content: fmt(src.getField("f1", { key: "poNumber", label: "poNumber", shared: "poNumber" })), styles: identValue },
    ],
    [
      { content: "Quantity", styles: identLabel },
      { content: fmt(f4QtyPassed(src.getField("f1", { key: "quantity", label: "quantity", shared: "quantity" }))), styles: identValue },
      { content: "Week Code", styles: identLabel },
      { content: fmt(src.getField("f1", { key: "weekCode", label: "weekCode", shared: "weekCode" })), styles: identValue },
    ],
    ...extra,
  ];
}

function resultTable(
  doc: jsPDF,
  y: number,
  title: string,
  head: string[],
  body: any[],
  colStyles: Record<number, object>,
  resultIndex: number,
) {
  y = sectionTitle(doc, title, undefined, y);
  pdfTable(doc, {
    startY: y,
    head: [head],
    body,
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "middle",
      textColor: INK,
      lineColor: LIGHT,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: LIGHT,
      textColor: ACCENT,
      fontStyle: "bold",
      fontSize: CONTENT_HEAD,
      lineColor: ACCENT,
      lineWidth: 0.3,
      halign: "center",
      valign: "middle",
    },
    columnStyles: colStyles,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    didParseCell: (data: any) => {
      const raw = String(data.cell.raw ?? "");
      if (data.section === "head") {
        data.cell.styles.fillColor = LIGHT;
        data.cell.styles.textColor = ACCENT;
      }
      if (data.section === "body" && data.column.index === resultIndex) {
        if (raw === "Pass") {
          data.cell.styles.textColor = ACCENT;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "center";
        }
        if (raw === "Fail") {
          data.cell.styles.textColor = [178, 38, 38];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "center";
        }
        if (raw === "NA") data.cell.styles.halign = "center";
      }
    },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

function renderF15Body(doc: jsPDF, report: Report, src: ExportSource, y: number) {
  const productionOrder = src.getField("f1", { key: "productionOrder", label: "productionOrder" }).trim();
  const testedDate = fieldValue(report, src, "testedDate");
  const reportDateValue = testedDate || fieldValue(report, src, "date", "cocDate");
  const reportNo = f15ReportNumber(productionOrder, reportDateValue);
  y = renderF6ReportNo(doc, reportNo, y);
  y = identTable(
    doc,
    y,
    jobIdentRows(src, [
      [
        { content: "Applicable Standard", styles: identLabel },
        { content: fmt(localField(src, "f15", "standard", F15_STANDARD)), styles: identValue },
        { content: "Coating Durability", styles: identLabel },
        { content: fmt(localField(src, "f15", "durability", "Coating Durability A")), styles: identValue },
      ],
      [
        { content: "Solderable Surface mount land Present?", styles: identLabel },
        { content: fmt(localField(src, "f15", "smtLand", "Yes")), styles: identValue },
        { content: "Solderable PTH Present?", styles: identLabel },
        { content: fmt(localField(src, "f15", "pth", "Yes")), styles: identValue },
      ],
      [
        { content: "Solder Used", styles: identLabel },
        { content: fmt(localField(src, "f15", "solder", "SAC 305")), styles: identValue },
        { content: "AQL", styles: identLabel },
        { content: fmt(sampleAql(localField(src, "f15", "aql", "AQL 2.5"))), styles: identValue },
      ],
      [
        { content: "No. of Panels in Lot", styles: identLabel },
        { content: fmt(panelsPhrase(localField(src, "f15", "lotPanels"))), styles: identValue },
        { content: "No. of Panels Tested", styles: identLabel },
        { content: fmt(panelsPhrase(localField(src, "f15", "testedPanels"))), styles: identValue },
      ],
    ]),
  );

  const rows = src.getRows(report.id, "results");
  y = resultTable(
    doc,
    y,
    "Test result",
    ["Category", "Test Specimen", "Requirement", "Observation", "Result"],
    rows.map((row) => [
      fmt(row.category),
      fmt(row.specimen),
      fmt(row.requirement),
      fmt(row.observation),
      fmt(f15ResultDisplay(row.result || "")),
    ]),
    {
      0: { cellWidth: 36, fontStyle: "bold", fontSize: 10 },
      1: { cellWidth: 28 },
      4: { cellWidth: 18, halign: "center", fontStyle: "bold" },
    },
    4,
  );

  const signoff = report.sections.find((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff");
  if (signoff) y = renderSignoff(doc, report, signoff, src, y);
  return y;
}

function renderF16Body(doc: jsPDF, report: Report, src: ExportSource, y: number) {
  const productionOrder = src.getField("f1", { key: "productionOrder", label: "productionOrder" }).trim();
  const testedDate = fieldValue(report, src, "testedDate");
  const reportDateValue = testedDate || fieldValue(report, src, "date", "cocDate");
  const reportNo = f16ReportNumber(productionOrder, reportDateValue);
  y = renderF6ReportNo(doc, reportNo, y);
  y = identTable(
    doc,
    y,
    jobIdentRows(src, [
      [
        { content: "No. of Panels in Lot", styles: identLabel },
        { content: fmt(panelsPhrase(localField(src, "f16", "lotPanels"))), styles: identValue },
        { content: "AQL", styles: identLabel },
        { content: fmt(sampleAql(localField(src, "f16", "aql", "AQL 4.0"))), styles: identValue },
      ],
      [
        { content: "No. of Panels Tested", styles: identLabel },
        { content: fmt(panelsPhrase(localField(src, "f16", "testedPanels"))), colSpan: 3, styles: identValue },
      ],
    ]),
  );

  const rows = src.getRows(report.id, "results");
  if (pageChrome) pageChrome.sectionTitle = "ADHESION TEST";
  y = resultTable(
    doc,
    y,
    "Adhesion test",
    ["Adhesion Type", "Test Method", "Test Specimen", "Requirement", "Observation", "Result"],
    rows.map((row) => [
      fmt(row.type),
      fmt(row.method),
      fmt(row.specimen),
      fmt(row.requirement),
      fmt(row.observation),
      fmt(f16ResultDisplay(row.result || "")),
    ]),
    {
      0: { cellWidth: 28, fontStyle: "bold", fontSize: 10 },
      1: { cellWidth: 32, fontSize: 10 },
      2: { cellWidth: 28 },
      5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
    },
    5,
  );

  const signoff = report.sections.find((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff");
  if (signoff) y = renderSignoff(doc, report, signoff, src, y);
  return y;
}

function ordinalDay(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Convert schema rev like "Rev 2.07 · Eff. 05 Sep 2025" → "Rev:2.07 · Effect Date:05th Sep 2025". */
function formatFooterMeta(rev: string) {
  const match = /Rev\s*([0-9.]+)\s*[·•-]?\s*Eff\.?\s*(.+)$/i.exec(rev.trim());
  if (!match) return rev;
  const revision = match[1]!;
  const rawDate = match[2]!.trim().replace(/\s+/g, " ");
  const dateMatch = /^(\d{1,2})\s+(.+)$/.exec(rawDate);
  const effectDate = dateMatch
    ? `${ordinalDay(Number(dateMatch[1]))} ${dateMatch[2]}`
    : rawDate;
  return `Rev: ${revision} · Effect Date: ${effectDate}`;
}

function drawFooter(doc: jsPDF, report: Report, from = 1, to = doc.getNumberOfPages(), total = doc.getNumberOfPages()) {
  const meta = formatFooterMeta(report.rev);
  const inset = report.id === "f7" ? 6 : PAGE_MARGIN;
  const footerY = report.id === "f7" ? 5.4 : 6.5;
  const lineY = report.id === "f7" ? 8.5 : 10;
  const lineColor = pdfSkin === "current" ? LIGHT : themeById(pdfSkin).footerLine;
  for (let i = from; i <= to; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.4);
    if (report.id === "f6") {
      renderF6MarkLegend(doc, h - 14, (w - f6MarkLegendWidth(doc)) / 2);
      doc.setDrawColor(...lineColor);
      doc.setLineWidth(0.4);
    }
    doc.line(inset, h - lineY, w - inset, h - lineY);
    doc.setFont(pdfFontFamily, "normal");
    doc.setFontSize(report.id === "f7" ? 6.6 : 7);
    doc.setTextColor(...MUTED);
    doc.text(`${report.code} · ${meta}`, inset, h - footerY);
    doc.text(`Page ${i} of ${total}`, w - inset, h - footerY, { align: "right" });
  }
}


function cleanSectionHeading(title: string) {
  return String(title || "")
    .replace(/^\s*0+[\s.)-]+/, "")
    .replace(/^\s*0+\s+/, "")
    .trim()
    .toUpperCase();
}

function sectionTitle(doc: jsPDF, title: string, subtitle: string | undefined, y: number, allowPageBreak = true) {
  if (allowPageBreak && !drawingPageChrome && y > pageContentBottom(doc) - 22) {
    if (y > chromeTopMargin() + 10) y = addPdfPage(doc);
  }
  const label = cleanSectionHeading(title);
  const barW = 1.8;
  const barH = 5.2;
  const barR = 0.55;
  const gap = 2.6;
  const compactF1 = pageChrome?.report.id === "f1";
  const baseline = y + (compactF1 ? 3.2 : 4.4);
  const barY = baseline - 3.7;
  if (pdfSkin === "modern") {
    doc.setFillColor(...ACCENT);
    doc.roundedRect(PAGE_MARGIN, barY, barW, barH, barR, barR, "F");
  } else if (pdfSkin === "executive") {
    doc.setFillColor(...LIGHT);
    doc.rect(PAGE_MARGIN, barY, innerContentWidth(doc), barH, "F");
    doc.setFillColor(...ACCENT);
    doc.rect(PAGE_MARGIN, barY, barW, barH, "F");
  } else {
    doc.setFillColor(...ACCENT);
    doc.rect(PAGE_MARGIN, barY, 2.2, barH, "F");
  }
  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(label, PAGE_MARGIN + barW + gap, baseline);
  if (subtitle) {
    doc.setFont(pdfFontFamily, "normal");
    doc.setFontSize(compactF1 ? 8.5 : 11);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, PAGE_MARGIN + barW + gap, baseline + 5.6);
    return baseline + 12;
  }
  return baseline + (compactF1 ? 4 : 7);
}

function isBlankSpecToken(value: string) {
  const token = String(value || "").trim();
  return !token || /^(n\/?a|na|nil|-|—|–)$/i.test(token);
}

function combinedSpecification(spec: string, regulatory: string) {
  const parts = [spec, regulatory].map((item) => String(item || "").trim()).filter((item) => !isBlankSpecToken(item));
  return parts.join(" & ");
}

function innerContentWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2;
}

function fieldItems(report: Report, section: any, src: ExportSource) {
  const items: { label: string; value: string; wide: boolean }[] = [];
  for (const f of section.fields) {
    if (f.key === "regulatoryRequirement" || f.shared === "regulatoryRequirement") continue;
    if (f.key === "specification" || f.shared === "specification") {
      const regulatoryField = section.fields.find(
        (x: any) => x.key === "regulatoryRequirement" || x.shared === "regulatoryRequirement",
      );
      const regulatoryValue = regulatoryField
        ? src.getField(report.id, regulatoryField)
        : src.getField("f1", {
            key: "regulatoryRequirement",
            label: "Regulatory Requirement",
            shared: "regulatoryRequirement",
          });
      items.push({
        label: "Specification",
        value: fmt(combinedSpecification(src.getField(report.id, f), regulatoryValue)),
        wide: true,
      });
      continue;
    }
    items.push({
      label: f.label,
      value: fmt(src.getField(report.id, f)),
      wide: Boolean(f.span && f.span > 1) || f.type === "textarea",
    });
  }
  return items;
}

function renderStackedFieldGrid(doc: jsPDF, report: Report, section: any, src: ExportSource, y: number) {
  if (section.title) y = sectionTitle(doc, section.title, section.subtitle, y);
  const compactF1 = report.id === "f1";
  const items = fieldItems(report, section, src);
  const avail = innerContentWidth(doc);
   const labelStyle = {
    fontStyle: "bold" as const,
    textColor: ACCENT,
    fontSize: compactF1 ? 7.2 : 8.2,
    overflow: "linebreak" as const,
    valign: "top" as const,
    minCellHeight: compactF1 ? 4.5 : 5.6,
    cellPadding: {
      top: compactF1 ? 0.7 : 1.6,
      bottom: compactF1 ? 0.5 : 1.0,
      left: 2.2,
      right: 2.2,
    },
  };
    const valueStyle = {
    textColor: INK,
    fontStyle: "normal" as const,
    fontSize: compactF1 ? 7.5 : CONTENT_FONT,
    overflow: "linebreak" as const,
    valign: "top" as const,
    minCellHeight: compactF1 ? 5.3 : 7.8,
    cellPadding: {
      top: 0.3,
      bottom: compactF1 ? 0.8 : 2.8,
      left: 2.2,
      right: 2.2,
    },
  };
  const body: any[] = [];
  let pair: typeof items = [];
  const flushPair = () => {
    if (!pair.length) return;
    if (pair.length === 1) pair.push({ label: "", value: "", wide: false });
    body.push([
      { content: pair[0]!.label, styles: labelStyle },
      { content: pair[1]!.label, styles: labelStyle },
    ]);
    body.push([
      { content: pair[0]!.value || " ", styles: valueStyle },
      { content: pair[1]!.value || " ", styles: valueStyle },
    ]);
    pair = [];
  };
  for (const item of items) {
    if (item.wide) {
      flushPair();
      body.push([{ content: item.label, colSpan: 2, styles: labelStyle }]);
      body.push([{ content: item.value || " ", colSpan: 2, styles: valueStyle }]);
      continue;
    }
    pair.push(item);
    if (pair.length === 2) flushPair();
  }
  flushPair();

  pdfTable(doc, {
    startY: y,
    body,
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      overflow: "linebreak",
      valign: "top",
      lineColor: LIGHT,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: avail / 2 },
      1: { cellWidth: avail / 2 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + (compactF1 ? 3 : 10);
}

function renderFields(doc: jsPDF, report: Report, section: any, src: ExportSource, y: number, perRow: number) {
  if (report.id === "f1") return renderStackedFieldGrid(doc, report, section, src, y);
  if (section.title) y = sectionTitle(doc, section.title, section.subtitle, y);
  const items = fieldItems(report, section, src);
  const cells: any[] = [];
  let row: any[] = [];

  const pushRow = () => {
    if (!row.length) return;
    while (row.length < perRow * 2) row.push("");
    cells.push(row);
    row = [];
  };

  for (const item of items) {
    if (item.wide) {
      pushRow();
      const pad = perRow * 2 - 2;
      cells.push([item.label, { content: item.value, colSpan: pad + 1 }]);
      continue;
    }
    row.push(item.label, item.value);
    if (row.length >= perRow * 2) pushRow();
  }
  pushRow();

  const avail = innerContentWidth(doc);
  const labelW = perRow === 2 ? Math.min(54, avail * 0.26) : Math.min(38, avail * 0.16);
  const valueW = (avail - labelW * perRow) / perRow;
  const colStyles: any = {};
  for (let i = 0; i < perRow * 2; i++) {
    colStyles[i] =
      i % 2 === 0
        ? {
            fontStyle: "bold",
            textColor: ACCENT,
            fontSize: 8.4,
            cellWidth: labelW,
            overflow: "linebreak",
          }
        : { textColor: INK, fontStyle: "normal", cellWidth: valueW, overflow: "linebreak" };
  }

  pdfTable(doc, {
    startY: y,
    body: cells,
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      overflow: "linebreak",
      cellPadding: { top: 2.4, bottom: 2.4, left: 2.2, right: 2.2 },
      lineColor: LIGHT,
      lineWidth: 0.2,
      valign: "middle",
    },
    columnStyles: colStyles,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

function buildTableBody(report: Report, section: any, rows: Record<string, string>[]) {
  const colCount = section.columns.length;
  const groupCell = (label: string) => [
    {
      content: String(label || "").replace(/\. /g, ".\u00A0"),
      colSpan: colCount,
      styles: {
        fillColor: ACCENT,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9.2,
        halign: "left",
        valign: "middle",
        minCellHeight: 8.2,
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.8, right: 2.8 },
        overflow: "ellipsize",
      },
    },
  ];

  if (report.id === "f3" && section.key === "checklist") {
    const mergeFrom = section.columns.findIndex((c: any) => c.key === "specimen");
    const mergeTo = section.columns.findIndex((c: any) => c.key === "obs");
    const from = mergeFrom >= 0 ? mergeFrom : 3;
    const to = mergeTo >= 0 ? mergeTo : 7;
    const mergeSpan = to - from + 1;
    const body: any[] = [];
    rows.forEach((r, index) => {
      if (r.__group) {
        body.push(groupCell(r.__group));
        return;
      }
      const merge = f3CertMerge(rows, index);
      const cells: any[] = [];
      section.columns.forEach((c: any, ci: number) => {
      if (merge.kind !== "none" && ci >= from && ci <= to) {
        if (ci === from) {
          cells.push({
            content: merge.kind === "start" ? r.method || F3_CERT_TEXT : "",
            colSpan: mergeSpan,
            styles: { halign: "center", valign: "middle" },
          });
        }
        return;
      }

      cells.push(fmt(r[c.key] ?? ""));
    });

    body.push(cells);
  });

  return body;
}

  const body: any[] = [];
  for (const r of rows) {
    if (r.__group) {
      body.push(groupCell(r.__group));
      continue;
    }
    body.push(section.columns.map((c: any) => fmt(r[c.key] ?? "")));
  }
  return body;
}

function renderTable(doc: jsPDF, report: Report, section: any, src: ExportSource, y: number) {
  if (pageChrome) pageChrome.sectionTitle = cleanSectionHeading(section.title ?? "");
  const minBlock = report.id === "f3" ? 32 : 24;
  if (!drawingPageChrome && y + minBlock > pageContentBottom(doc)) {
    y = addPdfPage(doc);
  }
  y = sectionTitle(doc, section.title ?? "Table", section.subtitle, y);
  const rows = src.getRows(report.id, section.key);
  const head = [section.columns.map((c: any) => c.label)];
  const body = buildTableBody(report, section, rows);

  const totalWeight = section.columns.reduce((a: number, c: any) => a + (c.width ?? 1), 0);
  const avail = innerContentWidth(doc);
  const colStyles: any = {};
  section.columns.forEach((c: any, i: number) => {
    colStyles[i] = { cellWidth: ((c.width ?? 1) / totalWeight) * avail, overflow: "linebreak" };
  });
  const f3 = report.id === "f3" && section.key === "checklist";

  pdfTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: LIGHT,
      textColor: ACCENT,
      fontSize: f3 ? 8 : CONTENT_HEAD,
      fontStyle: "bold",
      cellPadding: { top: 1.8, bottom: 1.8, left: 1.6, right: 1.6 },
      lineColor: ACCENT,
      lineWidth: 0.35,
      overflow: "linebreak",
      valign: "middle",
    },
    styles: {
      fontSize: f3 ? 8.2 : CONTENT_FONT,
      cellPadding: { top: 1.8, bottom: 1.8, left: 1.8, right: 1.8 },
      lineColor: LIGHT,
      lineWidth: 0.2,
      textColor: INK,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: f3 ? 7.4 : 6.2,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: colStyles,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    didParseCell: (data: any) => {
      const raw = String(data.cell.raw ?? data.cell.text?.[0] ?? "");
      if (data.section === "head") {
        data.cell.styles.fillColor = LIGHT;
        data.cell.styles.textColor = ACCENT;
      }
      if (data.cell.colSpan && data.cell.colSpan > 1 && data.section === "body") {
        data.cell.styles.overflow = "ellipsize";
        data.cell.styles.valign = "middle";
      }
      if (data.section === "body" && ["Pass", "Passed", "Accepted"].includes(raw)) {
        data.cell.styles.textColor = ACCENT;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && raw === "Fail") {
        data.cell.styles.textColor = [178, 38, 38];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  return (doc as any).lastAutoTable.finalY + 9;
}

function wrapNoteParagraph(doc: jsPDF, text: string, width: number, indent: number) {
  if (!indent) return doc.splitTextToSize(text, width) as string[];
  const words = text.split(/\s+/).filter(Boolean);
  let first = "";
  let used = 0;
  for (let i = 0; i < words.length; i++) {
    const trial = first ? `${first} ${words[i]}` : words[i]!;
    if (doc.getTextWidth(trial) <= width - indent) {
      first = trial;
      used = i + 1;
    } else {
      break;
    }
  }
  const rest = words.slice(used).join(" ");
  return [first, ...(rest ? (doc.splitTextToSize(rest, width) as string[]) : [])].filter(Boolean);
}

function renderNote(doc: jsPDF, section: any, y: number, keepOnPage = false) {
  const compactF1 = pageChrome?.report.id === "f1";
  const title = section.title ?? "Note";
  const textX = PAGE_MARGIN + 5.4;
  const textW = doc.internal.pageSize.getWidth() - textX - PAGE_MARGIN;
  const lineH = compactF1 ? 3.7 : 5.4;
  const paraGap = compactF1 ? 2 : 4.8;
  const afterTitle = compactF1 ? 3 : 8;
  const firstIndent = 10;
  const titleH = compactF1 ? 8 : 12;
  const paragraphs = String(section.text || "")
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const applyBodyStyle = () => {
    doc.setFont(pdfFontFamily, "normal");
    doc.setFontSize(compactF1 ? 7.4 : CONTENT_FONT);
    doc.setTextColor(...INK);
    doc.setLineHeightFactor(1.32);
  };

  applyBodyStyle();
  const wrapped = paragraphs.map((para, index) => wrapNoteParagraph(doc, para, textW, index === 0 ? firstIndent : 0));
  const bodyH = wrapped.reduce(
    (sum, lines, index) => sum + lines.length * lineH + (index < wrapped.length - 1 ? paraGap : 0),
    0,
  );
  const totalH = titleH + afterTitle + bodyH + 2;
  if (!keepOnPage && y + totalH > pageContentBottom(doc)) {
  y = addPdfPage(doc);
}
  y = sectionTitle(doc, title, undefined, y);
  y += afterTitle;
  applyBodyStyle();

  wrapped.forEach((lines, index) => {
    const indent = index === 0 ? firstIndent : 0;
    lines.forEach((line, lineIndex) => {
      doc.text(line, lineIndex === 0 && indent ? textX + indent : textX, y + 1.2);
      y += lineH;
    });
    if (index < wrapped.length - 1) y += paraGap;
  });
  doc.setLineHeightFactor(1.15);
  return y + 4;
}

function renderSignoff(doc: jsPDF, report: Report, section: any, src: ExportSource, y: number) {
  const compactF1 = report.id === "f1";
  const pageW = doc.internal.pageSize.getWidth();
  const w = pageW - PAGE_MARGIN * 2;
  const flatFields: any[] = section.fields ?? [];
  const horizontalF4Fields = report.id === "f4" && !section.columns?.length && flatFields.length === 2;
  const columns: { title: string; fields: any[] }[] = section.columns?.length
  ? section.columns
  : horizontalF4Fields
    ? flatFields.map((field: any) => ({ title: "", fields: [field] }))
    : [{ title: "", fields: flatFields }];

  const rowCount = Math.max(...columns.map((c) => c.fields.length), 1);
  const height = section.columns?.length || horizontalF4Fields
    ? 8 + rowCount * (compactF1 ? 9 : 14)
    : 32;
  const blockH = 14 + height;

  // Keep title + approval card together. Skip a new page if this page is still empty chrome.
 if (report.id !== "f4" && y > chromeTopMargin() + 8 && y + blockH > pageContentBottom(doc)) {
  y = addPdfPage(doc);
}

  y = sectionTitle(doc, section.title ?? "Sign-off", undefined, y, false);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(PAGE_MARGIN, y - 2, w, height, 2, 2, "F");

  const colW = w / columns.length;
  columns.forEach((col, i) => {
    const x = PAGE_MARGIN + i * colW + 4;
    let yy = y + 2.5;
    if (col.title) {
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(compactF1 ? 7.2 : CONTENT_LABEL);
      doc.setTextColor(...ACCENT);
      doc.text(col.title.toUpperCase(), x, yy);
      yy += 4.5;
    }
    col.fields.forEach((f: any) => {
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(compactF1 ? 8.3 : 11);
      doc.setTextColor(...ACCENT);
      doc.text(f.label.toUpperCase(), x, yy);
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(compactF1 ? 7.5 : 11);
      doc.setTextColor(...INK);
      doc.text(fmt(src.getField(report.id, f)), x, yy + 3.8);
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(0.25);
      doc.line(x, yy + 5.6, x + colW - 10, yy + 5.6);
      yy += compactF1 ? 9 : 14;
    });
  });

  return y + height + 3;
}

function f2Field(report: Report, src: ExportSource, key: string, shared?: string) {
  return src.getField(report.id, { key, label: key, shared });
}

function buildF2Model(report: Report, src: ExportSource): F2PrintModel {
  return buildF2PrintModel(src.f2 ? src.f2 : mergeF2State(null), {
    customer: f2Field(report, src, "customer", "customer"),
    po: f2Field(report, src, "poNumber", "poNumber"),
    part: f2Field(report, src, "partNumber", "partNumber"),
    custSpec: src.getField(report.id, { key: "specification", label: "Specification", shared: "specification" }),
  });
}

/** Section header — blue bar beside the title. */
function drawF1SectionBar(doc: jsPDF, title: string, y: number) {
  return sectionTitle(doc, title, undefined, y);
}

/** F2 dispatch row: left title, optional right-hand label + value. */
function drawF2SplitBar(
  doc: jsPDF,
  y: number,
  leftTitle: string,
  rightLabel?: string,
  rightValue?: string,
) {
  const w = doc.internal.pageSize.getWidth();
  if (y > doc.internal.pageSize.getHeight() - 40) {
    y = addPdfPage(doc);
  }

  const left = leftTitle.toUpperCase();
  doc.setFillColor(...ACCENT);
  doc.rect(PAGE_MARGIN, y - 4.2, 2.4, 6.2, "F");
  doc.setFont(pdfFontFamily, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(left, PAGE_MARGIN + 5, y);

  const value = fmt(rightValue || "");
  const label = (rightLabel || "").toUpperCase();
  if (label || value) {
    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const valueW = value ? doc.getTextWidth(value) : 0;
    if (value) doc.text(value, w - PAGE_MARGIN, y, { align: "right" });

    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(CONTENT_FONT);
    doc.setTextColor(...ACCENT);
    if (label) {
      const labelX = w - PAGE_MARGIN - (value ? valueW + 2.2 : 0);
      doc.text(label, labelX, y, { align: "right" });
    }
  }
  return y + 9;
}

function renderF2FieldGrid(doc: jsPDF, pairs: [string, string][], y: number) {
  const cells: any[] = [];
  let row: any[] = [];
  const push = () => {
    if (!row.length) return;
    while (row.length < 4) row.push("");
    cells.push(row);
    row = [];
  };
  for (const [label, value] of pairs) {
    row.push(label, fmt(value));
    if (row.length >= 4) push();
  }
  push();
  if (!cells.length) return y;

  pdfTable(doc, {
    startY: y,
    body: cells,
    theme: "grid",
    styles: { fontSize: CONTENT_FONT, cellPadding: { top: 2.5, bottom: 2.5, left: 2.4, right: 2.4 }, lineColor: LIGHT, lineWidth: 0.2 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: ACCENT, fontSize: CONTENT_LABEL, cellWidth: 42 },
      1: { textColor: INK, fontStyle: "normal" },
      2: { fontStyle: "bold", textColor: ACCENT, fontSize: CONTENT_LABEL, cellWidth: 42 },
      3: { textColor: INK, fontStyle: "normal" },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

function formatF2ArraySerials(serials: string[], prod: string): string[] {
  const values: { value: number; width: number }[] = [];

  for (const serial of serials) {
    const productionPrefix = `${prod}-`;
    const pcbNumber =
      prod && serial.startsWith(productionPrefix)
        ? serial.slice(productionPrefix.length)
        : serial.slice(0, serial.lastIndexOf("-"));

    if (!/^\d+$/.test(pcbNumber)) return serials;

    values.push({
      value: Number(pcbNumber),
      width: Math.max(2, pcbNumber.length),
    });
  }

  if (!values.length) return [];

  const formatNumber = (value: number, width: number) =>
    String(value).padStart(width, "0");

  const formatRange = (
    first: { value: number; width: number },
    last: { value: number; width: number },
    width: number,
  ) => {
    const start = formatNumber(first.value, width);
    const end = formatNumber(last.value, width);

    return first.value === last.value
      ? `${prod}(${start})`
      : `${prod}(${start}-${end})`;
  };

  const result: string[] = [];
  let first = values[0]!;
  let previous = first;
  let rangeWidth = first.width;

  for (const current of values.slice(1)) {
    if (current.value === previous.value + 1) {
      previous = current;
      rangeWidth = Math.max(rangeWidth, current.width);
      continue;
    }

    result.push(formatRange(first, previous, rangeWidth));
    first = current;
    previous = current;
    rangeWidth = current.width;
  }

  result.push(formatRange(first, previous, rangeWidth));
  return result;
}

function renderF2SerialGrid(
  doc: jsPDF,
  serials: string[],
  y: number,
  arrayFormat = false,
  prod = "",
) {
  const printedSerials = arrayFormat ? formatF2ArraySerials(serials, prod) : serials;
  const rows = chunkSerials(printedSerials, pdfIsLandscape(doc) ? 12 : 8);
  if (!rows.length) return y;
  pdfTable(doc, {
    startY: y,
    body: rows.map((row) => row.map((cell) => cell || "")),
    theme: "grid",
    styles: {
      fontSize: CONTENT_FONT,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: { top: 3.4, bottom: 3.4, left: 1.2, right: 1.2 },
      textColor: INK,
      lineColor: LIGHT,
      lineWidth: 0.2,
      minCellHeight: 10,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

function weekBatchLabel(week: string, prod: string) {
  return `Week code ${week || ""}  ·  Batch no. ${prod || ""}`;
}

function renderF2BoardGroups(
  doc: jsPDF,
  y: number,
  boards: F2PrintBoard[],
  withReason: boolean,
  arrayFormat: boolean,
) {
  const groups = groupF2PrintBoards(boards, withReason);
  if (!groups.length) return y;

  if (!withReason) {
    for (const group of groups) {
      y = drawF2SplitBar(doc, y, weekBatchLabel(group.week, group.prod), "Qty", group.qty);
      y = renderF2SerialGrid(doc, group.serials, y, arrayFormat, group.prod);
    }
    return y;
  }

  const batches: { week: string; prod: string; reasons: typeof groups }[] = [];
  const seen = new Map<string, number>();
  for (const group of groups) {
    const key = `${group.prod}::${group.week}`;
    let i = seen.get(key);
    if (i === undefined) {
      i = batches.length;
      seen.set(key, i);
      batches.push({ week: group.week, prod: group.prod, reasons: [] });
    }
    batches[i]!.reasons.push(group);
  }

  for (const batch of batches) {
    if (batch.reasons.length === 1) {
      const group = batch.reasons[0]!;
      const left = group.reason
        ? `${weekBatchLabel(group.week, group.prod)}  ·  ${group.reason}`
        : weekBatchLabel(group.week, group.prod);
      y = drawF2SplitBar(doc, y, left, "Qty", group.qty);
      y = renderF2SerialGrid(doc, group.serials, y, arrayFormat, group.prod);
      continue;
    }

    y = drawF2SplitBar(doc, y, weekBatchLabel(batch.week, batch.prod));
    for (const group of batch.reasons) {
      y = drawF2SplitBar(doc, y, group.reason?.trim() || "—", "Qty", group.qty);
      y = renderF2SerialGrid(doc, group.serials, y, arrayFormat, group.prod);
    }
  }
  return y;
}

function renderF2Body(doc: jsPDF, report: Report, src: ExportSource, y: number) {
  const model = buildF2Model(report, src);
  const arrayFormat = model.supplyFormat.trim().toLowerCase() === "array";
  const reportNo = f2ReportNumber(src.getField("f1", { key: "cocNumber", label: "cocNumber", shared: "cocNumber" }));

  y = renderF4ReportNo(doc, reportNo, y);

  y = drawF1SectionBar(doc, "Customer and product details", y);
  y = renderF2FieldGrid(
    doc,
    [
      ["Customer", model.customer],
      ["P.O. Number", model.po],
      ["Part Number in PCB", model.part],
      ["Supply Format", model.supplyFormat],
    ],
    y,
  );

  if (!model.batches.length) {
    y = drawF1SectionBar(doc, "Dispatches", y);
    doc.setFont(pdfFontFamily, "normal");
    doc.setFontSize(CONTENT_FONT);
    doc.setTextColor(...MUTED);
    doc.text("No serial numbers assigned to a dispatch.", PAGE_MARGIN + 2, y);
    y += 8;
  }

  let lastDispatch = "";
  for (const batch of model.batches) {
    const isNewDispatch = batch.dispatch !== lastDispatch;
    lastDispatch = batch.dispatch;
    if (isNewDispatch) {
      y = drawF2SplitBar(
        doc,
        y,
        `Dispatch no. ${batch.dispatch}`,
        "Shipment Date",
        formatDisplayDate(batch.date),
      );
    }
    y = drawF2SplitBar(
      doc,
      y,
      `Week code ${batch.week || ""}  ·  Batch no. ${batch.prod || ""}`,
      "Qty",
      batch.qty,
    );
    y = renderF2SerialGrid(doc, batch.serials, y, arrayFormat, batch.prod);
  }

   if (model.stock.length > 0) {
    y = drawF1SectionBar(doc, `Stock board details  ·  Qty ${model.stock.length}`, y);
    y = renderF2BoardGroups(doc, y, model.stock, false, arrayFormat);
  }

  if (model.showRejected && model.rejected.length > 0) {
    y = drawF1SectionBar(doc, `Rejected board details  ·  Qty ${model.rejected.length}`, y);
    y = renderF2BoardGroups(doc, y, model.rejected, true, arrayFormat);
  }

  const signoff = report.sections.find((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff");
  if (signoff) y = renderSignoff(doc, report, signoff, src, y);

  return y;
}

function maxColumns(report: Report) {
  return report.sections.reduce((m, s) => (s.kind === "table" ? Math.max(m, s.columns.length) : m), 0);
}

function useLandscape(report: Report) {
  if (report.id === "f2" || report.id === "f3" || report.id === "f5" || report.id === "f7") return true;
  if (report.id === "f4" || report.id === "f6" || report.id === "f15" || report.id === "f16") return false;
  return maxColumns(report) > 6;
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return /image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
}

async function hydrateF7Images(src: ExportSource): Promise<ExportSource> {
  const reportId = src.reportId;
  if (!reportId || reportId === "new") return src;
  const rows = f7EnsureCharRows(src.getRows("f7", "characteristics"));
  const f7Images: Record<string, string> = { ...(src.f7Images || {}) };
  const jobs: Promise<void>[] = [];
  rows.forEach((row, index) => {
    (["x", "y"] as const).forEach((dir) => {
      if (dir === "y" && String(row.sl || "").trim() === "13") return;
      const image = parseF7Image(dir === "x" ? row.imageX : row.imageY);
      const key = `${row.sl || index}-${dir}`;
      if (!image?.id || f7Images[key]) return;
      jobs.push(
        fetchReportFileDataUrl(reportId, image.id)
          .then((url) => {
            f7Images[key] = url;
          })
          .catch(() => undefined),
      );
    });
  });
  if (jobs.length) await Promise.all(jobs);
  return { ...src, f7Images };
}

async function appendF3Attachments(doc: jsPDF, src: ExportSource): Promise<Uint8Array> {
  const reportId = src.reportId;
  const attachments = src.getRows("f3", "checklist").flatMap(parseF3Attachments);

  if (!reportId || reportId === "new" || attachments.length === 0) {
    return new Uint8Array(doc.output("arraybuffer"));
  }

  const output = await PDFDocument.load(doc.output("arraybuffer"));

  for (const attachment of attachments) {
    const blob = attachment.id
      ? await fetchReportFileBlob(reportId, attachment.id)
      : attachment.dataUrl
        ? await (await fetch(attachment.dataUrl)).blob()
        : null;

    if (!blob) continue;

    const bytes = await blob.arrayBuffer();
    const name = attachment.name.toLowerCase();

    if (name.endsWith(".pdf")) {
      const source = await PDFDocument.load(bytes);
      const pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach((page) => output.addPage(page));
      continue;
    }

    let image: PDFImage | null = null;
    if (name.endsWith(".png")) image = await output.embedPng(bytes);
    else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) image = await output.embedJpg(bytes);
    if (!image) continue;

    const page = output.addPage([595.28, 841.89]);
    const scale = Math.min(
      (page.getWidth() - 48) / image.width,
      (page.getHeight() - 48) / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;

    page.drawImage(image, {
      x: (page.getWidth() - width) / 2,
      y: (page.getHeight() - height) / 2,
      width,
      height,
    });
  }

  return output.save();
}

function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderBody(
  d: jsPDF,
  report: Report,
  src: ExportSource,
  landscape: boolean,
  logo: string | null,
  nadcap: string | null = null,
) {
  if (report.id === "f7") {
    renderF7LandscapeReport(d, report, src, logo, pdfSkin);
    return;
  }
  pageChrome = {
    report,
    src,
    logo,
    nadcap,
    reportNo: resolveReportNo(report, src),
    pageNote: "",
    sectionTitle: "",
  };
  try {
    paintPageBackground(d);
    let y = drawF1CertificateHeader(d, report, src, logo, nadcap);
    if (report.id === "f3") {
      y = renderF3IdentBlock(d, report, src, y);
    }
    if (report.id === "f2") {
      renderF2Body(d, report, src, y);
      return;
    }
    if (report.id === "f4") {
      renderF4Body(d, report, src, y);
      return;
    }
    if (report.id === "f5") {
      renderF5Body(d, report, src, y, logo);
      return;
    }
    if (report.id === "f6") {
      renderF6Body(d, report, src, y, logo);
      return;
    }
    if (report.id === "f15") {
      renderF15Body(d, report, src, y);
      return;
    }
    if (report.id === "f16") {
      renderF16Body(d, report, src, y);
      return;
    }
    for (const section of report.sections as Section[]) {
      // Order Lookup is UI-only (production order fetch); values appear under F1 title.
      if (section.kind === "fields" && section.title === "Order Lookup") continue;
      if (report.id === "f3" && section.kind === "fields" && section.title === "Report Identification") continue;
      if (section.kind === "fields") y = renderFields(d, report, section, src, y, landscape ? 3 : 2);
      else if (section.kind === "table") y = renderTable(d, report, section, src, y);
      else if (section.kind === "note") y = renderNote(d, section, y);
      else y = renderSignoff(d, report, section, src, y);
    }
  } finally {
    pageChrome = null;
  }
}

export async function buildReportDoc(report: Report, src: ExportSource, template: PdfTemplateId = "current") {
  const landscape = useLandscape(report);
  const [logo, nadcap, hydrated] = await Promise.all([
    getHiqLogoDataUrl(),
    getNadcapLogoDataUrl(),
    loadUnicodeFonts().then(() => hydrateF7Images(src)),
  ]);
  const d = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  registerUnicodeFont(d);
  applyPdfSkin(template);
  try {
    renderBody(d, report, hydrated, landscape, logo, nadcap);
    drawFooter(d, report);
    return d;
  } finally {
    applyPdfSkin("current");
  }
}

const PDF_POINTS_PER_MM = 72 / 25.4;

type AsF1Position = {
  x: number;
  top: number;
  size?: number;
  maxWidth?: number;
};

/**
 * Coordinates are millimeters from the top-left of the exported template PDF.
 * Fill these from the actual one-page PDF, not from the screenshot.
 */
const AS_F1_POSITIONS: Record<string, AsF1Position> = {
  partNumber: { x: 0, top: 0, maxWidth: 0 },
  partName: { x: 0, top: 0, maxWidth: 0 },
  serialNumber: { x: 0, top: 0, maxWidth: 0 },
  fairIdentifier: { x: 0, top: 0, maxWidth: 0 },
  partRevision: { x: 0, top: 0, maxWidth: 0 },
  drawingNumber: { x: 0, top: 0, maxWidth: 0 },
  drawingRevision: { x: 0, top: 0, maxWidth: 0 },
  additionalChanges: { x: 0, top: 0, maxWidth: 0 },
  processReference: { x: 0, top: 0, maxWidth: 0 },
  organizationName: { x: 0, top: 0, maxWidth: 0 },
  supplierCode: { x: 0, top: 0, maxWidth: 0 },
  purchaseOrderNumber: { x: 0, top: 0, maxWidth: 0 },
  baselinePartNumber: { x: 0, top: 0, maxWidth: 0 },
  faiReason: { x: 0, top: 0, maxWidth: 0 },
  verifiedByName: { x: 0, top: 0, maxWidth: 0 },
  verifiedByDate: { x: 0, top: 0, maxWidth: 0 },
  reviewedByName: { x: 0, top: 0, maxWidth: 0 },
  reviewedByDate: { x: 0, top: 0, maxWidth: 0 },
  customerApprovalName: { x: 0, top: 0, maxWidth: 0 },
  customerApprovalDate: { x: 0, top: 0, maxWidth: 0 },
  comments: { x: 0, top: 0, maxWidth: 0 },
};

/** Set each checkbox position from the exported PDF's measured coordinates. */
const AS_F1_CHECKBOXES: Record<string, { x: number; top: number }> = {
  detailFai: { x: 0, top: 0 },
  assemblyFai: { x: 0, top: 0 },
  fullFai: { x: 0, top: 0 },
  partialFai: { x: 0, top: 0 },
  nonconformanceYes: { x: 0, top: 0 },
  nonconformanceNo: { x: 0, top: 0 },
};

/** Set these to the first index row's coordinates and the template's row spacing. */
const AS_F1_INDEX_START = { x: 0, top: 0 };
const AS_F1_INDEX_ROW = { height: 0, columnWidths: [0, 0, 0, 0] as const };

async function exportAsF1(report: Report, src: ExportSource) {
  const templateUrl = `${import.meta.env.BASE_URL}templates/as-f1-template.pdf`;
  const templateResponse = await fetch(templateUrl);

  if (!templateResponse.ok) {
    throw new Error(`Could not load AS-F1 PDF template (${templateResponse.status}).`);
  }

  const templateBytes = await templateResponse.arrayBuffer();
  const pdf = await PDFDocument.load(templateBytes);
  const page = pdf.getPages()[0];

  if (!page) {
    throw new Error("The AS-F1 PDF template contains no pages.");
  }

  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const mm = PDF_POINTS_PER_MM;

  function value(key: string, shared?: string) {
    return src.getField("as-f1", { key, label: key, shared });
  }

  function drawText(key: string, text: string) {
    const position = AS_F1_POSITIONS[key];
    if (!position || !text) return;

    const size = position.size ?? 8;
    const options = {
      x: position.x * mm,
      y: page.getHeight() - position.top * mm - size,
      size,
      font,
      color: rgb(0, 0, 0),
      ...(position.maxWidth ? { maxWidth: position.maxWidth * mm } : {}),
    };

    page.drawText(text, options);
  }

  function drawCheck(key: string, checked: boolean) {
    if (!checked) return;
    const position = AS_F1_CHECKBOXES[key];
    if (!position) return;

    const x = position.x * mm;
    const y = page.getHeight() - position.top * mm;
    const size = 1.8 * mm;

    page.drawLine({
      start: { x, y },
      end: { x: x + size * 0.4, y: y - size * 0.45 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: x + size * 0.4, y: y - size * 0.45 },
      end: { x: x + size, y: y + size * 0.45 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }

  drawText("partNumber", value("partNumber", "partNumber"));
  drawText("partName", value("partName"));
  drawText("serialNumber", value("serialNumber"));
  drawText("fairIdentifier", value("fairIdentifier"));
  drawText("partRevision", value("partRevision", "partRev"));
  drawText("drawingNumber", value("drawingNumber"));
  drawText("drawingRevision", value("drawingRevision"));
  drawText("additionalChanges", value("additionalChanges"));
  drawText("processReference", value("processReference", "productionOrder"));
  drawText("organizationName", value("organizationName"));
  drawText("supplierCode", value("supplierCode"));
  drawText("purchaseOrderNumber", value("purchaseOrderNumber", "poNumber"));
  drawText("baselinePartNumber", value("baselinePartNumber"));
  drawText("faiReason", value("faiReason"));
  drawText("verifiedByName", value("verifiedByName"));
  drawText("verifiedByDate", value("verifiedByDate"));
  drawText("reviewedByName", value("reviewedByName"));
  drawText("reviewedByDate", value("reviewedByDate"));
  drawText("customerApprovalName", value("customerApprovalName"));
  drawText("customerApprovalDate", value("customerApprovalDate"));
  drawText("comments", value("comments"));

  const faiType = value("faiType");
  const faiScope = value("faiScope");
  const nc = value("documentedNonconformance");

  drawCheck("detailFai", faiType === "Detail FAI");
  drawCheck("assemblyFai", faiType === "Assembly FAI");
  drawCheck("fullFai", faiScope === "Full FAI");
  drawCheck("partialFai", faiScope === "Partial FAI");
  drawCheck("nonconformanceYes", nc === "Yes");
  drawCheck("nonconformanceNo", nc === "No");

  const indexRows = src.getRows("as-f1", "index");
  const columnKeys = ["partNumber", "partName", "partType", "fairIdentifier"];

  indexRows.forEach((row, rowIndex) => {
    columnKeys.forEach((key, columnIndex) => {
      const x =
        AS_F1_INDEX_START.x +
        AS_F1_INDEX_ROW.columnWidths
          .slice(0, columnIndex)
          .reduce<number>((sum, width) => sum + width, 0);

      const position = {
        x,
        top: AS_F1_INDEX_START.top + rowIndex * AS_F1_INDEX_ROW.height,
        maxWidth: AS_F1_INDEX_ROW.columnWidths[columnIndex],
        size: 7,
      };

      const size = position.size;
      page.drawText(row[key] || "", {
        x: position.x * mm,
        y: page.getHeight() - position.top * mm - size,
        size,
        font,
        color: rgb(0, 0, 0),
        maxWidth: position.maxWidth * mm,
      });
    });
  });

  const bytes = await pdf.save();
  const ref = value("cocNumber", "cocNumber") || "draft";
  const filename = `${report.code}_as-9102-form-1_${slug(ref)}.pdf`;
  downloadPdf(bytes, filename);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type { PdfTemplateId } from "./pdf/types";

export async function exportReport(report: Report, src: ExportSource, template: PdfTemplateId = "current") {
   if (report.id === "as-f1") {
    await exportAsF1(report, src);
    return;
  }
  const doc = await buildReportDoc(report, src, template);
  const ref = src.getField(report.id, { key: "cocNumber", label: "COC Number", shared: "cocNumber" }) || "draft";
  const filename = `${report.code}_${slug(report.title)}_${slug(ref)}.pdf`;
    let bytes: Uint8Array;
  try {
    bytes = await appendF3Attachments(doc, src);
  } catch (error) {
    console.warn("Could not append F3 attachments; exporting the report without them.", error);
    bytes = new Uint8Array(doc.output("arraybuffer"));
  }
  downloadPdf(bytes, filename);
}

/** Every report combined into a single PDF document. */
export async function exportAll(reports: Report[], src: ExportSource, template: PdfTemplateId = "current") {
  if (!reports.length) return;
  const [logo, nadcap, hydrated] = await Promise.all([
    getHiqLogoDataUrl(),
    getNadcapLogoDataUrl(),
    loadUnicodeFonts().then(() => hydrateF7Images(src)),
  ]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  registerUnicodeFont(doc);
  applyPdfSkin(template);

  const ranges: { report: Report; from: number; to: number }[] = [];

  try {
    reports.forEach((report, i) => {
      const landscape = useLandscape(report);
      if (i === 0) {
        if (landscape) {
          doc.addPage("a4", "landscape");
          doc.deletePage(1);
        }
      } else {
        doc.addPage("a4", landscape ? "landscape" : "portrait");
      }
      const from = doc.getNumberOfPages();
      renderBody(doc, report, hydrated, landscape, logo, nadcap);
      ranges.push({ report, from, to: doc.getNumberOfPages() });
    });

    const total = doc.getNumberOfPages();
    ranges.forEach(({ report, from, to }) => drawFooter(doc, report, from, to, total));
  } finally {
    applyPdfSkin("current");
  }
  const ref = src.getField(reports[0]!.id, { key: "cocNumber", label: "COC Number", shared: "cocNumber" }) || "draft";
  const filename = `HIQ_Rigid_COC_Full_Pack_${slug(ref)}.pdf`;
  downloadPdf(await appendF3Attachments(doc, src), filename);
}
