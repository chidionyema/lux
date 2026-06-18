# LUX — The Commercial Product Vision

**AI coding companion for everyone. Zero terminal. Zero config. Double-click to start.**

---

## The Problem We're Solving

Current state: "Install Hermes, configure API keys, edit YAML files, create a Telegram bot, set up launchd..."

This is developer-hostile. For non-technical users, it's impossible.

## The Product: LUX Desktop

A macOS application (with Windows/Linux to follow) that:

1. **Downloads as a .dmg** — double-click, drag to Applications, done
2. **First launch is a guided tour** — beautiful onboarding, no terminal, no config files
3. **Comes with everything** — model access, Telegram bot, memory, verification. Pre-configured.
4. **Works instantly** — start typing or talking in under 2 minutes from download
5. **Feels like magic** — "fix my code" works without understanding what Hermes, LUX, or Pi are

---

## Onboarding Flow (The User Never Sees Code)

```
┌──────────────────────────────────────────────────────┐
│                  LUX DESKTOP                          │
│                                                       │
│   ┌─────────────────────────────────────────────┐    │
│   │                                             │    │
│   │           ✦  Welcome to LUX  ✦              │    │
│   │                                             │    │
│   │     Your AI coding companion.               │    │
│   │     It reads your code, fixes bugs,          │    │
│   │     and proves everything works.             │    │
│   │                                             │    │
│   │           [ Get Started ]                    │    │
│   │                                             │    │
│   └─────────────────────────────────────────────┘    │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Step 1: Welcome (15 seconds)
- Animated intro showing what LUX does
- "Your AI that lives on your computer and helps you code"
- Click "Get Started"

### Step 2: Name (10 seconds)
```
What should I call you?
┌─────────────────────────────────┐
│ Chidi                           │
└─────────────────────────────────┘
        [ Continue ]
```

### Step 3: Connect Your Code (30 seconds)
```
Where's your code?
┌──────────────────────────────────────────────────┐
│  📁 ~/Documents/code                              │
│     Found 12 projects                             │
│                                                   │
│  ☑ ecommerce-clean                                │
│  ☑ signalengine                                   │
│  ☑ portfolio-site                                 │
│  ☐ forex_trend_prediction                         │
│  ☐ ...                                            │
│                                                   │
│  [ Select All ]      [ Continue with 3 selected ] │
└──────────────────────────────────────────────────┘
```
Auto-discovers projects. User checks which ones to protect.

### Step 4: Phone Setup (60 seconds)
```
Want to code from your phone?

┌──────────────────────────────────────────────────┐
│                                                   │
│  1. Open Telegram on your phone                   │
│  2. Scan this QR code ──→  [QR CODE]              │
│     (or open t.me/LuxYourName_bot)                │
│                                                   │
│  Status: ⏳ Waiting for you to message the bot... │
│                                                   │
│  [ Skip — I'll set this up later ]                │
└──────────────────────────────────────────────────┘
```

LUX auto-creates the Telegram bot programmatically using the Bot API (no @BotFather needed — the app registers the bot itself). The QR code links directly to it.

### Step 5: Permissions (30 seconds)
```
LUX needs access to read and edit your code.

┌──────────────────────────────────────────────────┐
│                                                   │
│  macOS will ask:                                  │
│  "LUX Desktop would like to access               │
│   files in your Documents folder"                 │
│                                                   │
│  This is so I can read your code, run tests,       │
│  and fix bugs. I never access anything outside     │
│  your code folders.                                │
│                                                   │
│  [ Grant Access ]                                  │
│                                                   │
│  (clicking this opens System Settings for you)     │
└──────────────────────────────────────────────────┘
```

### Step 6: Done! (5 seconds)
```
┌──────────────────────────────────────────────────┐
│                                                   │
│           ✦  All set!  ✦                         │
│                                                   │
│   🛡️  3 projects protected                       │
│   📱  Phone ready: t.me/LuxYourName_bot           │
│   ✅  Health check running                        │
│                                                   │
│   Try it now:                                     │
│                                                   │
│   ┌─────────────────────────────────────────┐    │
│   │  Fix the login timeout in signalengine   │    │
│   └─────────────────────────────────────────┘    │
│   [ Send ]                                        │
│                                                   │
│   Or say it: 🎤 [Tap to speak]                     │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## The Dashboard (What The User Sees)

No terminal. No YAML. No cron expressions.

```
┌──────────────────────────────────────────────────────────────┐
│  LUX Desktop                                    ⚙️  🔔  👤   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────┐  ┌────────────────────────────┐ │
│  │  🛡️  Project Health      │  │  📊  Today's Activity       │ │
│  │                          │  │                             │ │
│  │  ecommerce-clean  🟢     │  │  3 functions modified       │ │
│  │  847 specs · 0 failures  │  │  12 verifications (all ✅)   │ │
│  │                          │  │  0 regressions blocked      │ │
│  │  signalengine      🟢    │  │  1 new spec created         │ │
│  │  312 specs · 0 failures  │  │                             │ │
│  │                          │  │  Next health check: 9:00 AM │ │
│  │  portfolio-site    🟡    │  └────────────────────────────┘ │
│  │  45 specs · 2 warnings   │                                │
│  └─────────────────────────┘                                  │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  💬  Ask LUX anything...                                  │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Fix the login bug                                    │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                              [ Send ] 🎤  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Features visible in the dashboard:

| Element | What It Shows |
|---------|--------------|
| **Project Health** | Per-project spec count, pass/fail, warnings |
| **Today's Activity** | Modified functions, verifications run, regressions blocked |
| **Chat Bar** | Type or speak tasks |
| **Notifications** | 🔔 alerts when something needs attention |
| **Settings** | ⚙️ change model, manage projects, phone setup |

---

## What Goes Away

| Current (Developer) | Product (Everyone) |
|---------------------|-------------------|
| `curl -fsSL ... \| bash` | Double-click .dmg |
| Edit `~/.hermes/config.yaml` | Settings panel |
| `export MINIMAX_API_KEY=...` | Pre-configured (Nous Portal bundle) |
| `hermes gateway setup` | QR code scan |
| `launchctl start ai.hermes.gateway` | Starts automatically |
| `hermes cron add "0 9 * * *"` | Toggle: "Daily health check: ON" |
| `hermes doctor` | Dashboard health indicator |
| macOS permission popup | Guided explanation + auto-open Settings |

---

## Implementation Path

### Phase 1: One-Click Script (Today)
`setup.sh` — already built. Runs everything in one command. Still requires terminal.

### Phase 2: Native App (2 weeks)
Electron/Tauri wrapper around Hermes. Bundles the setup script. Shows the dashboard. Handles onboarding flow.

### Phase 3: Bundled Model Access (1 month)
Integrate Nous Portal or similar. User creates account, pays one subscription, gets models + tools. No API keys to manage.

### Phase 4: App Store (2 months)
Distribute via macOS App Store + Windows Store. Auto-updates. Signed binaries. Non-technical users just search "LUX" and install.

---

## Revenue Model

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 1 project, 100 specs, Gemini Flash, basic dashboard |
| **Pro** | $29/mo | Unlimited projects, unlimited specs, all models, phone access, health reports |
| **Team** | $99/mo | Pro + shared specs, team dashboard, code review, priority support |

---

## The Experience

**Non-technical founder, day 1:**
```
1. Downloads LUX from website
2. Drags to Applications, opens
3. "Welcome! What should I call you?" → types name
4. "Where's your code?" → clicks ~/Documents/code, sees 3 projects
5. Scans QR code with phone → t.me/LuxFounder_bot opens
6. Types: "My checkout page is broken"
7. LUX reads code, finds bug, writes fix, verifies, deploys
8. "✅ Fixed! The discount calculation was off by one for returning customers.
   Commit pushed. 12/12 specs verified. No regressions."
```

The founder never saw a terminal, never edited a config file, never typed an API key, never used a cron expression. They just talked to LUX like a person.
