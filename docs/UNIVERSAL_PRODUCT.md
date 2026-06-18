# LUX — Universal Product Vision

**One agent. Every surface. Zero friction.**

---

## The Core Insight

LUX is not an app. LUX is a **service** that follows you across every device you own. The agent runs once — on your hardware or in the cloud — and you access it from anywhere, any device, any platform.

```
                    ┌─────────────────────────────────┐
                    │         LUX CORE                 │
                    │  (runs on your hardware or       │
                    │   cloud VM — Mac/Win/Linux/Pi)   │
                    │                                  │
                    │  • Hermes Agent                  │
                    │  • LUX Proof Engine              │
                    │  • Specs + Memory + Cron         │
                    │  • All models (Gemini, MiniMax)  │
                    └──────────┬───────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
    ┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
    │   DESKTOP     │  │   MOBILE      │  │   WEB         │
    │               │  │               │  │               │
    │ macOS       │  │ iOS         │  │ Any browser   │
    │ Windows ⊞     │  │ Android 🤖    │  │ Any device    │
    │ Linux 🐧      │  │               │  │               │
    └───────────────┘  └───────────────┘  └───────────────┘

    ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
    │   MESSAGING    │  │   VOICE        │  │   WEARABLE     │
    │               │  │               │  │               │
    │ Telegram      │  │ Alexa         │  │ Apple Watch  │
    │ WhatsApp      │  │ Google Home   │  │ Wear OS ⌚     │
    │ Discord       │  │ Siri          │  │               │
    │ Slack         │  │ CarPlay       │  │               │
    │ iMessage      │  │ Android Auto  │  │               │
    │ Signal        │  │               │  │               │
    └───────────────┘  └───────────────┘  └───────────────┘

    ┌───────────────┐  ┌───────────────┐
    │   IDE          │  │   TV           │
    │               │  │               │
    │ VS Code       │  │ Apple TV    │
    │ JetBrains     │  │ Android TV    │
    │ Cursor        │  │               │
    │ Zed           │  │               │
    └───────────────┘  └───────────────┘
```

---

## Every Surface, One Agent

### Desktop (Native Apps)

| Platform | Technology | Distribution |
|----------|-----------|--------------|
| **macOS** | SwiftUI native app | App Store + .dmg |
| **Windows** | Tauri (Rust + WebView) | Microsoft Store + .exe |
| **Linux** | Tauri | Flatpak + .AppImage |

Each app provides:
- Beautiful dashboard (project health, activity feed, chat)
- System tray icon (always running, always accessible)
- Native notifications (regression detected, health report ready)
- Auto-start on login
- Local file access (reads your code natively)

### Mobile (Companion Apps)

| Platform | Technology | Distribution |
|----------|-----------|--------------|
| **iOS** | SwiftUI native | App Store |
| **Android** | Kotlin/Jetpack Compose | Google Play |

Each app provides:
- Chat interface (text + voice)
- Push notifications (PR review needed, spec failure)
- Widget (project health on home screen)
- Voice-first mode (talk while walking, driving)
- Camera → code (snap a screenshot, ask "what's wrong here?")

### Messaging (Zero Install)

Users don't install anything. They just message LUX:

| Platform | How It Works |
|----------|-------------|
| **Telegram** | Bot auto-created during onboarding |
| **WhatsApp** | QR code links to LUX business number |
| **Discord** | Bot joins your server |
| **Slack** | App installed to workspace |
| **iMessage** | Messages forwarded via Mac relay |
| **Signal** | Bot via signal-cli |

Onboarding: "Where do you want to talk to LUX?" → pick your platforms → scan QR codes → done.

### Voice (Hands-Free)

| Platform | How It Works |
|----------|-------------|
| **Alexa** | "Alexa, ask LUX to check my projects" |
| **Google Home** | "Hey Google, tell LUX to fix the login bug" |
| **Siri** | "Hey Siri, ask LUX for today's health report" |
| **CarPlay / Android Auto** | Voice coding while driving |
| **AirPods** | "LUX, what broke in the last deploy?" |

The voice layer translates natural speech to LUX tasks. Responses are read aloud.

### Wearable (Glanceable)

| Platform | What It Shows |
|----------|--------------|
| **Apple Watch** | Complication: 🟢/🟡/🔴 project health. Tap for details. |
| **Wear OS** | Tile: "3 projects · 0 failures · Last check 2 min ago" |

Quick actions from the watch:
- "Fix the build" → taps phone → LUX runs
- "Health check" → runs now, shows result on watch face

### TV (Dashboard Mode)

| Platform | What It Shows |
|----------|--------------|
| **Apple TV** | Full dashboard on your big screen. Project health, activity feed, verification history. |
| **Android TV** | Same dashboard, Chromecast-compatible. |

Morning routine: turn on TV → LUX dashboard shows overnight health report.

### IDE (Where Developers Live)

| Platform | Integration |
|----------|------------|
| **VS Code** | Extension: inline verification, spec generation, one-click fix |
| **JetBrains** | Plugin: same capabilities, IntelliJ-native UI |
| **Cursor** | Built-in via .cursorrules |
| **Zed** | ACP integration (already supported) |

The IDE surface shows verification inline:
```
function calculateDiscount(total, tier) {
  // 🟢 LUX: 847/847 specs pass · last verified 2 min ago
  return total * DISCOUNT_RATES[tier];
}
```

---

## Cloud Option: Zero Hardware

For users who don't want to run anything locally:

```
┌─────────────────────────────────────────────────────┐
│                  LUX CLOUD                           │
│                                                      │
│  • Runs on our infrastructure                        │
│  • Connects to your GitHub/GitLab repos              │
│  • Your code stays on your repos (we read only)      │
│  • All the same surfaces — nothing changes           │
│  • Starts at $29/mo (includes model access)          │
│                                                      │
│  [ Sign Up ]  —  No download needed, works instantly │
└─────────────────────────────────────────────────────┘
```

The cloud option eliminates the biggest friction: "I don't have a computer that's always on." Sign up, connect GitHub, start messaging LUX from your phone. Done in 60 seconds.

---

## The Universal Onboarding (60 Seconds)

### Flow for any new user, any platform:

```
1. Open lux.ai in your browser
2. "Welcome to LUX. How do you want to start?"
   
   ┌──────────────────────────────────────────────┐
   │  📱  I want LUX on my phone                   │
   │      (scan QR code, opens Telegram/WhatsApp)  │
   │                                               │
   │  💻  I want to install on my computer          │
   │      (download for Mac · Windows · Linux)      │
   │                                               │
   │  ☁️  I want LUX in the cloud                   │
   │      (no download, connects to GitHub)         │
   │                                               │
   │  🗣️  I want to talk to LUX                     │
   │      (Alexa · Google Home · Siri)              │
   └──────────────────────────────────────────────┘

3. 60 seconds later: LUX is active on your chosen surface.
   Same agent. Same memory. Same proofs. Everywhere.
```

---

## The Experience (Across Devices)

### Morning — Apple Watch
```
Watch face complication: 🟢
Tap → "3 projects healthy. Overnight verification: 1,159 specs, 0 failures."
```

### Commute — CarPlay
```
"Hey Siri, ask LUX what needs attention."
→ "One warning in portfolio-site. Unused dependency 'moment.js'.
   Want me to remove it?"
"Yes."
→ "Removed. Build passes. All specs verified."
```

### At Desk — Desktop App + VS Code
```
Open VS Code → start editing → 🟢 inline verification badge
LUX desktop app in menu bar: "847 specs · last verified 2 min ago"
```

### Meeting — Phone (WhatsApp)
```
Boss: "Is the payment refactor safe to deploy?"
You: message LUX on WhatsApp "Has processPayment been verified?"
LUX: "✅ Yes. 1,024/1,024 clauses pass. 0 regressions. Last verified 8 min ago.
      All dependent functions also verified: validateCart (312/312), applyDiscount (89/89).
      Safe to deploy."
```

### Evening — TV Dashboard
```
Apple TV: LUX dashboard fullscreen
Shows: today's activity, all projects, verification history
Auto-refreshes every 30 seconds
```

### Night — Alexa
```
"Alexa, ask LUX to run the weekly full verification."
→ Runs. Reports next morning.
```

---

## Architecture (How It All Connects)

```
┌─────────────────────────────────────────────────────────────┐
│                     LUX BACKEND                              │
│                                                              │
│  • Hermes Agent (runs on user hardware or cloud)            │
│  • LUX Engine (specs, proofs, verification)                 │
│  • Gateway (connects all surfaces)                           │
│  • Sync Engine (memory + specs follow you everywhere)        │
│                                                              │
│  Deployment options:                                         │
│    🖥  Self-hosted: Mac, Windows, Linux, Raspberry Pi        │
│    ☁️  Cloud: LUX Cloud ($29/mo, we host, zero setup)       │
│    🐳  Docker: one container, runs anywhere                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌─────▼─────┐
    │ REST API │      │ WebSocket│      │ Webhooks  │
    │ (sync)   │      │ (realtime)│     │ (events)  │
    └────┬─────┘      └────┬─────┘      └─────┬─────┘
         │                 │                  │
    ┌────▼─────────────────▼──────────────────▼─────┐
    │              CONNECT LAYER                     │
    │                                                │
    │  Telegram Bot  ·  WhatsApp Business  ·  Discord │
    │  Slack App  ·  Signal Bot  ·  iMessage Relay    │
    │  Alexa Skill  ·  Google Home  ·  Siri Intent    │
    │  Push Notifications (APNs · FCM)                │
    └────────────────────┬───────────────────────────┘
                         │
    ┌────────────────────┼───────────────────────────┐
    │            CLIENT APPS                          │
    │                                                 │
    │  macOS  ·  Windows  ·  Linux  ·  iOS  · Android │
    │  watchOS  ·  Wear OS  ·  tvOS  ·  Android TV    │
    │  VS Code  ·  JetBrains  ·  Web Dashboard        │
    └─────────────────────────────────────────────────┘
```

---

## Business Model

| Tier | Price | Surfaces | Specs | Projects | Models |
|------|-------|----------|-------|----------|--------|
| **Free** | $0 | Web + 1 messaging + IDE | 100 | 1 | Gemini Flash |
| **Pro** | $29/mo | All surfaces | Unlimited | Unlimited | All models |
| **Team** | $99/mo | All + shared specs | Unlimited | Unlimited | All + priority |
| **Enterprise** | Custom | All + SSO + audit | Unlimited | Unlimited | All + dedicated |

### What's Free Forever
- LUX Core (open source, MIT)
- Self-hosted on your own hardware
- Pi extensions
- Hermes skills
- Type-level proofs

### What's Paid
- Cloud hosting (we run the agent for you)
- Bundled model access (one subscription, all models)
- Multi-surface sync (memory follows you across devices)
- Team collaboration (shared specs, shared dashboards)
- Priority support

---

## Launch Strategy

### Phase 1: Developer Preview (Now)
- Open source on GitHub
- `setup.sh` one-click install
- Telegram + CLI + Pi surfaces
- Free forever for self-hosted

### Phase 2: Desktop App (Month 1-2)
- macOS native app (SwiftUI)
- Windows app (Tauri)
- Guided onboarding (no terminal)
- Dashboard UI
- Free tier on App Store

### Phase 3: Mobile + Cloud (Month 3-4)
- iOS + Android apps
- LUX Cloud ($29/mo hosted)
- Push notifications
- Widgets + Watch

### Phase 4: Everywhere (Month 5-6)
- Alexa + Google Home skills
- WhatsApp + Discord + Slack
- Apple TV + Android TV
- CarPlay + Android Auto
- iMessage relay

### Phase 5: Enterprise (Month 7-12)
- SSO + audit logs
- Team dashboards
- Shared spec libraries
- On-premise deployment
- SOC 2 compliance
