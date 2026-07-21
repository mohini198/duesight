# ⚡ AGENT-OS Dashboard — Cyberpunk AI Agent Frontend

> Production Next.js dashboard for the AGENT-OS multi-agent platform. Real-time WebSocket agent streaming, human-in-the-loop approval UI, task history, and live cost tracking — built with a cyberpunk dark aesthetic.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-11-purple?style=flat-square)](https://framer.com/motion)

---

## 🚀 Live Demo

[agent-os.vercel.app](https://agent-os.vercel.app) *(update after deploy)*

> **Backend repo:** [github.com/mohini198/agent-platform](https://github.com/mohini198/agent-platform)

---

## ✨ Features

- 🔐 **Auth Pages** — Login + Register with animated cyberpunk design
- 📡 **Live Agent Stream** — Real-time WebSocket feed showing each agent's status
- 👤 **Human Review Card** — Approve/Reject modal with feedback input
- 📊 **Task History** — Full run history with tokens, cost, and loop count
- 💰 **Cost Display** — Live token count + USD cost per run in header
- 🌑 **Cyberpunk Theme** — Deep black + electric cyan/green, Space Mono font
- 📱 **Responsive** — Works on desktop and mobile
- ⚡ **Framer Motion** — Smooth animations on all state transitions

---

## 🖥️ Screenshots

```
Login Page                    Dashboard
┌─────────────────────┐      ┌──────────────────────────────────┐
│                     │      │ AGENT_OS    tokens  $cost  logout │
│    AGENT_OS         │      ├──────────────┬───────────────────┤
│                     │      │ > task input │  AGENT ROSTER     │
│  [Sign In|Register] │      ├──────────────│  🧠 Planner       │
│                     │      │ STREAM OUTPUT│  🔍 Researcher    │
│  Email ___________  │      │              │  ✍️  Writer        │
│  Password _______   │      │ 12:34 🧠 ... │  🛡️  Reviewer     │
│                     │      │ 12:35 🔍 ... │  👤 Human         │
│  [INITIALIZE SESSION│      │ 12:36 ✍️  ... │                   │
│                     │      │ ⏸️  REVIEW   │  PIPELINE FLOW    │
└─────────────────────┘      └──────────────┴───────────────────┘
```

---

## 📁 Project Structure

```
agent-frontend/
├── app/
│   ├── globals.css          # Cyberpunk design system + CSS variables
│   ├── layout.tsx           # Root layout + fonts
│   ├── page.tsx             # Login / Register page
│   └── dashboard/
│       └── page.tsx         # Main dashboard with all features
├── lib/
│   └── api.ts               # API calls + WebSocket client + Auth helpers
├── public/
├── tailwind.config.ts
└── next.config.ts
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- Backend running at `http://localhost:8000`  
  → [Setup guide](https://github.com/mohini198/agent-platform)

### 1. Clone and Install

```bash
git clone https://github.com/mohini198/agent-frontend.git
cd agent-frontend
npm install
```

### 2. Configure Backend URL

The frontend points to `http://localhost:8000` by default.  
For production, update `lib/api.ts`:

```typescript
const API_BASE = "https://your-railway-url.railway.app";
const WS_BASE  = "wss://your-railway-url.railway.app";
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🎨 Design System

Built with a custom cyberpunk design system defined in `globals.css`:

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#020406` | Page background |
| `--cyan` | `#00e5ff` | Primary accent |
| `--green` | `#00ff88` | Success states |
| `--amber` | `#ffaa00` | Warnings / HITL |
| `--red` | `#ff4466` | Errors |
| `--font-mono` | Space Mono | All code/data text |
| `--font-display` | Syne | Headings + UI |

---

## 🔌 WebSocket Events

The dashboard listens for these events from the backend:

| Event | Description |
|-------|-------------|
| `status` | Agent step update (shown in stream) |
| `human_review` | Pipeline paused — shows approval card |
| `complete` | Final output ready — switches to Output tab |
| `cost` | Token count + USD cost — shown in header |
| `error` | Pipeline error — shown in red |

---

## 🚀 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set production URL
vercel --prod
```

Or connect your GitHub repo directly at [vercel.com](https://vercel.com) for auto-deploy on every push.

---

## 🛠️ Built With

- [Next.js 16](https://nextjs.org) — React framework
- [Tailwind CSS 4](https://tailwindcss.com) — Utility styling
- [Framer Motion](https://framer.com/motion) — Animations
- [Lucide React](https://lucide.dev) — Icons
- [Space Mono](https://fonts.google.com/specimen/Space+Mono) — Monospace font
- [Syne](https://fonts.google.com/specimen/Syne) — Display font

---

## 👤 Author

**Mohini** — AI Engineer  
GitHub: [@mohini198](https://github.com/mohini198)  
Backend: [AGENT-OS Platform](https://github.com/mohini198/agent-platform)

---

