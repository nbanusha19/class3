import {
  Boxes,
  Building2,
  ClipboardCheck,
  FileBadge2,
  FlaskConical,
  Layers3,
  Package,
  Ruler,
  ShieldCheck,
  Signature,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type StepStyle = { icon: LucideIcon; color: string; label: string };

/** Semantic icon + accent colour per report step (visual only). */
export const STEP_STYLES: StepStyle[] = [
  { icon: FileBadge2, color: "var(--step-blue)", label: "Certificate" },
  { icon: Building2, color: "var(--step-purple)", label: "Customer" },
  { icon: Layers3, color: "var(--step-orange)", label: "Construction" },
  { icon: FlaskConical, color: "var(--step-cyan)", label: "Materials" },
  { icon: ClipboardCheck, color: "var(--step-indigo)", label: "Testing" },
  { icon: Ruler, color: "var(--step-emerald)", label: "Inspection" },
  { icon: ShieldCheck, color: "var(--step-green)", label: "Compliance" },
  { icon: Signature, color: "var(--step-blue)", label: "Approval" },
  { icon: Package, color: "var(--step-amber)", label: "Packing" },
  { icon: Boxes, color: "var(--step-cyan)", label: "Inventory" },
  { icon: Truck, color: "var(--step-red)", label: "Shipment" },
];

export function stepStyle(i: number): StepStyle {
  return STEP_STYLES[i % STEP_STYLES.length]!;
}
