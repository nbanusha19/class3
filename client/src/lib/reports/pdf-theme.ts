export type PdfRgb = [number, number, number];
export type PdfTemplateId = "template1" | "template2" | "template3";
export type PdfHeaderStyle = "tick-rule" | "kicker" | "ornament";
export type PdfLayout = "grid" | "open" | "formal";

export type PdfTheme = {
  id: PdfTemplateId;
  label: string;
  shortLabel: string;
  description: string;
  accent: PdfRgb;
  accentDark: PdfRgb;
  light: PdfRgb;
  ink: PdfRgb;
  muted: PdfRgb;
  line: PdfRgb;
  rule: PdfRgb;
  altRow: PdfRgb;
  signoffFill: PdfRgb;
  fontScale: number;
  gridLine: number;
  headLine: number;
  headerRule: number;
  sectionRule: number;
  headerStyle: PdfHeaderStyle;
  layout: PdfLayout;
  sectionGap: number;
  hiqLogo: number;
  nadcapWidth: number;
  titleFont: "times" | "helvetica";
  swatch: string;
  swatch2: string;
};

export const PDF_TEMPLATES: Record<PdfTemplateId, PdfTheme> = {
  template1: {
    id: "template1",
    label: "Classic Grid",
    shortLabel: "Template 1",
    description: "Light-ruled certificate table with more cell padding and softer structure lines.",
    accent: [37, 99, 168],
    accentDark: [22, 62, 118],
    light: [240, 245, 250],
    ink: [22, 30, 42],
    muted: [55, 68, 86],
    line: [206, 218, 230],
    rule: [176, 196, 214],
    altRow: [248, 251, 253],
    signoffFill: [240, 246, 252],
    fontScale: 1.12,
    gridLine: 0.28,
    headLine: 0.32,
    headerRule: 1.05,
    sectionRule: 0.55,
    headerStyle: "tick-rule",
    layout: "grid",
    sectionGap: 6.5,
    hiqLogo: 14,
    nadcapWidth: 36,
    titleFont: "times",
    swatch: "#2563a8",
    swatch2: "#e2ecf7",
  },
  template2: {
    id: "template2",
    label: "Open Ledger",
    shortLabel: "Template 2",
    description: "Open two-column ledger: labels beside values, light hairlines, no cell boxes.",
    accent: [15, 108, 108],
    accentDark: [8, 72, 72],
    light: [236, 246, 244],
    ink: [20, 36, 36],
    muted: [70, 96, 92],
    line: [176, 204, 198],
    rule: [15, 108, 108],
    altRow: [246, 251, 249],
    signoffFill: [236, 246, 244],
    fontScale: 1.1,
    gridLine: 0.3,
    headLine: 0.4,
    headerRule: 1.1,
    sectionRule: 0.45,
    headerStyle: "kicker",
    layout: "open",
    sectionGap: 6,
    hiqLogo: 13,
    nadcapWidth: 36,
    titleFont: "helvetica",
    swatch: "#0f6c6c",
    swatch2: "#e8f4f2",
  },
  template3: {
    id: "template3",
    label: "Formal Letter",
    shortLabel: "Template 3",
    description: "Formal letter with a gold frame and underlines. NADCAP sits in the header, clear of the title.",
    accent: [28, 36, 48],
    accentDark: [18, 24, 32],
    light: [248, 244, 234],
    ink: [18, 22, 28],
    muted: [92, 84, 68],
    line: [214, 196, 150],
    rule: [184, 134, 11],
    altRow: [252, 249, 242],
    signoffFill: [252, 249, 242],
    fontScale: 1.1,
    gridLine: 0.28,
    headLine: 0.35,
    headerRule: 0.55,
    sectionRule: 0.4,
    headerStyle: "ornament",
    layout: "formal",
    sectionGap: 7,
    hiqLogo: 13,
    nadcapWidth: 34,
    titleFont: "times",
    swatch: "#1c2430",
    swatch2: "#b8860b",
  },
};

export const PDF_TEMPLATE_IDS: PdfTemplateId[] = ["template1", "template2", "template3"];

let active: PdfTheme = PDF_TEMPLATES.template1;

export function applyPdfTemplate(id: PdfTemplateId) {
  active = PDF_TEMPLATES[id] ?? PDF_TEMPLATES.template1;
}

export function getPdfTheme(): PdfTheme {
  return active;
}

export function pdfFontSize(base: number) {
  return Math.round(base * active.fontScale * 10) / 10;
}

export function copyRgb(target: PdfRgb, src: PdfRgb) {
  target[0] = src[0];
  target[1] = src[1];
  target[2] = src[2];
}
