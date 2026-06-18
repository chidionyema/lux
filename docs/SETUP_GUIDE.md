# LUX — Complete Setup & Operations Guide

**Always-on. Proof-driven. Pocket-accessible. Safe autonomy.**

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR PHONE (anywhere)                    │
│  Telegram @Ottototbot: "Fix the login bug in signalengine"   │
└────────────────────────┬────────────────────────────────────┘
                         │ Telegram Cloud
┌────────────────────────▼────────────────────────────────────┐
│              YOUR MAC (home/office, on + Wi-Fi)              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  HERMES GATEWAY (launchd, PID 16959, survives logout) │   │
│  │  • Receives Telegram messages                         │   │
│  │  • Fires cron jobs (9 AM, 6 PM, Sunday)              │   │
│  │  • Routes to Hermes Agent                             │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │  HERMES AGENT v0.16.0                                 │   │
│  │  • Model: Gemini 2.5 Flash (fast, global servers)     │   │
│  │  • Soul: LUX Celestial Coordinator (SOUL.md)          │   │
│  │  • Skills: 74 loaded (TDD + PDD + debugging + ...)   │   │
│  │  • Memory: Cross-session persistent (MEMORY.md)       │   │
│  │  • Tools: 18 active (terminal, file, web, browser...) │   │
│  └────────┬──────────────────┬──────────────────────────┘   │
│           │                  │                               │
│  ┌────────▼────────┐  ┌──────▼──────────────────────────┐   │
│  │  OMP / PI        │  │  LUX ENGINE                     │   │
│  │  • Code editing  │  │  • SpecVerifier (formal specs)  │   │
│  │  • LSP + DAP     │  │  • Type-level proofs (L4)       │   │
│  │  • Subagents     │  │  • Pi extensions (auto-verify)  │   │
│  └─────────────────┘  │  • 50 tests, 0 failures          │   │
│                        └─────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SCHEDULED JOBS                                       │   │
│  │  ☀️  9 AM daily  → Health check (deps, security, ...) │   │
│  │  🌅 6 PM daily  → Today's summary (changes, specs)    │   │
│  │  📋 Sun midnight → Full verification (all projects)    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation Recap

### What's Installed

| Component | Version | Path |
|-----------|---------|------|
| Hermes Agent | v0.16.0 | `~/.hermes/` |
| LUX Engine | v0.2.0 | `~/Documents/code/lux/` |
| Python | 3.11.15 | venv |
| Node.js | v26.3.0 | system |
| Git | 2.39.3 | system |
| ripgrep | 13.0.0 | system |
| ffmpeg | 8.1.1 | Homebrew |
| Chrome | system | Browser automation |

### Key Files

```
~/.hermes/
├── config.yaml          ← Model, tools, permissions, gateway
├── .env                 ← API keys (NEVER commit)
├── SOUL.md              ← LUX Celestial Coordinator personality
├── skills/              ← 74 skills (PDD, TDD, debugging, etc.)
├── memories/
│   ├── MEMORY.md        ← Agent's notes (auto-managed)
│   └── USER.md          ← User profile (auto-managed)
├── cron/                ← Scheduled job definitions  
├── sessions/            ← Session logs
└── logs/                ← Gateway logs

~/Documents/code/lux/
├── src/                 ← LUX engine source (3,711 lines)
│   ├── core/            ← Semantic graph, AST parsing
│   └── proof/           ← SpecVerifier, type-level proofs
├── tests/               ← 50 tests, 0 failures
├── lux-zero-friction.ts ← Pi extension (auto-verify on edit)
├── lux-code-review.ts   ← Pi extension (proof-backed PR review)
├── lux-proof-extension.ts ← Pi extension (tools + commands)
├── hermes-setup/        ← Setup docs, soul, PDD skill
└── CREDENTIALS.local.md ← Credentials reference (GITIGNORED)
```

---

## Model Configuration

### Primary: Gemini 2.5 Flash

| Property | Value |
|----------|-------|
| Model | `gemini-2.5-flash` |
| Provider | Custom (Google AI Studio) |
| Latency | ~1-3 seconds |
| Servers | Global (low latency from anywhere) |
| Key | In `~/.hermes/.env` |
| Why | Fast responses for remote/mobile use |

### Backup: MiniMax M3

| Property | Value |
|----------|-------|
| Model | `minimax-m3` |
| Provider | Custom (MiniMax API) |
| Context | 1M tokens (best for large codebases) |
| Latency | ~5-8 seconds (China servers) |
| Key | In `~/.hermes/.env` |

**To switch models:**

```bash
# Use MiniMax for complex, large-context tasks
hermes -m minimax-m3 -z "refactor the entire payment system"

# Use Gemini for everything else (default, fast)
hermes -z "fix login bug"
```

### Available Providers (configured in .env)

| Provider | Status | Use Case |
|----------|--------|----------|
| Gemini 2.5 Flash | ✅ Primary | Daily coding, quick queries |
| MiniMax M3 | ✅ Backup | Large context, complex refactors |
| DeepSeek V4 | ✅ Backup | Alternative if Gemini/MiniMax down |
| Gemini 3 Flash | ✅ Auxiliary | Vision, search, compression |

---

## Telegram Setup

### Configuration

| Setting | Value |
|---------|-------|
| Bot | @Ottototbot |
| URL | t.me/Ottototbot |
| Owner ID | 8868748055 |
| Access | Owner only (TELEGRAM_ALLOWED_USERS) |
| Status | ✅ Configured, gateway running |

### Usage From Your Phone

1. Open Telegram
2. Message @Ottototbot
3. Send any coding task
4. Hermes processes on your Mac, replies to your phone

**Works from anywhere** — as long as your Mac is on and connected to Wi-Fi. The launchd gateway service survives logout and sleep.

---

## Autonomy & Permissions (Safe Model)

### What Runs Unattended (No Approval Needed)

| Action | Auto? | Why Safe |
|--------|-------|----------|
| Read files | ✅ Always | Read-only |
| Edit files | ✅ Always | Version controlled |
| Run tests | ✅ Always | Non-destructive |
| Git operations | ✅ Always | Standard workflow |
| Web search | ✅ Always | Read-only |
| Code review | ✅ Always | Read-only |
| Create specs | ✅ Always | Non-destructive |
| Subagent tasks | ✅ Auto-approve | Isolated worktrees |

### What Requires Attention

| Action | Blocks? | Frequency |
|--------|---------|-----------|
| `rm -rf` / destructive | ⚠️ Asks | Rare in coding |
| `sudo` | ⚠️ Asks | Rare |
| Network-exposed ops | ⚠️ Asks | Very rare |
| Install system packages | ⚠️ Asks | Occasional |

### How It's Configured

```yaml
# ~/.hermes/config.yaml
delegation:
  subagent_auto_approve: true    # Subagents auto-approve (isolated worktrees)

terminal:
  sudo_password: ""              # Empty = works with Touch ID, no password leak

tool_loop_guardrails:
  hard_stop_enabled: true        # Safety net stays on — prevents infinite loops
```

**No blanket dangerous-command approval.** The safe approach: subagents handle the risky work in isolation, the main agent asks for truly destructive operations, and 95% of daily coding tasks never hit an approval prompt.

---

## Scheduled Automations

| Job | Schedule | What It Does | Next Run |
|-----|----------|-------------|----------|
| ☀️ Morning Health | Daily 9 AM | Check deps, security, tests, complexity | Jun 18, 9 AM |
| 🌅 Evening Summary | Daily 6 PM | Modified functions, verified specs, regressions | Jun 17, 6 PM |
| 📋 Weekly Verify | Sunday midnight | Full `lux verify` across all projects | Jun 21, midnight |

```bash
hermes cron list          # View all jobs
hermes cron run <id>      # Run a job immediately
hermes cron pause <id>    # Pause a job
hermes cron remove <id>   # Delete a job
```

---

## Daily Usage

### Quick Reference

```bash
# Terminal
hermes                        # Interactive TUI session
hermes -z "fix login bug"     # One-shot task
hermes doctor                 # System health check
hermes gateway status         # Check gateway
hermes cron list              # View scheduled jobs

# Pi (coding agent)
pi                            # Start with LUX auto-verify
/lux                          # LUX status dashboard
/lux-health                   # Live diagnostic
/verify-specs                 # List project specs

# LUX (verification)
cd ~/Documents/code/lux
npm test                      # 50 tests
npx vitest run                # Full test suite
npx tsc --noEmit --strict     # Type-level proof verification
```

### Common Workflows

**Fix a bug from your phone:**
```
Telegram: "Fix the login timeout in signalengine"
→ Hermes reads code, finds bug, writes fix
→ LUX auto-verifies against existing specs
→ Reply: "✅ Fixed. 7/7 edge cases pass. Commit: a3f2b1c"
```

**Refactor with verification:**
```bash
cd my-project
pi "Refactor payment processing to async"
# LUX auto-verifies after every edit
# Silent PASS on success, alerted FAIL on regression
```

**Morning check-in:**
```
Telegram (9 AM auto): "🩺 Health report: 3 projects healthy.
   ecommerce-clean: 2 deps updated. signalengine: all specs pass."
```

---

## Maintenance

### Updates

```bash
hermes update           # Update Hermes Agent
cd ~/Documents/code/lux && git pull  # Update LUX Engine
```

### Monitoring

```bash
hermes gateway status              # Gateway health
tail -f ~/.hermes/logs/gateway.log # Live logs
hermes doctor                      # Full diagnostic
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Gateway not running | `launchctl start ai.hermes.gateway` |
| Model not responding | `hermes doctor` → check API keys |
| Telegram no reply | Gateway running? Mac on Wi-Fi? |
| Pi extension not loading | Check `~/.pi/agent/extensions/lux-zero-friction.ts` |
| Sudo prompt stuck | Touch ID enabled? `sudo_password: ""` should work |
| **"python3.11 would like to access data"** | Grant Full Disk Access (see below) |

### macOS Permissions Fix

If macOS shows a popup: **"python3.11" would like to access data from other apps**, grant Full Disk Access once:

```
1. System Settings → Privacy & Security → Full Disk Access
2. Click the + button
3. Press Cmd+Shift+G (Go to folder)
4. Paste this exact path:

   /Users/chidionyema/.local/share/uv/python/cpython-3.11.15-macos-x86_64-none/bin/python3.11

5. Also add Terminal (or iTerm):
   /System/Applications/Utilities/Terminal.app

6. Quit and reopen Terminal, then:
   launchctl stop ai.hermes.gateway
   launchctl start ai.hermes.gateway
```

The popup won't appear again.

### Automated Setup

To reconfigure everything from scratch in one command:

```bash
cd ~/Documents/code/lux
bash setup.sh
```

This re-deploys all configs, keys, soul, skills, extensions, cron jobs, and restarts the gateway.

---

## Credentials

**Location:** `~/Documents/code/lux/CREDENTIALS.local.md`  
**Git status:** gitignored — never committed, never shared  
**Contains:** API keys, bot tokens, user IDs, model endpoints

If you lose it, keys can be regenerated from:
- Gemini: [aistudio.google.com](https://aistudio.google.com)
- MiniMax: [platform.minimax.io](https://platform.minimax.io)
- DeepSeek: [platform.deepseek.com](https://platform.deepseek.com)
- Telegram: @BotFather
