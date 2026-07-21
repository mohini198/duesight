// =====================================================================
// lib/api.ts — All API calls + WebSocket logic
// =====================================================================

const API_BASE = "https://agent-platform-production-a13b.up.railway.app";
const WS_BASE  = "wss://agent-platform-production-a13b.up.railway.app";

// ── Auth ──────────────────────────────────────────────────────────────

export async function register(email: string, password: string) {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

// ── Task history ──────────────────────────────────────────────────────

export async function getHistory(token: string) {
  const res = await fetch(`${API_BASE}/history?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// ── Human approval ───────────────────────────────────────────────────

export async function approveTask(
  threadId: string,
  approved: boolean,
  feedback: string,
  token: string
) {
  const res = await fetch(`${API_BASE}/approve/${threadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved, feedback, token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Approval failed" }));
    throw new Error(err.detail || "Approval failed");
  }
  return res.json();
}

// ── WebSocket ─────────────────────────────────────────────────────────

export type AgentEvent =
  | { event: "status";       message: string }
  | { event: "human_review"; thread_id: string; current_draft: string; review_score: number; message: string }
  | { event: "complete";     result: string }
  | { event: "cost";         tokens: number; cost_usd: number }
  | { event: "error";        message: string };

export function createAgentSocket(
  token: string,
  onEvent: (e: AgentEvent) => void,
  onOpen?: () => void,
  onClose?: () => void
): WebSocket {
  const wsUrl = `${WS_BASE}/ws/task?token=${encodeURIComponent(token)}`;
  console.log("🔍 Connecting to:", wsUrl);

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("✅ WebSocket connected");
    onOpen?.();
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as AgentEvent;
      onEvent(data);
    } catch (e) {
      console.error("Failed to parse WS message", e);
    }
  };

  ws.onclose = (e) => {
    console.log(`🔌 WebSocket closed | code=${e.code} reason="${e.reason}"`);
    onClose?.();
  };

  ws.onerror = (e) => {
    console.error("❌ WebSocket error", e);
  };

  return ws;
}

// ── Token storage (localStorage wrapper) ─────────────────────────────

export const Auth = {
  save: (token: string, email: string, userId: number) => {
    localStorage.setItem("agent_token", token);
    localStorage.setItem("agent_email", email);
    localStorage.setItem("agent_user_id", String(userId));
  },
  getToken: () => localStorage.getItem("agent_token") || "",
  getEmail: () => localStorage.getItem("agent_email") || "",
  clear: () => {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_email");
    localStorage.removeItem("agent_user_id");
  },
  isLoggedIn: () => !!localStorage.getItem("agent_token"),
};