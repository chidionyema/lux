# LUX Voice — Continuous Frictionless Voice Architecture

**Talk to your proofs. Code with your voice. Zero clunk.**

---

## The Vision

Current state: Type into Telegram. Wait. Read response. Type again. Clunky.

Target state: Put in AirPods. "LUX, the checkout page is broken again." LUX reads your code, finds the bug, writes the fix, verifies all specs, and responds: "Fixed. The discount calculation was off by one. 847 specs verified. Want me to deploy?"

No typing. No waiting. No switching contexts. Continuous conversation with an agent that proves everything it does.

---

## Architecture

Building on **[StreamCoreAI](https://github.com/streamcoreai/streamcore-server)** — the most mature open-source real-time voice agent server:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (Any Device)                          │
│                                                                  │
│  iPhone · Android · Mac · Windows · Web · Watch · CarPlay       │
│                                                                  │
│  Mic ──→ WebRTC (Opus audio) ──→ ┌──────────────────────────┐  │
│  Speaker ←── WebRTC (Opus) ←─── │   LUX VOICE SERVER (Go)   │  │
│                                  │                            │  │
│  DataChannel ←── events ←─────── │  VAD → STT → LLM → TTS    │  │
│  (transcripts, tool calls,       │  (streaming, overlapped)   │  │
│   verification results)          │                            │  │
│                                  │  Barge-in: interrupt mid-  │  │
│                                  │  response just by talking  │  │
│                                  └────────────┬───────────────┘  │
│                                               │                  │
└───────────────────────────────────────────────┼──────────────────┘
                                                │
                               ┌────────────────┼────────────────┐
                               │                │                │
                          ┌────▼────┐    ┌──────▼──────┐   ┌────▼────┐
                          │  STT     │    │   LLM        │   │  TTS     │
                          │ Deepgram │    │ Hermes Agent │   │ ElevenLabs│
                          │ OpenAI   │    │ (Gemini/     │   │ Cartesia │
                          │ Local    │    │  DeepSeek/   │   │ Edge TTS │
                          │ Whisper  │    │  MiniMax)    │   │ Local    │
                          └─────────┘    │               │   └─────────┘
                                         │ + LUX Engine  │
                                         │ (specs,       │
                                         │  proofs,      │
                                         │  verification)│
                                         └───────────────┘
```

---

## The Conversation Flow

### No More Request-Response

```
CURRENT (clunky):
  User: [types] "fix login bug"
  [waits 5-30 seconds]
  Agent: "Fixed. Commit a3f2b1c."
  User: [types] "did it pass verification?"
  [waits 3 seconds]
  Agent: "Yes, 12/12 specs pass."
  User: [types] "deploy it"
  ...

LUX VOICE (frictionless):
  User: "LUX, is the login fix ready?"
  Agent: "Yes. 12 specs pass, no regressions. Deploying now."
  User: "Wait — did you check the rate limit edge case?"
  Agent: [interrupted mid-sentence] "Checking... yes, covered. 
          Spec 'rate_limit_handled' passes with 1000 samples."
  User: "Good. Deploy."
  Agent: "Done. Health check in 30 minutes."
```

### Key Capabilities

| Feature | How It Works |
|---------|-------------|
| **Always listening** | Local wake word "LUX" (offline, on-device, privacy-preserving). No audio leaves the device until wake word detected. |
| **Barge-in** | Start talking while agent is speaking → agent stops, processes your interruption. Natural conversation. |
| **Streaming response** | Agent starts speaking before full response is generated. Sub-second first-word latency. |
| **Verification audio** | "12 specs pass" spoken aloud. "2 specs FAILED" spoken with urgency. Proof is audible. |
| **Context carryover** | "Deploy it" — agent knows "it" means the fix from 30 seconds ago. Conversation memory. |
| **Multi-device** | Start on phone in car, continue on desktop when you arrive. Session handoff via Hermes memory. |
| **Voice + screen** | Complex output (diffs, dashboards) sent to phone/watch screen while agent speaks summary. |

---

## Integration With Hermes + LUX

LUX Voice is NOT a separate agent. It's the SAME Hermes agent, accessed via voice instead of text:

```
LUX Voice Server (Go, StreamCoreAI)
  │
  │  Audio → Text (STT)
  │  Text → Agent (Hermes CLI, same as typing)
  │  Agent response → Speech (TTS)
  │
  └── Talks to the SAME Hermes agent
      Same memory (MEMORY.md)
      Same specs (~/.lux/specs/)
      Same proofs (SpecVerifier)
      Same cron jobs
      Same Telegram bot (text still works too)
```

### What Changes vs. Current Setup

| Component | Current | With LUX Voice |
|-----------|---------|----------------|
| Input | Type text | Speak naturally |
| Output | Read text | Listen + glance at screen |
| Latency | 5-30 seconds | <1 second first word |
| Context | Per-message | Continuous conversation |
| Devices | Telegram app | Phone, watch, desktop, car |
| Wake | Open app, type | "LUX" — hands-free |

### What Stays The Same

| Component | Unchanged |
|-----------|-----------|
| Agent brain | Same Hermes + LUX |
| Model | Same DeepSeek/Gemini/MiniMax |
| Memory | Same MEMORY.md |
| Specs | Same verification engine |
| Cron jobs | Same schedules |
| Permissions | Same safety model |

---

## Implementation Plan

### Phase 1: Standalone Voice (Week 1-2)

Deploy StreamCoreAI as a sidecar to Hermes:

```bash
# Clone and configure
git clone https://github.com/streamcoreai/streamcore-server
cd streamcore-server
cp config.toml.example config.toml

# Configure to use Hermes as the LLM backend
# (StreamCoreAI calls Hermes CLI for agent responses)
```

```toml
# config.toml
[stt]
provider = "deepgram"
api_key = "${DEEPGRAM_API_KEY}"

[llm]
provider = "openai"
api_key = "${OPENAI_API_KEY}"
base_url = "https://api.deepseek.com/v1"
model = "deepseek-chat"
# System prompt loads LUX soul
system_prompt = "/Users/chidionyema/.hermes/SOUL.md"

[tts]
provider = "elevenlabs"
api_key = "${ELEVENLABS_API_KEY}"
voice_id = "pNInz6obpgDQGcFmaJgB"  # Adam — professional tone
```

### Phase 2: Hermes Integration (Week 2-3)

Wire StreamCoreAI to call Hermes for agent responses:

```go
// Custom LLM plugin that routes to Hermes
func (h *HermesLLM) Generate(ctx context.Context, messages []Message) (string, error) {
    // Convert voice transcript to Hermes prompt
    // Call Hermes CLI
    cmd := exec.Command("hermes", "-z", messages[len(messages)-1].Content)
    output, err := cmd.Output()
    return string(output), err
}
```

The voice server handles audio → text. Hermes handles text → agent response. TTS handles response → speech. LUX verification results are injected into the response.

### Phase 3: LUX Proof Audio (Week 3)

Add verification audio cues:

```
Agent speaking: "The checkout discount calculation has been fixed."
[verification runs]
Audio cue: soft chime
Agent: "847 specs verified. Zero failures."
[if failure]
Audio cue: alert tone
Agent: "WARNING: 2 specs failed. The rate_limit edge case returned null."
```

### Phase 4: Multi-Device + Wake Word (Week 4)

- **iOS/macOS app**: Native WebRTC client with local wake word (Apple's on-device speech recognition)
- **Watch app**: "LUX, health check" → speaks summary
- **CarPlay**: "LUX, what's the deploy status?"
- **Web**: Browser client for any device

---

## Privacy Architecture

```
┌─────────────────────────────────────────────────────────┐
│  ON DEVICE (never leaves)                                │
│                                                          │
│  • Wake word detection (local ML model)                  │
│  • Audio before wake word: DESTROYED immediately         │
│  • Voice activity detection (is someone talking?)        │
└──────────────────────┬──────────────────────────────────┘
                       │ Only after "LUX" wake word
┌──────────────────────▼──────────────────────────────────┐
│  STREAMING TO SERVER (encrypted, ephemeral)              │
│                                                          │
│  • Opus audio over WebRTC (DTLS-SRTP encrypted)         │
│  • STT processing (Deepgram/OpenAI — SOC 2 compliant)   │
│  • Transcript stored in session (encrypted at rest)     │
│  • Raw audio: DELETED after STT completes               │
│  • User can delete transcripts anytime                   │
└─────────────────────────────────────────────────────────┘
```

**What we NEVER do:**
- Record conversations without explicit opt-in
- Store raw audio (transcribed and deleted)
- Send audio to the LLM (text only)
- Use conversation data for training

---

## Quick Test (Today)

```bash
# StreamCoreAI can run locally in <5 minutes
git clone https://github.com/streamcoreai/streamcore-server
cd streamcore-server
cp config.toml.example config.toml
# Edit: set OPENAI_API_KEY to DeepSeek key, TTS to Edge (free)
docker build -t lux-voice .
docker run -p 8080:8080 lux-voice

# Open browser client → grant mic → talk
# "Fix the login bug in signalengine"
# → Routes to Hermes → LUX verifies → speaks result
```

---

## Why This Beats Current "Clunky" Integrations

| Current (Telegram Text) | LUX Voice |
|-------------------------|-----------|
| Open app, type, wait, read, type again | "LUX, fix the bug" — done |
| 5-30 second latency | <1 second first word |
| Lose context between messages | Continuous conversation |
| One device at a time | Phone → desktop → watch seamlessly |
| Can't code while driving | CarPlay voice coding |
| Need hands free? Can't. | "LUX, health check" from AirPods |

**The agent is the same. The experience is transformed.**
