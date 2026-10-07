import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-lg border border-header-foreground/20 bg-header-foreground/10 text-header-foreground transition-colors hover:bg-header-foreground/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-foreground/25"
          aria-label="Open user menu"
        >
          <UserRound className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 border-[color:var(--glass-border)] bg-[color:var(--glass-bg-strong)] p-0 shadow-[var(--shadow-card)] backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-3 py-4 font-normal">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0 w-full">
              <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-1">
          <DropdownMenuItem
            onClick={logout}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
