# LUX — The Heavenly Experience: Setup & Usage Guide

**Always-on. Proof-driven. Accessible from anywhere.**

---

## What's Installed

| Component | Version | Location |
|-----------|---------|----------|
| **Hermes Agent** | v0.16.0 | `~/.hermes/` |
| **LUX Soul** | v1.0 | `~/.hermes/SOUL.md` |
| **LUX PDD Skill** | v1.0 | `~/.hermes/skills/lux-proof-driven-development/` |
| **LUX Proof Engine** | v0.2.0 | `~/Documents/code/lux/` |
| **LUX Pi Extensions** | v1.0 | `~/Documents/code/lux/lux-zero-friction.ts` |
| **DeepSeek V4** | Flash | Primary model |
| **Gemini 3 Flash** | Preview | Auxiliary (vision, search, compression) |

## Quick Reference

```bash
# Core commands
hermes                    # Start interactive session (TUI)
hermes -z "task"          # One-shot prompt
hermes doctor             # System health check
hermes model              # Change model/provider
hermes gateway start      # Start Telegram/Discord/etc
hermes gateway setup      # Configure messaging platforms
hermes schedule add       # Add cron job
hermes update             # Update Hermes

# LUX commands
lux verify                # Verify all project specs
lux spec add <fn>         # Create a specification
lux generate-tests <fn>   # Generate property tests from spec

# Pi commands (when using OMP/pi)
pi                        # Start pi coding agent
/lux                      # LUX status dashboard
/lux-health               # Live diagnostic
/verify-specs             # List project specs
/verify-hook              # Install git pre-commit verification hook
```

## Daily Workflow

### Morning: Health Check

```bash
# Hermes auto-runs on schedule, but you can trigger:
hermes -z "Run health check on all my projects"
```

### During the Day: Code from Anywhere

**At your desk:**
```bash
cd my-project
pi                    # Start pi coding agent with LUX protection active
```

**On your phone (once Telegram is set up):**
```
Message your bot: "Fix the login timeout bug in signalengine"
→ Hermes processes on your Mac
→ Auto-verifies with LUX
→ Replies with commit hash and proof summary
```

### Before Commits: Verify

```bash
lux verify            # Verify all project specs
npm test              # Run the test suite
# Both must pass before committing
```

### End of Day: Wrap Up

```bash
hermes -z "Summarize today's changes and verified specs"
```

## Features by Access Method

| Feature | CLI (`hermes`) | Telegram | Pi (`pi`) |
|---------|---------------|----------|-----------|
| Code generation | ✅ | ✅ | ✅ |
| Formal verification | ✅ `lux verify` | ✅ via terminal | ✅ Auto on edit |
| Web search | ✅ | ✅ | ✅ |
| Browser automation | ✅ | ✅ | — |
| Scheduled tasks | ✅ `hermes schedule` | ✅ cron delivery | — |
| File operations | ✅ | ✅ | ✅ |
| Memory (cross-session) | ✅ | ✅ | — |
| Code review | ✅ `/review-prs` | ✅ | ✅ |
| TDD enforcement | ✅ Skill | ✅ Skill | — |
| PDD enforcement | ✅ Skill | ✅ Skill | ✅ Extension |

## Configuration Files

```
~/.hermes/
├── config.yaml          # Model, terminal, tools, skills config
├── .env                 # API keys (DeepSeek, Gemini, MiniMax)
├── SOUL.md              # LUX Celestial Coordinator personality
├── skills/              # 74 skills (TDD, PDD, debugging, etc.)
├── memories/
│   ├── MEMORY.md        # Agent's persistent notes (auto-managed)
│   └── USER.md          # User profile (auto-managed)
├── sessions/            # Session logs
├── logs/                # Execution logs
└── cron/                # Scheduled task definitions
```

## Next Steps (Setup Remaining)

### 1. Fix MiniMax Key
The current MiniMax key in `~/.hermes/.env` is invalid. Get a new one at [platform.minimax.io](https://platform.minimax.io) and update:
```bash
hermes config set MINIMAX_API_KEY <new_key>
```

### 2. Set Up Telegram
```bash
# Create bot: message @BotFather on Telegram
# → /newbot → choose name → copy token

# Get your ID: message @userinfobot on Telegram

# Configure Hermes
hermes gateway setup
# → Select: Telegram
# → Enter bot token
# → Enter your Telegram ID

# Start gateway (keeps running in background)
hermes gateway start
```

### 3. Add Scheduled Automations
```bash
# Morning health check (9 AM daily)
hermes schedule add "0 9 * * *" "Run health check on all projects and report any issues"

# Evening summary (6 PM daily)
hermes schedule add "0 18 * * *" "Summarize today's verified changes across all projects"

# Weekly full verification (Sunday midnight)
hermes schedule add "0 0 * * 0" "Run lux verify on all projects with specs"
```

### 4. Migrate Config
```bash
hermes doctor --fix
```

## How LUX Protection Works (in Pi)

When you're coding with `pi`:

1. **Auto-detect**: On session start, LUX discovers specs from `__tests__/`
2. **Auto-verify**: After every edit, silently verifies against specs
3. **Silent PASS**: You never see successful verifications
4. **Alerted FAIL**: Only notified when an edit breaks expectations
5. **Status bar**: Always shows `🛡️ N protected · verified OK`

```bash
# Install the extension (one-time)
cp ~/Documents/code/lux/lux-zero-friction.ts ~/.pi/agent/extensions/

# Then just use pi normally — protection is automatic
cd any-project
pi
```

## How PDD Works (in Hermes)

When using Hermes for coding:

```
/skill lux-proof-driven-development

Then tell Hermes:
"Add a calculateDiscount function with these specs:
 - Input: total (number), tier (bronze|silver|gold|platinum)
 - Output: discount amount (0 ≤ output ≤ total)
 - Platinum gets ≥20%, gold gets ≥10%

 Write the spec, implement it, and verify."
```

Hermes will:
1. Write the formal specification
2. Implement the function
3. Run the verifier (1000 random samples)
4. Report: "✅ 1000/1000 clauses pass"

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `hermes: command not found` | `source ~/.zshrc` or add `~/.local/bin` to PATH |
| Model not responding | `hermes doctor` → check API connectivity |
| DeepSeek key expired | Update `OPENAI_API_KEY` in `~/.hermes/.env` |
| Pi extension not loading | Check `~/.pi/agent/extensions/lux-zero-friction.ts` exists |
| Skills not appearing | `hermes /reload-skills` |
| Verification fails | `lux verify --verbose` for detailed output |
