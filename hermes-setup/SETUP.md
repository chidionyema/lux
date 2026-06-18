# The Heavenly Experience — Hermes + LUX Setup Guide

**Always-on. Self-improving. Proof-driven. Accessible from anywhere.**

---

## 1. Install Hermes Agent

```bash
# One command — handles everything
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# Reload shell
source ~/.bashrc  # or: source ~/.zshrc

# Verify
hermes doctor
```

## 2. Configure Your Model Brain

```bash
# Option A: Nous Portal (easiest — covers models + search + image + TTS)
hermes setup --portal

# Option B: Bring your own keys
hermes model
# → Choose provider: Anthropic, OpenAI, Google, OpenRouter, etc.
# → Enter API key
# → Select model: claude-sonnet-4-6 (recommended for PDD)

# Option C: Use multiple providers (cost optimization)
hermes config set ANTHROPIC_API_KEY sk-ant-...
hermes config set OPENAI_API_KEY sk-...
# Hermes will route based on task complexity
```

## 3. Set Up Telegram (Pocket AI)

```bash
# 1. Create a bot: message @BotFather on Telegram
#    → /newbot → choose name → get token

# 2. Get your Telegram ID: message @userinfobot

# 3. Configure Hermes
hermes gateway setup
# → Select: Telegram
# → Enter bot token
# → Enter your Telegram user ID

# 4. Start the gateway (runs in background)
hermes gateway start

# 5. Test: message your bot on Telegram
#    "hello" → should respond
```

**Now you can code from anywhere.** Text your bot from your phone while Hermes runs on your Mac.

## 4. Install the LUX Soul

```bash
# Copy the celestial coordinator personality
cp hermes-setup/soul.md ~/.hermes/soul.md

# Hermes reads this on every session — it defines your agent's identity
```

## 5. Install LUX Skills

```bash
# Install the PDD skill
cp -r hermes-setup/skills/lux-proof-driven-development ~/.hermes/skills/

# Install the zero-friction Pi extension
cp lux-zero-friction.ts ~/.pi/agent/extensions/

# Install the code review extension
cp lux-code-review.ts ~/.pi/agent/extensions/

# Reload
hermes /reload-skills
```

## 6. Install LUX CLI (for Hermes to call)

```bash
# From the lux project directory
cd lux
npm install
npm link  # Makes `lux` available globally

# Test
lux --help
```

## 7. Configure Scheduled Automations

```bash
# Hermes has a built-in cron scheduler
hermes schedule add "0 9 * * *" "Run health check on all projects"
hermes schedule add "0 18 * * *" "Summarize today's verified changes"
hermes schedule add "0 0 * * 0" "Run full verification suite on all specs"
```

## 8. Verify Everything Works

```bash
# 1. Local CLI
hermes
> /lux-health
🟢 ALL SYSTEMS GO

# 2. Telegram
# Message your bot: "/lux-health"
# Should respond with diagnostics

# 3. Pi integration
pi
# Status bar should show: 🛡️ N protected · verified OK

# 4. Automated verification
cd any-project
echo "function add(a,b) { return a+b; }" > test.js
pi "add a spec for the add function"
# Agent calls capture_spec → function is protected
```

## The Complete Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR PHONE                            │
│  Telegram: "Fix the login timeout bug in signalengine"   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 HERMES GATEWAY                           │
│  • Receives Telegram message                             │
│  • Routes to Hermes Agent                                │
│  • Sends response back to Telegram                       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 HERMES AGENT                             │
│  • soul.md: LUX Celestial Coordinator                    │
│  • Memory: Honcho dialectic user model                   │
│  • Skills: TDD + PDD + LUX verification                  │
│  • Scheduler: Health checks, daily reports               │
└────────┬─────────────────────────┬──────────────────────┘
         │                         │
┌────────▼──────────┐    ┌─────────▼──────────────────────┐
│   OMP / PI        │    │   LUX ENGINE                    │
│   • Hashline edits│    │   • SpecVerifier                 │
│   • LSP + DAP     │    │   • Property test generator      │
│   • 40+ providers │    │   • Type-level proofs            │
│   • Subagents     │    │   • Zero-friction extension      │
└───────────────────┘    └────────────────────────────────┘
```

## Quick Reference

| What | Command |
|------|---------|
| Start chatting | `hermes` |
| Start gateway (Telegram) | `hermes gateway start` |
| Change model | `hermes model` |
| Check health | `hermes doctor` |
| Verify specs | `lux verify` |
| Create spec | `lux spec add <function>` |
| Show Pi protection | `/lux` in Pi |
| Health diagnostics | `/lux-health` in Hermes or Pi |
| Code review with proof | `lux review-proof` |

## The Experience

```
Monday 9:00 AM — Hermes auto-runs health check:
  "🩺 3 projects healthy. 1 dependency outdated in ecommerce-clean.
   Auto-updated lodash 4.17.21 → 4.17.22. All tests pass."

Monday 2:00 PM — You're at a coffee shop:
  Phone → Telegram: "Refactor the payment module to async"
  Hermes on your Mac:
    1. specs loaded for processPayment, validateCart, applyDiscount
    2. Refactors each function
    3. Auto-verifies: 45/45 edge cases pass
    4. Commits with proof evidence
  Telegram: "✅ Refactored. 45/45 specs pass. Commit: a3f2b1c"

Monday 10:00 PM — You're asleep:
  Hermes scheduled job runs full verification suite
  All specs across all projects verified
  Report saved to ~/.hermes/reports/

Tuesday 8:00 AM — You wake up:
  Telegram: "🌅 Overnight verification: 847 specs verified. 0 failures.
   1 suggestion: ecommerce-clean/src/cart.ts:142
   Consider adding edge case for empty cart with discount code."
```

**You think it. Hermes builds it. LUX proves it. You ship it.**
