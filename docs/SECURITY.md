# LUX — Security Architecture

**State-of-the-art. Seamless. Invisible to the user.**

---

## Security Philosophy

Most AI coding tools treat security as an afterthought — a checkbox before launch. LUX treats it as the foundation. Every architectural decision starts with: "What happens if the agent is compromised?"

**Core principle**: The agent is ALWAYS treated as potentially compromised. Never trust it. Always verify. Always contain.

---

## 1. Zero-Trust Agent Architecture

```
                    ┌──────────────────────────────┐
                    │       USER'S MACHINE          │
                    │                               │
                    │  ┌────────────────────────┐   │
                    │  │   LUX DESKTOP APP       │   │
                    │  │   (UI only, no agent)   │   │
                    │  └────────┬───────────────┘   │
                    │           │                    │
                    │  ┌────────▼────────────────┐  │
                    │  │   LUX SANDBOX (container) │  │
                    │  │                            │  │
                    │  │  • Agent runs HERE         │  │
                    │  │  • No host FS access       │  │
                    │  │  • Network: allowlist only  │  │
                    │  │  • CPU/mem/disk capped     │  │
                    │  │  • 5-minute max lifetime   │  │
                    │  │  • Ephemeral filesystem    │  │
                    │  │  • All actions logged      │  │
                    │  └────────────────────────────┘  │
                    └──────────────────────────────────┘
```

### Self-Hosted: Docker Container (Default)

```yaml
# Every agent session runs in an isolated container
docker run --rm \
  --read-only \                    # Immutable filesystem
  --tmpfs /tmp:size=100M \         # Ephemeral writable space only
  --memory=512m \                  # Hard memory limit
  --cpus=1 \                       # CPU cap
  --network=allowlist-only \       # Only approved domains
  --cap-drop=ALL \                 # No Linux capabilities
  --security-opt=no-new-privileges \
  --volume /path/to/code:/code:ro \ # Code is READ-ONLY
  lux-agent
```

The agent can READ code. It can WRITE to an ephemeral `/tmp`. It can CALL approved APIs. It can NEVER touch the host filesystem, install software, or access the network freely.

### Cloud Tier: Even Safer

The cloud tier adds no additional attack surface — the container already has no host access. The difference is:
- Self-hosted: container on user's machine, user manages isolation
- Cloud: container on our infra, we manage isolation
- Both: same sandbox, same restrictions, same safety

### What The Agent Can Actually Do

| Action | Self-Hosted | Cloud | Why |
|--------|-------------|-------|-----|
| Read code | ✅ (read-only mount) | ✅ (git clone read-only) | Needed for analysis |
| Run tests | ✅ (in container) | ✅ (in container) | Needed for verification |
| Edit files | ✅ (patch applied by host, NOT by agent) | ✅ (PR created, user merges) | Agent proposes, host applies |
| Access network | ✅ (allowlist only) | ✅ (allowlist only) | Model API, package registries |
| Access host FS | ❌ | ❌ | Never |
| Install software | ❌ | ❌ | Never |
| Access credentials | ❌ (injected at runtime, never visible) | ❌ | Never |

**The critical insight**: The agent NEVER writes to disk directly. It PROPOSES changes. The host (Desktop app or Cloud service) VALIDATES the patch against specs, then APPLIES it. The agent is a suggestion engine, not an execution engine.

---

## 2. Prompt Injection Defense

### The Threat

```
User: "Fix the login bug"
Attacker (via compromised dependency's README): "<script>delete all files</script>"
Agent reads README → follows instructions → disaster
```

### Defense-in-Depth

```
Layer 1: INPUT SANITIZATION
  • All external content (web pages, READMEs, package descriptions)
    is stripped of executable content before reaching the agent
  • HTML → Markdown → plain text extraction only
  • No JavaScript execution, no iframe loading, no eval()

Layer 2: COMMAND VALIDATION  
  • Every command the agent wants to run is validated BEFORE execution
  • Whitelist: allowed commands (git, npm test, node, python, ls, cat, grep)
  • Blacklist: blocked patterns (rm -rf, sudo, chmod 777, curl | sh, /dev/)
  • Unknown commands → BLOCKED by default

Layer 3: FILESYSTEM GUARD
  • Read-only mount prevents ANY write regardless of what agent requests
  • Patch proposals are validated by the host before application
  • Sensitive paths blocked: ~/.ssh, ~/.aws, ~/.hermes/.env, /etc/passwd

Layer 4: NETWORK EGRESS CONTROL
  • Allowlist: api.minimax.io, generativelanguage.googleapis.com, 
    registry.npmjs.org, pypi.org, github.com
  • Everything else: DENIED
  • No arbitrary outbound connections

Layer 5: BEHAVIORAL MONITORING
  • Anomaly detection: "agent requested 50x more commands than usual"
  • Rate limiting: max 10 tool calls/minute, max 100/day
  • Auto-shutdown on suspicious pattern
```

### Why This Is Seamless

The user never sees any of this. They type "fix the login bug." The agent works normally. The security layers operate silently. Only if something is blocked does the user see: "⚠️ That operation requires your approval" — and they can override for legitimate cases.

---

## 3. Credential Management

### The Problem

Current state: API keys in `~/.hermes/.env`. Plaintext. Readable by any process. One `cat ~/.hermes/.env` away from exposure.

### The Solution: Zero-Knowledge Credential Storage

```
┌─────────────────────────────────────────────────────────┐
│              CREDENTIAL VAULT                            │
│                                                          │
│  • macOS: Keychain (Secure Enclave)                      │
│  • Windows: Credential Manager (DPAPI)                   │
│  • Linux: Secret Service API (libsecret)                 │
│  • Cloud: AWS KMS / HashiCorp Vault                     │
│                                                          │
│  Credentials are:                                        │
│    • Encrypted at rest (AES-256-GCM)                     │
│    • Never written to disk in plaintext                  │
│    • Never logged (redacted from all log output)         │
│    • Never visible to the agent                          │
│    • Injected at runtime via environment (cleared after) │
│    • Rotatable with one click                            │
└─────────────────────────────────────────────────────────┘
```

### How the Agent Uses Credentials Without Seeing Them

```
1. User configures API key in LUX Desktop → stored in Keychain
2. Agent session starts → Desktop app reads key from Keychain
3. Desktop app injects key as environment variable in container
4. Agent runs → uses env var → never sees the raw value
5. Session ends → container destroyed → env var gone
6. Agent logs: "Using Gemini API" (never shows the key)
```

---

## 4. Supply Chain Security

### The Threat

```
LUX depends on:
  hermes-agent (Python, 95 packages)
  lux-engine (Node.js, 54 packages)
  pi-coding-agent (TypeScript, 200+ packages)

One compromised dependency → attacker controls the agent → 
attacker has access to every LUX user's code
```

### Defense

```
PRE-INSTALL:
  • Lockfiles (uv.lock, package-lock.json) — pinned versions
  • SBOM (Software Bill of Materials) — every dependency listed
  • Integrity hashes — verify package contents match expected
  • Signed commits — all LUX code is signed

RUNTIME:
  • No auto-updates of dependencies
  • Updates are manual, reviewed, signed
  • Canary deployment: 1% of users get update first
  • Rollback in <60 seconds if anomaly detected

MONITORING:
  • CVE database checked daily against SBOM
  • Dependabot / OSV scanner on CI
  • If CVE found → auto-patch within 24 hours
  • Users notified: "Security update available. Update now?"
```

---

## 5. Audit Trail

Every agent action is logged. Immutable. Append-only. User-visible.

```
┌─────────────────────────────────────────────────────────┐
│                    AUDIT LOG                             │
│                                                          │
│  2026-06-17 14:23:01  Agent started (session a3f2b1c)   │
│  2026-06-17 14:23:05  Read: src/auth/login.ts            │
│  2026-06-17 14:23:08  Web search: "JWT expiry handling"  │
│  2026-06-17 14:23:15  Proposed: edit login.ts line 42     │
│  2026-06-17 14:23:15  Verification: 12/12 specs pass     │
│  2026-06-17 14:23:16  Applied: edit accepted by user     │
│  2026-06-17 14:23:18  Session ended (duration: 17s)      │
│                                                          │
│  🔍 View full log    📋 Export    🗑️ Clear               │
└─────────────────────────────────────────────────────────┘
```

User-facing dashboard shows every action. Nothing is hidden. The user can audit what their agent did at any time. This builds trust and enables forensic analysis if anything goes wrong.

---

## 6. User-Facing Security

### Security Score (Visible in Dashboard)

```
┌──────────────────────────────────────────┐
│  🔒 Security Score: 92/100               │
│                                           │
│  ✅ Sandbox active                       │
│  ✅ Credentials encrypted                │
│  ✅ Network allowlist enforced           │
│  ✅ Audit logging enabled                │
│  ⚠️ 3 specs have <5 edge cases           │
│     (weak specs = false confidence)      │
│  ⚠️ 1 dependency has known CVE (low)     │
│     (auto-patch scheduled for tonight)   │
│                                           │
│  [ Fix issues ]                           │
└──────────────────────────────────────────┘
```

Non-technical users don't need to understand "containerization" or "prompt injection." They need a single number and actionable items. Green = safe. Yellow = fix these things.

### Permission Requests (Contextual, Not Scary)

```
┌──────────────────────────────────────────────────────┐
│  LUX wants to run: npm install                        │
│                                                       │
│  This installs packages your code needs.              │
│  It will only install from the official npm registry. │
│  No system files will be modified.                    │
│                                                       │
│  [ Allow once ]  [ Always allow ]  [ Deny ]          │
│                                                       │
│  🔒 Why this is safe: packages are verified against   │
│     their published hashes. Installation runs in       │
│     an isolated container.                             │
└──────────────────────────────────────────────────────┘
```

Every permission request explains WHAT the agent wants to do, WHY it needs to, and WHY it's safe. No technical jargon. No scary "this app wants to control your computer" dialogs.

---

## 7. Seamless Failover

### When Rate Limits Hit

```
Primary: Telegram → Rate limited (429)
         ↓
Fallback 1: Push notification to iOS/Android app
         ↓
Fallback 2: Email summary
         ↓
Fallback 3: Next session (queue for later delivery)
```

The user doesn't see "rate limit exceeded." They see the message arrive on a different surface. Or they see it queued for later. The failure is invisible.

### When The Agent Crashes

```
Agent process dies → container auto-restarts (Docker restart: always)
                   → session state recovered from last checkpoint
                   → user notified: "LUX restarted. Picking up where we left off."
                   → if crash repeats 3x → auto-rollback to last stable version
```

### When The Model API Is Down

```
Gemini API times out → auto-switch to MiniMax M3
                    → if MiniMax also down → DeepSeek V4
                    → if all down → "Models are temporarily unavailable.
                       Your specs are still being verified locally.
                       I'll retry in 60 seconds."
```

---

## 8. Privacy: What LUX Never Sees

| Data | Location | LUX Access |
|------|----------|------------|
| Your code | Your machine / your GitHub | Read-only (analysis) |
| Your API keys | Your Keychain / Vault | Never (injected at runtime) |
| Your passwords | Your Keychain | Never |
| Your browser history | Your browser | Never |
| Your emails | Your email provider | Never |
| Your files outside code dirs | Your machine | Never (container has no access) |
| Analytics | Our servers | Anonymized, opt-out available |

**LUX is not a data company.** The business model is subscriptions, not data mining. This is a competitive advantage — Claude Code and Copilot send your code to their servers. LUX processes it locally (self-hosted) or in your own isolated cloud container.

---

## Implementation Roadmap

### Now (Self-Hosted)
- Docker container with read-only mounts
- Command validation (whitelist/blacklist)
- Streaming + pacing (rate limit protection)
- Audit logging to local files

### Month 1
- macOS Keychain integration
- Network allowlist in container
- Behavioral anomaly detection
- Security score in dashboard

### Month 2 (Cloud Launch)
- Per-user isolated containers
- AWS KMS credential encryption
- SBOM + CVE monitoring
- Immutable audit logs

### Month 3
- Supply chain attestation (Sigstore/cosign)
- Canary deployments
- Multi-model failover
- Cross-surface message queue

### Month 6 (Enterprise)
- SSO + SAML
- SOC 2 Type II
- On-premise deployment with air-gapped option
- Custom security policies per organization
