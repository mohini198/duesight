"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Send, CheckCircle, XCircle, RotateCcw, Sparkles } from "lucide-react";
import { Auth, createAgentSocket, getHistory, approveTask, AgentEvent } from "@/lib/api";

interface StatusMessage { id: number; text: string; type: "info"|"success"|"warning"|"error"; ts: number; }
interface HistoryItem { id: number; task_prompt: string; status: string; loop_count: number; tokens_used: number; cost_usd: number; started_at: string; }
interface HumanReview { threadId: string; draft: string; score: number; }

let msgId = 0;

const AGENTS = [
  { name: "Planner",    desc: "Research strategy" },
  { name: "Researcher", desc: "Company profile" },
  { name: "Competitor", desc: "Market landscape" },
  { name: "Risk",       desc: "Risk assessment" },
  { name: "Report",     desc: "Investment memo" },
];

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const [result, setResult] = useState("");
  const [cost, setCost] = useState<{tokens:number; usd:number}|null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [humanReview, setHumanReview] = useState<HumanReview|null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [approvingLoading, setApprovingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"stream"|"result"|"history">("stream");
  const wsRef = useRef<WebSocket|null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const threadCounter = useRef(1);

  useEffect(() => {
    if (!Auth.isLoggedIn()) { router.push("/"); return; }
    setEmail(Auth.getEmail());
    loadHistory();
  }, [router]);

  useEffect(() => { if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight; }, [messages]);

  async function loadHistory() { try { setHistory(await getHistory(Auth.getToken())); } catch {} }

  function addMessage(text: string, type: StatusMessage["type"] = "info") {
    setMessages(prev => [...prev, { id: msgId++, text, type, ts: Date.now() }]);
  }

  const handleEvent = useCallback((e: AgentEvent) => {
    switch (e.event) {
      case "status": {
        const type = e.message.includes("⚠") ? "warning" : e.message.includes("✅")||e.message.includes("✓") ? "success" : e.message.includes("❌") ? "error" : "info";
        addMessage(e.message, type);
        break;
      }
      case "human_review":
        setHumanReview({ threadId: e.thread_id, draft: e.current_draft, score: e.review_score });
        setActiveTab("stream");
        addMessage("Memo drafted — ready for your review.", "warning");
        break;
      case "complete":
        setResult(e.result); setRunning(false); setActiveTab("result");
        addMessage("Analysis complete.", "success");
        loadHistory();
        break;
      case "cost":
        setCost({ tokens: e.tokens, usd: e.cost_usd });
        break;
      case "error":
        addMessage(`Error: ${e.message}`, "error"); setRunning(false);
        break;
    }
  }, []);

  function runTask() {
    if (!task.trim() || running) return;
    const threadId = `session_${Date.now()}_${threadCounter.current++}`;
    setRunning(true); setMessages([]); setResult(""); setCost(null); setHumanReview(null); setActiveTab("stream");

    const ws = createAgentSocket(Auth.getToken(), handleEvent,
      () => { addMessage(`Researching "${task.trim()}"...`, "info"); ws.send(JSON.stringify({ task: task.trim(), thread_id: threadId })); },
      () => {}
    );
    wsRef.current = ws;
  }

  async function handleApproval(approved: boolean) {
    if (!humanReview) return;
    setApprovingLoading(true);
    try {
      await approveTask(humanReview.threadId, approved, reviewFeedback, Auth.getToken());
      addMessage(approved ? "Approved — finalizing memo." : "Sent back for revision.", approved ? "success" : "warning");
      setHumanReview(null); setReviewFeedback("");
    } catch (err: unknown) {
      addMessage(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally { setApprovingLoading(false); }
  }

  function logout() { wsRef.current?.close(); Auth.clear(); router.push("/"); }

  function msgColor(type: StatusMessage["type"]) {
    switch (type) { case "success": return "var(--success)"; case "warning": return "var(--warning)"; case "error": return "var(--danger)"; default: return "var(--text-secondary)"; }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <header style={{ height: 64, borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", padding: "0 28px", gap: 20, flexShrink: 0 }}>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Due<span style={{ color: "var(--accent)" }}>Sight</span>
        </div>
        <div style={{ flex: 1 }} />
        {cost && (
          <div className="font-mono card" style={{ display: "flex", gap: 14, fontSize: 12, padding: "6px 14px", color: "var(--text-secondary)" }}>
            <span>{cost.tokens.toLocaleString()} tok</span>
            <span style={{ color: "var(--success)" }}>${cost.usd.toFixed(6)}</span>
          </div>
        )}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", fontSize: 13, color: "var(--text-secondary)" }}>
          <span className="status-dot dot-success" /> {email}
        </div>
        <button onClick={logout} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LogOut size={14} /> Log Out
        </button>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, padding: 20, overflow: "hidden" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>

          <div className="card" style={{ padding: 16, display: "flex", gap: 10, flexShrink: 0 }}>
            <input value={task} onChange={e => setTask(e.target.value)} onKeyDown={e => e.key === "Enter" && runTask()}
              placeholder="Enter a company name — Stripe, Notion, Ramp…" disabled={running} className="input-field" style={{ flex: 1 }} />
            <button onClick={runTask} disabled={running || !task.trim()} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
              {running ? <><RotateCcw size={14} style={{ animation: "spin 1s linear infinite" }} /> Analyzing</> : <><Sparkles size={14} /> Analyze</>}
            </button>
          </div>

          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              {(["stream", "result", "history"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "14px 22px", background: "none", border: "none", cursor: "pointer",
                  borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: 13, fontWeight: 600,
                }}>
                  {tab === "stream" ? "Live Analysis" : tab === "result" ? "Memo" : "History"}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              <AnimatePresence mode="wait">

                {activeTab === "stream" && (
                  <motion.div key="stream" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} ref={streamRef}
                    style={{ height: "100%", overflowY: "auto", padding: 22 }}>

                    <AnimatePresence>
                      {humanReview && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="card-high" style={{ padding: 20, marginBottom: 18 }}>
                          <div className="badge badge-warning" style={{ marginBottom: 12 }}>
                            <span className="status-dot dot-warning" /> Awaiting Review
                          </div>
                          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Preview the draft, then approve or send back with notes.</p>
                          <div className="font-mono" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 12, maxHeight: 180, overflowY: "auto", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                            {humanReview.draft.slice(0, 700)}{humanReview.draft.length > 700 ? "…" : ""}
                          </div>
                          <textarea value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} placeholder="Revision notes (required to send back)…" rows={2} className="input-field" style={{ marginBottom: 12, resize: "none" }} />
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => handleApproval(true)} disabled={approvingLoading} className="btn-success" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button onClick={() => handleApproval(false)} disabled={approvingLoading || !reviewFeedback.trim()} className="btn-danger-outline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <XCircle size={14} /> Send Back
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {messages.length === 0 ? (
                      <div style={{ textAlign: "center", paddingTop: 60 }}>
                        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Enter a company name to begin the analysis.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {messages.map((m, i) => (
                          <motion.div key={m.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, flexShrink: 0 }}>{new Date(m.ts).toLocaleTimeString("en", { hour12: false })}</span>
                            <span style={{ fontSize: 13.5, color: msgColor(m.type), lineHeight: 1.55 }}>{m.text}</span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "result" && (
                  <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: "100%", overflowY: "auto", padding: 22 }}>
                    {result ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                          <span className="badge badge-success"><CheckCircle size={12} /> Approved</span>
                          {cost && <span className="font-mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>{cost.tokens.toLocaleString()} tokens · ${cost.usd.toFixed(6)}</span>}
                        </div>
                        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 26, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                          {result}
                        </div>
                      </div>
                    ) : <p style={{ textAlign: "center", paddingTop: 60, fontSize: 13, color: "var(--text-muted)" }}>No memo yet. Run an analysis first.</p>}
                  </motion.div>
                )}

                {activeTab === "history" && (
                  <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: "100%", overflowY: "auto", padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Past Analyses</span>
                      <button onClick={loadHistory} className="font-mono" style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer" }}>Refresh</button>
                    </div>
                    {history.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No analyses yet.</p> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {history.map(item => (
                          <div key={item.id} className="card card-hover" style={{ padding: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <span className={`status-dot ${item.status === "completed" ? "dot-success" : item.status === "running" ? "dot-warning" : "dot-danger"}`} />
                              <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.status.toUpperCase()}</span>
                              <span className="font-mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>{new Date(item.started_at).toLocaleDateString()}</span>
                            </div>
                            <p style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 8, fontWeight: 500 }}>{item.task_prompt}</p>
                            <div className="font-mono" style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
                              <span>{item.loop_count} loops</span><span>{item.tokens_used.toLocaleString()} tok</span><span style={{ color: "var(--success)" }}>${item.cost_usd.toFixed(6)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 14 }}>Research Council</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {AGENTS.map((a, i) => (
                <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--surface-high)" }}>
                  <span className="font-mono badge badge-accent" style={{ padding: "2px 7px", fontSize: 10 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 18, flex: 1, overflowY: "auto" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 14 }}>Pipeline</div>
            {["Intake", "Research", "Competitors", "Risks", "Memo", "Review", "Done"].map((step, i, arr) => (
              <div key={step}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <span className="status-dot dot-accent" style={{ opacity: 0.6 }} />
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{step}</span>
                </div>
                {i < arr.length - 1 && <div style={{ marginLeft: 3, width: 1, height: 10, background: "var(--border-strong)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
