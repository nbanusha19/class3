import { useState, type FormEvent } from "react";
import { ClipboardCheck, FileBadge, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { HiQMark } from "@/components/brand/HiQMark";

export function LoginScreen() {
  const { login } = useAuth();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(userId, password);
      if (!result.ok) {
        setError(result.error);
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[46%] flex-col overflow-hidden bg-[linear-gradient(160deg,#0b2f5c_0%,#123f78_48%,#0f3b73_100%)] px-10 py-8 text-white lg:flex xl:w-[48%]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.22),transparent_42%),radial-gradient(circle_at_80%_80%,rgba(37,99,235,0.18),transparent_40%)]" />

        <div className="relative z-10 flex items-center gap-3">
          <HiQMark className="size-9" />
          <span className="text-[13px] font-semibold tracking-[0.14em] text-white">HI-Q ELECTRONICS</span>
        </div>

        <div className="relative z-10 my-auto max-w-md pb-10 pt-16">
          <p className="text-[12px] font-medium tracking-[0.08em] text-white/55">
            HIQ-QAD-P06 · Class 3 · REV 1.0
          </p>
          <h1 className="font-display mt-4 text-[42px] font-bold leading-[1.08] tracking-tight text-white">
            Class 3 PCB
            <br />
            Report Suite
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/75">
            Sign in to fill IPC-6012F Class 3 certificates, inspection reports, and export polished PDFs from one
            workspace.
          </p>

          <div className="mt-10 flex items-center gap-3 text-[#f5a623]">
            <span className="flex size-10 items-center justify-center rounded-xl border border-[#f5a623]/35 bg-white/5">
              <FileBadge className="size-5" />
            </span>
            <span className="flex size-10 items-center justify-center rounded-xl border border-[#f5a623]/35 bg-white/5">
              <ClipboardCheck className="size-5" />
            </span>
            <span className="flex size-10 items-center justify-center rounded-xl border border-[#f5a623]/35 bg-white/5">
              <ShieldCheck className="size-5" />
            </span>
          </div>
        </div>

        <p className="relative z-10 text-[12px] text-white/45">Admin access only.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-[#f4f6f9] px-6 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <HiQMark className="size-9" />
            <div>
              <p className="text-[13px] font-semibold tracking-[0.12em] text-[#0f3b73]">HI-Q ELECTRONICS</p>
              <p className="text-[12px] text-muted-foreground">Class 3 PCB Report Suite</p>
            </div>
          </div>

          <h2 className="font-display text-[32px] font-bold tracking-tight text-[#1e293b]">Admin sign in</h2>
          <p className="mt-2 text-[14px] text-[#64748b]">Sign in to manage Class 3 quality documentation.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-[13px] font-medium text-[#334155]">User ID</span>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
                className="h-11 w-full rounded-lg border border-[#d7dde7] bg-white px-3.5 text-[14px] text-[#0f172a] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[13px] font-medium text-[#334155]">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border border-[#d7dde7] bg-white px-3.5 text-[14px] text-[#0f172a] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </label>

            {error ? <p className="text-[13px] font-medium text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#0f3b73] text-[15px] font-semibold text-white transition hover:bg-[#123f78] disabled:opacity-70"
            >
              Continue
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
