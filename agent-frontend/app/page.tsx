"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { login, register, Auth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (Auth.isLoggedIn()) router.push("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    try {
      if (mode === "register") {
        await register(email, password);
        setSuccess("Account created. Signing you in...");
        const data = await login(email, password);
        Auth.save(data.access_token, data.email, data.user_id);
        setTimeout(() => router.push("/dashboard"), 600);
      } else {
        const data = await login(email, password);
        Auth.save(data.access_token, data.email, data.user_id);
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  if (!mounted) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", position: "relative", overflow: "hidden" }}>

      {/* Ambient glow orbs */}
      <div style={{ position: "fixed", top: "-10%", left: "10%", width: 400, height: 400, borderRadius: "50%", background: "var(--accent)", opacity: 0.12, filter: "blur(120px)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "var(--success)", opacity: 0.08, filter: "blur(120px)", pointerEvents: "none" }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ width: "100%", maxWidth: 420, position: "relative" }}>

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20,
            padding: "6px 14px", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border-strong)"
          }}>
            <span className="status-dot dot-accent pulse" />
            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
              AI DUE DILIGENCE DESK
            </span>
          </div>

          <h1 className="font-display" style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 10 }}>
            Due<span className="shimmer">Sight</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
            Five AI analysts research, compare, and score any company —
            you sign off on the memo.
          </p>
        </div>

        <div className="card-high fade-in" style={{ padding: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 28, background: "var(--bg)", borderRadius: 10, padding: 4 }}>
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                background: mode === m ? "var(--accent)" : "transparent",
                color: mode === m ? "#fff" : "var(--text-muted)",
                boxShadow: mode === m ? "0 4px 14px rgba(109,94,245,0.3)" : "none",
              }}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@firm.com" required className="input-field" />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="input-field" />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="badge badge-danger" style={{ width: "100%", justifyContent: "flex-start", padding: "10px 14px" }}>
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="badge badge-success" style={{ width: "100%", justifyContent: "flex-start", padding: "10px 14px" }}>
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 4, width: "100%" }}>
              {loading ? "Processing…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="font-mono" style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
          DueSight — Powered by a 5-agent research council
        </p>
      </motion.div>
    </div>
  );
}
