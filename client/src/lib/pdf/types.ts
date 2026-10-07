export type PdfTemplateId = "current" | "modern" | "executive";

export type PdfRgb = [number, number, number];

export type PdfThemeId = "modern" | "executive";

export type PdfTheme = {
  id: PdfThemeId;
  pageBg: PdfRgb;
  headerBg: PdfRgb;
  headerBg2: PdfRgb;
  headerText: PdfRgb;
  headerMuted: PdfRgb;
  accent: PdfRgb;
  accentSoft: PdfRgb;
  ink: PdfRgb;
  muted: PdfRgb;
  cardBg: PdfRgb;
  cardBorder: PdfRgb;
  label: PdfRgb;
  tableHead: PdfRgb;
  tableHeadText: PdfRgb;
  tableLine: PdfRgb;
  success: PdfRgb;
  footerLine: PdfRgb;
  rounded: boolean;
  numberedSections: boolean;
  headerStyle: "banner" | "darkbar";
};
