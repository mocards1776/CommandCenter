import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";

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

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="display text-3xl font-bold uppercase tracking-[0.18em]">Command Center</h1>
          <div className="stripe mt-3" />
        </div>

        <form onSubmit={onSubmit} className="panel p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-field border border-line px-3 py-2 text-cream outline-none focus:border-gold"
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
              className="bg-field border border-line px-3 py-2 text-cream outline-none focus:border-gold"
            />
          </label>

          {notice && <p className="text-sm text-gold">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="bg-gold text-shell font-semibold uppercase tracking-wider text-sm py-2.5 hover:brightness-110 disabled:opacity-50 transition"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setNotice(null);
            }}
            className="text-chalk hover:text-cream text-sm transition-colors"
          >
            {mode === "signin" ? "Need an account?" : "Already have an account?"}
          </button>
        </form>
      </div>
    </div>
  );
}
