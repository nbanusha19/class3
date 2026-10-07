import { useEffect, useState, useRef, useCallback } from "react";
import { Moon, Sun, Waves, Sunset, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeId = "light" | "dark" | "ocean" | "sunset";

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "ocean", label: "Ocean", icon: Waves },
  { id: "sunset", label: "Sunset", icon: Sunset },
] as const;

const STORAGE_KEY = "hiq-theme";

/** Visual theme selector — single icon trigger with dropdown menu. */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("light");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as ThemeId | null;
    if (saved && THEMES.some((t) => t.id === saved)) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const handleSelect = useCallback((id: ThemeId) => {
    setTheme(id);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const currentTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <div className="relative z-50" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${currentTheme.label}`}
        title={`Theme: ${currentTheme.label}`}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md border border-header-foreground/20",
          "bg-header-foreground/10 px-2 py-1.5 text-header-foreground backdrop-blur-sm",
          "transition-all duration-200 hover:bg-header-foreground/20 hover:border-header-foreground/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        )}
      >
        <CurrentIcon className="size-4" />
        <ChevronDown className={cn("size-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select theme"
          className={cn(
            "absolute right-0 top-full z-[100] mt-1.5 w-40 overflow-hidden rounded-lg border border-border",
            "bg-[color:var(--glass-bg-strong)] p-1.5 text-ink shadow-xl shadow-black/20 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150"
          )}
        >
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                role="option"
                aria-selected={active}
                type="button"
                onClick={() => handleSelect(t.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
                  active
                    ? "bg-primary/10 text-ink"
                    : "text-muted-foreground hover:bg-muted hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="font-medium">{t.label}</span>
                {active && <span className="ml-auto flex size-2 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
