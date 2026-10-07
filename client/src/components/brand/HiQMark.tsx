import { cn } from "@/lib/utils";

type HiQMarkProps = {
  className?: string;
};

const LOGO_SRC = `${import.meta.env.BASE_URL}hiq-logo.png`;

/** HI-Q brand mark from /public/hiq-logo.png */
export function HiQMark({ className }: HiQMarkProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="HI-Q"
      className={cn("inline-block shrink-0 object-contain", className)}
      draggable={false}
    />
  );
}
