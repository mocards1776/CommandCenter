import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import StarField from "@/components/StarField";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setNotice(`Check ${email} for a confirmation link, then sign in.`);
          setMode("signin");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full bg-field border border-white/10 px-3.5 py-2.5 text-[13.5px] text-cream rounded-sm outline-none focus:border-accent/60";

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <StarField count={70} seed={5} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3">
          <span className="flag-mark" />
          <h1 className="font-display text-cream text-[30px] tracking-[0.05em]">
            Command <span className="text-accent">Center</span>
          </h1>
          <div className="rule-flag w-24" />
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-panel flex flex-col gap-4 rounded border border-accent/25 p-7"
        >
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </label>

          {notice && <p className="text-accent text-[12.5px] leading-relaxed">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="from-accent-deep to-accent-dark text-cream mt-1 rounded-sm bg-gradient-to-b py-2.5 text-[11px] font-semibold uppercase tracking-[0.20em] transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setNotice(null);
            }}
            className="text-chalk hover:text-cream text-[12.5px] transition-colors"
          >
            {mode === "signin" ? "Need an account?" : "Already have an account?"}
          </button>
        </form>
      </div>
    </div>
  );
}
