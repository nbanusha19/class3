import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PdfTemplateId } from "@/lib/pdf/types";

function MiniDoc({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[6px] border shadow-inner", className)}>
      <div className="aspect-[210/297] w-full">{children}</div>
    </div>
  );
}

function CurrentPreview() {
  return (
    <MiniDoc className="border-slate-300 bg-white">
      <div className="absolute inset-0 p-[6%] text-[5px] leading-tight text-slate-800">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1">
            <div className="size-3 rounded-[2px] bg-amber-400" />
            <div>
              <div className="text-[6px] font-bold text-[#3b6fa0]">HI-Q ELECTRONICS PVT LTD</div>
              <div className="text-[4px] tracking-wide text-slate-500">PRINTED CIRCUIT BOARD MANUFACTURING</div>
            </div>
          </div>
          <div className="text-right text-[4px] text-slate-500">
            Hosur · Tamilnadu
            <div>www.hiqelectronics.com</div>
          </div>
        </div>
        <div className="mt-1 h-[2px] bg-[#3b6fa0]" />
        <div className="mt-1 text-center font-serif text-[8px] font-bold text-[#3b6fa0]">Certificate of Conformance</div>
        <div className="mt-1 grid grid-cols-4 gap-[2px] text-center">
          {["NCAGE 3566Y", "UL E156972", "COC NUMBER", "DATE"].map((item) => (
            <div key={item} className="rounded-[1px] border border-slate-200 py-[2px] text-[4px] font-semibold text-[#3b6fa0]">
              {item}
            </div>
          ))}
        </div>
        <div className="mt-1 space-y-[2px]">
          {["CUSTOMER AND PRODUCT DETAILS", "CONSTRUCTION"].map((title) => (
            <div key={title}>
              <div className="flex items-center gap-[2px]">
                <div className="h-[6px] w-[2px] bg-[#3b6fa0]" />
                <div className="text-[5px] font-bold tracking-wide">{title}</div>
              </div>
              <div className="mt-[2px] grid grid-cols-2 gap-[2px]">
                <div className="h-[9px] border border-slate-200 bg-slate-50" />
                <div className="h-[9px] border border-slate-200 bg-slate-50" />
                <div className="col-span-2 h-[9px] border border-slate-200 bg-slate-50" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 rounded-[2px] border border-slate-200 p-[3px] text-[4px] text-slate-500">
          Statement of Compliance — certified printed boards…
        </div>
        <div className="mt-1 grid grid-cols-3 gap-[2px]">
          {["Inspected", "Verified", "Approved"].map((item) => (
            <div key={item} className="h-[16px] rounded-[2px] bg-slate-100 px-[2px] pt-[2px] text-[4px] font-semibold text-[#3b6fa0]">
              {item}
            </div>
          ))}
        </div>
      </div>
    </MiniDoc>
  );
}

function ModernPreview() {
  return (
    <MiniDoc className="border-emerald-200 bg-[#f7fcfa]">
      <div className="absolute inset-0 overflow-hidden text-[5px] leading-tight">
        <div className="h-[32%] bg-gradient-to-r from-teal-600 to-emerald-600 px-[6%] pt-[5%] text-white">
          <div className="flex items-start gap-1">
            <div className="size-3 rounded-[2px] bg-white/90" />
            <div>
              <div className="text-[5.5px] font-bold">HI-Q ELECTRONICS PVT LTD</div>
              <div className="text-[4px] tracking-wide text-teal-100">PRINTED CIRCUIT BOARD MANUFACTURING EST: 1983</div>
            </div>
          </div>
          <div className="mt-[2px] text-center text-[7px] font-bold">Certificate of Conformance</div>
          <div className="mt-[2px] text-center text-[3.5px] leading-tight text-teal-50">
            No: 9, Industrial Estate, Hosur - 635109, Tamilnadu, India. www.hiqelectronics.com
          </div>
        </div>
        <div className="space-y-[4px] px-[6%] py-[3%]">
          <div className="grid grid-cols-4 overflow-hidden rounded-[1px] border border-emerald-200 text-center text-[3.5px]">
            {["NCAGE 3566Y", "UL E156972", "COC NUMBER", "DATE"].map((item) => (
              <div key={item} className="bg-teal-700 py-[2px] font-semibold text-white">
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-[4px] bg-teal-50 px-[4px] py-[2px] text-[5px] font-bold text-teal-900">◉ CUSTOMER & PRODUCT</div>
          <div className="rounded-[4px] border border-emerald-100 bg-white p-[3px] shadow-sm">
            <div className="text-[4px] font-semibold uppercase tracking-wider text-teal-700">Customer</div>
            <div className="text-[6px] font-medium text-slate-800">CPC Solutions Ltd</div>
          </div>
          <div className="grid grid-cols-2 gap-[3px]">
            <div className="rounded-[4px] border border-emerald-100 bg-white p-[3px]">
              <div className="text-[4px] uppercase tracking-wider text-teal-700">Part number</div>
              <div className="h-[5px] w-3/4 rounded-sm bg-slate-200" />
            </div>
            <div className="rounded-[4px] border border-emerald-100 bg-white p-[3px]">
              <div className="text-[4px] uppercase tracking-wider text-teal-700">P.O. number</div>
              <div className="h-[5px] w-2/3 rounded-sm bg-slate-200" />
            </div>
          </div>
          <div className="rounded-[4px] bg-emerald-50 p-[4px] text-[4px] text-emerald-900">Statement of Compliance</div>
          <div className="grid grid-cols-3 gap-[2px]">
            {["Inspected", "Verified", "Approved"].map((item) => (
              <div key={item} className="rounded-[4px] border border-teal-100 bg-white p-[3px] text-[4px] font-semibold text-teal-800">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MiniDoc>
  );
}

function ExecutivePreview() {
  return (
    <MiniDoc className="border-slate-400 bg-[#f8fafc]">
      <div className="absolute inset-0 overflow-hidden text-[5px] leading-tight">
        <div className="relative h-[34%] bg-[#0f172a] px-[7%] pt-[5%] text-slate-100">
          <div className="absolute inset-y-0 left-0 w-[3px] bg-indigo-500" />
          <div className="flex items-start gap-1">
            <div className="size-3 rounded-[2px] bg-amber-400" />
            <div>
              <div className="text-[5.5px] font-bold text-white">HI-Q ELECTRONICS PVT LTD</div>
              <div className="text-[3.5px] tracking-wide text-indigo-200">PRINTED CIRCUIT BOARD MANUFACTURING EST: 1983</div>
            </div>
          </div>
          <div className="mt-[3px] text-center text-[7px] font-bold tracking-wide">Certificate of Conformance</div>
          <div className="mt-[2px] text-center text-[3.5px] leading-tight text-indigo-200">
            No: 9, Industrial Estate, Hosur - 635109, Tamilnadu, India. www.hiqelectronics.com
          </div>
        </div>
        <div className="space-y-[5px] px-[7%] py-[4%]">
          <div className="grid grid-cols-4 overflow-hidden border border-slate-300 text-center text-[3.5px]">
            {["NCAGE 3566Y", "UL E156972", "COC NUMBER", "DATE"].map((item) => (
              <div key={item} className="bg-[#1e293b] py-[2px] font-semibold text-slate-100">
                {item}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-[3px] text-[5.5px] font-bold text-slate-900">
            <span>CUSTOMER AND PRODUCT DETAILS</span>
          </div>
          <div className="h-px bg-indigo-100" />
          <div className="grid grid-cols-2 gap-[4px]">
            <div className="border border-slate-200 bg-white p-[3px]">
              <div className="text-[4px] font-semibold uppercase tracking-[0.12em] text-indigo-800">Customer</div>
              <div className="mt-[2px] border-b border-slate-200 pb-[2px] text-[6px]">Aerospace OEM</div>
            </div>
            <div className="border border-slate-200 bg-white p-[3px]">
              <div className="text-[4px] font-semibold uppercase tracking-[0.12em] text-indigo-800">Part number</div>
              <div className="mt-[2px] h-[6px] border-b border-slate-200" />
            </div>
          </div>
          <div className="flex items-center gap-[3px] text-[5.5px] font-bold text-slate-900">
            <span>CONSTRUCTION</span>
          </div>
          <div className="border border-slate-200 bg-white p-[4px] text-[4px] text-slate-600">Statement of Compliance</div>
          <div className="grid grid-cols-3 gap-px bg-slate-300">
            {["Inspected", "Verified", "Approved"].map((item) => (
              <div key={item} className="bg-white p-[3px] text-[4px] font-semibold text-indigo-900">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MiniDoc>
  );
}

const COPY: Record<
  PdfTemplateId,
  { kicker: string; title: string; blurb: string; action: string; preview: () => ReactNode }
> = {
  current: {
    kicker: "TEMPLATE 01",
    title: "Current / Standard",
    blurb: "Use the existing approved PDF design.",
    action: "Use Current Template",
    preview: () => <CurrentPreview />,
  },
  modern: {
    kicker: "TEMPLATE 02",
    title: "Modern Quality",
    blurb: "Modern quality-management presentation.",
    action: "Use Template",
    preview: () => <ModernPreview />,
  },
  executive: {
    kicker: "TEMPLATE 03",
    title: "Executive Premium",
    blurb: "Premium technical and executive presentation.",
    action: "Use Template",
    preview: () => <ExecutivePreview />,
  },
};

export function TemplatePreview({
  id,
  selected,
  onSelect,
  onUse,
}: {
  id: PdfTemplateId;
  selected: boolean;
  onSelect: () => void;
  onUse: () => void;
}) {
  const item = COPY[id];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white/80 text-left shadow-[0_12px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-[0_22px_50px_-24px_rgba(15,23,42,0.55)]",
        selected
          ? id === "modern"
            ? "border-teal-500 ring-2 ring-teal-400/40"
            : id === "executive"
              ? "border-indigo-500 ring-2 ring-indigo-400/40"
              : "border-sky-500 ring-2 ring-sky-400/40"
          : "border-white/40 hover:border-slate-300",
      )}
    >
      <div className="relative p-3 pb-2">
        {item.preview()}
        {selected ? (
          <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
            <Check className="size-3" /> Selected
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.kicker}</p>
        <h3 className="mt-1 font-display text-[16px] font-semibold text-ink">{item.title}</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">{item.blurb}</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onUse();
          }}
          className={cn(
            "mt-4 inline-flex h-9 items-center justify-center rounded-lg text-[12px] font-semibold transition",
            id === "current"
              ? "bg-sky-700 text-white hover:bg-sky-800"
              : id === "modern"
                ? "bg-teal-600 text-white hover:bg-teal-700"
                : "bg-indigo-700 text-white hover:bg-indigo-800",
          )}
        >
          {item.action}
        </button>
      </div>
    </div>
  );
}
