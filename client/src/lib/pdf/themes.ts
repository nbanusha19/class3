import type { PdfTheme } from "./types";

export const MODERN_THEME: PdfTheme = {
  id: "modern",
  pageBg: [247, 252, 250],
  headerBg: [13, 148, 136],
  headerBg2: [5, 150, 105],
  headerText: [255, 255, 255],
  headerMuted: [204, 251, 241],
  accent: [13, 148, 136],
  accentSoft: [204, 251, 241],
  ink: [15, 46, 41],
  muted: [71, 107, 99],
  cardBg: [255, 255, 255],
  cardBorder: [167, 243, 208],
  label: [13, 116, 110],
  tableHead: [15, 118, 110],
  tableHeadText: [255, 255, 255],
  tableLine: [167, 243, 208],
  success: [5, 150, 105],
  footerLine: [153, 246, 228],
  rounded: true,
  numberedSections: false,
  headerStyle: "banner",
};

export const EXECUTIVE_THEME: PdfTheme = {
  id: "executive",
  pageBg: [248, 250, 252],
  headerBg: [15, 23, 42],
  headerBg2: [30, 27, 75],
  headerText: [248, 250, 252],
  headerMuted: [165, 180, 214],
  accent: [79, 70, 229],
  accentSoft: [224, 231, 255],
  ink: [15, 23, 42],
  muted: [71, 85, 105],
  cardBg: [255, 255, 255],
  cardBorder: [203, 213, 225],
  label: [49, 46, 129],
  tableHead: [30, 41, 71],
  tableHeadText: [248, 250, 252],
  tableLine: [203, 213, 225],
  success: [79, 70, 229],
  footerLine: [165, 180, 214],
  rounded: false,
  numberedSections: false,
  headerStyle: "darkbar",
};

export function themeById(id: "modern" | "executive"): PdfTheme {
  return id === "executive" ? EXECUTIVE_THEME : MODERN_THEME;
}
